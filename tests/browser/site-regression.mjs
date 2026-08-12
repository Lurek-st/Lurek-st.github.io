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

async function runProductionMatrix(browser, url) {
  const viewports = [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ];
  const results = [];

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', colorScheme: 'dark' });
    await primeEnglishDarkMode(context);
    const page = await context.newPage();
    const diagnostics = collectPageDiagnostics(page);
    const badResponses = [];
    page.on('response', response => {
      if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() });
    });

    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    assert(await page.locator('html').getAttribute('lang') === 'en', `${viewport.width}px: initial language is not English.`);

    const structure = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('[id]')).map(element => element.id);
      const visible = element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const unnamed = Array.from(document.querySelectorAll('a, button, input, select, textarea, [role="button"], [tabindex]'))
        .filter(visible)
        .filter(element => !(element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || '').trim())
        .map(element => `${element.tagName.toLowerCase()}#${element.id}`);
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        duplicateIds: [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))],
        missingAlt: document.querySelectorAll('img:not([alt])').length,
        unnamed,
        h1Count: document.querySelectorAll('h1').length,
        brokenLoadedImages: Array.from(document.images)
          .filter(image => image.getAttribute('src') && image.complete && image.naturalWidth === 0)
          .map(image => image.getAttribute('src')),
      };
    });
    assert(structure.overflow === 0, `${viewport.width}px: document has ${structure.overflow}px horizontal overflow.`);
    assert(structure.duplicateIds.length === 0, `${viewport.width}px: duplicate IDs: ${structure.duplicateIds.join(', ')}`);
    assert(structure.missingAlt === 0, `${viewport.width}px: images without alt text were found.`);
    assert(structure.unnamed.length === 0, `${viewport.width}px: unnamed controls: ${structure.unnamed.join(', ')}`);
    assert(structure.h1Count === 1, `${viewport.width}px: expected exactly one H1, found ${structure.h1Count}.`);
    assert(structure.brokenLoadedImages.length === 0, `${viewport.width}px: broken loaded images: ${structure.brokenLoadedImages.join(', ')}`);

    if (viewport.width < 768) {
      const menu = page.locator('#nav-menu');
      const toggle = page.locator('#nav-toggle');
      assert(await menu.getAttribute('inert') !== null, `${viewport.width}px: closed mobile menu is not inert.`);
      await toggle.click();
      assert(await toggle.getAttribute('aria-expanded') === 'true', `${viewport.width}px: mobile menu did not expand.`);
      assert(await page.evaluate(() => document.activeElement === document.querySelector('#nav-menu .nav__link')), `${viewport.width}px: menu focus did not move to the first link.`);
      await page.keyboard.press('Escape');
      assert(await toggle.getAttribute('aria-expanded') === 'false', `${viewport.width}px: Escape did not close the menu.`);
      assert(await toggle.evaluate(element => document.activeElement === element), `${viewport.width}px: Escape did not restore toggle focus.`);
    }

    const languageButton = page.locator(viewport.width < 768 ? '#mobile-translate' : '#translate');
    await languageButton.click();
    await page.waitForFunction(() => document.documentElement.lang === 'zh-CN');
    assert((await page.locator('.home__title').textContent()) === '你好，我是 Lurek Lu', `${viewport.width}px: Chinese title did not render.`);

    if (viewport.width === 768) {
      await page.locator('#beyond-work .beyond-work__module--road').scrollIntoViewIfNeeded();
      await page.waitForSelector('.beyond-work__travel-slider.is-travel-runtime', { timeout: 15000 });
      const travelState = await page.evaluate(() => ({
        inactiveInert: Array.from(document.querySelectorAll('.beyond-work__travel-chapter:not(.is-current)')).every(chapter => chapter.inert),
        flexDirection: getComputedStyle(document.querySelector('.beyond-work__travel-chapter.is-current .beyond-work__travel-accordion')).flexDirection,
      }));
      assert(travelState.inactiveInert, '768px: inactive travel chapter is keyboard-focusable.');
      assert(travelState.flexDirection === 'column', `768px: travel accordion direction is ${travelState.flexDirection}.`);
    }

    assert(diagnostics.consoleErrors.length === 0, `${viewport.width}px console errors: ${diagnostics.consoleErrors.join(' | ')}`);
    assert(diagnostics.pageErrors.length === 0, `${viewport.width}px page errors: ${diagnostics.pageErrors.join(' | ')}`);
    assert(diagnostics.requestFailures.length === 0, `${viewport.width}px request failures: ${JSON.stringify(diagnostics.requestFailures)}`);
    assert(badResponses.length === 0, `${viewport.width}px HTTP errors: ${JSON.stringify(badResponses)}`);
    results.push({ viewport, structure, diagnostics, badResponses });
    await context.close();
  }
  return results;
}

async function runCriticalInteractions(browser, url) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
    colorScheme: 'dark',
  });
  await primeEnglishDarkMode(context);
  const page = await context.newPage();
  const diagnostics = collectPageDiagnostics(page);
  const audioResponses = [];
  page.on('response', response => {
    if (new URL(response.url()).pathname.endsWith('.mp3')) audioResponses.push({ url: response.url(), status: response.status() });
  });

  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  assert((await page.locator('img[data-lazy-src]').count()) >= 6, 'Deferred images loaded before becoming visible.');
  assert(audioResponses.length === 0, 'Soundtrack loaded without a user gesture.');

  const selectedTab = page.locator('.qualification__button[aria-selected="true"]');
  assert(await selectedTab.getAttribute('tabindex') === '0', 'Selected qualification tab is not in the tab order.');
  assert(await page.locator('.qualification__button[tabindex="-1"]').count() === 2, 'Inactive qualification tabs are in the tab order.');
  await selectedTab.focus();
  await page.keyboard.press('ArrowRight');
  assert(await page.locator('#qualification-tab-work').getAttribute('aria-selected') === 'true', 'Qualification ArrowRight navigation failed.');
  assert(await page.locator('#qualification-tab-work').getAttribute('tabindex') === '0', 'Qualification roving tabindex did not advance.');

  const aboutImage = page.locator('.about__img');
  await aboutImage.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.about__img')?.naturalWidth > 0);
  assert(await aboutImage.getAttribute('src') === 'assets/img/about.png', 'About image did not load on visibility.');

  await page.locator('#portfolio').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => Array.from(document.querySelectorAll('#portfolio img')).some(image => image.naturalWidth > 0));

  await page.locator('#beyond-work .beyond-work__module--stories').scrollIntoViewIfNeeded();
  await page.waitForSelector('.beyond-work__stories-cluster.is-stories-runtime', { timeout: 15000 });
  const storyOptions = page.locator('.beyond-work__stories-cluster [role="option"]');
  assert(await storyOptions.count() === 11, 'Story selector option count changed.');
  assert(await page.locator('.beyond-work__stories-cluster [role="option"][tabindex="0"]').count() === 1, 'Story selector must expose one roving tab stop.');
  const storyBefore = await page.locator('.beyond-work__stories-cluster [aria-selected="true"]').getAttribute('data-story');
  await page.locator('.beyond-work__stories-cluster [aria-selected="true"]').focus();
  await page.keyboard.press('ArrowRight');
  const storyAfter = await page.locator('.beyond-work__stories-cluster [aria-selected="true"]').getAttribute('data-story');
  assert(storyAfter && storyAfter !== storyBefore, 'Story ArrowRight navigation failed.');

  const soundtrack = page.locator('[data-beyond-work-soundtrack-toggle]');
  await soundtrack.scrollIntoViewIfNeeded();
  await soundtrack.waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('[data-beyond-work-soundtrack-toggle]')?.disabled, null, { timeout: 15000 });
  await soundtrack.click();
  await page.waitForFunction(() => document.querySelector('[data-beyond-work-soundtrack-toggle]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 15000 });
  assert(audioResponses.length === 1 && audioResponses[0].status === 200, `First soundtrack click produced ${JSON.stringify(audioResponses)}.`);
  await soundtrack.click();
  await page.waitForFunction(() => document.querySelector('[data-beyond-work-soundtrack-toggle]')?.getAttribute('aria-pressed') === 'false');
  assert(audioResponses.length === 1, 'Pausing the soundtrack triggered another audio request.');

  assert(diagnostics.consoleErrors.length === 0, `Critical interactions console errors: ${diagnostics.consoleErrors.join(' | ')}`);
  assert(diagnostics.consoleWarnings.length === 0, `Critical interactions console warnings: ${diagnostics.consoleWarnings.join(' | ')}`);
  assert(diagnostics.pageErrors.length === 0, `Critical interactions page errors: ${diagnostics.pageErrors.join(' | ')}`);
  assert(diagnostics.requestFailures.length === 0, `Critical interactions request failures: ${JSON.stringify(diagnostics.requestFailures)}`);
  await context.close();
  return { audioResponses, diagnostics };
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
  result.productionMatrix = await runProductionMatrix(browser, url);
  result.criticalInteractions = await runCriticalInteractions(browser, url);
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
