import type { ScenePalette } from "@shared";

const MAX_PARTICLES = 400;
const FLOATS_PER_PARTICLE = 8;

interface RenderFrameArgs {
  particleData: Float32Array;
  particleCount: number;
  particleStride: number;
  palette: ScenePalette;
  pixelWidth: number;
  pixelHeight: number;
  timeSeconds: number;
}

export class WebGpuParticleRenderer {
  #canvas: HTMLCanvasElement;
  #context: GPUCanvasContext;
  #device: GPUDevice;
  #pipeline: GPURenderPipeline;
  #quadBuffer: GPUBuffer;
  #instanceBuffer: GPUBuffer;
  #uniformBuffer: GPUBuffer;
  #uniformBindGroup: GPUBindGroup;
  #format: GPUTextureFormat;

  private constructor(
    canvas: HTMLCanvasElement,
    context: GPUCanvasContext,
    device: GPUDevice,
    format: GPUTextureFormat,
    pipeline: GPURenderPipeline,
    quadBuffer: GPUBuffer,
    instanceBuffer: GPUBuffer,
    uniformBuffer: GPUBuffer,
    uniformBindGroup: GPUBindGroup
  ) {
    this.#canvas = canvas;
    this.#context = context;
    this.#device = device;
    this.#format = format;
    this.#pipeline = pipeline;
    this.#quadBuffer = quadBuffer;
    this.#instanceBuffer = instanceBuffer;
    this.#uniformBuffer = uniformBuffer;
    this.#uniformBindGroup = uniformBindGroup;
  }

  static async create(canvas: HTMLCanvasElement): Promise<WebGpuParticleRenderer> {
    if (!("gpu" in navigator)) {
      throw new Error("WebGPU is not available in this browser.");
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance"
    });
    if (!adapter) {
      throw new Error("No WebGPU adapter was available.");
    }

    const device = await adapter.requestDevice();
    const context = canvas.getContext("webgpu") as GPUCanvasContext | null;
    if (!context) {
      throw new Error("Unable to create a WebGPU canvas context.");
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format,
      alphaMode: "premultiplied"
    });

    const shaderModule = device.createShaderModule({
      code: `
struct Uniforms {
  viewport: vec4<f32>,
  tint: vec4<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
  @location(0) corner: vec2<f32>,
  @location(1) center: vec2<f32>,
  @location(2) color: vec3<f32>,
  @location(3) size: f32,
  @location(4) velocity: vec2<f32>,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec3<f32>,
  @location(1) local: vec2<f32>,
  @location(2) glow: f32,
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let aspect = uniforms.viewport.x;
  let pointScale = uniforms.viewport.y;
  let size = input.size * pointScale;
  let offset = vec2<f32>(input.corner.x * size / aspect, input.corner.y * size);
  let velocityGlow = clamp(length(input.velocity) * 1.8 + 0.25, 0.0, 1.0);

  var output: VertexOutput;
  output.position = vec4<f32>(input.center + offset, 0.0, 1.0);
  output.color = mix(input.color, uniforms.tint.xyz, 0.18);
  output.local = input.corner;
  output.glow = velocityGlow;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let dist = length(input.local);
  if (dist > 1.0) {
    discard;
  }

  let ring = smoothstep(1.0, 0.15, dist);
  let core = smoothstep(0.45, 0.0, dist);
  let color = input.color * (0.74 + core * 0.72 + input.glow * 0.2);
  return vec4<f32>(color, ring * 0.9);
}
`
    });

    const uniformBuffer = device.createBuffer({
      label: "particle-uniform-buffer",
      size: Float32Array.BYTES_PER_ELEMENT * 8,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const quadBuffer = device.createBuffer({
      label: "quad-vertex-buffer",
      size: Float32Array.BYTES_PER_ELEMENT * 8,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });

    device.queue.writeBuffer(
      quadBuffer,
      0,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
    );

    const instanceBuffer = device.createBuffer({
      label: "particle-instance-buffer",
      size: MAX_PARTICLES * FLOATS_PER_PARTICLE * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" }
        }
      ]
    });

    const uniformBindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer
          }
        }
      ]
    });

    const pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: Float32Array.BYTES_PER_ELEMENT * 2,
            stepMode: "vertex",
            attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }]
          },
          {
            arrayStride: Float32Array.BYTES_PER_ELEMENT * FLOATS_PER_PARTICLE,
            stepMode: "instance",
            attributes: [
              { shaderLocation: 1, offset: 0, format: "float32x2" },
              { shaderLocation: 2, offset: 8, format: "float32x3" },
              { shaderLocation: 3, offset: 20, format: "float32" },
              { shaderLocation: 4, offset: 24, format: "float32x2" }
            ]
          }
        ]
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [
          {
            format,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one",
                operation: "add"
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add"
              }
            }
          }
        ]
      },
      primitive: {
        topology: "triangle-strip"
      }
    });

    return new WebGpuParticleRenderer(
      canvas,
      context,
      device,
      format,
      pipeline,
      quadBuffer,
      instanceBuffer,
      uniformBuffer,
      uniformBindGroup
    );
  }

  resize(pixelWidth: number, pixelHeight: number): void {
    if (this.#canvas.width === pixelWidth && this.#canvas.height === pixelHeight) {
      return;
    }

    this.#canvas.width = pixelWidth;
    this.#canvas.height = pixelHeight;
    this.#context.configure({
      device: this.#device,
      format: this.#format,
      alphaMode: "premultiplied"
    });
  }

  render({
    particleData,
    particleCount,
    particleStride,
    palette,
    pixelWidth,
    pixelHeight,
    timeSeconds
  }: RenderFrameArgs): void {
    if (particleCount === 0) {
      return;
    }

    this.resize(pixelWidth, pixelHeight);

    const uploadData = new Float32Array(particleCount * particleStride);
    uploadData.set(particleData.subarray(0, particleCount * particleStride));

    this.#device.queue.writeBuffer(this.#instanceBuffer, 0, uploadData);

    const tint = hexToRgb(palette.glow);
    const aspect = pixelWidth / Math.max(pixelHeight, 1);
    const pointScale = 0.9 + Math.min(pixelWidth, pixelHeight) / 2200;

    this.#device.queue.writeBuffer(
      this.#uniformBuffer,
      0,
      new Float32Array([
        aspect,
        pointScale,
        timeSeconds,
        0,
        tint[0],
        tint[1],
        tint[2],
        1
      ])
    );

    const commandEncoder = this.#device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          clearValue: {
            r: palette.clearColor[0],
            g: palette.clearColor[1],
            b: palette.clearColor[2],
            a: palette.clearColor[3]
          },
          loadOp: "clear",
          storeOp: "store",
          view: this.#context.getCurrentTexture().createView()
        }
      ]
    });

    renderPass.setPipeline(this.#pipeline);
    renderPass.setBindGroup(0, this.#uniformBindGroup);
    renderPass.setVertexBuffer(0, this.#quadBuffer);
    renderPass.setVertexBuffer(1, this.#instanceBuffer);
    renderPass.draw(4, particleCount);
    renderPass.end();

    this.#device.queue.submit([commandEncoder.finish()]);
  }

  destroy(): void {
    this.#quadBuffer.destroy();
    this.#instanceBuffer.destroy();
    this.#uniformBuffer.destroy();
    this.#device.destroy();
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const bigint = Number.parseInt(normalized, 16);
  return [
    ((bigint >> 16) & 255) / 255,
    ((bigint >> 8) & 255) / 255,
    (bigint & 255) / 255
  ];
}
