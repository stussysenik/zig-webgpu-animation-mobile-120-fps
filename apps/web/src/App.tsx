import { startTransition, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { CapabilityState, FrameStats, QualityProfile } from "@shared";
import { QUALITY_LABELS, QUALITY_PROFILES } from "@shared";
import { CanvasStage } from "./components/CanvasStage";
import { SCENES } from "./lib/scenes";
import { usePwaInstall } from "./lib/pwa";

const INITIAL_STATS: FrameStats = {
  fps: 0,
  frameMs: 0,
  energy: 0,
  particleCount: 0,
  quality: "balanced",
  kernelMode: "booting"
};

export default function App() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [quality, setQuality] = useState<QualityProfile>(SCENES[0].defaultQuality);
  const [stats, setStats] = useState<FrameStats>(INITIAL_STATS);
  const [capability, setCapability] = useState<CapabilityState>({ status: "loading" });
  const install = usePwaInstall();

  const activeScene = SCENES[sceneIndex];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        cycleScene(1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        cycleScene(-1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sceneIndex]);

  const sceneBadges = useMemo(
    () => [
      "Zig physics",
      "WebGPU renderer",
      activeScene.motionNote,
      capability.kernelMode ? `Kernel ${capability.kernelMode}` : "Kernel booting"
    ],
    [activeScene.motionNote, capability.kernelMode]
  );

  function cycleScene(direction: 1 | -1) {
    startTransition(() => {
      setSceneIndex((current) => {
        const next = (current + direction + SCENES.length) % SCENES.length;
        return next;
      });
    });
  }

  return (
    <main
      className="shell"
      style={
        {
          "--accent": activeScene.palette.accent,
          "--glow": activeScene.palette.glow,
          "--surface": activeScene.palette.surface
        } as CSSProperties
      }
    >
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <section className="hero-panel panel reveal">
        <div className="hero-topline">
          <span className="brand-chip">zig-webgpu-animation-mobile-120-fps</span>
          <span className="status-chip">
            {capability.status === "ready" ? "WebGPU live" : capability.status === "loading" ? "Booting engine" : "Fallback mode"}
          </span>
        </div>

        <div className="hero-copy">
          <p className="eyebrow">Mobile-first animation gallery</p>
          <h1>{activeScene.title}</h1>
          <p className="lede">{activeScene.strapline}</p>
          <p className="body-copy">{activeScene.description}</p>
        </div>

        <div className="badge-row">
          {sceneBadges.map((badge) => (
            <span className="mini-badge" key={badge}>
              {badge}
            </span>
          ))}
        </div>
      </section>

      <section className="stage-panel panel reveal">
        <header className="stage-header">
          <div>
            <p className="stage-label">Interactive stage</p>
            <p className="stage-subtitle">Swipe the canvas or use the arrows to browse the gallery.</p>
          </div>
          <div className="stage-nav">
            <button aria-label="Previous scene" className="nav-button" onClick={() => cycleScene(-1)} type="button">
              ←
            </button>
            <button aria-label="Next scene" className="nav-button" onClick={() => cycleScene(1)} type="button">
              →
            </button>
          </div>
        </header>

        <CanvasStage
          onCapabilityChange={setCapability}
          onStats={setStats}
          quality={quality}
          scene={activeScene}
        />

        <div className="controls-row">
          <div className="segmented-control" role="tablist" aria-label="Quality profile">
            {QUALITY_PROFILES.map((profile) => (
              <button
                aria-selected={quality === profile}
                className={`segmented-button ${quality === profile ? "is-active" : ""}`}
                key={profile}
                onClick={() => setQuality(profile)}
                role="tab"
                type="button"
              >
                {QUALITY_LABELS[profile]}
              </button>
            ))}
          </div>

          {install.canInstall ? (
            <button className="install-button" onClick={() => void install.promptInstall()} type="button">
              Install PWA
            </button>
          ) : (
            <p className="install-hint">{install.installHint}</p>
          )}
        </div>

        {capability.status === "unsupported" ? (
          <p className="capability-warning">
            {capability.reason ??
              "WebGPU is unavailable in this browser. Open the app in a current Safari or Chromium build with WebGPU enabled."}
          </p>
        ) : null}
      </section>

      <section className="metrics-grid reveal">
        <article className="metric-card panel">
          <span>FPS</span>
          <strong>{stats.fps > 0 ? Math.round(stats.fps) : "…"}</strong>
          <small>Smoothed live refresh estimate</small>
        </article>
        <article className="metric-card panel">
          <span>Frame</span>
          <strong>{stats.frameMs > 0 ? `${stats.frameMs.toFixed(1)} ms` : "…"}</strong>
          <small>Measured simulation step</small>
        </article>
        <article className="metric-card panel">
          <span>Particles</span>
          <strong>{stats.particleCount || "…"}</strong>
          <small>WASM simulation payload</small>
        </article>
        <article className="metric-card panel">
          <span>Energy</span>
          <strong>{stats.energy > 0 ? stats.energy.toFixed(2) : "…"}</strong>
          <small>Average scene motion amplitude</small>
        </article>
      </section>

      <section className="gallery-panel panel reveal">
        <div className="gallery-heading">
          <div>
            <p className="stage-label">Scene gallery</p>
            <p className="stage-subtitle">Each scene shares the same Zig engine boundary and swaps only presets + motion logic.</p>
          </div>
        </div>
        <div className="gallery-strip">
          {SCENES.map((scene, index) => (
            <button
              className={`scene-card ${index === sceneIndex ? "is-active" : ""}`}
              key={scene.slug}
              onClick={() =>
                startTransition(() => {
                  setSceneIndex(index);
                  setQuality(scene.defaultQuality);
                })
              }
              type="button"
            >
              <span className="scene-card-index">0{index + 1}</span>
              <strong>{scene.title}</strong>
              <span>{scene.strapline}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
