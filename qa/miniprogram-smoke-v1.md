# Mini Program Smoke v1

Date: 2026-05-24
Scope: WeChat mini program WebView shell for the existing H5/React/Three.js map.

## Verification

- `npm run check:miniprogram`: pass
- `npm run check:map`: pass
- `npm run build`: pass
- WeChat DevTools app detected at `/Applications/wechatwebdevtools.app`.
- WeChat DevTools CLI detected at `/Applications/wechatwebdevtools.app/Contents/MacOS/cli`.

## Manual Tool Attempt

- Command attempted:
  - `/Applications/wechatwebdevtools.app/Contents/MacOS/cli open --project /Users/zzw4257/Documents/ZJU_archieve/05.课程与学术资料/项目设计实践/数据库-补充后端模块/repo/miniprogram`
- Result:
  - CLI first reported IDE service port disabled.
  - After confirming enablement, CLI timed out waiting for the IDE port file.
  - This appears to be a local WeChat DevTools service-port/runtime issue, not a project structure failure.

## Import Path

Use WeChat DevTools import with:

```text
/Users/zzw4257/Documents/ZJU_archieve/05.课程与学术资料/项目设计实践/数据库-补充后端模块/repo/miniprogram
```

## Notes

- `webBaseUrl` is currently a placeholder in `miniprogram/miniprogram/app.js`.
- DevTools can disable URL checking for local preview; real-device preview requires a valid HTTPS business domain.
- The shell does not duplicate 3D map logic; it only passes query parameters to the H5 app.
