import { useEffect, useRef } from "react";
import type {
  CapabilityState,
  FrameStats,
  PointerSample,
  QualityProfile,
  SceneDefinition
} from "@shared";
import { loadAnimationEngine, type WasmAnimationEngine } from "../engine/engine";
import { WebGpuParticleRenderer } from "../engine/renderer";

interface CanvasStageProps {
  quality: QualityProfile;
  scene: SceneDefinition;
  onCapabilityChange: (state: CapabilityState) => void;
  onStats: (stats: FrameStats) => void;
}

const MAX_DPR_BY_QUALITY: Record<QualityProfile, number> = {
  high: 2.4,
  balanced: 2,
  battery: 1.5
};

export function CanvasStage({
  quality,
  scene,
  onCapabilityChange,
  onStats
}: CanvasStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<WasmAnimationEngine | null>(null);
  const rendererRef = useRef<WebGpuParticleRenderer | null>(null);
  const animationRef = useRef<number | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const pointerRef = useRef<PointerSample>({
    active: false,
    x: 0,
    y: 0,
    dx: 0,
    dy: 0
  });
  const pixelSizeRef = useRef({ width: 0, height: 0 });
  const fpsRef = useRef(60);
  const sceneRef = useRef(scene);
  const qualityRef = useRef(quality);
  const onStatsRef = useRef(onStats);
  const onCapabilityChangeRef = useRef(onCapabilityChange);

  sceneRef.current = scene;
  qualityRef.current = quality;
  onStatsRef.current = onStats;
  onCapabilityChangeRef.current = onCapabilityChange;

  useEffect(() => {
    let cancelled = false;

    const syncSize = () => {
      const canvas = canvasRef.current;
      const engine = engineRef.current;
      const renderer = rendererRef.current;
      if (!canvas || !engine || !renderer) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }

      const devicePixelRatio = Math.min(
        window.devicePixelRatio || 1,
        MAX_DPR_BY_QUALITY[qualityRef.current]
      );
      pixelSizeRef.current = {
        width: Math.max(1, Math.floor(rect.width * devicePixelRatio)),
        height: Math.max(1, Math.floor(rect.height * devicePixelRatio))
      };

      engine.resize(rect.width, rect.height, devicePixelRatio);
      renderer.resize(pixelSizeRef.current.width, pixelSizeRef.current.height);
    };

    const applySceneState = () => {
      const engine = engineRef.current;
      if (!engine) {
        return;
      }

      engine.setQuality(qualityRef.current);
      engine.loadScene(sceneRef.current.engineSceneId);
      syncSize();
    };

    const animate = (timestamp: number) => {
      if (cancelled) {
        return;
      }

      const engine = engineRef.current;
      const renderer = rendererRef.current;
      if (!engine || !renderer) {
        animationRef.current = window.requestAnimationFrame(animate);
        return;
      }

      const lastFrame = lastFrameRef.current ?? timestamp - 16.6;
      const dt = Math.min(33, Math.max(8, timestamp - lastFrame));
      lastFrameRef.current = timestamp;

      engine.updatePointer(pointerRef.current);
      engine.step(dt);
      const frame = engine.frame();
      renderer.render({
        particleData: frame.particleData,
        particleCount: frame.particleCount,
        particleStride: frame.particleStride,
        palette: sceneRef.current.palette,
        pixelWidth: pixelSizeRef.current.width,
        pixelHeight: pixelSizeRef.current.height,
        timeSeconds: timestamp / 1000
      });

      const fps = fpsRef.current * 0.88 + (1000 / dt) * 0.12;
      fpsRef.current = fps;

      onStatsRef.current({
        fps,
        frameMs: dt,
        energy: frame.energy,
        particleCount: frame.particleCount,
        quality: qualityRef.current,
        kernelMode: engine.kernelMode
      });

      animationRef.current = window.requestAnimationFrame(animate);
    };

    async function boot() {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      onCapabilityChangeRef.current({ status: "loading" });

      try {
        const [engine, renderer] = await Promise.all([
          loadAnimationEngine(),
          WebGpuParticleRenderer.create(canvas)
        ]);

        if (cancelled) {
          renderer.destroy();
          return;
        }

        engineRef.current = engine;
        rendererRef.current = renderer;

        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR_BY_QUALITY[qualityRef.current]);
        engine.init({
          width: rect.width || 390,
          height: rect.height || 540,
          devicePixelRatio: dpr,
          quality: qualityRef.current
        });
        applySceneState();

        observerRef.current = new ResizeObserver(syncSize);
        observerRef.current.observe(canvas);
        window.addEventListener("resize", syncSize);
        syncSize();

        onCapabilityChangeRef.current({
          status: "ready",
          kernelMode: engine.kernelMode
        });
        animationRef.current = window.requestAnimationFrame(animate);
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "The renderer failed to initialize.";
        onCapabilityChangeRef.current({ status: "unsupported", reason });
      }
    }

    void boot();

    return () => {
      cancelled = true;
      if (animationRef.current !== null) {
        window.cancelAnimationFrame(animationRef.current);
      }
      lastFrameRef.current = null;
      observerRef.current?.disconnect();
      window.removeEventListener("resize", syncSize);
      rendererRef.current?.destroy();
      rendererRef.current = null;
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) {
      return;
    }

    engine.setQuality(quality);
    engine.loadScene(scene.engineSceneId);
  }, [quality, scene.engineSceneId]);

  const updatePointer = (
    clientX: number,
    clientY: number,
    active: boolean
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = 1 - ((clientY - rect.top) / rect.height) * 2;
    const previous = pointerRef.current;

    pointerRef.current = {
      active,
      x,
      y,
      dx: x - previous.x,
      dy: y - previous.y
    };
  };

  return (
    <div className="stage-shell">
      <canvas
        aria-label={`${scene.title} animation stage`}
        className="stage-canvas"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          updatePointer(event.clientX, event.clientY, true);
        }}
        onPointerMove={(event) => {
          if (!pointerRef.current.active && event.pointerType !== "mouse") {
            return;
          }
          updatePointer(event.clientX, event.clientY, pointerRef.current.active);
        }}
        onPointerUp={(event) => {
          updatePointer(event.clientX, event.clientY, false);
        }}
        onPointerLeave={() => {
          pointerRef.current = { ...pointerRef.current, active: false, dx: 0, dy: 0 };
        }}
        ref={canvasRef}
      />
      <div className="stage-grid" />
    </div>
  );
}
