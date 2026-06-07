<a id="readme-top"></a>

<div align="center">
  <img src="docs/assets/readme/readme-hero.png" alt="Jingong Xiaozi robot-head navigation concept" width="860">

  <h1>Jingong Xiaozi</h1>

  <p>
    A robot-head landscape touch application for workshop navigation, dialog display, and backend-driven map directives.
  </p>

  <p>
    <a href="README.md">Chinese README</a>
    ·
    <a href="#quickstart"><strong>Quickstart</strong></a>
    ·
    <a href="#proof"><strong>Proof</strong></a>
    ·
    <a href="#gallery"><strong>Screenshots</strong></a>
    ·
    <a href="#backend"><strong>Backend Contract</strong></a>
    ·
    <a href="#release"><strong>Release</strong></a>
  </p>

  <p>
    <a href="https://github.com/zzw4257/jingongxiaozi/releases/tag/v0.1.0-map-structure-20260607"><img src="https://img.shields.io/github/v/release/zzw4257/jingongxiaozi?label=release" alt="GitHub release"></a>
    <a href="https://github.com/zzw4257/jingongxiaozi/releases/tag/v0.1.0-map-structure-20260607"><img src="https://img.shields.io/badge/APK-arm64--v8a-3DDC84?logo=android&logoColor=white" alt="Android arm64 APK"></a>
    <img src="https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white" alt="Tauri 2.x">
    <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=111111" alt="React 18">
    <img src="https://img.shields.io/badge/Three.js-0.184-000000?logo=threedotjs&logoColor=white" alt="Three.js 0.184">
    <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5.7">
    <img src="https://img.shields.io/badge/WeChat%20Mini%20Program-WebGL-07C160?logo=wechat&logoColor=white" alt="WeChat Mini Program WebGL">
    <img src="https://img.shields.io/badge/closed%20spaces-80-2563EB" alt="80 closed spaces">
    <img src="https://img.shields.io/badge/doorways-53-F59E0B" alt="53 doorways">
    <img src="https://img.shields.io/badge/alignment%20error-0.000-10B981" alt="alignment error 0.000">
    <img src="https://img.shields.io/badge/mini%20program-no%20WebView-07C160" alt="mini program no WebView">
    <img src="https://img.shields.io/github/repo-size/zzw4257/jingongxiaozi?label=repo%20size" alt="GitHub repo size">
    <img src="https://img.shields.io/github/last-commit/zzw4257/jingongxiaozi?label=last%20commit" alt="GitHub last commit">
  </p>

  <sub>The hero is a generated brand concept; every product image below is a real landscape runtime screenshot.</sub>
</div>

<a id="overview"></a>

## What It Is

Jingong Xiaozi is a field-facing guide application for an embedded robot-head display. Its primary user is not a desktop operator, but someone standing in front of a landscape touch panel and trying to understand where to go next.

The current map line is no longer the old rectangular block map. The runtime uses `public/map-models/jingong.glb` as the visual model and structured semantic data for rooms, corridors, doors, stairs, the 2.5F platform, and route topology. The legacy hand-authored map remains available as a hidden demo or fallback surface, but it is not the default map.

The product target is concrete:

- Start in a landscape touch experience instead of a shrunken desktop page.
- Keep the map closed, readable, and consistent across overview, single-floor, and split-floor views.
- Route through doors, corridors, stairs, and platforms instead of drawing wall-crossing straight lines.
- Let backend services send a room target without knowing map coordinates.
- Keep the mini-program branch self-contained with packaged WebGL assets and shared map data.

<a id="proof"></a>

## Proof

<p align="center">
  <img src="docs/assets/readme/map-route-202.png" alt="Route from 101 to 202-5 in the landscape 3D map" width="860">
  <br><sub>Real H5/mobile landscape screenshot: route from 101 to 202-5 through the public stair and the raised 202 platform.</sub>
</p>

| Gate | Current Evidence |
| --- | --- |
| Map data size | `53 rooms`, `53 door segments`, `80 spaces`, `16 centerlines` |
| Closed spaces | `npm run check:map` runs `scripts/verify-geometry.mjs` |
| Route constraints | `101 -> 104-2F01` and `101 -> 108-2F04` use internal stairs; `101 -> 202-5` uses the public stair and 202 platform |
| Model assets | `jingong.glb` and `jingong-fallback.glb` pass `scripts/verify-model-assets.mjs` |
| Model alignment | `16 control points`, `max error 0.000`, `avg error 0.000`, `53 doorways` |
| H5 build | `npm run build` passes TypeScript and Vite production build |
| Mini-program shell | `npm run check:miniprogram` blocks WebView, localhost, and full-map PNG fallback regressions |
| Android package | The release asset is an arm64-v8a APK; see the release page for the SHA-256 digest |

<a id="gallery"></a>

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/assets/readme/standby.png" alt="Landscape standby screen"><br><sub>Standby: the robot expression is the visual center.</sub></td>
    <td width="50%"><img src="docs/assets/readme/map-overview.png" alt="Landscape map overview"><br><sub>Overview: full 3D structure, floor relation, and navigation entry.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/assets/readme/map-single-1f.png" alt="First-floor single view"><br><sub>1F: rooms, corridors, stairs, and service spaces are separated.</sub></td>
    <td width="50%"><img src="docs/assets/readme/map-single-2f.png" alt="Second-floor single view"><br><sub>2F: independent upper rooms, public upper corridor, and the 202 platform remain distinct.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/assets/readme/map-raised202.png" alt="Raised 202 platform focus"><br><sub>Raised 202 platform: the platform and its lower support context are visible together.</sub></td>
    <td width="50%"><img src="docs/assets/readme/map-exploded.png" alt="Exploded floor view"><br><sub>Exploded view: only the presentation changes; route topology stays physical.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/assets/readme/map-layers-panel.png" alt="Map layer panel"><br><sub>Layer panel: landscape touch controls for floor and map state changes.</sub></td>
    <td width="50%"><img src="docs/assets/readme/map-route-104.png" alt="Route to the 104 upper space"><br><sub>104 upper route: the path must use the internal 104 stair.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/assets/readme/miniprogram-map-default.png" alt="Mini-program default map"><br><sub>Mini-program default map: packaged WebGL assets, no external H5 service.</sub></td>
    <td width="50%"><img src="docs/assets/readme/miniprogram-route-208.png" alt="Mini-program route map"><br><sub>Mini-program route view: shared map data and route semantics.</sub></td>
  </tr>
</table>

<a id="quickstart"></a>

## Quickstart

```bash
npm install
npm run dev
```

Useful entry URLs:

```text
http://127.0.0.1:5173/?mode=map
http://127.0.0.1:5173/?mode=map&targetRoomId=202-5&announce=summary,distance,direction,floorChange
http://127.0.0.1:5173/?mode=map&targetRoomId=104-2F01&announce=summary,distance,floorChange
```

Production web build:

```bash
npm run check:map
npm run build
```

<a id="map-system"></a>

## Map System

```text
3DS / STL / SKP / DWG source assets
        |
        v
public/map-models/jingong.glb
        |
        v
modelAlignment + mapData closed-space semantics
        |
        +--> H5 / Tauri Three.js scene
        |
        +--> packaged mini-program map data
```

The map is designed for physical guidance, not just visual floor-plan drawing:

- **Closed spaces:** every visible region is classified as room, corridor, stair, restroom, service, storage, reserved, support, or void.
- **Door-first routing:** room center -> door -> corridor centerline -> stair or platform -> door -> target center.
- **Independent upper rooms:** the upper spaces of `104 / 106 / 108` cannot be reached through the public stair.
- **Raised 202 platform:** `202-5` is represented as a 2.5F platform target with lower support context.
- **Dynamic labels:** far views stay sparse; near and single-floor views reveal more room labels.
- **Safe split view:** exploded floors change only the visual presentation, not the route graph.

<a id="modes"></a>

## Application Modes

| Mode | Purpose |
| --- | --- |
| Standby | Pure robot expression display for the embedded idle state |
| Chat | Large response display without an on-screen input field |
| Expert | Answer display with citation cards for retrieval-style responses |
| Map | Fullscreen 3D navigation, layer control, route guidance, and touch camera |
| Backend debug | Folded entry for directive injection tests without dominating the product UI |

<a id="backend"></a>

## Backend Contract

Backend services do not need to send coordinates. They send one typed directive. Map navigation uses `MapDirectRequest`:

```js
window.jingongApplyDirective({
  type: "map",
  request: {
    targetRoomId: "202-5",
    announce: ["summary", "distance", "direction", "floorChange"]
  }
});
```

The stable interface is documented in [`docs/backend-integration-contract.md`](docs/backend-integration-contract.md).

<a id="miniprogram"></a>

## WeChat Mini Program

The mini-program branch lives in [`miniprogram/`](miniprogram/) and is designed to follow the mobile map's data and visual policy:

- no `web-view`
- no `localhost`
- no `5173`
- no full-map PNG screenshot pretending to be WebGL
- no product-visible native polygon overlay replacing the Three scene

Validation commands:

```bash
npm run sync:miniprogram:map
npm run check:miniprogram
npm run check:miniprogram:parity
```

A real WeChat Mini Program AppID is still required before formal upload:

```bash
npm run check:miniprogram:release
```

<a id="release"></a>

## Release

Current GitHub Release:

- [`v0.1.0-map-structure-20260607`](https://github.com/zzw4257/jingongxiaozi/releases/tag/v0.1.0-map-structure-20260607)
- APK: `jingong-xiaozi-v0.1.0-map-structure-20260607-arm64.apk`
- ABI: `arm64-v8a`

Android arm64 build command:

```bash
npm run tauri -- android build --apk --target aarch64 --ci
```

Release candidates should pass:

```bash
npm run check:map
npm run check:miniprogram
npm run check:miniprogram:parity
npm run build
cd src-tauri && cargo check
npm run tauri -- android build --apk --target aarch64 --ci
```

<a id="repo-map"></a>

## Repository Map

| Path | Role |
| --- | --- |
| [`src/features/map3d/`](src/features/map3d/) | H5/Tauri Three.js map scene, camera, labels, and route rendering |
| [`src/features/map/data/mapData.ts`](src/features/map/data/mapData.ts) | Rooms, spaces, doors, stairs, centerlines, and route graph |
| [`src/features/map/runtime.ts`](src/features/map/runtime.ts) | Shared route and map runtime logic |
| [`public/map-models/`](public/map-models/) | Runtime GLB models and textures |
| [`miniprogram/`](miniprogram/) | Self-contained WeChat Mini Program branch |
| [`scripts/`](scripts/) | Map, model, alignment, mini-program, and QA verification scripts |
| [`docs/backend-integration-contract.md`](docs/backend-integration-contract.md) | Backend directive and MapDirect contract |
| [`docs/releases/`](docs/releases/) | Release notes and verification records |

<a id="verification"></a>

## Verification Commands

```bash
npm run check:geometry
npm run check:model
npm run check:alignment
npm run check:map
npm run check:miniprogram
npm run check:miniprogram:parity
npm run build
cd src-tauri && cargo check
```

`npm run qa:mobile` requires the optional Playwright environment.

## Publication Hygiene

- Do not commit `env.txt`, Android signing material, local browser caches, or APK build outputs.
- APK files are distributed as GitHub Release assets, not source-controlled files.
- Source model files under `models/` are calibration and reference assets; browser runtime uses generated GLB files.

<p align="right"><a href="#readme-top">Back to top</a></p>
