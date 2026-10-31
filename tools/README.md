# Planner tooling

- `roads.json` — hand-traced road polylines (px on the official 4096 map). Edit this to fix a route.
- `costmap.js` — builds `cost.json` (walking cost grid, 2px cells of the 2400×2100 crop) from the map image.
- `pathfind.js` — Dijkstra on `cost.json` + road corridors + risk zones → `map/paths.js` (all node pairs).
- `test_plan.js` / `dom_test.js` — headless checks (needs `npm i jsdom leaflet@1.9.4 pngjs jpeg-js` in a scratch dir).

Regenerate paths after editing roads or nodes:

    node tools/pathfind.js <dir with node_modules> map tools/cost.json tools/roads.json map/paths.js

- `e2e_browser.js` — real Chromium session (Playwright): clicks all 14 spawns on fresh pages with an occlusion check, legend toggle, keycards, option table, forced cluster, layer toggles; desktop + phone; screenshots.

    node tools/e2e_browser.js <dir with node_modules incl. playwright> <screenshot dir> <url>

- `stamp.py` — run before every commit: appends ?v=<hash> to script/image URLs so browsers never mix new HTML with cached JS.
- `route_sheet.js` — renders each spawn's default route onto the map (PNG per spawn) for visual review.
