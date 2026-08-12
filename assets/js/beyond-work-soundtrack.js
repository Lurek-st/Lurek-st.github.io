const HOWLER_URL = "https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.core.min.js";
const SOUNDTRACK = Object.freeze({
  title: "I Don't Know You",
  artist: "Noni",
  src: "assets/audio/noni-i-dont-know-you.mp3",
  targetVolume: 0.18,
  initialFade: 1500,
  resumeFade: 400,
  pauseFade: 200
});

let soundtrackPromise;

export function initSoundtrack() {
  if (!soundtrackPromise) soundtrackPromise = createSoundtrack();
  return soundtrackPromise;
}

function loadHowler() {
  if (typeof window.Howl === "function") return Promise.resolve();
  const existing = document.querySelector('script[data-beyond-work-library="howler-core-2.2.4"]');
  if (existing) return new Promise((resolve, reject) => {
    existing.addEventListener("load", resolve, { once: true });
    existing.addEventListener("error", reject, { once: true });
  });
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = HOWLER_URL;
    script.async = true;
    script.dataset.beyondWorkLibrary = "howler-core-2.2.4";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Howler Core could not be loaded."));
    document.head.append(script);
  });
}

async function createSoundtrack() {
  const toggle = document.querySelector("[data-beyond-work-soundtrack-toggle]");
  if (!toggle) return null;

  let howl = null;
  let soundId = null;
  let state = "loading";
  let userPaused = false;
  let hasPlayed = false;
  let pendingStart = null;
  let pauseTimer = 0;
  let transitionId = 0;

  function render() {
    const playing = state === "playing";
    toggle.disabled = state === "loading" || state === "error";
    toggle.classList.toggle("is-playing", playing);
    toggle.setAttribute("aria-pressed", String(playing));
    toggle.setAttribute("aria-label", `${playing ? "Pause" : "Play"} ${SOUNDTRACK.title}`);
  }
  function setState(next) { state = next; render(); }
  function isPlaying() { return howl && (typeof soundId === "number" ? howl.playing(soundId) : howl.playing()); }
  function volume() { return typeof soundId === "number" ? howl.volume(soundId) : howl.volume(); }
  function setVolume(value) { if (typeof soundId === "number") howl.volume(value, soundId); else howl.volume(value); }
  function fade(from, to, duration) { if (typeof soundId === "number") howl.fade(from, to, duration, soundId); else howl.fade(from, to, duration); }
  function pause() { if (typeof soundId === "number") howl.pause(soundId); else howl.pause(); }
  function clearPause() { if (pauseTimer) { window.clearTimeout(pauseTimer); pauseTimer = 0; } }

  function start(kind, fadeDuration) {
    if (!howl || state === "error" || userPaused) return;
    clearPause();
    const transition = ++transitionId;
    pendingStart = { transition, kind, fadeDuration };
    if (howl.state() === "unloaded") { setState("loading"); howl.load(); }
    setVolume(0);
    const id = typeof soundId === "number" ? howl.play(soundId) : howl.play();
    if (typeof id === "number") soundId = id;
    window.setTimeout(() => {
      if (!pendingStart || pendingStart.transition !== transition || isPlaying()) return;
      pendingStart = null;
      if (!userPaused) setState("autoplay-blocked");
    }, 520);
  }

  function onPlay(id) {
    soundId = id;
    if (userPaused) { pause(); setState("paused"); return; }
    const request = pendingStart;
    pendingStart = null;
    hasPlayed = true;
    setState("playing");
    fade(volume(), SOUNDTRACK.targetVolume, request?.fadeDuration || SOUNDTRACK.resumeFade);
  }

  function playFromUser() {
    if (!howl || state === "error") return;
    userPaused = false;
    if (isPlaying()) { setState("playing"); fade(volume(), SOUNDTRACK.targetVolume, SOUNDTRACK.resumeFade); return; }
    start("user", hasPlayed ? SOUNDTRACK.resumeFade : SOUNDTRACK.initialFade);
  }

  function pauseFromUser() {
    if (!howl || state === "error") return;
    userPaused = true;
    pendingStart = null;
    const transition = ++transitionId;
    clearPause();
    setState("paused");
    if (!isPlaying()) return;
    fade(volume(), 0, SOUNDTRACK.pauseFade);
    pauseTimer = window.setTimeout(() => {
      if (transition === transitionId && userPaused) pause();
    }, SOUNDTRACK.pauseFade + 24);
  }

  function retryAfterGesture(event) {
    if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
    if (state === "autoplay-blocked" && !userPaused) start("fallback", SOUNDTRACK.initialFade);
  }

  toggle.addEventListener("click", () => {
    if (state === "playing") pauseFromUser();
    else playFromUser();
  });
  document.addEventListener("pointerdown", retryAfterGesture, { capture: true, passive: true });
  document.addEventListener("keydown", retryAfterGesture, { capture: true });
  render();

  try {
    await loadHowler();
    if ("mediaSession" in navigator && typeof window.MediaMetadata === "function") {
      navigator.mediaSession.metadata = new MediaMetadata({ title: SOUNDTRACK.title, artist: SOUNDTRACK.artist });
      navigator.mediaSession.setActionHandler("play", playFromUser);
      navigator.mediaSession.setActionHandler("pause", pauseFromUser);
    }
    howl = new window.Howl({
      src: [SOUNDTRACK.src], loop: true, volume: 0, preload: false,
      onloaderror: (_id, error) => { console.warn("Soundtrack audio unavailable.", error); setState("error"); },
      onplay: onPlay,
      onplayerror: () => { if (!isPlaying() && !userPaused) setState("autoplay-blocked"); },
      onunlock: () => { if (state === "autoplay-blocked" && !userPaused) start("fallback", SOUNDTRACK.initialFade); }
    });
    setState("paused");
  } catch (error) {
    console.warn("Soundtrack runtime unavailable; retaining the static soundtrack identity.", error);
    setState("error");
  }

  return {
    getState: () => ({ instanceCount: howl ? 1 : 0, state, userPaused, seek: howl && typeof soundId === "number" ? howl.seek(soundId) : 0 }),
    playFromUser,
    pauseFromUser
  };
}
