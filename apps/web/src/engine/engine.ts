import type { EngineConfig, PointerSample, QualityProfile } from "@shared";

const ENGINE_URL = "/engine/engine.wasm";

const QUALITY_MAP: Record<QualityProfile, number> = {
  high: 0,
  balanced: 1,
  battery: 2
};

const KERNEL_MODE_MAP: Record<number, string> = {
  0: "zig-native-stub",
  1: "external"
};

interface EngineExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  init_engine: (width: number, height: number, dpr: number, quality: number) => void;
  resize: (width: number, height: number, dpr: number) => void;
  set_quality_profile: (quality: number) => void;
  load_scene: (sceneId: number) => void;
  update_pointer: (
    x: number,
    y: number,
    dx: number,
    dy: number,
    active: number
  ) => void;
  step: (dtMs: number) => void;
  get_particle_count: () => number;
  get_particle_stride_floats: () => number;
  get_particle_data_ptr: () => number;
  get_average_energy: () => number;
  get_kernel_mode: () => number;
}

interface EngineFrame {
  particleCount: number;
  particleStride: number;
  particleData: Float32Array;
  energy: number;
}

export class WasmAnimationEngine {
  readonly kernelMode: string;
  #exports: EngineExports;
  #particleStride: number;

  constructor(exports: EngineExports) {
    this.#exports = exports;
    this.#particleStride = exports.get_particle_stride_floats();
    this.kernelMode = KERNEL_MODE_MAP[exports.get_kernel_mode()] ?? "unknown";
  }

  init(config: EngineConfig): void {
    this.#exports.init_engine(
      config.width,
      config.height,
      config.devicePixelRatio,
      QUALITY_MAP[config.quality]
    );
  }

  resize(width: number, height: number, devicePixelRatio: number): void {
    this.#exports.resize(width, height, devicePixelRatio);
  }

  setQuality(quality: QualityProfile): void {
    this.#exports.set_quality_profile(QUALITY_MAP[quality]);
  }

  loadScene(sceneId: number): void {
    this.#exports.load_scene(sceneId);
  }

  updatePointer(pointer: PointerSample): void {
    this.#exports.update_pointer(
      pointer.x,
      pointer.y,
      pointer.dx,
      pointer.dy,
      pointer.active ? 1 : 0
    );
  }

  step(dtMs: number): void {
    this.#exports.step(dtMs);
  }

  frame(): EngineFrame {
    const particleCount = this.#exports.get_particle_count();
    const particleDataPtr = this.#exports.get_particle_data_ptr();
    const particleData = new Float32Array(
      this.#exports.memory.buffer,
      particleDataPtr,
      particleCount * this.#particleStride
    );

    return {
      particleCount,
      particleStride: this.#particleStride,
      particleData,
      energy: this.#exports.get_average_energy()
    };
  }
}

let enginePromise: Promise<WasmAnimationEngine> | null = null;

export async function loadAnimationEngine(): Promise<WasmAnimationEngine> {
  if (!enginePromise) {
    enginePromise = instantiateEngine();
  }

  return enginePromise;
}

async function instantiateEngine(): Promise<WasmAnimationEngine> {
  const response = await fetch(ENGINE_URL);
  if (!response.ok) {
    throw new Error(`Failed to load ${ENGINE_URL}: ${response.status}`);
  }

  const bytes = await response.arrayBuffer();
  const result = await WebAssembly.instantiate(bytes, {});
  return new WasmAnimationEngine(result.instance.exports as EngineExports);
}
