# Mini Program Smoke v1

Date: 2026-05-25
Scope: WeChat mini program WebView shell for the existing H5/React/Three.js map.

## Verification

- `npm run check:miniprogram`: pass
- `npm run check:map`: pass
- `npm run build`: pass
- WeChat DevTools app detected at `/Applications/wechatwebdevtools.app`.
- WeChat DevTools CLI detected at `/Applications/wechatwebdevtools.app/Contents/MacOS/cli`.
- `cli open --project ... --port 3800 --lang zh`: pass after enabling service port.
- DevTools simulator compiled `pages/home/home`: pass.
- Simulator opened `pages/web-map/web-map` with H5 URL `http://127.0.0.1:5173/?mode=map`: pass.

## Manual Tool Attempt

- Initial command reported IDE service port disabled.
- Re-ran with a TTY, confirmed enabling the service port, and relaunched with `--port 3800`.
- Verified `127.0.0.1:3800` was listening and `.ide` contained `3800`.
- The previous timeout was caused by a stale/non-listening service port, not by the mini program project.
- `touristappid` triggered `更改 AppID 失败 touristappid` in this DevTools version, so the local demo config now leaves `appid` blank.

## Import Path

Use WeChat DevTools import with:

```text
/Users/zzw4257/Documents/ZJU_archieve/05.课程与学术资料/项目设计实践/数据库-补充后端模块/repo/miniprogram
```

## Notes

- `webBaseUrl` defaults to `http://127.0.0.1:5173/` for local DevTools preview.
- Real-device preview requires a deployed HTTPS H5 URL and a valid WeChat business domain.
- The shell does not duplicate 3D map logic; it only passes query parameters to the H5 app.
