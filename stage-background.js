/* Native scrolling composes the whole-page field. Rest is genuinely static. */
(() => {
  'use strict';
  const layer = document.querySelector('[data-stage] .site-field');
  if (!layer) return;
  const svg = layer.querySelector('svg');
  const paths = Array.from(layer.querySelectorAll('[data-field-path]'));
  const maskRect = layer.querySelector('[data-field-mask]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const surfaces = [];
  const ns = 'http://www.w3.org/2000/svg';
  let width = innerWidth;
  let height = innerHeight;
  let targetY = Math.max(0, scrollY);
  let currentY = targetY;
  let previousTime = 0;
  let frame = 0;
  let dirtySize = true;
  let needsProjection = true;
  let lastDrawY = NaN;
  let stopped = false;

  function setState(value) { layer.dataset.fieldState = value; }
  function entranceActive() {
    return !!document.querySelector('[data-contact-entrance][data-entrance-state="entering"]');
  }
  function curve(index, y) {
    const main = index < 4;
    const n = main ? index : index - 4;
    const q = y / (height * 1.25 + 850);
    const spread = (width < 768 ? [ -12, 0, 18, 39 ] : [ -34, 0, 48, 105 ])[n];
    const s = Math.sin(q);
    const c = Math.cos(q * .73);
    const point = (x, v, factor = 1) => (x * width + spread * factor).toFixed(2) + ' ' + (v * height).toFixed(2);
    if (main) {
      return 'M'+point(1.12+s*.06,-.3)+'C'+point(.53+c*.07,.03+s*.10,.55)+' '+point(1.3-s*.06,.31+c*.12,1.2)+' '+point(.68+s*.08,.58+s*.12)+'C'+point(.38-c*.08,.74+s*.12,1.25)+' '+point(.12+s*.05,.83-c*.1,.6)+' '+point(-.27+s*.06,1.28);
    }
    return 'M'+point(-.28,.20+s*.20)+'C'+point(.08+s*.05,-.10+c*.12,.6)+' '+point(.45+s*.06,.32+s*.13,1.2)+' '+point(.68+c*.06,.20+s*.09)+'C'+point(.90+s*.08,.10+s*.12,.8)+' '+point(1.10-c*.04,-.14+s*.10,1.1)+' '+point(1.3,-.20+s*.12);
  }
  function resize() {
    width = document.documentElement.clientWidth;
    height = innerHeight;
    const box = '0 0 '+width+' '+height;
    svg.setAttribute('viewBox', box);
    maskRect.setAttribute('width', width);
    maskRect.setAttribute('height', height);
    const mask = maskRect.parentElement;
    mask.setAttribute('width', width);
    mask.setAttribute('height', height);
    surfaces.forEach(({ drawing }) => {
      drawing.setAttribute('viewBox', box);
      drawing.style.width = width+'px';
      drawing.style.height = height+'px';
    });
    dirtySize = false;
    lastDrawY = NaN;
    needsProjection = true;
  }
  function draw() {
    const y = reduced.matches ? 0 : currentY;
    if (Math.abs(y-lastDrawY) < .05) return;
    paths.forEach((path, i) => path.setAttribute('d',curve(i,y)));
    lastDrawY = y;
    layer.dataset.fieldPosition = y.toFixed(1);
  }
  function project() {
    // Batch geometry reads before writes; includes the one-shot closing transform.
    const boxes = surfaces.map(item => item.host.getBoundingClientRect());
    surfaces.forEach(({ drawing, plane }, i) => {
      const r = boxes[i];
      const visible = r.bottom > 0 && r.top < height;
      plane.hidden = !visible;
      if (!visible) return;
      drawing.style.transform = 'translate('+(-r.left)+'px, '+(-r.top)+'px)';
    });
    needsProjection = false;
  }
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    setState(document.hidden ? 'hidden' : reduced.matches ? 'static-reduced' : 'rest');
  }
  function tick(time) {
    frame = 0;
    if (stopped || document.hidden) return stop();
    if (dirtySize) resize();
    const dt = Math.min(50,previousTime ? time-previousTime : 16.67);
    previousTime = time;
    if (reduced.matches || Math.abs(targetY-currentY) > height*2) currentY = targetY;
    else currentY += (targetY-currentY)*(1-Math.exp(-dt/115));
    if (Math.abs(targetY-currentY) < .2) currentY = targetY;
    draw();
    const entering = entranceActive();
    if (needsProjection || entering) project();
    if (currentY !== targetY || entering) {
      setState('settling');
      frame = requestAnimationFrame(tick);
    } else stop();
  }
  function wake() {
    if (stopped || document.hidden || frame) return;
    setState(reduced.matches ? 'static-reduced' : 'responding');
    frame = requestAnimationFrame(tick);
  }
  function scrollInput() {
    targetY = Math.max(0,scrollY);
    needsProjection = true;
    wake();
  }
  function layoutInput() { dirtySize = true; targetY = Math.max(0,scrollY); wake(); }
  try {
    for (const host of document.querySelectorAll('#contact, .footer__bg')) {
      const plane = document.createElement('div');
      plane.className = 'site-field-surface';
      plane.setAttribute('aria-hidden','true');
      const drawing = document.createElementNS(ns,'svg');
      drawing.setAttribute('focusable','false');
      drawing.setAttribute('preserveAspectRatio','none');
      const use = document.createElementNS(ns,'use');
      use.setAttribute('href','#stage-field-contours');
      use.setAttribute('class','site-field__drawing');
      drawing.append(use);
      plane.append(drawing);
      host.prepend(plane);
      surfaces.push({host,plane,drawing});
    }
    window.addEventListener('scroll',scrollInput,{passive:true});
    window.addEventListener('resize',layoutInput,{passive:true});
    document.addEventListener('app:languagechange',layoutInput);
    document.addEventListener('visibilitychange',() => {
      if (document.hidden) stop();
      else {currentY=targetY=Math.max(0,scrollY);lastDrawY=NaN;layoutInput();}
    });
    reduced.addEventListener('change',() => {currentY=targetY;lastDrawY=NaN;wake();});
    const entranceObserver = new MutationObserver(() => {needsProjection=true;wake();});
    document.querySelectorAll('[data-contact-entrance]').forEach(element => entranceObserver.observe(element,{attributes:true,attributeFilter:['data-entrance-state']}));
    if ('ResizeObserver' in window) {
      const sizeObserver = new ResizeObserver(() => {needsProjection=true;wake();});
      sizeObserver.observe(document.querySelector('.main'));
      sizeObserver.observe(document.querySelector('.footer'));
    }
    document.fonts?.ready?.then(layoutInput);
    window.addEventListener('pageshow',layoutInput);
    resize();
    draw();
    project();
    setState(reduced.matches ? 'static-reduced' : 'rest');
  } catch (_) {
    stopped=true;
    stop();
    surfaces.forEach(({plane}) => plane.remove());
    setState('static-fallback');
  }
})();
