/* Beyond Work runtime coordinator. Stage 5 currently enhances Stay Moving only. */
(() => {
  const SPORT_COPY = {
    cn: ["\u7fbd\u6bdb\u7403", "\u6e38\u6cf3", "\u5339\u514b\u7403", "\u7f51\u7403", "\u8dd1\u6b65", "\u51b2\u6d6a", "Wargame"],
    en: ["Badminton", "Swimming", "Pickleball", "Tennis", "Running", "Surfing", "Wargame"]
  };

  const MOTION = {
    baseVelocity: 16,
    hoverMultiplier: 5,
    enterSeconds: 0.15,
    leaveSeconds: 0.28
  };

  let initialized = false;
  let storiesController = null;
  let travelController = null;
  let soundtrackController = null;

  function currentLanguage() {
    return localStorage.getItem("lang") === "cn" ? "cn" : "en";
  }

  function initStayMoving() {
    const sensor = document.querySelector("#beyond-work .beyond-work__ribbon");
    const canonicalGroup = sensor?.querySelector(".beyond-work__ribbon-items");
    if (!sensor || !canonicalGroup) return null;

    const track = document.createElement("div");
    track.className = "beyond-work__ribbon-track";
    sensor.insertBefore(track, canonicalGroup);
    track.append(canonicalGroup);

    canonicalGroup.querySelectorAll("[i18n]").forEach((item) => item.removeAttribute("i18n"));

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let groupWidth = 0;
    let offset = 0;
    let currentSpeed = MOTION.baseVelocity;
    let hovered = false;
    let reduced = reducedMotion.matches;
    let lastFrame = performance.now();
    let rafId = 0;
    let rebuildId = 0;
    let userPaused = false;
    let inViewport = false;
    const toggle = document.querySelector('[data-beyond-work-ribbon-toggle]');

    function updateToggle() {
      if (!toggle) return;
      toggle.hidden = reduced;
      toggle.textContent = currentLanguage() === 'cn' ? (userPaused ? '继续' : '暂停') : (userPaused ? 'Play' : 'Pause');
      toggle.setAttribute('aria-pressed', String(userPaused));
      toggle.setAttribute('aria-label', currentLanguage() === 'cn' ? (userPaused ? '继续滚动运动文字' : '暂停滚动运动文字') : (userPaused ? 'Play sports ribbon' : 'Pause sports ribbon'));
    }
    function syncMotion() {
      cancelAnimationFrame(rafId);
      rafId = 0;
      lastFrame = performance.now();
      if (!reduced && !userPaused && inViewport && !document.hidden) rafId = requestAnimationFrame(tick);
      updateToggle();
    }

    function normalizedPhase() {
      if (!groupWidth) return 0;
      return ((-offset % groupWidth) + groupWidth) % groupWidth / groupWidth;
    }

    function applyTransform() {
      track.style.transform = `translate3d(${offset}px, 0, 0)`;
    }

    function renderLabels(language) {
      const labels = SPORT_COPY[language] || SPORT_COPY.en;
      [...canonicalGroup.children].forEach((item, index) => {
        item.textContent = labels[index] || "";
      });
    }

    function rebuildGeometry() {
      const phase = normalizedPhase();
      track.querySelectorAll("[data-beyond-work-ribbon-clone]").forEach((clone) => clone.remove());
      groupWidth = canonicalGroup.getBoundingClientRect().width;

      if (!groupWidth) return;

      if (!reduced) {
        const groupCount = Math.max(2, Math.ceil(sensor.clientWidth / groupWidth) + 2);
        for (let index = 1; index < groupCount; index += 1) {
          const clone = canonicalGroup.cloneNode(true);
          clone.dataset.beyondWorkRibbonClone = "";
          clone.setAttribute("aria-hidden", "true");
          track.append(clone);
        }
      }

      offset = reduced ? 0 : -phase * groupWidth;
      lastFrame = performance.now();
      applyTransform();
      syncMotion();
    }

    function scheduleGeometry() {
      cancelAnimationFrame(rebuildId);
      rebuildId = requestAnimationFrame(() => {
        rebuildId = requestAnimationFrame(rebuildGeometry);
      });
    }

    function tick(frameTime) {
      const deltaSeconds = Math.min((frameTime - lastFrame) / 1000, 0.1);
      lastFrame = frameTime;

      if (!reduced && groupWidth) {
        const targetSpeed = MOTION.baseVelocity * (hovered ? MOTION.hoverMultiplier : 1);
        const response = hovered ? MOTION.enterSeconds : MOTION.leaveSeconds;
        const smoothing = 1 - Math.exp(-deltaSeconds / response);
        currentSpeed += (targetSpeed - currentSpeed) * smoothing;
        offset += currentSpeed * deltaSeconds;
        while (offset >= 0) offset -= groupWidth;
        applyTransform();
      }

      rafId = requestAnimationFrame(tick);
    }

    sensor.addEventListener("pointerenter", (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      hovered = true;
    });
    sensor.addEventListener("pointerleave", (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      hovered = false;
    });

    reducedMotion.addEventListener("change", (event) => {
      reduced = event.matches;
      currentSpeed = MOTION.baseVelocity;
      syncMotion();
      scheduleGeometry();
    });

    toggle?.addEventListener('click', () => { userPaused = !userPaused; syncMotion(); });
    document.addEventListener('visibilitychange', syncMotion);
    const viewportObserver = new IntersectionObserver(entries => {
      inViewport = entries[0].isIntersecting;
      syncMotion();
    });
    viewportObserver.observe(sensor);

    new ResizeObserver(scheduleGeometry).observe(sensor);
    document.fonts.ready.then(scheduleGeometry);

    document.addEventListener("app:languagechange", (event) => {
      renderLabels(event.detail?.lang === "cn" ? "cn" : "en");
      updateToggle();
      scheduleGeometry();
    });

    renderLabels(currentLanguage());
    rebuildGeometry();
    syncMotion();

    return {
      destroy() {
        cancelAnimationFrame(rafId);
        cancelAnimationFrame(rebuildId);
        viewportObserver.disconnect();
      }
    };
  }

  function initBeyondWorkOnce() {
    if (initialized) return;
    initialized = true;
    initStayMoving();
    import("./beyond-work-stories.js")
      .then(({ initStories }) => initStories())
      .then((controller) => { storiesController = controller; })
      .catch((error) => console.warn("Stories D3 runtime unavailable; retaining the static fallback.", error));
    document.addEventListener("app:languagechange", () => storiesController?.setLanguage());
    import("./beyond-work-travel.js")
      .then(({ initTravel }) => initTravel())
      .then((controller) => { travelController = controller; })
      .catch((error) => console.warn("Travel runtime unavailable; retaining the static fallback.", error));
    document.addEventListener("app:languagechange", (event) => travelController?.setLanguage(event.detail?.lang));
    import("./beyond-work-soundtrack.js")
      .then(({ initSoundtrack }) => initSoundtrack())
      .then((controller) => { soundtrackController = controller; })
      .catch((error) => console.warn("Soundtrack runtime unavailable; retaining the static soundtrack identity.", error));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBeyondWorkOnce, { once: true });
  } else {
    initBeyondWorkOnce();
  }
})();
