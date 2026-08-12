# Browser regression checks

Install the declared development dependencies and Chromium once:

```text
npm install
npx playwright install chromium
```

Run the interaction and deterministic visual regression checks:

```text
npm run test:browser
```

Only update the committed screenshot after intentional, reviewed visual changes:

```text
npm run test:browser:update
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` may point to an existing Chromium-family
browser. `TEST_ARTIFACTS_DIR` may place run output outside the repository.

