# Android Map Smoke v36

Date: 2026-05-24 18:10 CST
Scope: floor height, single-floor readability, route endpoint clarity, Android kiosk touch flow.

## Build Artifact

- APK: `build/android-release/jingong-xiaozi-0.1.0-map-height-v36-arm64-test-signed.apk`
- Size: 19 MB
- ABI: `arm64-v8a` only
- Signature: apksigner v2/v3 verified, signer `CN=Jingong Xiaozi Test, O=ZJU, C=CN`

## Automated Verification

- `npm run check:map`: pass
  - 53 rooms
  - 53 door segments
  - 71 spaces
  - 16 centerlines
  - route constraints verified by live route calculation
  - model assets verified, primary 47 meshes / 5000 vertices
  - alignment max error 0.074, average error 0.037
- `npm run build`: pass
- `cd src-tauri && cargo check`: pass
- `npm run tauri -- android build --apk --target aarch64 --ci`: pass
- `zipalign -c -p 4`: pass
- `apksigner verify --verbose --print-certs`: pass
- `adb install -r`: pass
- `adb shell am start -W -n cn.edu.zju.jingongxiaozi/.MainActivity`: cold start ok, total time 4584 ms

## Visual QA Evidence

Web 844x390 captures:

- `qa/screenshots/web-v36/jingong-v36b-map-default-844x390.png`
- `qa/screenshots/web-v36/jingong-v36b-single-1f-844x390.png`
- `qa/screenshots/web-v36/jingong-v36b-single-2f-844x390.png`
- `qa/screenshots/web-v36/jingong-v36b-exploded-844x390.png`
- `qa/screenshots/web-v36/jingong-v36c-route-104-844x390.png`
- `qa/screenshots/web-v36/jingong-v36-route-panel-844x390.png`

Android emulator captures:

- `qa/screenshots/android-v36-standby-loaded.png`
- `qa/screenshots/android-v36-map-default-2.png`
- `qa/screenshots/android-v36-layers-panel-2.png`
- `qa/screenshots/android-v36-single-1f.png`
- `qa/screenshots/android-v36-debug-panel.png`
- `qa/screenshots/android-v36-route-104-final.png`

## Manual Findings

- Standby remains a pure expression surface with only the side drawer handle and map FAB visible.
- Default map opens into full-building 2.5D with the right operation rail inside the Android landscape viewport.
- Single-floor views now show the whole floor first, not a cropped local zoom. The bottom chip states `一层精看` / `二层精看`, and walls, corridors, doors, and room labels are more readable.
- Exploded view uses larger floor separation and a low oblique camera so stair pairing is visually apparent.
- Route `101 -> 104-2F01` displays current point, next portal, destination, and the first instruction without the uncalibrated heading HUD blocking the endpoint.
- The debug panel is still reachable but remains a dedicated panel, not a default visible overlay.

## Remaining Risks

- Real robot hardware sensor permission and heading calibration were not tested on physical Android hardware.
- Vite still emits the existing large chunk warning because Three.js and the app bundle are not code-split yet.
