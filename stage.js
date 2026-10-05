/* Independent enhancement for the local candidate. Four images, four identities. */
(() => {
  'use strict';
  const root = document.querySelector('#portfolio [data-project-showcase]');
  if (!root) return;
  const panels = [...root.querySelectorAll('[data-project-panel]')];
  const frames = panels.map(panel => panel.querySelector('[data-project-surface]'));
  if (panels.length !== 4 || frames.some(frame => !frame?.querySelector('img'))) return;

  const compact = matchMedia('(max-width: 1023px)');
  const stacked = matchMedia('(max-width: 559px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const directory = document.createElement('div');
  const canvas = document.createElement('div');
  directory.className = 'project-directory';
  directory.setAttribute('role', 'tablist');
  directory.setAttribute('aria-labelledby', 'stage-project-heading');
  canvas.className = 'project-canvas';
  canvas.dataset.projectCanvas = '';
  const buttons = [];
  const previews = [];
  let selected = 0;
  let generation = 0;
  let canvasWidth = 0;
  let resizeFrame = 0;
  const animations = new Set();
  const motionOff = () => reduced.matches || document.body.classList.contains('motion-paused');
  const transform = pose => `translate(${pose.x}px, ${pose.y}px) scale(${pose.scale}) rotate(${pose.angle}deg)`;

  function readPose(frame) {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(frame).transform);
    return { x: matrix.m41, y: matrix.m42, scale: Math.hypot(matrix.a, matrix.b), angle: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI };
  }

  function cancelMotion() {
    generation += 1;
    animations.forEach(animation => animation.cancel());
    animations.clear();
    root.dataset.projectMoving = 'false';
  }

  function layout() {
    const width = canvas.clientWidth;
    if (!width) return null;
    const mainHeight = width * 10 / 16;
    const angles = compact.matches ? [-7, 4, 6] : [-8, 5, 7];
    const radians = angles.map(angle => angle * Math.PI / 180);
    const spanFactors = radians.map(angle => Math.cos(angle) + Math.abs(Math.sin(angle)) * 10 / 16);
    const gap = Math.min(26, Math.max(10, width * .04));
    const smallWidth = Math.min(compact.matches ? 134 : 156, (width - 16 - 2 * gap) / spanFactors.reduce((sum, value) => sum + value, 0));
    const smallHeight = smallWidth * 10 / 16;
    const totalWidth = smallWidth * spanFactors.reduce((sum, value) => sum + value, 0) + 2 * gap;
    const row = mainHeight + (compact.matches ? 30 : 40);
    const offsets = compact.matches ? [10, 26, 0] : [12, 34, 0];
    const poses = [];
    let cursor = (width - totalWidth) / 2;
    let bottom = row;
    let slot = 0;
    frames.forEach((frame, index) => {
      frame.style.width = `${width}px`;
      frame.style.height = `${mainHeight}px`;
      if (index === selected) poses.push({ x: 0, y: 0, scale: 1, angle: 0 });
      else {
        const angle = radians[slot];
        const minX = Math.min(0, -Math.sin(angle) * smallHeight);
        const minY = Math.min(0, Math.sin(angle) * smallWidth);
        const rotatedHeight = Math.abs(Math.sin(angle)) * smallWidth + Math.cos(angle) * smallHeight;
        poses.push({ x: cursor - minX, y: row + offsets[slot] - minY, scale: smallWidth / width, angle: angles[slot] });
        cursor += smallWidth * spanFactors[slot] + gap;
        bottom = Math.max(bottom, row + offsets[slot] + rotatedHeight);
        slot += 1;
      }
    });
    canvas.style.height = `${Math.ceil(bottom + 14)}px`;
    canvasWidth = width;
    directory.setAttribute('aria-orientation', stacked.matches ? 'horizontal' : 'vertical');
    return poses;
  }

  function state() {
    root.dataset.projectSelected = panels[selected].dataset.projectPanel;
    panels.forEach((panel, index) => {
      const active = index === selected;
      panel.hidden = !active;
      panel.inert = !active;
      panel.setAttribute('aria-hidden', String(!active));
      buttons[index].setAttribute('aria-selected', String(active));
      buttons[index].tabIndex = active ? 0 : -1;
      previews[index].hidden = active;
      frames[index].dataset.projectActive = String(active);
      frames[index].querySelector('img').setAttribute('aria-hidden', String(!active));
    });
  }

  function settle() {
    cancelMotion();
    const poses = layout();
    if (!poses) return;
    frames.forEach((frame, index) => {
      frame.style.transform = transform(poses[index]);
      frame.style.zIndex = index === selected ? '4' : '2';
    });
  }

  function select(index) {
    if (index === selected || index < 0 || index >= panels.length) return;
    // Capture the on-screen pose before cancelling an interrupted animation.
    const before = frames.map(readPose);
    const old = selected;
    cancelMotion();
    selected = index;
    state();
    const after = layout();
    if (!after) return;
    const duration = compact.matches ? 400 : 650;
    const run = generation;
    const shouldAnimate = !motionOff() && typeof frames[0].animate === 'function';
    root.dataset.projectMoving = String(shouldAnimate);
    frames.forEach((frame, item) => {
      frame.style.zIndex = item === selected ? '6' : item === old ? '5' : '2';
      frame.style.transform = transform(after[item]);
      if (!shouldAnimate) return;
      const from = before[item];
      const to = after[item];
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      const arc = Math.min(compact.matches ? 18 : 36, distance * .085);
      const keyframes = Array.from({ length: 13 }, (_, step) => {
        const t = step / 12;
        return { offset: t, transform: transform({
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t - arc * 4 * t * (1 - t),
          scale: from.scale + (to.scale - from.scale) * t,
          angle: from.angle + (to.angle - from.angle) * t
        }) };
      });
      const animation = frame.animate(keyframes, { duration, easing: 'cubic-bezier(.22, .75, .25, 1)' });
      animations.add(animation);
    });
    if (shouldAnimate) {
      animations.add(panels[selected].animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180 }));
      Promise.allSettled([...animations].map(animation => animation.finished)).then(() => {
        if (run !== generation) return;
        animations.clear();
        root.dataset.projectMoving = 'false';
        frames.forEach((frame, item) => { frame.style.zIndex = item === selected ? '4' : '2'; });
      });
    }
  }

  try {
    panels.forEach((panel, index) => {
      const key = panel.dataset.projectPanel;
      const title = panel.querySelector('h3');
      const button = document.createElement('button');
      const label = document.createElement('span');
      label.textContent = title.textContent.trim();
      label.setAttribute('i18n', title.getAttribute('i18n'));
      label.id = `stage-label-${key}`;
      button.append(label);
      button.type = 'button';
      button.className = 'project-tab';
      button.id = `stage-tab-${key}`;
      button.dataset.projectSelect = key;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', `stage-panel-${key}`);
      button.addEventListener('click', () => select(index));
      button.addEventListener('keydown', event => {
        const verticalStep = stacked.matches ? 2 : 1;
        const movement = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: verticalStep, ArrowUp: -verticalStep };
        let next;
        if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = panels.length - 1;
        else if (event.key in movement) next = (index + movement[event.key] + panels.length) % panels.length;
        else return;
        event.preventDefault();
        buttons[next].focus({ preventScroll: true });
        select(next);
      });
      directory.append(button);
      buttons.push(button);
      panel.id = `stage-panel-${key}`;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', button.id);
      const preview = document.createElement('button');
      preview.type = 'button';
      preview.className = 'project-preview-button';
      preview.dataset.projectPreview = key;
      preview.setAttribute('aria-labelledby', label.id);
      // Equivalent keyboard access is provided by the four named tabs.
      preview.tabIndex = -1;
      preview.addEventListener('click', () => select(index));
      frames[index].append(preview);
      previews.push(preview);
      canvas.append(frames[index]);
    });
    root.prepend(directory);
    root.insertBefore(canvas, root.querySelector('.project-copy'));
    root.dataset.projectReady = '';
    state();
    settle();
    const refresh = () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(settle); };
    if ('ResizeObserver' in window) new ResizeObserver(() => {
      if (Math.abs(canvas.clientWidth - canvasWidth) > .5) refresh();
    }).observe(canvas);
    window.addEventListener('resize', refresh, { passive: true });
    document.addEventListener('app:languagechange', refresh);
    reduced.addEventListener('change', refresh);
    compact.addEventListener('change', refresh);
    stacked.addEventListener('change', refresh);
    new MutationObserver(refresh).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    document.fonts?.ready.then(refresh);
  } catch (error) {
    cancelMotion();
    delete root.dataset.projectReady;
    panels.forEach((panel, index) => {
      panel.hidden = false;
      panel.inert = false;
      panel.removeAttribute('aria-hidden');
      panel.removeAttribute('role');
      panel.removeAttribute('aria-labelledby');
      const frame = frames[index];
      frame.removeAttribute('style');
      frame.querySelector('img').removeAttribute('aria-hidden');
      frame.querySelector('.project-preview-button')?.remove();
      panel.prepend(frame);
    });
    directory.remove();
    canvas.remove();
    console.error('Project enhancement unavailable; original project articles retained.', error);
  }

  function emailLinks() {
    const copy = document.querySelector('#contact [i18n="email__address"]');
    if (!copy || copy.querySelector('a')) return;
    [...copy.childNodes].forEach(node => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      const address = node.textContent.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return;
      const link = document.createElement('a');
      link.href = `mailto:${address}`;
      link.textContent = address;
      node.replaceWith(link);
    });
  }
  emailLinks();
  document.addEventListener('app:languagechange', emailLinks);
})();
