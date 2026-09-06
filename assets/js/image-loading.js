/* Responsive, recoverable media. Native src/srcset remain usable without JS. */
(() => {
  const assets = window.SITE_IMAGE_ASSETS || {};
  const managed = new WeakSet();
  const records = new Set();
  const copy = () => document.documentElement.lang.startsWith('zh')
    ? { loading: '图片加载中', error: '图片暂未加载', retry: '重试', tap: '轻点重试' }
    : { loading: 'Loading image', error: 'Image unavailable', retry: 'Retry', tap: 'Tap to retry' };

  function url(source, width = 480) {
    const variants = assets[source]?.variants;
    if (!variants) return source;
    const target = width * Math.min(window.devicePixelRatio || 1, 3);
    return (variants.find(item => item.width >= target) || variants.at(-1)).src;
  }
  function srcset(source) {
    return assets[source]?.variants.map(item => `${item.src} ${item.width}w`).join(', ') || '';
  }
  function prepare(root) {
    root.querySelectorAll('img[loading="lazy"]').forEach(image => { image.loading = 'eager'; });
  }
  const approaching = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      prepare(entry.target);
      approaching.unobserve(entry.target);
    });
  }, { rootMargin: '900px 0px' }) : null;

  function enhance(root = document) {
    root.querySelectorAll('img[data-media-image]').forEach(image => {
      if (managed.has(image)) return;
      const frame = image.closest('[data-media-frame]');
      if (!frame) return;
      managed.add(image);
      // Swiper clones markup, not event listeners. Rebuild a clone's status
      // control instead of inheriting an inert control from its source slide.
      frame.querySelector(':scope > .media-status')?.remove();
      const original = image.dataset.original || image.getAttribute('src');
      const status = document.createElement('span');
      status.className = 'media-status';
      status.hidden = true;
      const label = document.createElement('span');
      label.setAttribute('role', 'status');
      const retry = document.createElement(frame.matches('button') ? 'span' : 'button');
      if (retry.tagName === 'BUTTON') retry.type = 'button';
      status.append(label, retry);
      frame.append(status);
      let attempts = 0;
      let generation = 0;
      let failedGeneration = -1;
      let timer;
      const record = { frame, update };
      records.add(record);

      function update() {
        const words = copy();
        const failed = frame.dataset.mediaState === 'error';
        label.textContent = failed ? words.error : words.loading;
        retry.hidden = !failed;
        retry.textContent = frame.matches('button') ? words.tap : words.retry;
      }
      function loading() {
        generation += 1;
        clearTimeout(timer);
        frame.dataset.mediaState = 'loading';
        status.hidden = true;
        update();
        timer = setTimeout(() => { if (frame.isConnected) status.hidden = false; }, 450);
      }
      function reload() {
        if (!frame.isConnected) return;
        loading();
        // One automatic fallback to the preserved original also covers format errors.
        image.removeAttribute('srcset');
        image.loading = 'eager';
        image.src = `${original}${original.includes('?') ? '&' : '?'}retry=${Date.now()}`;
      }
      function failed() {
        if (failedGeneration === generation) return;
        failedGeneration = generation;
        clearTimeout(timer);
        if (attempts++ === 0) {
          timer = setTimeout(reload, 650);
        } else {
          frame.dataset.mediaState = 'error';
          status.hidden = false;
          update();
        }
      }
      async function loaded() {
        const run = generation;
        try { if (image.decode) await image.decode(); }
        catch (_) { if (run === generation) failed(); return; }
        if (run !== generation || !frame.isConnected) return;
        clearTimeout(timer);
        frame.dataset.mediaState = 'ready';
        status.hidden = true;
        const ambient = frame.querySelector('.beyond-work__travel-ambient');
        if (ambient) { ambient.removeAttribute('srcset'); ambient.src = image.currentSrc || image.src; }
      }
      const retryTarget = frame.matches('button') ? frame : retry;
      retryTarget.addEventListener('click', () => {
        if (frame.dataset.mediaState === 'error') reload();
      });
      image.addEventListener('load', loaded);
      image.addEventListener('error', failed);
      loading();
      if (image.complete) {
        if (image.naturalWidth) loaded();
        else if (image.currentSrc) failed();
      }
      if (approaching) approaching.observe(frame);
      else prepare(frame);
    });
  }

  document.addEventListener('app:languagechange', () => {
    records.forEach(record => {
      if (record.frame.isConnected) record.update();
      else records.delete(record);
    });
  });
  window.SiteImages = { url, srcset, enhance, prepare };
  function initialize() {
    enhance();
    const slides = document.querySelector('.portfolio__container .swiper-wrapper');
    if (slides) new MutationObserver(() => enhance(slides)).observe(slides, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
