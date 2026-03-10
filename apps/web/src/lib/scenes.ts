import type { SceneDefinition } from "@shared";

export const SCENES: readonly SceneDefinition[] = [
  {
    slug: "orbit-weave",
    engineSceneId: 0,
    title: "Orbit Weave",
    strapline: "Elastic halos that recoil and braid around your touch.",
    description:
      "A layered orbital spring field that feels alive under quick swipes and slow drags.",
    motionNote: "Three orbital bands, spring anchors, touch-driven swirl",
    defaultQuality: "high",
    palette: {
      accent: "#8ef6d3",
      glow: "#ffd090",
      surface: "#11323b",
      clearColor: [0.027, 0.086, 0.106, 1]
    }
  },
  {
    slug: "ripple-grid",
    engineSceneId: 1,
    title: "Ripple Grid",
    strapline: "A gridded wave sheet with tactile pulse and controlled rebound.",
    description:
      "A spring-loaded lattice tuned for directional ripples, ideal for showing touch latency and stability.",
    motionNote: "Grid anchors, phase-shifted wave motion, pressure ripple",
    defaultQuality: "balanced",
    palette: {
      accent: "#90cfff",
      glow: "#89f3ff",
      surface: "#14283a",
      clearColor: [0.032, 0.056, 0.109, 1]
    }
  },
  {
    slug: "bloom-field",
    engineSceneId: 2,
    title: "Bloom Field",
    strapline: "Dense embers that spiral inward, burst outward, and settle again.",
    description:
      "A radial particle bloom with asymmetrical motion and enough density to pressure-test mobile rendering.",
    motionNote: "Seeded bloom distribution, soft attractors, touch inversion",
    defaultQuality: "balanced",
    palette: {
      accent: "#ffb366",
      glow: "#ff7d66",
      surface: "#381d22",
      clearColor: [0.09, 0.038, 0.042, 1]
    }
  }
];

