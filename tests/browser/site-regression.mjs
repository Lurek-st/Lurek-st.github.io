import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const pixelmatchPath = require.resolve('pixelmatch');
const { default: pixelmatch } = await import(pathToFileURL(pixelmatchPath).href);

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, '..', '..');
const artifactDirectory = process.env.TEST_ARTIFACTS_DIR
  ? path.resolve(process.env.TEST_ARTIFACTS_DIR)
  : path.join(repositoryRoot, 'test-results');
const snapshotPath = path.join(testDirectory, 'snapshots', 'home-1440x900.png');
const updateSnapshots = process.argv.includes('--update-snapshots') || process.env.UPDATE_SNAPSHOTS === '1';
const chromeExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

await fs.mkdir(artifactDirectory, { recursive: true });

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mp3', 'audio/mpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearlyEqual(actual, expected, tolerance = 0.75) {
  return Math.abs(actual - expected) <= tolerance;
}

function createStaticServer() {
  return createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      const relativePath = decodeURIComponent(requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname);
      const filePath = path.resolve(repositoryRoot, `.${relativePath}`);
      const allowedRoot = `${repositoryRoot}${path.sep}`;
      if (filePath !== repositoryRoot && !filePath.startsWith(allowedRoot)) {
        response.writeHead(403).end('Forbidden');
        return;
      }

      const body = await fs.readFile(filePath);
      response.writeHead(200, {
        'Content-Type': mimeTypes.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(body);
    } catch (error) {
      response.writeHead(error?.code === 'ENOENT' ? 404 : 500).end('Not found');
    }
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert(address && typeof address !== 'string', 'Static test server did not expose a TCP address.');
  return `http://127.0.0.1:${address.port}/index.html`;
}

async function closeServer(server) {
  await new Promise(resolve => server.close(resolve));
}

function collectPageDiagnostics(page) {
  const diagnostics = { consoleErrors: [], consoleWarnings: [], pageErrors: [], requestFailures: [] };
  page.on('console', message => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
    if (message.type() === 'warning') diagnostics.consoleWarnings.push(message.text());
  });
  page.on('pageerror', error => diagnostics.pageErrors.push(error.message));
  page.on('requestfailed', request => {
    diagnostics.requestFailures.push({ url: request.url(), error: request.failure()?.errorText ?? 'unknown' });
  });
  return diagnostics;
}

async function primeEnglishDarkMode(context) {
  await context.addInitScript(() => {
    localStorage.setItem('lang', 'en');
    localStorage.setItem('selected-theme', 'dark');
    localStorage.setItem('selected-icon', 'uil-sun');
    window.__testLayoutShiftValue = 0;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__testLayoutShiftValue += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

async function runTypewriterInteraction(browser, url) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'no-preference',
    colorScheme: 'dark',
  });
  await primeEnglishDarkMode(context);
  const page = await context.newPage();
  const diagnostics = collectPageDiagnostics(page);

  await page.goto(url, { waitUntil: 'load' });
  assert((await page.title()) === 'Lurek Lu Business Card', 'Unexpected page title.');
  assert((await page.locator('body').innerText()).trim().length > 100, 'Homepage rendered as an empty shell.');
  assert(await page.locator('vite-error-overlay, nextjs-portal, #webpack-dev-server-client-overlay').count() === 0, 'A framework error overlay is visible.');

  const checkpoints = [
    { name: 'early', minimumLength: 2 },
    { name: 'middle', minimumLength: 8 },
    { name: 'late', minimumLength: 15 },
  ];
  const samples = [];

  for (const checkpoint of checkpoints) {
    await page.waitForFunction(
      ({ minimumLength }) => {
        const typedText = document.querySelector('.home__title .typing-text__content');
        const caret = document.querySelector('.home__title .typing-text__caret');
        return typedText && caret && typedText.textContent.length >= minimumLength;
      },
      checkpoint,
      { timeout: 10000 },
    );

    const sample = await page.locator('.home__title').evaluate((element, name) => {
      const typedText = element.querySelector('.typing-text__content');
      const caret = element.querySelector('.typing-text__caret');
      const elementRect = element.getBoundingClientRect();
      const typedTextRect = typedText.getBoundingClientRect();
      const caretRect = caret.getBoundingClientRect();
      return {
        checkpoint: name,
        text: typedText.textContent,
        textLength: typedText.textContent.length,
        elementLeft: elementRect.left,
        elementTop: elementRect.top,
        elementHeight: elementRect.height,
        typedTextRight: typedTextRect.right,
        caretLeft: caretRect.left,
        caretWidth: caretRect.width,
        gap: caretRect.left - typedTextRect.right,
      };
    }, checkpoint.name);

    assert(nearlyEqual(sample.caretLeft, sample.typedTextRight), `${checkpoint.name}: caret is ${sample.gap}px from the typed-text end.`);
    assert(sample.caretWidth >= 1.5 && sample.caretWidth <= 2.5, `${checkpoint.name}: caret width changed from the intended 2px.`);
    assert(samples.length === 0 || sample.textLength > samples.at(-1).textLength, `${checkpoint.name}: typed characters did not progress.`);
    samples.push(sample);
  }

  for (const sample of samples.slice(1)) {
    assert(nearlyEqual(sample.elementLeft, samples[0].elementLeft, 0.25), `${sample.checkpoint}: title shifted horizontally while typing.`);
    assert(nearlyEqual(sample.elementTop, samples[0].elementTop, 0.25), `${sample.checkpoint}: title shifted vertically while typing.`);
    assert(nearlyEqual(sample.elementHeight, samples[0].elementHeight, 0.25), `${sample.checkpoint}: title height changed while typing.`);
  }

  await page.waitForFunction(() => {
    const expected = [
      "Hi, I'm Lurek Lu",
      'Undergraduate Student at City University of Hong Kong (Dongguan)',
      'Long-term AI Practitioner · Independent Researcher · Entrepreneur',
    ];
    const selectors = ['.home__title', '.home__subtitle', '.home__description'];
    return selectors.every((selector, index) => document.querySelector(selector)?.textContent === expected[index])
      && !document.querySelector('.typing-text__caret');
  }, null, { timeout: 20000 });

  const finalTexts = await page.locator('.home__title, .home__subtitle, .home__description').allTextContents();
  const layoutShiftValue = await page.evaluate(() => window.__testLayoutShiftValue ?? 0);
  assert(diagnostics.consoleErrors.length === 0, `Console errors: ${diagnostics.consoleErrors.join(' | ')}`);
  assert(diagnostics.pageErrors.length === 0, `Page errors: ${diagnostics.pageErrors.join(' | ')}`);
  assert(diagnostics.requestFailures.length === 0, `Request failures: ${JSON.stringify(diagnostics.requestFailures)}`);

  await context.close();
  return { samples, finalTexts, layoutShiftValue, diagnostics };
}

async function runDeterministicVisualRegression(browser, url) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
    colorScheme: 'dark',
  });
  await primeEnglishDarkMode(context);
  const page = await context.newPage();
  const diagnostics = collectPageDiagnostics(page);

  await page.goto(url, { waitUntil: 'load' });
  await page.addStyleTag({ content: '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    const visibleImages = Array.from(document.images).filter(image => {
      const rect = image.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    });
    await Promise.all(visibleImages.map(image => image.complete
      ? Promise.resolve()
      : new Promise(resolve => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      })));
  });
  await page.waitForTimeout(100);

  const actualPath = path.join(artifactDirectory, 'home-1440x900.actual.png');
  await page.screenshot({ path: actualPath, fullPage: false, animations: 'disabled' });

  if (updateSnapshots) {
    await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
    await fs.copyFile(actualPath, snapshotPath);
  } else {
    const [baselineBuffer, actualBuffer] = await Promise.all([
      fs.readFile(snapshotPath),
      fs.readFile(actualPath),
    ]);
    const baseline = PNG.sync.read(baselineBuffer);
    const actual = PNG.sync.read(actualBuffer);
    assert(actual.width === baseline.width && actual.height === baseline.height, 'Visual-regression screenshot dimensions changed.');
    const diff = new PNG({ width: baseline.width, height: baseline.height });
    const diffPixels = pixelmatch(baseline.data, actual.data, diff.data, baseline.width, baseline.height, { threshold: 0.1 });
    if (diffPixels > 0) await fs.writeFile(path.join(artifactDirectory, 'home-1440x900.diff.png'), PNG.sync.write(diff));
    assert(diffPixels === 0, `Deterministic visual regression changed ${diffPixels} pixels.`);
  }

  assert(diagnostics.consoleErrors.length === 0, `Visual run console errors: ${diagnostics.consoleErrors.join(' | ')}`);
  assert(diagnostics.pageErrors.length === 0, `Visual run page errors: ${diagnostics.pageErrors.join(' | ')}`);
  await context.close();
  return { snapshotPath: path.relative(repositoryRoot, snapshotPath), diagnostics };
}

const server = createStaticServer();
let browser;
const result = { status: 'FAIL' };

try {
  const url = await listen(server);
  browser = await chromium.launch(chromeExecutable ? { executablePath: chromeExecutable, headless: true } : { headless: true });
  result.browserVersion = browser.version();
  result.url = url;
  result.typewriter = await runTypewriterInteraction(browser, url);
  result.visual = await runDeterministicVisualRegression(browser, url);
  result.status = 'PASS';
} catch (error) {
  result.error = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await closeServer(server);
  await fs.writeFile(path.join(artifactDirectory, 'site-regression.json'), JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify(result, null, 2));
}
