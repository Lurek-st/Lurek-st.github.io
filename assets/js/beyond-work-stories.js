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
  "star-wars": "assets/img/beyond-work/stories/star-wars.jpg",
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
  "star-trek": { x: .36, y: .43 }, rick: { x: .64, y: .47 }, futurama: { x: .50, y: .14 }, pokemon: { x: .23, y: .22 },
  family: { x: .77, y: .23 }, orville: { x: .18, y: .36 }, dad: { x: .84, y: .38 }, "star-vs": { x: .18, y: .64 },
  "bad-guys": { x: .82, y: .65 }, kingsman: { x: .35, y: .80 }, "star-wars": { x: .67, y: .84 }
};

const TABLET_RADII = { core: 64, secondary: 52, satellite: 46, long: 50 };
const MOBILE_RADII = { core: 56, secondary: 46, satellite: 42, long: 44 };
const FORCE = { positionStrength: .08, collisionStrength: .95, collisionIterations: 3, collisionPadding: 2, desktopEdgePadding: 10, mobileEdgePadding: 8, velocityDecay: .45, desktopHoverScale: 1.4, tapScale: 1.3, expandDuration: 180, tapExpandDuration: 200, shrinkDuration: 240, hoverAlpha: .35, leaveAlpha: .28, desktopContraction: .9 };

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
  let radiusFrame = 0;
  let resizeFrame = 0;

  const nodes = buttons.map((button) => {
    const spec = DESKTOP_SPECS[button.dataset.story];
    return { id: button.dataset.story, button, tier: spec.tier, isCore: spec.tier === "core", normalRadius: spec.radius, currentRadius: spec.radius, maxRadius: spec.radius * FORCE.desktopHoverScale, x: 0, y: 0, vx: 0, vy: 0, radiusAnimation: null };
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  function layoutMode() { return window.innerWidth < 600 ? "mobile" : window.innerWidth < 900 ? "tablet" : "desktop"; }
  function interactionMode() { return finePointerMedia.matches ? "hover" : "tap"; }
  function edgePadding() { return layout === "mobile" ? FORCE.mobileEdgePadding : FORCE.desktopEdgePadding; }
  function radiusFor(node) { return layout === "desktop" ? DESKTOP_SPECS[node.id].radius : layout === "tablet" ? TABLET_RADII[node.tier] : MOBILE_RADII[node.tier]; }
  function pointFor(node) {
    if (layout === "desktop") return DESKTOP_SPECS[node.id];
    const point = PORTRAIT_POINTS[node.id];
    if (layout === "mobile" && node.id === "star-trek") return { x: .29, y: point.y };
    if (layout === "mobile" && node.id === "rick") return { x: .71, y: point.y };
    return point;
  }
  function isFixed(node) { return node.fx !== undefined && node.fx !== null && node.fy !== undefined && node.fy !== null; }
  function moveNode(node, dx, dy) { if (!isFixed(node)) { node.x += dx; node.y += dy; node.vx = 0; node.vy = 0; } }
  function constrain(forceNodes = nodes) {
    const padding = edgePadding();
    forceNodes.forEach((node) => {
      if (isFixed(node)) return;
      const minX = node.maxRadius + padding; const maxX = width - node.maxRadius - padding;
      const minY = node.maxRadius + padding; const maxY = height - node.maxRadius - padding;
      if (node.x < minX) moveNode(node, minX - node.x, 0); if (node.x > maxX) moveNode(node, maxX - node.x, 0);
      if (node.y < minY) moveNode(node, 0, minY - node.y); if (node.y > maxY) moveNode(node, 0, maxY - node.y);
    });
  }
  function geometryForce() { let forceNodes = []; const force = () => constrain(forceNodes); force.initialize = (nextNodes) => { forceNodes = nextNodes; }; return force; }
  function renderNodes() {
    constrain();
    nodes.forEach((node) => {
      const diameter = node.currentRadius * 2;
      node.button.style.width = `${diameter}px`; node.button.style.height = `${diameter}px`;
      node.button.style.transform = `translate3d(${node.x - node.currentRadius}px, ${node.y - node.currentRadius}px, 0)`;
    });
  }
  function updateGeometry(preserve) {
    const rect = cluster.getBoundingClientRect(); const oldWidth = width; const oldHeight = height;
    width = rect.width; height = rect.height; if (!width || !height) return false;
    layout = layoutMode(); interaction = interactionMode();
    const centerX = width / 2; const centerY = height / 2; const scale = interaction === "hover" ? FORCE.desktopHoverScale : FORCE.tapScale;
    nodes.forEach((node) => {
      node.normalRadius = radiusFor(node); node.maxRadius = node.normalRadius * scale;
      if (!node.radiusAnimation) node.currentRadius = node.normalRadius;
      const point = pointFor(node); const artX = point.x * width; const artY = point.y * height;
      const contraction = layout === "desktop" && !node.isCore ? FORCE.desktopContraction : 1;
      node.preferredX = centerX + (artX - centerX) * contraction; node.preferredY = centerY + (artY - centerY) * contraction;
      const padding = edgePadding();
      node.preferredX = Math.max(node.maxRadius + padding, Math.min(width - node.maxRadius - padding, node.preferredX));
      node.preferredY = Math.max(node.maxRadius + padding, Math.min(height - node.maxRadius - padding, node.preferredY));
      if (node.isCore) { node.fx = node.preferredX; node.fy = node.preferredY; node.x = node.fx; node.y = node.fy; }
      else if (preserve && oldWidth && oldHeight) { node.x = node.x / oldWidth * width; node.y = node.y / oldHeight * height; }
      else { node.x = node.preferredX; node.y = node.preferredY; }
    });
    return true;
  }
  function refreshForces() {
    xForce.strength((node) => node.isCore ? 0 : FORCE.positionStrength); yForce.strength((node) => node.isCore ? 0 : FORCE.positionStrength);
    collideForce.radius((node) => node.currentRadius + FORCE.collisionPadding).strength(FORCE.collisionStrength).iterations(FORCE.collisionIterations);
  }
  function settle(iterations = 420) { simulation.stop().alpha(1); for (let index = 0; index < iterations; index += 1) simulation.tick(); renderNodes(); }
  function reheat(alpha) { if (!motionMedia.matches) simulation.alpha(Math.max(simulation.alpha(), alpha)).alphaTarget(0).restart(); }
  function start(preserve = false) {
    const priorLayout = layout; const priorInteraction = interaction; if (!updateGeometry(preserve)) return;
    if (priorLayout !== layout || priorInteraction !== interaction) release(hovered, false), release(tapped, false), hovered = null, tapped = null;
    simulation.nodes(nodes); xForce.x((node) => node.preferredX); yForce.y((node) => node.preferredY); refreshForces(); renderNodes();
    if (motionMedia.matches) settle(); else simulation.alpha(preserve ? .32 : 1).alphaTarget(0).restart();
  }
  function easeOutCubic(progress) { return 1 - Math.pow(1 - progress, 3); }
  function animateRadii(timestamp) {
    let animating = false;
    nodes.forEach((node) => { if (!node.radiusAnimation) return; const animation = node.radiusAnimation; const progress = Math.min(1, (timestamp - animation.started) / animation.duration); node.currentRadius = animation.from + (animation.to - animation.from) * easeOutCubic(progress); if (progress >= 1) node.radiusAnimation = null; else animating = true; });
    refreshForces(); renderNodes(); radiusFrame = animating ? requestAnimationFrame(animateRadii) : 0;
  }
  function transitionRadius(node, target, duration) { if (!node) return; node.radiusAnimation = { from: node.currentRadius, to: target, duration, started: performance.now() }; if (!radiusFrame) radiusFrame = requestAnimationFrame(animateRadii); }
  function release(node, reheatAfter = true) { if (!node) return; delete node.button.dataset.physicalActive; transitionRadius(node, node.normalRadius, FORCE.shrinkDuration); if (!node.isCore) { node.fx = null; node.fy = null; } if (reheatAfter) reheat(FORCE.leaveAlpha); }
  function activate(node, type) {
    if (!node || motionMedia.matches) return;
    const current = type === "hover" ? hovered : tapped; if (node === current) return;
    if (current) release(current, false); if (type === "hover") hovered = node; else tapped = node;
    if (!node.isCore) { node.fx = node.x; node.fy = node.y; } node.button.dataset.physicalActive = "true";
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
    buttons.forEach((button) => { const selected = button.dataset.story === id; button.setAttribute("aria-selected", String(selected)); button.classList.toggle("is-selected", selected); });
    const nextRequest = ++requestId; preload(id).then((src) => { if (nextRequest === requestId && selectedId === id) renderPreview(id, src); }).catch((error) => console.warn(error.message));
  }
  function schedulePreload() { const run = () => Object.keys(STORY_ASSETS).forEach((id) => preload(id).catch(() => {})); if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 1200 }); else setTimeout(run, 400); }
  function refreshLayout() { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(() => start(true)); }

  ensurePreviewMarkup();
  xForce = d3.forceX((node) => node.preferredX); yForce = d3.forceY((node) => node.preferredY); collideForce = d3.forceCollide((node) => node.currentRadius + FORCE.collisionPadding);
  simulation = d3.forceSimulation(nodes).force("x", xForce).force("y", yForce).force("collide", collideForce).force("geometry-constraints", geometryForce()).velocityDecay(FORCE.velocityDecay).alphaDecay(.055).on("tick", renderNodes);
  cluster.classList.add("is-stories-runtime"); cluster.dataset.forceStatus = "ready"; cluster.dataset.forceActive = "true";
  buttons.forEach((button) => {
    button.disabled = false;
    const node = nodeById.get(button.dataset.story);
    button.addEventListener("pointerenter", () => { if (interaction === "hover") { activate(node, "hover"); select(node.id); } });
    button.addEventListener("pointerleave", () => { if (interaction === "hover" && hovered === node) { release(hovered); hovered = null; } });
    button.addEventListener("focus", () => select(node.id));
    button.addEventListener("click", () => { select(node.id); if (interaction === "tap") activate(node, "tap"); });
  });
  new ResizeObserver(refreshLayout).observe(cluster); window.addEventListener("resize", refreshLayout); motionMedia.addEventListener("change", refreshLayout); finePointerMedia.addEventListener("change", refreshLayout);
  start(false); select(selectedId); schedulePreload();
  return { setLanguage() { updatePreviewLanguage(); if (motionMedia.matches) settle(180); else reheat(.12); }, getState() { return { nodeCount: nodes.length, selectedId, activePreviewId, previewCount: Object.keys(STORY_ASSETS).length, width, height, layout, simulation: 1 }; } };
}
