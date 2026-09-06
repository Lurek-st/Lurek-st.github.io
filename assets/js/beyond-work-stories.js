import { arrangeInRows, contactError, solveContacts } from "./stories-physics.js";

const D3_FORCE_URL = "https://cdn.jsdelivr.net/npm/d3-force@3.0.0/+esm";

const STORY_ASSETS = {
  "star-trek": "assets/img/beyond-work/stories/star-trek.jpg",
  rick: "assets/img/beyond-work/stories/rick-and-morty.jpg",
  family: "assets/img/beyond-work/stories/family-guy.jpg",
  "star-vs": "assets/img/beyond-work/stories/star-vs-the-forces-of-evil.jpg",
  orville: "assets/img/beyond-work/stories/the-orville.jpg",
  dad: "assets/img/beyond-work/stories/american-dad.jpg",
  "bad-guys": "assets/img/beyond-work/stories/the-bad-guys.jpg",
  pokemon: "assets/img/beyond-work/stories/pokemon.jpg",
  "star-wars": "assets/img/beyond-work/stories/marvel.jpg",
  kingsman: "assets/img/beyond-work/stories/kingsman.jpg",
  futurama: "assets/img/beyond-work/stories/futurama.jpg"
};

const DESKTOP_SPECS = {
  "star-trek": { tier: "core", radius: 72, x: .34, y: .48 }, rick: { tier: "core", radius: 72, x: .66, y: .52 },
  orville: { tier: "secondary", radius: 56, x: .13, y: .47 }, futurama: { tier: "secondary", radius: 56, x: .50, y: .14 },
  family: { tier: "satellite", radius: 50, x: .78, y: .22 }, dad: { tier: "satellite", radius: 50, x: .88, y: .42 },
  "bad-guys": { tier: "satellite", radius: 50, x: .85, y: .70 }, kingsman: { tier: "satellite", radius: 50, x: .38, y: .86 },
  pokemon: { tier: "secondary", radius: 56, x: .22, y: .23 }, "star-vs": { tier: "long", radius: 54, x: .18, y: .73 },
  "star-wars": { tier: "secondary", radius: 56, x: .68, y: .84 }
};

const PORTRAIT_POINTS = {
  "star-trek": { x: .32, y: .47 }, rick: { x: .68, y: .49 }, futurama: { x: .50, y: .28 }, pokemon: { x: .34, y: .09 },
  family: { x: .66, y: .10 }, orville: { x: .12, y: .30 }, dad: { x: .88, y: .31 }, "star-vs": { x: .14, y: .66 },
  "bad-guys": { x: .86, y: .68 }, kingsman: { x: .50, y: .66 }, "star-wars": { x: .50, y: .84 }
};

const TABLET_RADII = { core: 64, secondary: 52, satellite: 46, long: 50 };
const MOBILE_RADII = { core: 56, secondary: 46, satellite: 42, long: 44 };
const FORCE = { positionStrength: .055, collisionStrength: .95, collisionIterations: 3, collisionPadding: 2, desktopEdgePadding: 10, mobileEdgePadding: 8, velocityDecay: .45, desktopHoverScale: 1.4, tapScale: 1.3, expandDuration: 180, tapExpandDuration: 200, shrinkDuration: 240, hoverAlpha: .35, leaveAlpha: .28 };
const REST_LAYOUT = { desktopSpan: .66, portraitHeight: .68, gap: 8 };
const STEP_MS = 1000 / 60;

let controllerPromise;

export function initStories() {
  if (!controllerPromise) controllerPromise = createStoriesController();
  return controllerPromise;
}

async function createStoriesController() {
  const cluster = document.querySelector("#beyond-work [data-beyond-work-stories-cluster]");
  const preview = document.querySelector("#beyond-work [data-beyond-work-stories-preview]");
  const buttons = cluster ? [...cluster.querySelectorAll("button[data-story]")] : [];
  if (!cluster || !preview || buttons.length !== 11) throw new Error("Stories runtime requires the existing 11-button cluster and preview host.");

  const d3 = await import(D3_FORCE_URL);
  const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointerMedia = window.matchMedia("(hover: hover) and (pointer: fine)");
  const cache = new Map();
  let selectedId = buttons.find((button) => button.getAttribute("aria-selected") === "true")?.dataset.story || buttons[0].dataset.story;
  let requestId = 0;
  let activeSlot = 0;
  let activePreviewId = selectedId;
  let simulation;
  let collideForce;
  let xForce;
  let yForce;
  let width = 0;
  let height = 0;
  let layout = "desktop";
  let interaction = "hover";
  let hovered;
  let tapped;
  let frameId = 0;
  let lastTimestamp = 0;
  let accumulatedTime = 0;
  let blockedGrowthMs = 0;

  const nodes = buttons.map((button) => {
    const spec = DESKTOP_SPECS[button.dataset.story];
    return { id: button.dataset.story, button, tier: spec.tier, isCore: spec.tier === "core", normalRadius: spec.radius, currentRadius: spec.radius, x: 0, y: 0, vx: 0, vy: 0, radiusAnimation: null, activeAnchor: null };
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  function layoutMode() { return window.innerWidth < 600 ? "mobile" : window.innerWidth < 900 ? "tablet" : "desktop"; }
  function interactionMode() { return finePointerMedia.matches ? "hover" : "tap"; }
  function edgePadding() { return layout === "mobile" ? FORCE.mobileEdgePadding : FORCE.desktopEdgePadding; }
  function radiusFor(node) { return layout === "desktop" ? DESKTOP_SPECS[node.id].radius : layout === "tablet" ? TABLET_RADII[node.tier] : MOBILE_RADII[node.tier]; }
  function pointFor(node) {
    if (layout === "desktop") return DESKTOP_SPECS[node.id];
    const point = PORTRAIT_POINTS[node.id];
    if (layout === "mobile" && node.isCore) {
      const side = node.id === "star-trek" ? -1 : 1;
      // Narrow screens need a diagonal contact: two large circles cannot
      // expand side by side against both walls, even with space above them.
      const stagger = Math.max(0, Math.min(1, (320 - width) / 40)) * .06;
      return { x: side < 0 ? .29 : .71, y: point.y + side * stagger };
    }
    return point;
  }
  function restPositions() {
    const centerX = width / 2; const centerY = height / 2;
    const spanX = layout === "desktop" ? REST_LAYOUT.desktopSpan : 1;
    const spanY = layout === "desktop" ? REST_LAYOUT.desktopSpan : REST_LAYOUT.portraitHeight;
    const targets = nodes.map((node) => {
      const point = pointFor(node);
      return { id: node.id, isCore: node.isCore, currentRadius: node.normalRadius, vx: 0, vy: 0,
        x: centerX + (point.x * width - centerX) * spanX,
        y: centerY + (point.y * height - centerY) * spanY };
    });
    // Pack the resting targets themselves, at normal size. Springs can then
    // return to a feasible cluster without continuously fighting collisions.
    if (!solveContacts(targets, width, height, edgePadding(), REST_LAYOUT.gap, 480)) {
      solveContacts(targets, width, height, edgePadding(), FORCE.collisionPadding * 2, 480);
    }
    const left = Math.min(...targets.map((node) => node.x - node.currentRadius));
    const right = Math.max(...targets.map((node) => node.x + node.currentRadius));
    const top = Math.min(...targets.map((node) => node.y - node.currentRadius));
    const bottom = Math.max(...targets.map((node) => node.y + node.currentRadius));
    targets.forEach((node) => { node.x += centerX - (left + right) / 2; node.y += centerY - (top + bottom) / 2; });
    return targets;
  }
  function solve(iterations) { return solveContacts(nodes, width, height, edgePadding(), FORCE.collisionPadding * 2, iterations); }
  function snapshot() {
    return nodes.map((node) => ({ x: node.x, y: node.y, vx: node.vx, vy: node.vy, currentRadius: node.currentRadius,
      radiusAnimation: node.radiusAnimation ? { ...node.radiusAnimation } : null }));
  }
  function restore(saved) { nodes.forEach((node, index) => Object.assign(node, saved[index])); }
  function renderNodes() {
    nodes.forEach((node) => {
      const diameter = node.currentRadius * 2;
      node.button.style.width = `${diameter}px`; node.button.style.height = `${diameter}px`;
      node.button.style.transform = `translate3d(${node.x - node.currentRadius}px, ${node.y - node.currentRadius}px, 0)`;
    });
  }
  function refreshForces() {
    const strength = (node) => node.activeAnchor ? .12 : node.isCore ? .065 : FORCE.positionStrength;
    xForce.x((node) => node.activeAnchor?.x ?? node.preferredX).strength(strength);
    yForce.y((node) => node.activeAnchor?.y ?? node.preferredY).strength(strength);
    collideForce.radius((node) => node.currentRadius + FORCE.collisionPadding).strength(FORCE.collisionStrength).iterations(FORCE.collisionIterations);
  }
  function wake() {
    if (!frameId && !document.hidden) frameId = requestAnimationFrame(animate);
  }
  function stopFrames() {
    cancelAnimationFrame(frameId); frameId = 0; lastTimestamp = 0; accumulatedTime = 0;
  }
  function reheat(alpha) {
    if (motionMedia.matches) return;
    simulation.alpha(Math.max(simulation.alpha(), alpha)).alphaTarget(0);
    wake();
  }
  function resetInteractions() {
    hovered = null; tapped = null; blockedGrowthMs = 0;
    nodes.forEach((node) => {
      node.radiusAnimation = null; node.activeAnchor = null; node.currentRadius = node.normalRadius;
      node.vx = 0; node.vy = 0; delete node.button.dataset.physicalActive;
    });
  }
  function settle(iterations = 160) {
    simulation.alpha(1);
    for (let index = 0; index < iterations; index += 1) {
      const previous = snapshot(); simulation.tick();
      if (!solve()) { restore(previous); break; }
    }
    nodes.forEach((node) => { node.vx = 0; node.vy = 0; });
    simulation.alpha(0); renderNodes();
  }
  function easeOutCubic(progress) { return 1 - Math.pow(1 - progress, 3); }
  function advanceRadii(elapsed) {
    nodes.forEach((node) => {
      const animation = node.radiusAnimation;
      if (!animation) return;
      animation.elapsed = Math.min(animation.duration, animation.elapsed + elapsed);
      const progress = animation.elapsed / animation.duration;
      node.currentRadius = animation.from + (animation.to - animation.from) * easeOutCubic(progress);
      if (progress >= 1) node.radiusAnimation = null;
    });
  }
  function applyRadiusProposal(previous, proposed, growthFraction) {
    nodes.forEach((node, index) => {
      const before = previous[index]; const requested = proposed[index];
      const growing = requested.currentRadius > before.currentRadius;
      node.currentRadius = growing ? before.currentRadius + (requested.currentRadius - before.currentRadius) * growthFraction : requested.currentRadius;
      if (growing && growthFraction < 1 && before.radiusAnimation) {
        const animation = { ...before.radiusAnimation };
        const fraction = Math.max(0, Math.min(1, (node.currentRadius - animation.from) / (animation.to - animation.from)));
        // The animation clock follows the accepted radius, so a partial step
        // cannot quietly finish the timer before the circle reaches its size.
        animation.elapsed = animation.duration * (1 - Math.cbrt(1 - fraction));
        node.radiusAnimation = animation;
      } else node.radiusAnimation = requested.radiusAnimation ? { ...requested.radiusAnimation } : null;
    });
  }
  function advancePhysics(steps, allowExtraIterations) {
    const project = () => solve() || (allowExtraIterations && solve(360));
    for (let step = 0; step < steps; step += 1) {
      simulation.tick();
      if (!project()) return false;
    }
    // High-refresh displays also paint frames between the fixed physics steps.
    return steps > 0 || project();
  }
  function animate(timestamp) {
    frameId = 0;
    if (document.hidden || motionMedia.matches) { lastTimestamp = 0; accumulatedTime = 0; return; }
    const wallElapsed = lastTimestamp ? Math.max(0, timestamp - lastTimestamp) : STEP_MS;
    const elapsed = Math.min(50, wallElapsed);
    lastTimestamp = timestamp;
    const previous = snapshot();
    const hasRadiusAnimation = nodes.some((node) => node.radiusAnimation);
    advanceRadii(elapsed);
    const proposed = snapshot();
    const returning = !hasRadiusAnimation && nodes.every((node) => !node.activeAnchor);
    // Once interaction ends, give the home springs time to finish their job.
    // Cooling immediately would freeze displaced circles short of the cluster.
    if (returning) simulation.alpha(Math.max(.8, simulation.alpha()));
    else if (hasRadiusAnimation) simulation.alpha(Math.max(.12, simulation.alpha()));
    const alpha = simulation.alpha();
    accumulatedTime = Math.min(accumulatedTime + elapsed, STEP_MS * 3);
    const steps = Math.floor(accumulatedTime / STEP_MS);
    accumulatedTime -= steps * STEP_MS;
    for (const growthFraction of [1, .5, .25, .125, .0625, .015625, 0]) {
      restore(previous); applyRadiusProposal(previous, proposed, growthFraction);
      refreshForces(); simulation.alpha(alpha);
      const resting = growthFraction === 0 ? snapshot() : null;
      if (advancePhysics(steps, growthFraction === 1)) break;
      if (resting) {
        // Shrinking alone cannot violate the previously verified geometry.
        // Always keep that released space, even if all growth has to wait.
        restore(resting);
      }
    }
    const requestedGrowth = previous.some((node) => node.radiusAnimation && node.radiusAnimation.to > node.currentRadius);
    const madeProgress = nodes.some((node, index) => node.currentRadius > previous[index].currentRadius + .00001);
    blockedGrowthMs = requestedGrowth && !madeProgress ? blockedGrowthMs + wallElapsed : 0;
    // A truly immovable arrangement may decline further growth, but a fast
    // display must not turn a frame count into a premature animation cutoff.
    if (blockedGrowthMs >= 1800) {
      nodes.forEach((node) => {
        if (node.radiusAnimation?.to > node.currentRadius) node.radiusAnimation = null;
      });
      blockedGrowthMs = 0;
    }
    if (returning && nodes.every((node) => Math.hypot(node.x - node.preferredX, node.y - node.preferredY) < .12)) {
      nodes.forEach((node) => { node.vx = 0; node.vy = 0; });
      simulation.alpha(0);
    }
    renderNodes();
    if (nodes.some((node) => node.radiusAnimation) || simulation.alpha() > simulation.alphaMin()) wake();
    else { lastTimestamp = 0; accumulatedTime = 0; }
  }
  function start(preserve = false) {
    const rect = cluster.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const oldWidth = width; const oldHeight = height; const priorLayout = layout; const priorInteraction = interaction;
    width = rect.width; height = rect.height; layout = layoutMode(); interaction = interactionMode();
    const reset = motionMedia.matches || priorLayout !== layout || priorInteraction !== interaction;
    nodes.forEach((node) => { node.normalRadius = radiusFor(node); });
    if (reset) resetInteractions();
    const targets = restPositions();
    nodes.forEach((node, index) => {
      if (!node.radiusAnimation && !node.activeAnchor) node.currentRadius = node.normalRadius;
      node.preferredX = targets[index].x; node.preferredY = targets[index].y;
      if (preserve && oldWidth && oldHeight && !motionMedia.matches) {
        node.x = node.x / oldWidth * width; node.y = node.y / oldHeight * height;
        if (node.activeAnchor) { node.activeAnchor.x *= width / oldWidth; node.activeAnchor.y *= height / oldHeight; }
      } else { node.x = node.preferredX; node.y = node.preferredY; }
      node.vx = 0; node.vy = 0;
    });
    // A previous frame is only a valid fallback in its original container.
    // Re-establish feasibility synchronously on resize, before the browser paints.
    if (!solve(480)) {
      resetInteractions();
      if (!solve(480)) {
        const scale = arrangeInRows(nodes, width, height, edgePadding(), FORCE.collisionPadding * 2);
        if (scale === null) throw new Error("Stories container has no usable layout area.");
        nodes.forEach((node) => { node.normalRadius *= scale; });
      }
    }
    refreshForces(); stopFrames();
    if (motionMedia.matches) settle();
    else { renderNodes(); reheat(preserve ? .32 : 1); }
  }
  function transitionRadius(node, target, duration) {
    if (!node) return;
    node.radiusAnimation = { from: node.currentRadius, to: target, duration, elapsed: 0 };
    if (target > node.currentRadius) blockedGrowthMs = 0;
  }
  function release(node, reheatAfter = true) {
    if (!node) return;
    delete node.button.dataset.physicalActive; node.activeAnchor = null;
    transitionRadius(node, node.normalRadius, FORCE.shrinkDuration); refreshForces();
    if (reheatAfter) reheat(FORCE.leaveAlpha);
  }
  function activate(node, type) {
    if (!node || motionMedia.matches) return;
    const current = type === "hover" ? hovered : tapped; if (node === current) return;
    if (current) release(current, false); if (type === "hover") hovered = node; else tapped = node;
    node.activeAnchor = { x: node.x, y: node.y }; node.button.dataset.physicalActive = "true";
    transitionRadius(node, node.normalRadius * (type === "hover" ? FORCE.desktopHoverScale : FORCE.tapScale), type === "hover" ? FORCE.expandDuration : FORCE.tapExpandDuration); reheat(FORCE.hoverAlpha);
  }
  function titleFor(id) { return nodeById.get(id)?.button.textContent.trim() || id; }
  function altFor(id) { const title = titleFor(id); return document.documentElement.lang.startsWith("zh") ? `${title} \u7684\u5c55\u793a\u56fe\u7247` : `Preview image for ${title}`; }
  function ensurePreviewMarkup() {
    if (preview.dataset.previewRenderer === "ready") return;
    const source = preview.querySelector(".beyond-work__stories-preview-image")?.getAttribute("src") || STORY_ASSETS[selectedId];
    preview.dataset.previewRenderer = "ready";
    preview.innerHTML = `<div class="beyond-work__stories-preview-slot is-active" data-preview-slot="0" aria-hidden="false"><img class="beyond-work__stories-preview-background" src="${source}" alt="" aria-hidden="true"><img class="beyond-work__stories-preview-foreground" src="${source}" alt="${altFor(selectedId)}"></div><div class="beyond-work__stories-preview-slot" data-preview-slot="1" aria-hidden="true"><img class="beyond-work__stories-preview-background" alt="" aria-hidden="true"><img class="beyond-work__stories-preview-foreground" alt=""></div><div class="beyond-work__stories-preview-fallback" aria-hidden="true"><span></span></div><figcaption></figcaption>`;
  }
  function preload(id) {
    if (cache.has(id)) return cache.get(id).promise;
    const src = STORY_ASSETS[id]; const entry = { status: "loading", promise: null };
    entry.promise = new Promise((resolve, reject) => { const image = new Image(); image.onload = async () => { try { if (image.decode) await image.decode(); } catch (_) {} entry.status = "ready"; resolve(src); }; image.onerror = () => { entry.status = "error"; reject(new Error(`Story preview failed to load: ${id}`)); }; image.src = src; });
    cache.set(id, entry); return entry.promise;
  }
  function updatePreviewLanguage() { const caption = preview.querySelector("figcaption"); const active = preview.querySelector(".beyond-work__stories-preview-slot.is-active .beyond-work__stories-preview-foreground"); if (caption) caption.textContent = titleFor(selectedId); if (active) active.alt = altFor(selectedId); const fallback = preview.querySelector(".beyond-work__stories-preview-fallback span"); if (fallback) fallback.textContent = titleFor(selectedId); }
  function renderPreview(id, src) {
    const slots = [...preview.querySelectorAll(".beyond-work__stories-preview-slot")]; const current = slots[activeSlot]; const nextIndex = activePreviewId ? 1 - activeSlot : activeSlot; const next = slots[nextIndex];
    next.querySelector(".beyond-work__stories-preview-background").src = src; const foreground = next.querySelector(".beyond-work__stories-preview-foreground"); foreground.src = src; foreground.alt = altFor(id); next.setAttribute("aria-hidden", "false");
    preview.querySelector(".beyond-work__stories-preview-fallback")?.classList.remove("is-active"); requestAnimationFrame(() => { next.classList.add("is-active"); if (current !== next) { current.classList.remove("is-active"); current.setAttribute("aria-hidden", "true"); current.querySelector(".beyond-work__stories-preview-foreground").alt = ""; } });
    activeSlot = nextIndex; activePreviewId = id; updatePreviewLanguage();
  }
  function select(id) {
    if (!nodeById.has(id)) return; selectedId = id;
    buttons.forEach((button) => { const selected = button.dataset.story === id; button.setAttribute("aria-selected", String(selected)); button.classList.toggle("is-selected", selected); button.tabIndex = selected ? 0 : -1; });
    const nextRequest = ++requestId; preload(id).then((src) => { if (nextRequest === requestId && selectedId === id) renderPreview(id, src); }).catch((error) => console.warn(error.message));
  }
  function refreshLayout() { start(true); }

  ensurePreviewMarkup();
  xForce = d3.forceX((node) => node.preferredX); yForce = d3.forceY((node) => node.preferredY); collideForce = d3.forceCollide((node) => node.currentRadius + FORCE.collisionPadding);
  // One clock owns radius changes, integration, contact resolution and painting.
  // Keep D3's internal timer stopped throughout the controller's lifetime.
  simulation = d3.forceSimulation(nodes).stop().force("x", xForce).force("y", yForce).force("collide", collideForce).velocityDecay(FORCE.velocityDecay).alphaDecay(.055);
  cluster.classList.add("is-stories-runtime"); cluster.dataset.forceStatus = "ready"; cluster.dataset.forceActive = "true";
  buttons.forEach((button) => {
    button.disabled = false;
    const node = nodeById.get(button.dataset.story);
    button.addEventListener("pointerenter", () => { if (interaction === "hover") { activate(node, "hover"); select(node.id); } });
    button.addEventListener("pointerleave", () => { if (interaction === "hover" && hovered === node) { release(hovered); hovered = null; } });
    button.addEventListener("focus", () => select(node.id));
    button.addEventListener("click", () => { select(node.id); if (interaction === "tap") activate(node, "tap"); });
    button.addEventListener("keydown", (event) => {
      const current = buttons.indexOf(button);
      let next = current;
      if (["ArrowRight", "ArrowDown"].includes(event.key)) next = (current + 1) % buttons.length;
      else if (["ArrowLeft", "ArrowUp"].includes(event.key)) next = (current - 1 + buttons.length) % buttons.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = buttons.length - 1;
      else return;
      event.preventDefault(); select(buttons[next].dataset.story); buttons[next].focus();
    });
  });
  new ResizeObserver(refreshLayout).observe(cluster); window.addEventListener("resize", refreshLayout);
  motionMedia.addEventListener("change", refreshLayout); finePointerMedia.addEventListener("change", refreshLayout);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopFrames();
    else if (!motionMedia.matches && (nodes.some((node) => node.radiusAnimation) || simulation.alpha() > simulation.alphaMin())) wake();
  });
  start(false); select(selectedId);
  return { setLanguage() { updatePreviewLanguage(); if (motionMedia.matches) settle(180); else reheat(.12); }, getState() { return { nodeCount: nodes.length, selectedId, activePreviewId, previewCount: Object.keys(STORY_ASSETS).length, width, height, layout, simulation: 1, running: Boolean(frameId), contactError: contactError(nodes, width, height, edgePadding(), FORCE.collisionPadding * 2) }; } };
}
