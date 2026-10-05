import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.resolve(process.env.TEST_ARTIFACTS_DIR || path.join(root, 'test-results/published-design'));
const report = { target: '', cases: [], checks: [], browser: 'Chromium', result: 'RUNNING' };
await fs.mkdir(out, { recursive: true });
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
let server;
let base = process.env.TEST_BASE_URL;
if (!base) {
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = path.resolve(root, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) return response.writeHead(403).end();
    try { response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(await fs.readFile(file)); }
    catch { response.writeHead(404).end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/`;
}
report.target = base;
const origin = new URL(base).origin;
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--mute-audio'] });
function check(name, condition, detail) {
  report.checks.push({ name, pass: !!condition, detail });
  if (!condition) console.error('FAIL: ' + name);
}
async function save() { await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(report, null, 2)); }
async function at(page, selector) {
  await page.locator(selector).first().evaluate(e => scrollTo({ top: e.getBoundingClientRect().top + scrollY - 90, behavior: 'instant' }));
  await page.waitForTimeout(250);
}
async function screenshot(page, name) { await page.screenshot({ path: path.join(out, name + '.png') }); }
async function makeContext(width, lang, theme, extra = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'no-preference', ...extra });
  await context.addInitScript(({ lang, theme }) => {
    localStorage.setItem('lang', lang); localStorage.setItem('selected-theme', theme);
    window.__qaTypedLengths = [];
    new MutationObserver(() => {
      const node = document.querySelector('.home__title .typing-text__content');
      if (node) window.__qaTypedLengths.push(node.textContent.length);
    }).observe(document, { childList: true, characterData: true, subtree: true });
  }, { lang, theme });
  return context;
}
function diagnostics(page) {
  const result = { exceptions: [], consoleErrors: [], failedRequests: [], badResponses: [] };
  page.on('pageerror', e => result.exceptions.push(e.message));
  page.on('console', e => { if (e.type() === 'error') result.consoleErrors.push(e.text()); });
  page.on('requestfailed', r => result.failedRequests.push({ url: r.url(), error: r.failure()?.errorText }));
  page.on('response', r => { if (r.status() >= 400) result.badResponses.push({ url: r.url(), status: r.status() }); });
  return result;
}
async function ready(page) {
  await page.waitForFunction(() => window.__appReady && document.querySelector('[data-project-ready]') && document.querySelector('[data-skill-ready]'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => matchMedia('(prefers-reduced-motion: reduce)').matches || window.__qaTypedLengths.some(n => n > 0));
  await page.waitForFunction(() => document.querySelector('.home__title')?.textContent === "Hello, I'm Lurek Lu" && !document.querySelector('.home__data .typing-text'), null, { timeout: 20000 });
}
async function projectState(page) {
  return page.evaluate(() => ({
    selected: document.querySelector('[data-project-ready]').dataset.projectSelected,
    moving: document.querySelector('[data-project-ready]').dataset.projectMoving,
    panels: [...document.querySelectorAll('[data-project-panel]')].filter(e => !e.hidden).map(e => e.dataset.projectPanel),
    images: [...document.querySelectorAll('[data-project-surface] img')].map(e => ({ source: e.getAttribute('src'), loaded: e.complete && e.naturalWidth > 0 })),
    overflow: document.documentElement.scrollWidth - innerWidth
  }));
}

try {
  for (const config of [
    { width: 1440, lang: 'cn', theme: 'dark' },
    { width: 1024, lang: 'en', theme: 'light' },
    { width: 375, lang: 'en', theme: 'dark' },
    { width: 320, lang: 'cn', theme: 'light', reducedMotion: 'reduce' }
  ]) {
    const id = `${config.width}-${config.lang}-${config.theme}`;
    const context = await makeContext(config.width, config.lang, config.theme, { reducedMotion: config.reducedMotion || 'no-preference' });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const diag = diagnostics(page);
    const item = { id, config, diagnostics: diag };
    await page.goto(base, { waitUntil: 'domcontentloaded' }); await ready(page);
    check(id + ' page identity and meaningful rendered content', await page.title() === 'Lurek Lu Business Card' && (await page.locator('body').innerText()).length > 500 && await page.locator('vite-error-overlay,nextjs-portal').count() === 0);
    check(id + ' requested language/theme', await page.evaluate(c => document.documentElement.lang === (c.lang === 'cn' ? 'zh-CN' : 'en') && document.body.classList.contains('dark-theme') === (c.theme === 'dark'), config));
    item.content = await page.evaluate(() => ({ projects: document.querySelectorAll('[data-project-panel]').length, skills: document.querySelectorAll('.skill-detail').length, categories: document.querySelectorAll('.skill-tab').length, experiences: document.querySelectorAll('.qualification__data').length, description: document.querySelector('.home__description').textContent, life: document.querySelector('.home__life').textContent, emails: [...document.querySelectorAll('#contact a[href^="mailto:"]')].map(e => e.getAttribute('href')) }));
    check(id + ' four projects, six groups, 25 skills and 12 experiences', item.content.projects === 4 && item.content.skills === 25 && item.content.categories === 6 && item.content.experiences === 12, item.content);
    check(id + ' revised homepage and email order', item.content.description === (config.lang === 'cn' ? '一个 Marxist，同时也对 AI、商业和创业保持好奇。' : 'A Marxist, also curious about AI, business and entrepreneurship.') && item.content.life === (config.lang === 'cn' ? '做项目、写思考，也把时间留给运动、音乐、游戏和旅行。' : 'I build projects and write down my thoughts, and make time for sports, music, games and travel.') && item.content.emails.join('|') === 'mailto:lurek.st2077@gmail.com|mailto:lurek.st@outlook.com', item.content);
    item.forbiddenLinks = await page.locator('a[href]').evaluateAll(es => es.map(e => e.getAttribute('href')).filter(h => /localhost|127\.0\.0\.1|(?:^|\/)(?:stage|original|a|b)\.html/i.test(h)));
    check(id + ' no preview-only links', item.forbiddenLinks.length === 0, item.forbiddenLinks);
    if (config.width === 1440) check('homepage typewriter progresses', (await page.evaluate(() => [...new Set(window.__qaTypedLengths)].filter(n => n > 0 && n < 18))).length >= 3);
    await screenshot(page, id + '-home');
    check(id + ' contact arrow is a font-independent decorative vector', await page.locator('.home-contact__arrow').evaluate(e => {
      const box = e.getBoundingClientRect();
      return e.namespaceURI === 'http://www.w3.org/2000/svg' && !!e.querySelector('path') &&
        !e.textContent.trim() && e.getAttribute('aria-hidden') === 'true' &&
        e.getAttribute('focusable') === 'false' && box.width === 25 && box.height === 25;
    }));
    if (config.width < 768) {
      const contours = () => page.locator('[data-field-path]').evaluateAll(es => es.map(e => e.getAttribute('d')));
      const before = await contours();
      await page.setViewportSize({ width: config.width, height: 780 });
      await page.waitForTimeout(250);
      check(id + ' browser chrome height change leaves mobile geometry stable', JSON.stringify(await contours()) === JSON.stringify(before));
      await page.setViewportSize({ width: config.width, height: 900 });
      await page.waitForTimeout(250);
      check(id + ' mobile arcs have no sharp joins or inflections', await page.locator('[data-field-path]').evaluateAll(es => {
        const visible = es.filter(e => e.getTotalLength() > 1);
        return visible.length === 4 && visible.every(e => {
          const length = e.getTotalLength();
          let previousAngle, sign;
          for (let i = 1; i <= 240; i++) {
            const a = e.getPointAtLength(length * (i - 1) / 240);
            const b = e.getPointAtLength(length * i / 240);
            const angle = Math.atan2(b.y - a.y, b.x - a.x);
            if (previousAngle !== undefined) {
              const turn = Math.atan2(Math.sin(angle - previousAngle), Math.cos(angle - previousAngle));
              if (Math.abs(turn) > Math.PI / 90) return false;
              if (Math.abs(turn) > .0001) {
                if (sign && Math.sign(turn) !== sign) return false;
                sign = Math.sign(turn);
              }
            }
            previousAngle = angle;
          }
          return true;
        });
      }));
    }

    if (config.width < 768) await page.locator('#nav-toggle').click();
    await page.locator('.nav__link[href="#beyond-work"]').click();
    await page.waitForFunction(() => document.querySelector('.nav__link[href="#beyond-work"]').classList.contains('active-link'));
    check(id + ' Life navigation reaches correct section', new URL(page.url()).hash === '#beyond-work' && (config.width >= 768 || await page.locator('#nav-toggle').getAttribute('aria-expanded') === 'false'));

    await at(page, '#portfolio');
    item.projectStates = [];
    for (let index = 0; index < 4; index++) {
      await page.locator('.project-tab').nth(index).click();
      await page.waitForFunction(() => document.querySelector('[data-project-ready]').dataset.projectMoving === 'false');
      await page.waitForFunction(() => [...document.querySelectorAll('[data-project-surface] img')].every(e => e.complete && e.naturalWidth > 0));
      item.projectStates.push(await projectState(page));
    }
    check(id + ' all four project selections keep one panel and loaded images', item.projectStates.every(s => s.panels.length === 1 && s.panels[0] === s.selected && s.images.every(i => i.loaded) && s.overflow <= 0), item.projectStates);
    if (config.width === 1440) {
      await page.locator('.project-tab').first().click();
      await page.waitForFunction(() => document.querySelector('[data-project-ready]').dataset.projectMoving === 'true');
      item.projectMidMotion = await page.locator('[data-project-surface]').evaluateAll(es => es.map(e => ({ key: e.dataset.projectSurface, animations: e.getAnimations().length, transform: getComputedStyle(e).transform })));
      check('project has real moving intermediate frame', item.projectMidMotion.some(e => e.animations > 0), item.projectMidMotion);
      await page.locator('.project-tab').nth(1).click(); await page.locator('.project-tab').nth(2).click(); await page.locator('.project-tab').nth(3).click();
      await page.waitForFunction(() => document.querySelector('[data-project-ready]').dataset.projectMoving === 'false');
      check('rapid project clicks settle at last selection with one panel', (await projectState(page)).selected === 'portfolio5' && (await projectState(page)).panels.join() === 'portfolio5');
    }
    await screenshot(page, id + '-projects');

    await at(page, '#skills');
    for (const index of [1, 3, 5]) await page.locator('.skill-tab').nth(index).click();
    await page.waitForFunction(() => document.querySelector('[data-skill-ready]').dataset.skillPhase === 'rest');
    check(id + ' rapid skills select last category and retain percentages', await page.locator('.skill-tab').last().getAttribute('aria-selected') === 'true' && await page.locator('.skill-detail').count() === 25 && await page.locator('[data-skill-panel]:not([hidden])').count() === 1);
    await page.locator('.skill-tab').last().focus(); await page.keyboard.press('Home');
    await page.waitForFunction(() => document.querySelector('[data-skill-ready]').dataset.skillPhase === 'rest');
    check(id + ' keyboard Home selects first skill group', await page.locator('.skill-tab').first().getAttribute('aria-selected') === 'true');
    await screenshot(page, id + '-skills');

    await at(page, '#qualification');
    for (const [tab, count] of [['work', 5], ['certifications', 3], ['education', 4]]) {
      await page.locator('#qualification-tab-' + tab).click();
      check(id + ' experience ' + tab, await page.locator('#qualification-tab-' + tab).getAttribute('aria-selected') === 'true' && await page.locator('#' + tab + ' .qualification__data').count() === count);
    }
    await at(page, '#about');
    if (!config.reducedMotion) {
      await page.locator('[data-about-reel-indicator]').nth(2).click();
      await page.waitForFunction(() => document.querySelectorAll('[data-about-reel-indicator]')[2].getAttribute('aria-current') === 'true');
      check(id + ' About reel selects requested card', await page.locator('[data-about-reel-indicator]').nth(2).getAttribute('aria-current') === 'true');
    } else check(id + ' reduced motion exposes static About content', (await page.locator('#about').innerText()).length > 100 && !await page.locator('[data-about-reel-indicator]').nth(2).isVisible());
    await at(page, '.beyond-work__module--stories');
    await page.locator('[data-story="star-wars"]').click();
    check(id + ' Stories selection works', await page.locator('[data-story="star-wars"]').getAttribute('aria-selected') === 'true');

    await at(page, '.beyond-work__module--road');
    await page.waitForFunction(() => document.querySelector('.is-travel-runtime'), null, { timeout: 20000 });
    check(id + ' travel has eight runtime destinations with no duplicated fallback', await page.locator('[data-panel]').count() === 8 && await page.locator('.stage-travel-fallback').count() === 0);
    await page.locator('button[data-chapter-target="near"]').click();
    await page.waitForFunction(() => document.querySelector('[data-chapter="near"]').classList.contains('is-current'));
    check(id + ' Near four destinations accessible', await page.locator('[data-chapter="near"].is-current [data-panel]').count() === 4);
    await screenshot(page, id + '-travel');

    await page.locator('#theme-button').click(); await page.waitForTimeout(400);
    check(id + ' theme changes', await page.locator('body').evaluate(e => e.classList.contains('dark-theme')) !== (config.theme === 'dark'));
    await page.locator(config.width < 768 ? '#mobile-translate' : '#translate').click();
    await page.waitForFunction(lang => document.documentElement.lang !== (lang === 'cn' ? 'zh-CN' : 'en'), config.lang);
    await page.waitForTimeout(600);
    await page.waitForFunction(() => !document.querySelector('.home__data .typing-text'), null, { timeout: 20000 });
    check(id + ' both Life labels translated', await page.locator('[i18n="stage_nav_life"]').evaluateAll((es, lang) => es.length === 2 && es.every(e => e.textContent === (lang === 'cn' ? 'Life' : '工作之外')), config.lang));
    check(id + ' language switch preserves project selection', (await projectState(page)).selected === 'portfolio5');
    await at(page, '#contact'); await page.waitForTimeout(1000);
    await screenshot(page, id + '-contact');
    check(id + ' no page horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (config.reducedMotion) check('reduced motion produces static background', await page.locator('.site-field').getAttribute('data-field-state') === 'static-reduced');
    else if (config.width === 1440) {
      const before = await page.locator('[data-field-path]').first().getAttribute('d');
      await page.mouse.wheel(0, -500); await page.waitForTimeout(150);
      check('background responds to real scroll', await page.locator('[data-field-path]').first().getAttribute('d') !== before);
    }
    check(id + ' no application exceptions', diag.exceptions.length === 0, diag.exceptions);
    check(id + ' no failed first-party assets or HTTP errors', diag.failedRequests.filter(r => r.url.startsWith(origin)).length === 0 && diag.badResponses.filter(r => r.url.startsWith(origin)).length === 0, diag);
    const localAnalyticsCors = e => new URL(base).hostname === '127.0.0.1' && e.includes('https://cloudflareinsights.com/cdn-cgi/rum') && e.includes('blocked by CORS policy');
    item.localAnalyticsCors = diag.consoleErrors.filter(localAnalyticsCors);
    check(id + ' no JavaScript console errors', diag.consoleErrors.filter(e => !e.startsWith('Failed to load resource:') && !localAnalyticsCors(e)).length === 0, diag.consoleErrors);
    report.cases.push(item); await save(); await context.close(); console.log('DONE ' + id);
  }

  for (const mode of ['no-js', 'cdn-failed', 'controller-failed', 'image-retry', 'i18n-failed']) {
    const context = await makeContext(375, 'en', 'light', { javaScriptEnabled: mode !== 'no-js', reducedMotion: 'reduce' });
    let blockImage = true;
    await context.route('**/*', route => {
      const url = route.request().url();
      if ((mode === 'cdn-failed' && url.startsWith('https://cdn.jsdelivr.net/')) || (mode === 'controller-failed' && /\/stage(?:-details)?\.js(?:\?|$)/.test(url)) || (mode === 'image-retry' && blockImage && url.includes('portfolio-robot-calibration')) || (mode === 'i18n-failed' && /\/i18n_(?:cn|en)\.json(?:\?|$)/.test(url))) return route.abort();
      return route.continue();
    });
    const page = await context.newPage(); page.setDefaultTimeout(15000); const diag = diagnostics(page);
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    if (mode === 'no-js' || mode === 'cdn-failed') {
      await at(page, '.beyond-work__module--road');
      await page.waitForTimeout(600);
      const entries = page.locator('[data-travel-fallback-destination]');
      const expected = ['japan', 'germany-austria', 'malaysia-indonesia', 'uae', 'beijing', 'shanghai-hangzhou', 'greater-bay-area', 'xiamen'];
      check(mode + ' all eight travel destinations retained in order', (await entries.evaluateAll(es => es.map(e => e.dataset.travelFallbackDestination))).join() === expected.join());
      for (let i = 0; i < await entries.count(); i++) {
        await entries.nth(i).scrollIntoViewIfNeeded();
        await page.waitForFunction(index => { const img = document.querySelectorAll('[data-travel-fallback-destination]')[index].querySelector('img'); return img.complete && img.naturalWidth > 0; }, i);
      }
      check(mode + ' full four project/25 skill/12 experience content retained', await page.locator('[data-project-panel]').count() === 4 && await page.locator('.skill-detail').count() === 25 && await page.locator('.qualification__data').count() === 12);
    } else if (mode === 'controller-failed') {
      await page.waitForFunction(() => window.__appReady);
      check('controller failure leaves all projects and skill panels readable', await page.locator('[data-project-panel]').evaluateAll(es => es.length === 4 && es.every(e => !e.hidden)) && await page.locator('[data-skill-panel]').evaluateAll(es => es.length === 6 && es.every(e => !e.hidden)));
      await at(page, '#portfolio');
    } else if (mode === 'i18n-failed') {
      await page.waitForFunction(() => window.__appReady && document.documentElement.lang === 'zh-CN');
      const copy = await page.evaluate(() => ({ title: document.querySelector('.home__title').textContent, description: document.querySelector('.home__description').textContent, life: document.querySelector('.home__life').textContent, navigation: document.querySelector('[i18n="stage_nav_life"]').textContent, emails: [...document.querySelectorAll('#contact a[href^="mailto:"]')].map(e => e.getAttribute('href')) }));
      check('initial language JSON failure keeps correct new Chinese fallback', copy.title === "Hello, I'm Lurek Lu" && copy.description === '一个 Marxist，同时也对 AI、商业和创业保持好奇。' && copy.life === '做项目、写思考，也把时间留给运动、音乐、游戏和旅行。' && copy.navigation === '工作之外' && copy.emails[0] === 'mailto:lurek.st2077@gmail.com', copy);
      await at(page, '#portfolio'); await page.locator('.project-tab').nth(3).click();
      check('language data failure does not break project interaction', (await projectState(page)).selected === 'portfolio5');
    } else {
      await ready(page); await at(page, '#portfolio');
      await page.waitForFunction(() => document.querySelector('[data-project-surface="portfolio1"]').dataset.mediaState === 'error');
      check('failed image retains one usable project copy and link', await page.locator('[data-project-panel]:not([hidden])').count() === 1 && await page.locator('[data-project-panel="portfolio1"] a').isVisible());
      blockImage = false; await page.locator('[data-project-surface="portfolio1"] .media-status button').click();
      await page.waitForFunction(() => { const f = document.querySelector('[data-project-surface="portfolio1"]'); return f.dataset.mediaState === 'ready' && f.querySelector('img').naturalWidth > 0; });
      check('image Retry restores correct project', (await projectState(page)).selected === 'portfolio1');
    }
    check(mode + ' no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    check(mode + ' no uncaught script exception', diag.exceptions.length === 0, diag.exceptions);
    await screenshot(page, mode); report.cases.push({ id: mode, diagnostics: diag }); await save(); await context.close(); console.log('DONE ' + mode);
  }
  report.result = report.checks.every(c => c.pass) ? 'PASS' : 'FAIL';
} catch (error) { report.result = 'ERROR'; report.error = error.stack; }
finally { await save(); await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); }
console.log(JSON.stringify({ result: report.result, target: base, checks: report.checks.length, failed: report.checks.filter(c => !c.pass).map(c => c.name), error: report.error }, null, 2));
process.exitCode = report.result === 'PASS' ? 0 : 1;
