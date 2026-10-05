/* Independent enhancements for the local candidate. Static content is the fallback. */
(() => {
  'use strict';
  const root = document.querySelector('[data-skill-showcase]');
  const stack = root?.querySelector('[data-skill-panels]');
  const panels = Array.from(root?.querySelectorAll('[data-skill-panel]') || []);
  if (!root || !stack || panels.length < 2) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const canMove = () => !reduced.matches && !document.body.classList.contains('motion-paused') && typeof stack.animate === 'function';
  const ease = 'cubic-bezier(.22,.8,.22,1)';
  let selected = 0;
  let generation = 0;
  let heightAnimation;
  let markerAnimation;
  let layoutFrame;
  let resizeObserver;
  let bodyObserver;
  const animations = new Set();
  const buttons = [];
  const directory = document.createElement('div');
  const marker = document.createElement('span');

  function animate(element, frames, timing) {
    const animation = element.animate(frames, timing);
    animations.add(animation);
    animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
    return animation;
  }

  function cancelMotion() {
    generation += 1;
    animations.forEach(animation => animation.cancel());
    animations.clear();
    heightAnimation?.cancel();
    markerAnimation?.cancel();
    panels.forEach((panel, index) => {
      const active = index === selected;
      panel.hidden = !active;
      panel.inert = !active;
      panel.setAttribute('aria-hidden', String(!active));
      panel.tabIndex = active ? 0 : -1;
    });
    root.dataset.skillPhase = 'rest';
  }

  function sizePanel(moving = false, previousHeight = stack.getBoundingClientRect().height) {
    heightAnimation?.cancel();
    const height = Math.ceil(panels[selected].offsetHeight);
    if (!height) return;
    stack.style.height = `${height}px`;
    if (moving && canMove() && Math.abs(height - previousHeight) > 1) {
      heightAnimation = stack.animate([{ height: `${previousHeight}px` }, { height: `${height}px` }], {
        duration: 480, easing: ease
      });
    }
  }

  function placeMarker(moving = false) {
    const button = buttons[selected];
    if (!button) return;
    const base = directory.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    const label = button.firstElementChild.getBoundingClientRect();
    const width = Math.min(label.width, rect.width - 12);
    const transform = `translate(${rect.left - base.left + (rect.width - width) / 2}px, ${rect.bottom - base.top - 4}px) scaleX(${width})`;
    const from = getComputedStyle(marker).transform;
    markerAnimation?.cancel();
    marker.style.transform = transform;
    if (moving && canMove() && from !== 'none') {
      markerAnimation = marker.animate([{ transform: from }, { transform }], { duration: 440, easing: ease });
    }
  }

  function requestLayout() {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(() => {
      cancelMotion();
      sizePanel();
      placeMarker();
    });
  }

  function select(index, focus = false) {
    if (focus) buttons[index].focus({ preventScroll: true });
    if (index === selected) return;
    const outgoing = panels[selected];
    const previousHeight = stack.getBoundingClientRect().height;
    const previousOpacity = Number(getComputedStyle(outgoing).opacity);
    const previousTransform = getComputedStyle(outgoing).transform;
    const indicatorFrom = getComputedStyle(marker).transform;
    cancelMotion();
    selected = index;
    const incoming = panels[selected];
    panels.forEach((panel, i) => {
      const active = i === selected;
      panel.hidden = !active;
      panel.inert = !active;
      panel.setAttribute('aria-hidden', String(!active));
      panel.tabIndex = active ? 0 : -1;
      buttons[i].setAttribute('aria-selected', String(active));
      buttons[i].tabIndex = active ? 0 : -1;
    });
    root.dataset.skillSelected = incoming.dataset.skillPanel;
    // Keep the indicator's current visual position during interrupted selections.
    marker.style.transform = indicatorFrom;
    placeMarker(true);
    sizePanel(true, previousHeight);
    if (!canMove()) return;

    const ticket = generation;
    const delay = focus || previousOpacity < .15 ? 0 : 90;
    root.dataset.skillPhase = 'changing';
    if (delay) {
      outgoing.hidden = false;
      const exit = animate(outgoing, [
        { opacity: previousOpacity, transform: previousTransform },
        { opacity: 0, transform: 'translateY(-6px)' }
      ], { duration: 110, easing: 'cubic-bezier(.4,0,.8,.5)', fill: 'forwards' });
      exit.finished.then(() => {
        if (generation === ticket && outgoing !== panels[selected]) outgoing.hidden = true;
        exit.cancel();
      }, () => {});
    }
    const enter = animate(incoming, [
      { opacity: 0, transform: 'translateY(12px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 420, delay, easing: ease, fill: 'backwards' });
    const details = Array.from(incoming.querySelectorAll('.skill-detail'));
    const movements = details.map((detail, i) => animate(detail, [
      { transform: 'translateY(6px)' }, { transform: 'translateY(0)' }
    ], { duration: 440, delay: delay + 25 + i * 22, easing: ease, fill: 'backwards' }));
    Promise.all([enter, ...movements].map(animation => animation.finished)).then(() => {
      if (generation === ticket) root.dataset.skillPhase = 'rest';
    }, () => {});
  }

  function nextRow(index, direction) {
    const current = buttons[index].getBoundingClientRect();
    const candidates = buttons.map((button, i) => ({ i, rect: button.getBoundingClientRect() }))
      .filter(item => direction > 0 ? item.rect.top > current.top + 4 : item.rect.top < current.top - 4);
    if (!candidates.length) return index;
    const nextTop = direction > 0 ? Math.min(...candidates.map(item => item.rect.top)) : Math.max(...candidates.map(item => item.rect.top));
    const center = current.left + current.width / 2;
    return candidates.filter(item => Math.abs(item.rect.top - nextTop) < 4)
      .sort((a, b) => Math.abs(a.rect.left + a.rect.width / 2 - center) - Math.abs(b.rect.left + b.rect.width / 2 - center))[0].i;
  }

  try {
    directory.className = 'skill-directory';
    directory.setAttribute('role', 'tablist');
    const heading = document.querySelector('#skills .section__title');
    heading.id ||= 'stage-skills-heading';
    directory.setAttribute('aria-labelledby', heading.id);
    panels.forEach((panel, index) => {
      const button = document.createElement('button');
      const label = panel.querySelector('.skill-panel__title');
      const buttonLabel = document.createElement('span');
      if (label.hasAttribute('i18n')) buttonLabel.setAttribute('i18n', label.getAttribute('i18n'));
      buttonLabel.textContent = label.textContent;
      button.append(buttonLabel);
      button.type = 'button';
      button.className = 'skill-tab';
      button.dataset.skillSelect = panel.dataset.skillPanel;
      button.id = `stage-skill-tab-${index + 1}`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', panel.id);
      button.setAttribute('aria-selected', String(index === selected));
      button.tabIndex = index === selected ? 0 : -1;
      button.addEventListener('click', () => select(index));
      button.addEventListener('keydown', event => {
        let target = index;
        if (event.key === 'ArrowRight') target = (index + 1) % panels.length;
        else if (event.key === 'ArrowLeft') target = (index + panels.length - 1) % panels.length;
        else if (event.key === 'ArrowDown') target = nextRow(index, 1);
        else if (event.key === 'ArrowUp') target = nextRow(index, -1);
        else if (event.key === 'Home') target = 0;
        else if (event.key === 'End') target = panels.length - 1;
        else return;
        event.preventDefault();
        select(target, true);
      });
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', button.id);
      panel.tabIndex = index === selected ? 0 : -1;
      panel.hidden = index !== selected;
      panel.inert = index !== selected;
      panel.setAttribute('aria-hidden', String(index !== selected));
      buttons.push(button);
      directory.append(button);
    });
    marker.className = 'skill-marker';
    marker.setAttribute('aria-hidden', 'true');
    directory.append(marker);
    root.prepend(directory);
    root.dataset.skillReady = '';
    root.dataset.skillSelected = panels[selected].dataset.skillPanel;
    root.dataset.skillPhase = 'rest';
    sizePanel();
    placeMarker();
    if ('ResizeObserver' in window) {
      // Unhide/rehide during a selection is not a content resize; the selection owns its motion.
      const sizes = new WeakMap();
      resizeObserver = new ResizeObserver(entries => {
        let changed = false;
        for (const entry of entries) {
          const size = `${entry.contentRect.width}:${entry.contentRect.height}`;
          const old = sizes.get(entry.target);
          sizes.set(entry.target, size);
          if (old && old !== size && entry.target === panels[selected] && entry.contentRect.height > 0 && old !== '0:0') changed = true;
        }
        if (changed) requestLayout();
      });
      panels.forEach(panel => resizeObserver.observe(panel));
    }
    window.addEventListener('resize', requestLayout);
    document.addEventListener('app:languagechange', requestLayout);
    document.fonts?.ready?.then(requestLayout);
    reduced.addEventListener('change', requestLayout);
    bodyObserver = new MutationObserver(() => { if (!canMove()) requestLayout(); });
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  } catch (error) {
    cancelMotion();
    resizeObserver?.disconnect();
    bodyObserver?.disconnect();
    directory.remove();
    delete root.dataset.skillReady;
    delete root.dataset.skillSelected;
    delete root.dataset.skillPhase;
    stack.style.height = '';
    panels.forEach(panel => {
      panel.hidden = false;
      panel.inert = false;
      ['role', 'aria-labelledby', 'aria-hidden', 'tabindex'].forEach(name => panel.removeAttribute(name));
    });
    console.error('Skills enhancement unavailable; static content retained.', error);
  }
})();

(() => {
  'use strict';
  const surfaces = Array.from(document.querySelectorAll('[data-contact-entrance]'));
  if (!surfaces.length) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const canMove = () => !reduced.matches && !document.body.classList.contains('motion-paused');
  let state = 'idle';
  let observer;
  let bodyObserver;
  let animations = [];
  let watchdog;

  function mark(value) {
    state = value;
    surfaces.forEach(element => { element.dataset.entranceState = value; });
  }
  function finish() {
    clearTimeout(watchdog);
    mark('complete');
    animations.forEach(animation => animation.cancel());
    animations = [];
    observer?.disconnect();
    bodyObserver?.disconnect();
  }
  function enter() {
    if (state !== 'pending') return;
    if (!canMove()) return finish();
    try {
      mark('entering');
      observer?.disconnect();
      const start = document.timeline.currentTime;
      animations = surfaces.map(element => element.animate([
        { opacity: 0, transform: 'translateY(42px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], { duration: 850, easing: 'cubic-bezier(.18,.7,.22,1)' }));
      animations.forEach(animation => { animation.startTime = start; });
      const details = document.querySelectorAll('#contact .stage-heading, #contact .contact__container, .footer__container');
      details.forEach((element, index) => {
        const animation = element.animate([
          { opacity: 0, transform: 'translateY(12px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 600, delay: 80 + index * 65, easing: 'cubic-bezier(.18,.7,.22,1)', fill: 'backwards' });
        animation.startTime = start;
        animations.push(animation);
      });
      Promise.all(animations.map(animation => animation.finished)).then(finish).catch(() => {});
      watchdog = setTimeout(finish, 1300);
    } catch (error) {
      finish();
    }
  }

  try {
    if (!canMove() || !('IntersectionObserver' in window) || typeof surfaces[0].animate !== 'function') return finish();
    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) enter();
    }, { rootMargin: '0px 0px -36px 0px', threshold: 0 });
    mark('pending');
    surfaces.forEach(element => observer.observe(element));
    surfaces.forEach(element => element.addEventListener('focusin', finish, { once: true }));
    reduced.addEventListener('change', () => { if (reduced.matches) finish(); });
    bodyObserver = new MutationObserver(() => { if (!canMove()) finish(); });
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  } catch (error) {
    finish();
  }
})();

/* Complete the existing two-position travel slider's keyboard behavior locally. */
document.addEventListener('keydown', event => {
  if (!(event.target instanceof Element) || !event.target.closest('[data-beyond-work-travel-thumb]')) return;
  const chapter = { Home: 'far', End: 'near', ArrowDown: 'far', ArrowUp: 'near' }[event.key];
  if (!chapter) return;
  const control = event.target.closest('[data-beyond-work-travel-slider]')?.querySelector(`button[data-chapter-target="${chapter}"]`);
  if (!control) return;
  event.preventDefault();
  control.click();
});

/* Preview-only repair: the original controller remains the chapter authority. */
(() => {
  'use strict';
  const slider = document.querySelector('[data-stage] [data-beyond-work-travel-slider]');
  if (!slider) return;

  import('./assets/js/beyond-work-travel.js')
    .then(({ initTravel }) => initTravel())
    .then(controller => {
      if (!controller) return;
      const thumb = slider.querySelector('[data-beyond-work-travel-thumb]');
      const rail = slider.querySelector('.beyond-work__travel-rail');
      const draggable = thumb && window.Draggable?.get(thumb);
      const gsap = window.gsap;
      if (!draggable || !rail || !gsap) return;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)');

      function align(animate) {
        if (draggable.isPressed || draggable.isDragging || !thumb.isConnected) return;
        const near = thumb.getAttribute('aria-valuenow') === '1';
        const x = near ? Math.max(0, rail.clientWidth - thumb.offsetWidth) : 0;
        gsap.killTweensOf(thumb, 'x');
        if (animate && !reduced.matches) gsap.to(thumb, { x, duration: .36, ease: 'power3.out', overwrite: true });
        else gsap.set(thumb, { x });
        slider.querySelectorAll('[data-chapter-target]').forEach(label => {
          const current = (label.dataset.chapterTarget === 'near') === near;
          label.style.opacity = current ? '1' : '.42';
        });
      }

      draggable.addEventListener('release', () => {
        // Let the original release handler apply its chapter threshold first.
        queueMicrotask(() => align(true));
      });
      // A return animation must not keep a stale endpoint after a layout change.
      new ResizeObserver(() => align(false)).observe(rail);
      reduced.addEventListener('change', () => { if (reduced.matches) align(false); });
    })
    .catch(() => { /* The shared runtime retains its existing static fallback. */ });
})();
