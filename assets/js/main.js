/*==================== MENU SHOW Y HIDDEN ====================*/
const navMenu = document.getElementById('nav-menu'),
  navToggle = document.getElementById('nav-toggle'),
  navClose = document.getElementById('nav-close');

const accessibleLabels = {
  cn: {
    closeMenu: '\u5173\u95ed\u83dc\u5355',
    openMenu: '\u6253\u5f00\u83dc\u5355',
    scrollTop: '\u8fd4\u56de\u9876\u90e8',
    switchLanguage: '\u5207\u6362\u5230\u82f1\u6587',
    toggleTheme: '\u5207\u6362\u6df1\u8272/\u6d45\u8272\u4e3b\u9898',
    reelControls: '\u5173\u4e8e\u5361\u7247\u63a7\u5236',
    reelPause: '\u6682\u505c\u5173\u4e8e\u5361\u7247\u81ea\u52a8\u64ad\u653e',
    reelPlay: '\u64ad\u653e\u5173\u4e8e\u5361\u7247\u81ea\u52a8\u64ad\u653e',
    reelCard: index => `\u663e\u793a\u7b2c ${index} \u5f20\u5173\u4e8e\u5361\u7247`
  },
  en: {
    closeMenu: 'Close menu',
    openMenu: 'Open menu',
    scrollTop: 'Back to top',
    switchLanguage: 'Switch to Chinese',
    toggleTheme: 'Toggle dark/light theme',
    reelControls: 'About card controls',
    reelPause: 'Pause About card autoplay',
    reelPlay: 'Play About card autoplay',
    reelCard: index => `Show About card ${index}`
  }
}

function getInterfaceLanguage() {
  return localStorage.getItem('lang') === 'cn' ? 'cn' : 'en'
}

function updateAccessibleLabels(lang = getInterfaceLanguage()) {
  const labels = accessibleLabels[lang === 'cn' ? 'cn' : 'en']
  const expanded = navToggle?.getAttribute('aria-expanded') === 'true'
  const toggleLabel = expanded ? labels.closeMenu : labels.openMenu
  navToggle?.setAttribute('aria-label', toggleLabel)
  navToggle?.setAttribute('title', toggleLabel)
  navClose?.setAttribute('aria-label', labels.closeMenu)
  navClose?.setAttribute('title', labels.closeMenu)
  document.querySelectorAll('#translate, #mobile-translate').forEach(button => {
    button.setAttribute('aria-label', labels.switchLanguage)
    button.setAttribute('title', labels.switchLanguage)
  })
  const themeButton = document.getElementById('theme-button')
  themeButton?.setAttribute('aria-label', labels.toggleTheme)
  themeButton?.setAttribute('title', labels.toggleTheme)
  const scrollTop = document.getElementById('scroll-up')
  scrollTop?.setAttribute('aria-label', labels.scrollTop)
  scrollTop?.setAttribute('title', labels.scrollTop)
  const reelControls = document.querySelector('[data-about-reel-controls]')
  reelControls?.setAttribute('aria-label', labels.reelControls)
  const reelToggle = document.querySelector('[data-about-reel-toggle]')
  const reelPaused = reelToggle?.dataset.paused === 'true'
  const reelToggleLabel = reelPaused ? labels.reelPlay : labels.reelPause
  reelToggle?.setAttribute('aria-label', reelToggleLabel)
  reelToggle?.setAttribute('title', reelToggleLabel)
  reelToggle?.setAttribute('aria-pressed', String(reelPaused))
  document.querySelectorAll('[data-about-reel-indicator]').forEach((button, index) => {
    button.setAttribute('aria-label', labels.reelCard(index + 1))
    button.setAttribute('aria-current', button.classList.contains('is-active') ? 'true' : 'false')
  })
}

function setMobileMenuState(open, { moveFocus = false } = {}) {
  if (!navMenu) return
  const isMobile = window.innerWidth < 768
  const expanded = isMobile && open
  navMenu.classList.toggle('show-menu', expanded)
  navMenu.inert = isMobile && !expanded
  navToggle?.setAttribute('aria-expanded', String(expanded))
  updateAccessibleLabels()
  if (expanded && moveFocus) navMenu.querySelector('.nav__link')?.focus()
}

/*===== MENU SHOW =====*/
/* Validate if constant exists */
if (navToggle && navMenu) {
  navToggle.addEventListener('click', () => {
    setMobileMenuState(!navMenu.classList.contains('show-menu'), { moveFocus: true })
  })
}

/*===== MENU HIDDEN =====*/
/* Validate if constant exists */
if (navClose && navMenu) {
  navClose.addEventListener('click', () => {
    setMobileMenuState(false)
    navToggle?.focus()
  })
}

/*==================== REMOVE MENU MOBILE ====================*/
const navLink = document.querySelectorAll('.nav__link')

function linkAction() {
  const navMenu = document.getElementById('nav-menu')
  if (!navMenu) return
  // 点击每个菜单链接后收起菜单栏
  setMobileMenuState(false)
}
navLink.forEach(n => n.addEventListener('click', linkAction))

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && navMenu?.classList.contains('show-menu')) {
    setMobileMenuState(false)
    navToggle?.focus()
  }
})

window.addEventListener('resize', () => {
  setMobileMenuState(window.innerWidth < 768 && navMenu?.classList.contains('show-menu'))
})

setMobileMenuState(false)
document.addEventListener('app:languagechange', event => updateAccessibleLabels(event.detail?.lang))

/*==================== ACCORDION SKILLS ====================*/
const skillsContent = document.getElementsByClassName('skills__content'),
  skillsContentElements = document.querySelectorAll('.skills__content')

function setSkillsExpanded(content, expanded) {
  const header = content.querySelector('.skills__header')
  if (header) header.setAttribute('aria-expanded', expanded ? 'true' : 'false')
}

function toggleSkills() {
  const content = this.closest('.skills__content')
  if (!content) return
  const isOpen = content.classList.contains('skills__open')

  for (let i = 0; i < skillsContent.length; i++) {
    skillsContent[i].className = 'skills__content skills__close'
    setSkillsExpanded(skillsContent[i], false)
  }
  if (!isOpen) {
    content.className = 'skills__content skills__open'
    setSkillsExpanded(content, true)
  }
}

skillsContentElements.forEach((el) => {
  const header = el.querySelector('.skills__header')
  if (header) {
    header.addEventListener('click', toggleSkills)
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        toggleSkills.call(header)
      }
    })
  }
})

/*==================== QUALIFICATION TABS ====================*/
const tabs = document.querySelectorAll('[data-target]'),
  tabContents = document.querySelectorAll('[data-content]')

// Animation function for qualification content
function animateQualificationContent(targetContent) {
  const qualificationData = targetContent.querySelectorAll('.qualification__data')
  const rounders = targetContent.querySelectorAll('.qualification__rounder')
  const lines = targetContent.querySelectorAll('.qualification__line')

  // Reset all elements
  qualificationData.forEach((data, index) => {
    data.classList.remove('active', 'slide-in-left', 'slide-in-right')

    // Determine if content is on left or right based on grid structure
    const leftContent = data.children[0]
    const rightContent = data.children[2]

    if (leftContent && leftContent.innerHTML.trim() !== '') {
      data.classList.add('slide-in-left')
    } else if (rightContent && rightContent.innerHTML.trim() !== '') {
      data.classList.add('slide-in-right')
    }
  })

  rounders.forEach(rounder => {
    rounder.classList.remove('active')
  })

  lines.forEach(line => {
    line.classList.remove('active')
  })

  // Animate in sequence with staggered timing
  setTimeout(() => {
    qualificationData.forEach((data, index) => {
      setTimeout(() => {
        data.classList.add('active')
      }, index * 200) // 200ms delay between each card
    })

    rounders.forEach((rounder, index) => {
      setTimeout(() => {
        rounder.classList.add('active')
      }, index * 150 + 100) // Slightly earlier than cards
    })

    lines.forEach((line, index) => {
      setTimeout(() => {
        line.classList.add('active')
      }, index * 150 + 300) // After rounders start appearing
    })
  }, 100)
}

function activateQualificationTab(tab) {
  const target = document.querySelector(tab.dataset.target)
  if (!target) return

  // Hide current content with fade out
  const currentActive = document.querySelector('.qualification__active[data-content]')
  if (currentActive && currentActive !== target) {
    const currentData = currentActive.querySelectorAll('.qualification__data')
    const currentRounders = currentActive.querySelectorAll('.qualification__rounder')
    const currentLines = currentActive.querySelectorAll('.qualification__line')

    currentData.forEach(data => data.classList.remove('active'))
    currentRounders.forEach(rounder => rounder.classList.remove('active'))
    currentLines.forEach(line => line.classList.remove('active'))
  }

  // Switch active content after a brief delay
  setTimeout(() => {
    tabContents.forEach(tabContent => {
      tabContent.classList.remove('qualification__active')
    })
    target.classList.add('qualification__active')

    // Start animation for new content
    animateQualificationContent(target)
  }, currentActive && currentActive !== target ? 300 : 0)

  tabs.forEach(t => {
    t.classList.remove('qualification__active')
    t.setAttribute('aria-selected', 'false')
    t.tabIndex = -1
  })
  tab.classList.add('qualification__active')
  tab.setAttribute('aria-selected', 'true')
  tab.tabIndex = 0
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    activateQualificationTab(tab)
  })
})

// Keyboard navigation for the tablist (arrow keys)
const tablist = document.querySelector('.qualification__tabs')
if (tablist) {
  tablist.addEventListener('keydown', (e) => {
    const currentIndex = Array.from(tabs).findIndex(t => t.classList.contains('qualification__active'))
    if (currentIndex === -1) return
    let nextIndex = currentIndex
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % tabs.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    } else {
      return
    }
    e.preventDefault()
    activateQualificationTab(tabs[nextIndex])
    tabs[nextIndex].focus()
  })
}

// Initialize first tab animation on page load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const firstActiveContent = document.querySelector('.qualification__active[data-content]')
    if (firstActiveContent) {
      animateQualificationContent(firstActiveContent)
    }
  }, 500)
})


/*==================== PORTFOLIO SWIPER  ====================*/
let swiperPortfolio = null
const swiperContainer = document.querySelector('.portfolio__container')
if (typeof Swiper !== 'undefined' && swiperContainer) {
  swiperPortfolio = new Swiper('.portfolio__container', {
    cssMode: true,
    loop: true,

    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
    },

    pagination: {
      el: '.swiper-pagination',
      clickable: true,
    },
  });
}

// Native image sources work without JavaScript; image-loading.js prepares upcoming media.


/*==================== SCROLL SECTIONS ACTIVE LINK ====================*/
const sections = document.querySelectorAll('section[id]')

function scrollActive() {
  sections.forEach(current => {
    const sectionHeight = current.clientHeight
    const sectionTop = current.getBoundingClientRect().top;
    const sectionId = current.getAttribute('id')
    const navLink = document.querySelector('.nav__menu a[href*="' + sectionId + '"]')
    if (!navLink) return
    // section 位于视口中间时添加样式 active-link
    if (sectionTop <= window.innerHeight / 2 && sectionTop + sectionHeight >= window.innerHeight / 2) {
      navLink.classList.add('active-link')
    } else {
      navLink.classList.remove('active-link')
    }
  })
}
window.addEventListener('scroll', scrollActive)

/*==================== CHANGE BACKGROUND HEADER ====================*/
function scrollHeader() {
  const nav = document.getElementById('header')
  if (!nav) return
  if (this.scrollY >= 80) nav.classList.add('scroll-header'); else nav.classList.remove('scroll-header')
}
window.addEventListener('scroll', scrollHeader)

/*==================== SHOW SCROLL UP ====================*/
function scrollUp() {
  const scrollUp = document.getElementById('scroll-up');
  if (!scrollUp) return
  if (this.scrollY >= 560) scrollUp.classList.add('show-scroll'); else scrollUp.classList.remove('show-scroll')
}
window.addEventListener('scroll', scrollUp)

/*==================== DARK LIGHT THEME & LANGUAGE====================*/

const themeButton = document.getElementById('theme-button')
const darkTheme = 'dark-theme'
const iconTheme = 'uil-sun'
const language = 'cn'

// Previously selected topic (if user selected)
const selectedTheme = localStorage.getItem('selected-theme')
const selectedIcon = localStorage.getItem('selected-icon')

// We obtain the current theme that the interface has by validating the dark-theme class
const getCurrentTheme = () => document.body.classList.contains(darkTheme) ? 'dark' : 'light'
const getCurrentIcon = () => (themeButton && themeButton.classList.contains(iconTheme)) ? 'uil-moon' : 'uil-sun'

// Set default to dark theme if no previous selection
if (themeButton) {
  if (selectedTheme) {
    // If the validation is fulfilled, we ask what the issue was to know if we activated or deactivated the dark
    document.body.classList[selectedTheme === 'dark' ? 'add' : 'remove'](darkTheme)
    themeButton.classList[selectedIcon === 'uil-moon' ? 'add' : 'remove'](iconTheme)
  } else {
    // Default to dark theme
    document.body.classList.add(darkTheme)
    themeButton.classList.add(iconTheme)
    localStorage.setItem('selected-theme', 'dark')
    localStorage.setItem('selected-icon', 'uil-sun')
  }

  // Activate / deactivate the theme manually with the button
  themeButton.addEventListener('click', () => {
    // Add or remove the dark / icon theme
    document.body.classList.toggle(darkTheme)
    themeButton.classList.toggle(iconTheme)
    // We save the theme and the current icon that the user chose
    localStorage.setItem('selected-theme', getCurrentTheme())
    localStorage.setItem('selected-icon', getCurrentIcon())
  })
}

/*==================== WEB3 ANIMATIONS ====================*/

// Global variables to track animations
let activeAnimations = []
let isTypingActive = false
let typingRunId = 0

// Scroll Animation Observer
const scrollElements = document.querySelectorAll('.section__title, .section__subtitle, .scroll-animate, .skills__content, .qualification__data, .portfolio__content, .contact__information')

const elementInView = (el, dividend = 1) => {
  const elementTop = el.getBoundingClientRect().top
  const elementVisible = elementTop <= ((window.innerHeight || document.documentElement.clientHeight) / dividend)
  return elementVisible
}

const displayScrollElement = (element) => {
  element.classList.add('active')
}

const handleScrollAnimation = () => {
  scrollElements.forEach((el) => {
    if (elementInView(el, 1.1)) {  // 更容易触发
      displayScrollElement(el)
    }
  })

}

// Debug function to manually show elements (remove after testing)
const forceShowAllElements = () => {
  scrollElements.forEach((el) => {
    displayScrollElement(el)
  })
}

// Throttle scroll events for better performance
let ticking = false
window.addEventListener('scroll', () => {
  if (!ticking) {
    requestAnimationFrame(() => {
      handleScrollAnimation()
      ticking = false
    })
    ticking = true
  }
})

// Typing Effect
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
let prefersReducedMotion = motionPreference.matches
motionPreference.addEventListener('change', event => {
  prefersReducedMotion = event.matches
  if (event.matches) {
    clearTimeout(languageChangeTimeout)
    stopAllAnimations()
    displayFullTypingTexts()
    if (readNowButton) readNowButton.hidden = true
  }
})

/*==================== ABOUT CARD REEL ====================*/
// One local controller owns the continuous progress. Ambient flow, focus
// navigation, indicators, and the play/pause control all operate on it.
const ABOUT_REEL_CONFIG = Object.freeze({
  ambientSpeed: 1 / 6300,
  ambientDirection: -1,
  focusDuration: 540,
  resumeDuration: 420,
  focusHoldDuration: 5000,
  cardGap: 18,
  frameCapMs: 64,
  viewportActivationThreshold: 0.12
})

const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum)
const easeOutCubic = progress => 1 - Math.pow(1 - progress, 3)
const modulo = (value, divisor) => ((value % divisor) + divisor) % divisor

function initAboutReel() {
  const reel = document.querySelector('[data-about-reel]')
  const viewport = reel?.querySelector('[data-about-reel-viewport]')
  const track = reel?.querySelector('[data-about-reel-track]')
  const cards = Array.from(track?.querySelectorAll('[data-about-reel-card]') || [])
  const indicators = Array.from(reel?.querySelectorAll('[data-about-reel-indicator]') || [])
  const toggle = reel?.querySelector('[data-about-reel-toggle]')

  if (!reel || !viewport || !track || cards.length !== 4 || indicators.length !== cards.length || !toggle) {
    return { onLanguageChange: () => {} }
  }

  // The static CSS flow is the reduced-motion and initialization fallback.
  // Keep the controller available when the system motion preference changes.

  const state = {
    progress: 0,
    velocity: 0,
    cardHeights: [],
    cardStep: 0,
    viewportHeight: 0,
    centerY: 0,
    frameId: null,
    layoutFrame: null,
    focusTimer: null,
    focusTimerToken: 0,
    transition: null,
    focusTarget: null,
    focusSource: null,
    focusStartedAt: -Infinity,
    holdRequested: false,
    focusHoldUntil: 0,
    resumeStartedAt: performance.now(),
    lastFrameAt: performance.now(),
    lastIndicatorIndex: -1,
    lastPointerMoveAt: -Infinity,
    mode: 'ambient',
    inViewport: false,
    manualPause: false,
    controlFocus: false
  }

  const aboutSection = reel.closest('.about.section') || reel
  const hoverEnabled = () => !window.matchMedia('(max-width: 567px)').matches
  const ambientVelocity = () => ABOUT_REEL_CONFIG.ambientSpeed * ABOUT_REEL_CONFIG.ambientDirection
  const activeIndex = () => modulo(Math.round(state.progress), cards.length)

  const circularOffset = index => {
    let offset = index - state.progress
    const half = cards.length / 2
    while (offset > half) offset -= cards.length
    while (offset < -half) offset += cards.length
    return offset
  }

  const cancelFrame = () => {
    if (state.frameId !== null) {
      cancelAnimationFrame(state.frameId)
      state.frameId = null
    }
  }

  const clearFocusTimer = () => {
    if (state.focusTimer !== null) {
      clearTimeout(state.focusTimer)
      state.focusTimer = null
    }
    state.focusTimerToken += 1
    state.focusHoldUntil = 0
  }

  const ambientEligible = () => (
    !prefersReducedMotion &&
    state.inViewport &&
    !state.manualPause &&
    !state.controlFocus &&
    state.focusTarget === null &&
    !document.hidden
  )

  const shouldAnimate = () => (
    !prefersReducedMotion &&
    state.inViewport &&
    !document.hidden &&
    (Boolean(state.transition) || ambientEligible())
  )

  const updateIndicators = () => {
    const index = activeIndex()
    reel.dataset.activeCard = String(index + 1)
    reel.dataset.motionMode = state.mode
    if (state.lastIndicatorIndex === index) return
    state.lastIndicatorIndex = index
    indicators.forEach((indicator, indicatorIndex) => {
      const isActive = indicatorIndex === index
      indicator.classList.toggle('is-active', isActive)
      indicator.setAttribute('aria-current', String(isActive))
    })
    updateAccessibleLabels()
  }

  const render = () => {
    if (!state.cardStep) return
    cards.forEach((card, index) => {
      const offset = circularOffset(index)
      const distance = Math.abs(offset)
      const cardHeight = state.cardHeights[index] || state.cardHeights[0] || 0
      const top = state.centerY - (cardHeight / 2) + (offset * state.cardStep)
      const scale = distance <= 1
        ? 1 - (distance * 0.06)
        : Math.max(0.84, 0.94 - ((distance - 1) * 0.08))
      const opacity = distance <= 1
        ? 1 - (distance * 0.42)
        : Math.max(0.04, 0.58 - ((distance - 1) * 0.46))

      card.style.transform = `translate3d(0, ${top.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`
      card.style.opacity = opacity.toFixed(3)
      card.style.zIndex = String(30 - Math.round(distance * 10))
    })
    updateIndicators()
  }

  const measure = () => {
    const viewportRect = viewport.getBoundingClientRect()
    state.viewportHeight = viewportRect.height
    state.centerY = state.viewportHeight / 2
    state.cardHeights = cards.map(card => card.offsetHeight)
    const tallestCard = Math.max(...state.cardHeights, 0)
    state.cardStep = tallestCard + ABOUT_REEL_CONFIG.cardGap
    render()
  }

  const requestLayout = () => {
    if (state.layoutFrame !== null) return
    state.layoutFrame = requestAnimationFrame(() => {
      state.layoutFrame = null
      measure()
    })
  }

  const ensureFrame = () => {
    if (state.frameId === null && shouldAnimate()) {
      state.frameId = requestAnimationFrame(frame)
    }
  }

  const beginAmbient = (timestamp = performance.now()) => {
    if (state.manualPause) {
      state.velocity = 0
      state.mode = 'paused'
      cancelFrame()
      render()
      return
    }
    if (state.controlFocus || state.focusTarget !== null) {
      state.velocity = 0
      state.mode = state.controlFocus ? 'attention' : 'focused'
      cancelFrame()
      render()
      return
    }
    state.resumeStartedAt = timestamp
    state.velocity = 0
    state.mode = 'resuming'
    render()
    ensureFrame()
  }

  const scheduleFocusRelease = () => {
    clearFocusTimer()
    const token = state.focusTimerToken
    state.focusHoldUntil = performance.now() + ABOUT_REEL_CONFIG.focusHoldDuration
    state.focusTimer = window.setTimeout(() => {
      if (token !== state.focusTimerToken) return
      state.focusTimer = null
      state.focusHoldUntil = 0
      state.holdRequested = false
      if (state.focusTarget === null) return
      state.focusTarget = null
      state.focusSource = null
      beginAmbient()
    }, ABOUT_REEL_CONFIG.focusHoldDuration)
  }

  const nearestCardProgress = index => {
    const currentCard = Math.round(state.progress)
    const currentIndex = modulo(currentCard, cards.length)
    let distance = index - currentIndex
    if (distance > cards.length / 2) distance -= cards.length
    if (distance < -cards.length / 2) distance += cards.length
    return currentCard + distance
  }

  const focusCard = (index, source = 'manual', hold = false) => {
    if (index < 0 || index >= cards.length) return
    clearFocusTimer()
    const now = performance.now()
    state.focusTarget = index
    state.focusSource = source
    state.focusStartedAt = now
    state.holdRequested = hold
    state.velocity = 0
    const target = nearestCardProgress(index)
    state.transition = {
      start: state.progress,
      target,
      startedAt: now
    }
    state.mode = 'focus'
    if (Math.abs(target - state.progress) <= 0.001) {
      state.progress = target
      state.transition = null
      state.mode = 'focused'
      if (state.holdRequested) scheduleFocusRelease()
      render()
      return
    }
    render()
    ensureFrame()
  }

  const releaseFocus = index => {
    if (index !== undefined && state.focusTarget !== index) return
    clearFocusTimer()
    state.holdRequested = false
    state.focusTarget = null
    state.focusSource = null
    state.focusStartedAt = -Infinity
    // Keep the exact progress currently rendered. There is intentionally no
    // pre-focus snapshot to restore and no snap-back target.
    state.transition = null
    state.velocity = 0
    beginAmbient()
  }

  function frame(timestamp) {
    state.frameId = null
    if (!state.inViewport || document.hidden) return

    const elapsed = clamp(timestamp - state.lastFrameAt, 8, ABOUT_REEL_CONFIG.frameCapMs)
    state.lastFrameAt = timestamp

    if (state.transition) {
      const transition = state.transition
      const transitionProgress = clamp(
        (timestamp - transition.startedAt) / ABOUT_REEL_CONFIG.focusDuration,
        0,
        1
      )
      state.progress = transition.start + ((transition.target - transition.start) * easeOutCubic(transitionProgress))

      if (transitionProgress >= 1) {
        state.progress = transition.target
        state.transition = null
        state.velocity = 0
        state.mode = state.manualPause ? 'paused' : 'focused'
        if (state.holdRequested) scheduleFocusRelease()
      }
    } else if (state.focusTarget !== null || state.controlFocus || state.manualPause) {
      state.velocity = 0
      state.mode = state.manualPause
        ? 'paused'
        : (state.focusTarget === null ? 'attention' : 'focused')
    } else if (ambientEligible()) {
      const resumeProgress = clamp(
        (timestamp - state.resumeStartedAt) / ABOUT_REEL_CONFIG.resumeDuration,
        0,
        1
      )
      state.velocity = ambientVelocity() * resumeProgress
      state.progress += state.velocity * elapsed
      state.mode = resumeProgress < 1 ? 'resuming' : 'ambient'
      if (Math.abs(state.progress) > cards.length * 100) state.progress %= cards.length
    }

    render()
    if (state.transition || ambientEligible()) ensureFrame()
  }

  const setManualPause = paused => {
    state.manualPause = paused
    toggle.dataset.paused = String(paused)
    if (paused) {
      clearFocusTimer()
      state.holdRequested = false
      state.velocity = 0
      state.mode = 'paused'
      if (!state.transition) cancelFrame()
    } else {
      state.controlFocus = false
      state.holdRequested = false
      state.focusTarget = null
      state.focusSource = null
      state.transition = null
      state.velocity = 0
      beginAmbient()
    }
    updateAccessibleLabels()
    render()
  }

  const setInViewport = visible => {
    if (state.inViewport === visible) return
    state.inViewport = visible
    reel.dataset.inViewport = String(visible)
    if (visible) {
      state.lastFrameAt = performance.now()
      if (state.focusTarget === null && !state.manualPause && !state.controlFocus) {
        state.resumeStartedAt = performance.now() - ABOUT_REEL_CONFIG.resumeDuration
        state.velocity = ambientVelocity()
        state.mode = 'ambient'
      }
      ensureFrame()
    } else {
      cancelFrame()
    }
  }

  const syncViewport = () => {
    const rect = aboutSection.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight
    const overlap = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
    const minimumOverlap = Math.min(rect.height, viewportHeight) * ABOUT_REEL_CONFIG.viewportActivationThreshold
    setInViewport(overlap > 0 && overlap >= minimumOverlap)
  }

  viewport.classList.add('is-ready')
  reel.dataset.ready = 'true'
  measure()
  updateIndicators()

  cards.forEach((card, index) => {
    card.addEventListener('mouseenter', () => {
      if (!hoverEnabled()) return
      const pointerMovedSinceFocus = state.lastPointerMoveAt > state.focusStartedAt + 4
      if (state.focusTarget === index && state.focusSource !== null) return
      if (state.focusSource !== null && !pointerMovedSinceFocus) return
      focusCard(index, 'hover')
    })
    card.addEventListener('mouseleave', () => {
      if (!hoverEnabled()) return
      const pointerMovedAfterFocus = state.lastPointerMoveAt > state.focusStartedAt + 4
      if (pointerMovedAfterFocus && (state.focusSource === 'hover' || state.focusSource === 'tap')) {
        releaseFocus(index)
      }
    })
    card.addEventListener('click', () => focusCard(index, 'tap', true))
  })

  reel.addEventListener('pointermove', () => {
    state.lastPointerMoveAt = performance.now()
  }, { passive: true })

  reel.addEventListener('mouseleave', () => {
    if (hoverEnabled() && (state.focusSource === 'hover' || state.focusSource === 'tap')) releaseFocus()
  })

  indicators.forEach((indicator, index) => {
    indicator.addEventListener('click', () => {
      state.controlFocus = false
      focusCard(index, 'indicator', true)
    })
  })

  toggle.addEventListener('click', () => {
    state.controlFocus = false
    setManualPause(!state.manualPause)
  })

  reel.addEventListener('focusin', event => {
    const card = event.target.closest('[data-about-reel-card]')
    if (card && reel.contains(card)) {
      focusCard(cards.indexOf(card), 'keyboard')
      return
    }
    state.controlFocus = true
    if (state.focusTarget === null && !state.manualPause) {
      state.mode = 'attention'
      cancelFrame()
      render()
    }
  })

  reel.addEventListener('focusout', event => {
    const relatedTarget = event.relatedTarget
    if (relatedTarget && reel.contains(relatedTarget)) return
    const card = event.target.closest('[data-about-reel-card]')
    if (card && reel.contains(card)) releaseFocus(cards.indexOf(card))
    state.controlFocus = false
    if (state.focusTarget === null && !state.manualPause) beginAmbient()
  })

  motionPreference.addEventListener('change', () => {
    cancelFrame()
    clearFocusTimer()
    state.transition = null
    state.focusTarget = null
    state.controlFocus = false
    requestLayout()
    if (!prefersReducedMotion) beginAmbient()
  })

  window.addEventListener('resize', requestLayout)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelFrame()
      return
    }
    if (state.inViewport) {
      state.lastFrameAt = performance.now()
      if (ambientEligible()) beginAmbient()
      else ensureFrame()
    }
  })

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const entry = entries[0]
      setInViewport(Boolean(entry?.isIntersecting && entry.intersectionRatio >= ABOUT_REEL_CONFIG.viewportActivationThreshold))
    }, { threshold: [0, ABOUT_REEL_CONFIG.viewportActivationThreshold] })
    observer.observe(aboutSection)
  } else {
    syncViewport()
    window.addEventListener('scroll', syncViewport, { passive: true })
  }

  requestAnimationFrame(syncViewport)

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(requestLayout)
    observer.observe(viewport)
    cards.forEach(card => observer.observe(card))
  }
  document.fonts?.ready?.then(requestLayout)

  return {
    onLanguageChange: () => {
      // Re-measure translated text without changing the live progress.
      requestLayout()
      render()
      if (ambientEligible()) beginAmbient()
    }
  }
}

let aboutReelController = null
try {
  aboutReelController = initAboutReel()
} catch (error) {
  // Keep the static card flow usable if an enhancement fails to initialize.
  console.error('About reel enhancement failed', error)
}

const typingTexts = [
  {
    element: document.querySelector('.home__title'),
    text: 'Hi, I\'m Lurek Lu',
    textCn: '你好，我是 Lurek Lu',
    delay: 500,
    speed: 80
  },
  {
    element: document.querySelector('.home__subtitle'),
    text: 'Undergraduate Student at City University of Hong Kong (Dongguan)',
    textCn: '香港城市大学（东莞）本科生',
    delay: 0,
    speed: 60
  },
  {
    element: document.querySelector('.home__research'),
    text: 'Research focus: Robot safety & reliability',
    textCn: '研究方向：机器人安全与可靠性',
    delay: 0,
    speed: 50
  },
  {
    element: document.querySelector('.home__motto'),
    text: "Getting robots to work is one thing. Trusting them to work safely among people is another.",
    textCn: "机器人会干活是一回事，我们敢不敢把它放到人群里，是另一回事。",
    duration: 1200
  },
  {
    element: document.querySelector('.home__description'),
    text: 'Long-term AI Practitioner · Independent Researcher · Entrepreneur',
    textCn: 'AI 工具长期实践者 · 独立研究者 · 创业者',
    delay: 0,
    speed: 50
  }
]



const readNowButton = document.querySelector('[data-read-now]')
readNowButton?.addEventListener('click', () => {
  clearTimeout(languageChangeTimeout)
  stopAllAnimations()
  displayFullTypingTexts()
  document.querySelector('.home__actions a')?.focus({ preventScroll: true })
  readNowButton.hidden = true
})

function typeWriter(element, text, speed = 50, runId) {
  return new Promise((resolve, reject) => {
    if (!element) {
      resolve()
      return
    }

    element.style.opacity = '1'
    let typedText = element.querySelector('.typing-text__content')
    let rendered = element.querySelector('.typing-text__rendered')
    if (!typedText || !rendered) {
      const reserve = document.createElement('span')
      reserve.className = 'typing-text__reserve'
      reserve.textContent = text
      rendered = document.createElement('span')
      rendered.className = 'typing-text__rendered'
      typedText = document.createElement('span')
      typedText.className = 'typing-text__content'
      rendered.append(typedText)
      element.replaceChildren(reserve, rendered)
    }
    const caret = document.createElement('span')
    caret.className = 'typing-text__caret'
    caret.setAttribute('aria-hidden', 'true')

    typedText.textContent = ''
    rendered.append(caret)
    element.classList.add('typing-text')

    let i = 0
    let animationId

    function type() {
      // Check if animation should be stopped
      if (!isTypingActive || runId !== typingRunId) {
        element.replaceChildren(document.createTextNode(typedText.textContent))
        element.classList.remove('typing-text')
        reject('Animation stopped')
        return
      }

      if (i < text.length) {
        typedText.textContent += text.charAt(i)
        i++
        animationId = setTimeout(type, speed)
        // Track this animation
        activeAnimations.push(animationId)
      } else {
        element.replaceChildren(document.createTextNode(text))
        element.classList.remove('typing-text')
        resolve()
      }
    }

    type()
  })
}

function getCurrentLanguage() {
  return localStorage.getItem('lang') || 'en'
}

function stopAllAnimations() {
  typingRunId += 1

  // Stop typing flag
  isTypingActive = false

  // Clear all active timeouts
  activeAnimations.forEach(id => clearTimeout(id))
  activeAnimations = []

  // Normalize reserved/animated markup back to its currently visible text.
  document.querySelectorAll('.typing-text').forEach(el => {
    const visibleText = el.querySelector('.typing-text__content')?.textContent || ''
    el.replaceChildren(document.createTextNode(visibleText))
    el.classList.remove('typing-text')
  })

  // Also reset typing texts elements specifically
  typingTexts.forEach(item => {
    if (item.element) {
      item.element.classList.remove('typing-text')
    }
  })
}

// When the user prefers reduced motion, skip the typewriter entirely and
// directly show the full final text in the current language.
function displayFullTypingTexts(currentLang = getCurrentLanguage()) {
  typingTexts.forEach(item => {
    if (!item.element) return
    item.element.style.opacity = '1'
    item.element.classList.remove('typing-text')
    item.element.textContent = currentLang === 'cn' ? item.textCn : item.text
  })
}

function reserveTypingLayout(targetLang) {
  typingTexts.forEach(item => {
    if (!item.element) return
    const text = targetLang === 'cn' ? item.textCn : item.text
    const reserve = document.createElement('span')
    reserve.className = 'typing-text__reserve'
    reserve.textContent = text
    const rendered = document.createElement('span')
    rendered.className = 'typing-text__rendered'
    const typedText = document.createElement('span')
    typedText.className = 'typing-text__content'
    rendered.append(typedText)
    item.element.replaceChildren(reserve, rendered)
    item.element.classList.add('typing-text')
    item.element.style.opacity = '0'
  })
}

async function startTypingAnimation(targetLang = getCurrentLanguage()) {
  // Stop all existing animations first
  stopAllAnimations()
  const runId = typingRunId

  // Reduced motion: show complete text immediately, no typing.
  if (prefersReducedMotion) {
    displayFullTypingTexts(targetLang)
    return
  }

  // Enable typing
  isTypingActive = true
  if (readNowButton) readNowButton.hidden = false
  reserveTypingLayout(targetLang)

  // First delay for initial start
  await new Promise(resolve => setTimeout(resolve, 500))
  if (!isTypingActive || runId !== typingRunId) return

  try {
    for (const item of typingTexts) {
      if (!isTypingActive || runId !== typingRunId) break // Check if we should stop

      const textToType = targetLang === 'cn' ? item.textCn : item.text
      await typeWriter(item.element, textToType, item.duration ? item.duration / textToType.length : item.speed, runId)
      // Small delay between each text for better visual flow
      if (isTypingActive && runId === typingRunId) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
  } catch (error) {
    // Animation was stopped, this is expected
  } finally {
    if (runId === typingRunId) {
      isTypingActive = false
      if (readNowButton) readNowButton.hidden = true
    }
  }
}



// Start typing animation when page loads
window.addEventListener('load', () => {
  // Also check scroll animations on load
  setTimeout(handleScrollAnimation, 100)
  setTimeout(handleScrollAnimation, 500)
})

// Debounce variable to prevent multiple rapid calls
let languageChangeTimeout = null

// Function to handle language change
function handleLanguageChange(event) {
  const targetLang = event && event.detail && event.detail.lang
    ? event.detail.lang
    : getCurrentLanguage()

  aboutReelController?.onLanguageChange()

  // Clear any existing timeout to prevent multiple rapid calls
  if (languageChangeTimeout) {
    clearTimeout(languageChangeTimeout)
  }

  // Immediately stop all animations
  stopAllAnimations()

  // Reduced motion: show the target language text immediately, no typing.
  if (prefersReducedMotion) {
    displayFullTypingTexts(targetLang)
    return
  }

  languageChangeTimeout = setTimeout(() => {
    // Keep the translated text in flow until the web fonts are stable, then
    // reserve the final layout synchronously before restarting the animation.
    const fontsReady = document.fonts?.ready || Promise.resolve()
    fontsReady.then(() => startTypingAnimation(targetLang))

    // Clear the timeout variable
    languageChangeTimeout = null
  }, 150)
}

document.addEventListener('app:languagechange', handleLanguageChange)

// Initial scroll animation check
document.addEventListener('DOMContentLoaded', () => {
  // Check animations multiple times to ensure they work
  handleScrollAnimation()
  setTimeout(handleScrollAnimation, 300)
  setTimeout(handleScrollAnimation, 600)
  setTimeout(handleScrollAnimation, 1000)
})

// Add resize listener to recheck animations
window.addEventListener('resize', () => {
  setTimeout(handleScrollAnimation, 100)
})

/*==================== APP READY ====================*/
// Mark the application as fully initialized. The inline watchdog in <head>
// removes .js-enabled (restoring the no-JS fallback) if this flag is not set
// within the timeout, e.g. when this script fails to run completely.
window.__appReady = true
