# zig-webgpu-animation-mobile-120-fps

Mobile-first Zig + WebGPU animation gallery built as a web app first, with a clean path to package the experience for iOS later.

## Stack

- React + TypeScript app shell
- WebGPU renderer for the particle gallery
- Zig compiled to WebAssembly for physics/simulation
- PWA shell with install metadata and offline caching

## Getting Started

```bash
bun install
bun run dev
```

The dev command compiles the Zig engine first, copies the generated `engine.wasm` into the web app, and then starts Vite.

If you prefer npm, `npm install` and `npm run dev` work too.

## Production Build

```bash
bun run build
```

## Engine Tests

```bash
bun run test:engine
```

## Notes

- The initial engine exposes a stable WebAssembly boundary and a stubbed external-kernel adapter so real Fortran-backed kernels can be integrated later.
- The current milestone is web-first. For iOS packaging, add a thin `WKWebView` wrapper around the built web app rather than forking the rendering logic.
