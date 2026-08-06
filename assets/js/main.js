/* Lurek personal site main script.
 * - No third-party UI library (Swiper removed).
 * - Copy is owned by the DOM (data-i18n + JSON); the Home typewriter reads
 *   the live, already-translated text rather than holding a third copy.
 * - The i18n renderer lives in cn-en-translate.js (loadLanguage).
 */

/*==================== APP READY (cooperative) ==================== */
// main.js initialises event wiring + observers -> __mainReady.
// cn-en-translate.js sets __i18nReady after the first language JSON lands.
// Only when BOTH are ready is __appReady set, satisfying the 5s watchdog.
function markAppReady() {
  if (window.__mainReady && window.__i18nReady && !window.__appReady) {
    window.__appReady = true;
  }
}

/*==================== MOBILE MENU ====================*/
const navMenu = document.getElementById("nav-menu");
const navToggle = document.getElementById("nav-toggle");
const navClose = document.getElementById("nav-close");

function setMenuOpen(open) {
  if (!navMenu) return;
  if (open) {
    navMenu.classList.add("show-menu");
    if (navToggle) navToggle.setAttribute("aria-expanded", "true");
  } else {
    navMenu.classList.remove("show-menu");
    if (navToggle) navToggle.setAttribute("aria-expanded", "false");
  }
}

if (navToggle && navMenu) {
  navToggle.addEventListener("click", () => setMenuOpen(!navMenu.classList.contains("show-menu")));
}
if (navClose && navMenu) {
  navClose.addEventListener("click", () => setMenuOpen(false));
}
document.querySelectorAll(".nav__link").forEach((n) => n.addEventListener("click", () => setMenuOpen(false)));

/*==================== SKILLS ACCORDION ====================*/
// Native <details>/<summary> provide Enter + Space keyboard behaviour; we do
// not override keydown. We only enforce "at most one open on mobile" via the
// toggle event and keep desktop fully expanded.
const skillGroups = Array.from(document.querySelectorAll(".skill-group"));
const isMobileView = () => window.matchMedia("(max-width: 767px)").matches;

function syncSkillsState() {
  if (!isMobileView()) {
    // Desktop: everything visible (keep them all open).
    skillGroups.forEach((g) => {
      if (!g.open) g.open = true;
    });
    return;
  }
  // Mobile: keep at most one open; if several are open, collapse all but the
  // first (or the most recently activated one — the toggle handler below
  // collapses others before opening).
  const openGroups = skillGroups.filter((g) => g.open);
  if (openGroups.length > 1) {
    openGroups.slice(1).forEach((g) => { g.open = false; });
  }
}

skillGroups.forEach((group) => {
  const summary = group.querySelector("summary");
  if (summary) {
    // Reflect open state on the summary for screen readers.
    const reflect = () => {
      summary.setAttribute("aria-expanded", group.open ? "true" : "false");
    };
    reflect();
    group.addEventListener("toggle", () => {
      reflect();
      if (isMobileView() && group.open) {
        // Close any other open group (one at a time rule).
        skillGroups.forEach((other) => {
          if (other !== group && other.open) other.open = false;
        });
      }
    });
  }
});

window.addEventListener("resize", () => {
  syncSkillsState();
  setTimeout(scrollActive, 100);
});

/*==================== QUALIFICATION TABS ====================*/
const tabs = document.querySelectorAll("[data-target]");
const tabContents = document.querySelectorAll("[data-content]");

function animateQualificationContent(targetContent) {
  const qualificationData = targetContent.querySelectorAll(".qualification__data");
  const rounders = targetContent.querySelectorAll(".qualification__rounder");
  const lines = targetContent.querySelectorAll(".qualification__line");
  qualificationData.forEach((data) => {
    data.classList.remove("active", "slide-in-left", "slide-in-right");
    const leftContent = data.children[0];
    const rightContent = data.children[2];
    if (leftContent && leftContent.innerHTML.trim() !== "") data.classList.add("slide-in-left");
    else if (rightContent && rightContent.innerHTML.trim() !== "") data.classList.add("slide-in-right");
  });
  rounders.forEach((r) => r.classList.remove("active"));
  lines.forEach((l) => l.classList.remove("active"));
  setTimeout(() => {
    qualificationData.forEach((data, index) => {
      setTimeout(() => data.classList.add("active"), index * 200);
    });
    rounders.forEach((r, index) => setTimeout(() => r.classList.add("active"), index * 150 + 100));
    lines.forEach((l, index) => setTimeout(() => l.classList.add("active"), index * 150 + 300));
  }, 100);
}

function activateQualificationTab(tab) {
  const target = document.querySelector(tab.dataset.target);
  if (!target) return;
  const currentActive = document.querySelector(".qualification__active[data-content]");
  if (currentActive && currentActive !== target) {
    currentActive.querySelectorAll(".qualification__data").forEach((d) => d.classList.remove("active"));
    currentActive.querySelectorAll(".qualification__rounder").forEach((r) => r.classList.remove("active"));
    currentActive.querySelectorAll(".qualification__line").forEach((l) => l.classList.remove("active"));
  }
  setTimeout(() => {
    tabContents.forEach((c) => c.classList.remove("qualification__active"));
    target.classList.add("qualification__active");
    animateQualificationContent(target);
  }, currentActive && currentActive !== target ? 300 : 0);
  tabs.forEach((t) => {
    t.classList.remove("qualification__active");
    t.setAttribute("aria-selected", "false");
  });
  tab.classList.add("qualification__active");
  tab.setAttribute("aria-selected", "true");
}

tabs.forEach((tab) => tab.addEventListener("click", () => activateQualificationTab(tab)));

const tablist = document.querySelector(".qualification__tabs");
if (tablist) {
  tablist.addEventListener("keydown", (e) => {
    const currentIndex = Array.from(tabs).findIndex((t) => t.classList.contains("qualification__active"));
    if (currentIndex === -1) return;
    let nextIndex = currentIndex;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") nextIndex = (currentIndex + 1) % tabs.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else return;
    e.preventDefault();
    activateQualificationTab(tabs[nextIndex]);
    tabs[nextIndex].focus();
  });
}

/*==================== SCROLL ACTIVE / HEADER / SCROLL UP ====================*/
const sections = document.querySelectorAll("section[id]");
function scrollActive() {
  sections.forEach((current) => {
    const sectionHeight = current.clientHeight;
    const sectionTop = current.getBoundingClientRect().top;
    const sectionId = current.getAttribute("id");
    const navLink = document.querySelector('.nav__menu a[href*="' + sectionId + '"]');
    if (!navLink) return;
    if (sectionTop <= window.innerHeight / 2 && sectionTop + sectionHeight >= window.innerHeight / 2) {
      navLink.classList.add("active-link");
    } else {
      navLink.classList.remove("active-link");
    }
  });
}
window.addEventListener("scroll", scrollActive);

function scrollHeader() {
  const nav = document.getElementById("header");
  if (!nav) return;
  if (window.scrollY >= 80) nav.classList.add("scroll-header");
  else nav.classList.remove("scroll-header");
}
window.addEventListener("scroll", scrollHeader);

function scrollUpShow() {
  const scrollUp = document.getElementById("scroll-up");
  if (!scrollUp) return;
  if (window.scrollY >= 560) scrollUp.classList.add("show-scroll");
  else scrollUp.classList.remove("show-scroll");
}
window.addEventListener("scroll", scrollUpShow);

/*==================== THEME ====================*/
const themeButton = document.getElementById("theme-button");
const darkTheme = "dark-theme";
const iconTheme = "uil-sun";
const selectedTheme = localStorage.getItem("selected-theme");
const selectedIcon = localStorage.getItem("selected-icon");
const getCurrentTheme = () => (document.body.classList.contains(darkTheme) ? "dark" : "light");
const getCurrentIcon = () => (themeButton && themeButton.classList.contains(iconTheme) ? "uil-moon" : "uil-sun");
if (themeButton) {
  if (selectedTheme) {
    document.body.classList[selectedTheme === "dark" ? "add" : "remove"](darkTheme);
    themeButton.classList[selectedIcon === "uil-moon" ? "add" : "remove"](iconTheme);
  } else {
    document.body.classList.add(darkTheme);
    themeButton.classList.add(iconTheme);
    localStorage.setItem("selected-theme", "dark");
    localStorage.setItem("selected-icon", "uil-sun");
  }
  themeButton.addEventListener("click", () => {
    document.body.classList.toggle(darkTheme);
    themeButton.classList.toggle(iconTheme);
    localStorage.setItem("selected-theme", getCurrentTheme());
    localStorage.setItem("selected-icon", getCurrentIcon());
  });
}

/*==================== REVEAL + PIPELINE + CLOUD ANIMATIONS ====================*/
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const supportsObserver = "IntersectionObserver" in window;

function revealOnView(selector, activeClass) {
  const elements = document.querySelectorAll(selector);
  if (!supportsObserver || reducedMotion) {
    elements.forEach((el) => el.classList.add(activeClass));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add(activeClass);
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  );
  elements.forEach((el) => io.observe(el));
}

if (supportsObserver && !reducedMotion) {
  // Cards: reveal once on enter (stagger via CSS transition-delay on :nth).
  document.querySelectorAll(".project, .about-card, .about__statement, .about__pipeline, .skill-group").forEach((el) =>
    el.classList.add("reveal")
  );
  revealOnView(".reveal", "reveal--in");

  // Skills progress bars fill once when in view.
  const skillObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("skill--in-view");
          skillObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 }
  );
  document.querySelectorAll(".skill").forEach((el) => skillObserver.observe(el));

  // Cloud alignment (Home hero + robot calibration): the "predicted" cloud
  // slides onto the "measured" cloud once when the container is in view.
  revealOnView(".cloud-align", "cloud-align--run");

  // Pipeline / flow visuals: nodes light up in order when the container
  // enters the viewport.
  document.querySelectorAll(".flow").forEach((flow) => flow.classList.add("flow"));
  revealOnView(".flow", "flow--run");

  // Trajectory draw: hero arc draws once (stroke-dashoffset animation).
  revealOnView(".trajectory-draw", "trajectory-draw--run");
} else {
  // reduced motion or no observer: show everything immediately.
  document.querySelectorAll(".reveal").forEach((el) => el.classList.add("reveal--in"));
  document.querySelectorAll(".skill").forEach((el) => el.classList.add("skill--in-view"));
  document.querySelectorAll(".cloud-align").forEach((el) => el.classList.add("cloud-align--run"));
  document.querySelectorAll(".flow").forEach((el) => el.classList.add("flow--run"));
  document.querySelectorAll(".trajectory-draw").forEach((el) => el.classList.add("trajectory-draw--run"));
}

/*==================== HOME TYPEWRITER (single-run, cancellation-safe) ====================*/
const homeFocus = document.querySelector(".home__focus");
const homeApproach = document.querySelector(".home__approach");

// Monotonic run id: every refresh() cancels any in-flight animation.
let homeAnimationRun = 0;
// Real "is animating" counter: > 0 only while a run is actually writing
// characters. Cancelled runs decrement it in finally.
let homeAnimatingCount = 0;

function isHomeAnimating() {
  return homeAnimatingCount > 0;
}

function typeIntoElement(el, text, speed, runId) {
  return new Promise((resolve) => {
    if (!el) {
      resolve();
      return;
    }
    el.textContent = "";
    el.classList.add("typing-text");
    let i = 0;
    function step() {
      if (runId !== homeAnimationRun) {
        // Cancelled: the new run owns the DOM and has already re-added
        // the cursor class. Do NOT touch ANY DOM state (neither
        // textContent nor typing-text) — otherwise this stale timer could
        // remove the cursor the new run just added.
        resolve();
        return;
      }
      if (i >= text.length) {
        el.classList.remove("typing-text");
        resolve();
        return;
      }
      el.textContent += text.charAt(i);
      i += 1;
      setTimeout(step, speed);
    }
    step();
  });
}

async function playHomeFocus(runId) {
  if (!homeFocus) return;
  if (runId !== homeAnimationRun) return; // cancelled before it started
  const text = homeFocus.dataset.fullText || homeFocus.textContent;
  homeFocus.textContent = text;
  if (reducedMotion) return;
  await typeIntoElement(homeFocus, text, 28, runId);
}

async function playHomeApproach(runId) {
  if (!homeApproach) return;
  if (runId !== homeAnimationRun) return; // cancelled before it started
  const text = homeApproach.dataset.fullText || homeApproach.textContent;
  homeApproach.textContent = text;
  if (reducedMotion) return;
  await typeIntoElement(homeApproach, text, 18, runId);
}

function captureHomeText() {
  if (homeFocus) homeFocus.dataset.fullText = homeFocus.textContent;
  if (homeApproach) homeApproach.dataset.fullText = homeApproach.textContent;
}

// Called by cn-en-translate.js after every successful loadLanguage():
// - capture the (already translated) DOM text,
// - cancel any previous animation run (bump the generation),
// - drop any leftover cursor class from a cancelled run,
// - start exactly one new run for the new language.
function refreshHome() {
  const runId = ++homeAnimationRun;
  [homeFocus, homeApproach].forEach((el) => {
    if (el) el.classList.remove("typing-text");
  });
  captureHomeText();
  if (reducedMotion) return; // full text already in place via capture
  homeAnimatingCount += 1;
  (async () => {
    try {
      await playHomeFocus(runId);
      if (runId !== homeAnimationRun) return;
      await new Promise((r) => setTimeout(r, 120));
      await playHomeApproach(runId);
    } finally {
      homeAnimatingCount -= 1;
    }
  })();
}

window.__lurek = {
  refreshHome: refreshHome,
  isHomeAnimating: isHomeAnimating,
};

/*==================== BOOT ==================== */
document.addEventListener("DOMContentLoaded", () => {
  // Capture initial (Chinese fallback) text before i18n lands so the DOM
  // never appears empty if the first JSON is slow.
  captureHomeText();
  // Layered Home entrance: static layers (eyebrow/title/subtitle/actions/
  // tags) fade in via CSS transition-delay; focus/approach are driven by
  // the typewriter instead, so they are intentionally not .home__layer.
  document.documentElement.classList.add("home--entered");
  // Initial scroll highlight.
  setTimeout(scrollActive, 50);
  // Event wiring + observers are now in place. The FIRST Home animation is
  // triggered exactly once by cn-en-translate.js' initial loadLanguage()
  // success callback — nothing here starts a second run.
  syncSkillsState();
  window.__mainReady = true;
  markAppReady();
});

/*==================== APP READY ==================== */
// __appReady is NOT set here at the end of the file. It is set by
// markAppReady() only after BOTH __mainReady (this file) and __i18nReady
// (cn-en-translate.js) are true.
