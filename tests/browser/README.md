# Browser regression checks

Install the declared development dependencies and Chromium once:

```text
npm install
npx playwright install chromium
```

Run the published design suite against a temporary local server:

```text
npm run test:browser
```

The suite covers Chinese/English, light/dark, desktop/phone and reduced-motion
states. It checks the completed homepage typing sequence, four project frames,
real project transition frames and rapid reversal, seven skill categories and
29 details, keyboard selection, 12 experience entries, About, Stories, eight
travel destinations, navigation, theme/language changes and resource failures.
It also verifies image retry, script-disabled content, failed controllers,
failed travel CDN loading and failed initial language data. Screenshots and a
JSON result are written to `test-results/published-design` by default.

Set `TEST_BASE_URL` to test an already-running server or the published root URL.
The failure checks intercept requests only in isolated browser contexts; they
do not change the server. A localhost-only Cloudflare analytics CORS failure is
recorded separately; that exception does not apply to the published HTTPS site.

The previous carousel/typewriter suite and its screenshot are retained for
historical comparison. Its old-layout assertions are not the current design's
acceptance criteria:

```text
npm run test:browser:legacy
npm run test:browser:legacy:update
```

Only update a historical screenshot when intentionally reviewing that historical
layout. The new suite never rewrites committed visual baselines.

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` may point to an existing Chromium-family
browser. `TEST_ARTIFACTS_DIR` may place run output outside the repository. Browser
rendering checks are evidence for these named flows, not exhaustive accessibility
or cross-browser certification.
