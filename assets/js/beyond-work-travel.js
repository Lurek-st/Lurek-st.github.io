const GSAP_URL = "https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js";
const DRAGGABLE_URL = "https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/Draggable.min.js";

const TRAVEL_DATA = {
  far: [
    { id: "japan", date: "2016.02", zh: "\u65e5\u672c", en: "JAPAN", image: "assets/img/beyond-work/travel/far-japan.jpg", fit: "contain", focus: "61% 49%" },
    { id: "germany-austria", date: "2016.11", zh: "\u5fb7\u56fd / \u5965\u5730\u5229", en: "GERMANY / AUSTRIA", image: "assets/img/beyond-work/travel/far-germany-austria.png", focus: "62% 47%" },
    { id: "malaysia-indonesia", date: "2017.06", zh: "\u9a6c\u6765\u897f\u4e9a / \u5370\u5ea6\u5c3c\u897f\u4e9a", en: "MALAYSIA / INDONESIA", image: "assets/img/beyond-work/travel/far-malaysia-indonesia.jpg", focus: "42% 61%" },
    { id: "uae", date: "2019.07", zh: "\u963f\u8054\u914b", en: "UAE", secondaryZh: "\u8fea\u62dc \u00b7 \u963f\u5e03\u624e\u6bd4", secondaryEn: "DUBAI \u00b7 ABU DHABI", image: "assets/img/beyond-work/travel/far-uae.jpg", fit: "contain", focus: "50% 47%" }
  ],
  near: [
    { id: "beijing", date: "2023.09", zh: "\u5317\u4eac", en: "BEIJING", image: "assets/img/beyond-work/travel/near-beijing.jpg", focus: "51% 43%" },
    { id: "shanghai-hangzhou", date: "2024.06", zh: "\u4e0a\u6d77 / \u676d\u5dde", en: "SHANGHAI / HANGZHOU", image: "assets/img/beyond-work/travel/near-shanghai-hangzhou.jpg", focus: "50% 49%" },
    { id: "greater-bay-area", date: { cn: "2025 \u4e0b\u534a\u5e74", en: "2025 H2" }, zh: "\u5927\u6e7e\u533a", en: "GREATER BAY AREA", secondaryZh: "\u6df1\u5733 \u00b7 \u60e0\u5dde \u00b7 \u9999\u6e2f \u00b7 \u6fb3\u95e8", secondaryEn: "SHENZHEN \u00b7 HUIZHOU \u00b7 HONG KONG \u00b7 MACAU", image: "assets/img/beyond-work/travel/near-greater-bay-area.jpg", focus: "57% 47%" },
    { id: "xiamen", date: "2026.02", zh: "\u53a6\u95e8", en: "XIAMEN", image: "assets/img/beyond-work/travel/near-xiamen.jpg", focus: "51% 47%" }
  ]
};

const LABELS = { far: { cn: "\u8fdc\u65b9", en: "FARTHER AFIELD" }, near: { cn: "\u8fd1\u4e61", en: "CLOSER TO HOME" } };
let travelPromise;

export function initTravel() {
  if (!travelPromise) travelPromise = createTravelController();
  return travelPromise;
}

function loadScript(url, ready, name) {
  if (ready()) return Promise.resolve();
  const existing = document.querySelector(`script[data-beyond-work-library="${name}"]`);
  if (existing) return new Promise((resolve, reject) => { existing.addEventListener("load", resolve, { once: true }); existing.addEventListener("error", reject, { once: true }); });
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url; script.dataset.beyondWorkLibrary = name; script.onload = resolve; script.onerror = reject;
    document.head.append(script);
  });
}

async function createTravelController() {
  const root = document.querySelector("#beyond-work .beyond-work__module--road");
  const slider = root?.querySelector("[data-beyond-work-travel-slider]");
  const stage = root?.querySelector("[data-beyond-work-travel-mount]");
  const note = root?.querySelector(".beyond-work__travel-note");
  if (!root || !slider || !stage || !note) throw new Error("Travel runtime requires the existing section 08 hosts.");

  try {
    await loadScript(GSAP_URL, () => !!window.gsap, "gsap-3.12.5");
    await loadScript(DRAGGABLE_URL, () => !!window.Draggable, "draggable-3.12.5");
  } catch (error) {
    console.warn("Travel runtime unavailable; retaining the static Far/Japan fallback.", error);
    return null;
  }

  const { gsap, Draggable } = window;
  gsap.registerPlugin(Draggable);
  const state = { chapter: "far", active: { far: "japan", near: "beijing" }, language: localStorage.getItem("lang") === "cn" ? "cn" : "en" };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  let draggable;
  let endpointGesture = null;
  let resizeFrame = 0;

  function panelMarkup(story, chapter) {
    const srcset = window.SiteImages?.srcset(story.image) || '';
    const responsive = `src="${story.image}" srcset="${srcset}" sizes="(max-width: 720px) 90vw, 720px" loading="lazy" decoding="async"`;
    return `<button class="beyond-work__travel-panel${state.active[chapter] === story.id ? " is-active" : ""}" type="button" data-panel="${story.id}" data-chapter="${chapter}" data-fit="${story.fit || "cover"}" data-media-frame style="--travel-focus:${story.focus}"><img class="beyond-work__travel-ambient" ${responsive} alt="" aria-hidden="true"><img class="beyond-work__travel-image" ${responsive} alt="" data-media-image><span class="beyond-work__travel-shade"></span><span class="beyond-work__travel-collapsed"></span><span class="beyond-work__travel-meta"><time></time><strong></strong><small></small></span></button>`;
  }
  function renderRuntimeMarkup() {
    slider.classList.add("is-travel-runtime");
    slider.innerHTML = `<button class="beyond-work__travel-chapter-label is-current" type="button" data-chapter-target="far"></button><div class="beyond-work__travel-rail"><button class="beyond-work__travel-thumb" type="button" data-beyond-work-travel-thumb role="slider" aria-valuemin="0" aria-valuemax="1" aria-valuenow="0" aria-orientation="horizontal" aria-label="Travel chapter"><span aria-hidden="true">\u2194</span></button></div><button class="beyond-work__travel-chapter-label" type="button" data-chapter-target="near"></button>`;
    stage.innerHTML = ["far", "near"].map((chapter) => `<section class="beyond-work__travel-chapter${chapter === state.chapter ? " is-current" : ""}" data-chapter="${chapter}" aria-hidden="${chapter === state.chapter ? "false" : "true"}"><div class="beyond-work__travel-accordion">${TRAVEL_DATA[chapter].map((story) => panelMarkup(story, chapter)).join("")}</div></section>`).join("");
  }
  renderRuntimeMarkup();
  window.SiteImages?.enhance(stage);
  const rail = slider.querySelector(".beyond-work__travel-rail");
  const thumb = slider.querySelector("[data-beyond-work-travel-thumb]");
  const maxX = () => Math.max(0, rail.clientWidth - thumb.offsetWidth);
  const endpointSpan = () => window.matchMedia("(max-width: 720px)").matches ? 112 : 96;
  const story = (chapter, id) => TRAVEL_DATA[chapter].find((item) => item.id === id);
  const displayDate = (item) => typeof item.date === "object" ? item.date[state.language] : item.date;

  function setThumb(x, animate = false) {
    const target = Math.max(0, Math.min(maxX(), x));
    if (animate && !reducedMotion.matches) gsap.to(thumb, { x: target, duration: .36, ease: "power3.out", overwrite: true });
    else gsap.set(thumb, { x: target });
  }
  function syncSlider(progress = state.chapter === "near" ? 1 : 0) {
    slider.querySelectorAll("[data-chapter-target]").forEach((button) => {
      const emphasis = button.dataset.chapterTarget === "near" ? progress : 1 - progress;
      button.classList.toggle("is-current", button.dataset.chapterTarget === state.chapter);
      button.style.opacity = String(.42 + emphasis * .58);
    });
    thumb.setAttribute("aria-valuenow", state.chapter === "near" ? "1" : "0");
    thumb.setAttribute("aria-valuetext", LABELS[state.chapter][state.language]);
  }
  function setChapter(next, animate = true) {
    if (next !== "far" && next !== "near" || next === state.chapter) return;
    state.chapter = next;
    stage.querySelectorAll(".beyond-work__travel-chapter").forEach((chapter) => {
      const active = chapter.dataset.chapter === next;
      chapter.classList.toggle("is-current", active); chapter.setAttribute("aria-hidden", String(!active)); chapter.inert = !active;
    });
    setThumb(next === "near" ? maxX() : 0, animate); syncSlider(next === "near" ? 1 : 0);
    window.SiteImages?.prepare(stage.querySelector('.beyond-work__travel-chapter.is-current'));
  }
  function selectPanel(chapter, id) {
    if (!story(chapter, id) || state.active[chapter] === id) return;
    state.active[chapter] = id;
    stage.querySelectorAll(`.beyond-work__travel-panel[data-chapter="${chapter}"]`).forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === id));
  }
  function updateLanguage(language = localStorage.getItem("lang")) {
    state.language = language === "cn" ? "cn" : "en";
    slider.querySelectorAll("[data-chapter-target]").forEach((button) => { button.textContent = LABELS[button.dataset.chapterTarget][state.language]; });
    note.textContent = state.language === "cn" ? "\u4e0b\u4e00\u6b21\u51fa\u53d1\u4e5f\u5df2\u7ecf\u5728\u7b79\u5907\u4e2d\u2014\u2014\u897f\u4e9a\u3001\u7533\u6839\u533a\uff0c\u8fd8\u6709\u5317\u7f8e\u3002\u3002\u3002" : "The next journey is already taking shape\u2014West Asia, the Schengen area, and perhaps North America.";
    stage.querySelectorAll(".beyond-work__travel-panel").forEach((panel) => {
      const item = story(panel.dataset.chapter, panel.dataset.panel); const title = item[state.language === "cn" ? "zh" : "en"];
      panel.querySelector(".beyond-work__travel-collapsed").textContent = title;
      panel.querySelector("time").textContent = displayDate(item); panel.querySelector("strong").textContent = title;
      panel.querySelector("small").textContent = state.language === "cn" ? item.secondaryZh || "" : item.secondaryEn || "";
      panel.querySelector(".beyond-work__travel-image").alt = state.language === "cn" ? `${title} \u7684\u65c5\u884c\u7167\u7247` : `Travel photograph from ${title}`;
    });
    syncSlider();
  }
  function bindPanels() {
    stage.querySelectorAll(".beyond-work__travel-panel").forEach((panel) => {
      let intent;
      panel.addEventListener("pointerenter", () => { if (finePointer.matches) intent = setTimeout(() => selectPanel(panel.dataset.chapter, panel.dataset.panel), 80); });
      panel.addEventListener("pointerleave", () => clearTimeout(intent));
      panel.addEventListener("click", () => selectPanel(panel.dataset.chapter, panel.dataset.panel));
      panel.addEventListener("focus", () => selectPanel(panel.dataset.chapter, panel.dataset.panel));
    });
  }
  slider.querySelectorAll("[data-chapter-target]").forEach((button) => button.addEventListener("click", () => setChapter(button.dataset.chapterTarget)));
  thumb.addEventListener("keydown", (event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); setChapter(event.key === "ArrowLeft" ? "far" : "near"); } });
  function endpointAt(event) {
    const rect = rail.getBoundingClientRect(); const offset = event.clientX - rect.left;
    if (offset < 0 || offset > rect.width) return null;
    const span = endpointSpan();
    return offset <= span ? "far" : offset >= rect.width - span ? "near" : null;
  }
  slider.addEventListener("pointerdown", (event) => {
    if (event.target.closest("[data-beyond-work-travel-thumb]")) return;
    const chapter = endpointAt(event);
    endpointGesture = chapter ? { chapter, x: event.clientX, y: event.clientY, moved: false } : null;
  });
  slider.addEventListener("pointermove", (event) => { if (endpointGesture && Math.hypot(event.clientX - endpointGesture.x, event.clientY - endpointGesture.y) > 5) endpointGesture.moved = true; });
  slider.addEventListener("pointerup", () => { if (endpointGesture && !endpointGesture.moved) setChapter(endpointGesture.chapter); endpointGesture = null; });
  slider.addEventListener("pointercancel", () => { endpointGesture = null; });
  slider.addEventListener("click", (event) => {
    if (event.target.closest("[data-beyond-work-travel-thumb]")) return;
    const chapter = endpointAt(event);
    if (chapter) setChapter(chapter);
  });
  bindPanels(); updateLanguage(state.language);
  stage.querySelectorAll(".beyond-work__travel-chapter").forEach((chapter) => { chapter.inert = chapter.dataset.chapter !== state.chapter; });

  draggable = Draggable.create(thumb, {
    type: "x", bounds: { minX: 0, maxX: maxX() }, inertia: false,
    onDrag() { syncSlider(maxX() ? this.x / maxX() : 0); },
    onRelease() { const ratio = maxX() ? this.x / maxX() : 0; setChapter(state.chapter === "far" ? ratio >= .55 ? "near" : "far" : ratio <= .45 ? "far" : "near"); }
  })[0];
  function refreshBounds() { draggable.applyBounds({ minX: 0, maxX: maxX() }); setThumb(state.chapter === "near" ? maxX() : 0); syncSlider(); }
  function scheduleBounds() { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(refreshBounds); }
  new ResizeObserver(scheduleBounds).observe(rail); window.addEventListener("resize", scheduleBounds); reducedMotion.addEventListener("change", scheduleBounds);
  refreshBounds();
  return { setLanguage: updateLanguage, getState: () => ({ controller: 1, draggable: 1, chapter: state.chapter, active: { ...state.active }, endpointSpan: endpointSpan() }) };
}
