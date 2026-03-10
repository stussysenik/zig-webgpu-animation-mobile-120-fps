export type QualityProfile = "high" | "balanced" | "battery";

export interface ScenePalette {
  accent: string;
  glow: string;
  surface: string;
  clearColor: readonly [r: number, g: number, b: number, a: number];
}

export interface SceneDefinition {
  slug: string;
  engineSceneId: number;
  title: string;
  strapline: string;
  description: string;
  motionNote: string;
  defaultQuality: QualityProfile;
  palette: ScenePalette;
}

export interface EngineConfig {
  width: number;
  height: number;
  devicePixelRatio: number;
  quality: QualityProfile;
}

export interface PointerSample {
  active: boolean;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export interface FrameStats {
  fps: number;
  frameMs: number;
  energy: number;
  particleCount: number;
  quality: QualityProfile;
  kernelMode: string;
}

export interface CapabilityState {
  status: "loading" | "ready" | "unsupported";
  reason?: string;
  kernelMode?: string;
}

export const QUALITY_PROFILES: readonly QualityProfile[] = ["high", "balanced", "battery"];

export const QUALITY_LABELS: Record<QualityProfile, string> = {
  high: "High",
  balanced: "Balanced",
  battery: "Battery"
};

