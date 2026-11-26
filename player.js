/* =========================================================
   SETTINGS — this is the only part you need to edit
   ========================================================= */
const CONFIG = {
  title:    "My Track",            // shown on the page
  artist:   "Artist Name",         // shown under the title
  file:     "audio/track.dat",     // path of the audio file inside your repo
  encoded:  true,                  // true  = file was made with encode-audio.html (.dat)
                                   // false = you uploaded a normal .mp3 / .m4a
  mimeType: "audio/mpeg",          // audio/mpeg (.mp3), audio/mp4 (.m4a), audio/ogg, audio/wav
  key:      "change-this-secret-key" // MUST match the key you typed in encode-audio.html
};
/* ========================================================= */

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const playBtn = $("play"), backBtn = $("back"), fwdBtn = $("fwd");
  const seek = $("seek"), vol = $("volume");
  const cur = $("current"), dur = $("duration");
  const disc = $("disc"), status = $("status");

  $("title").textContent = CONFIG.title;
  $("artist").textContent = CONFIG.artist;
  document.title = CONFIG.title;

  // The audio element is never added to the page, so there is no
  // native player and no "Download" option in any browser menu.
  const audio = new Audio();
  audio.preload = "auto";
  audio.disableRemotePlayback = true;

  // ---------- load + unscramble ----------
  function unscramble(bytes, key) {
    const k = new TextEncoder().encode(key);
    for (let i = 0; i < bytes.length; i++) bytes[i] ^= k[i % k.length];
    return bytes;
  }

  async function load() {
    try {
      const res = await fetch(CONFIG.file);
      if (!res.ok) throw new Error("HTTP " + res.status);
      let bytes = new Uint8Array(await res.arrayBuffer());
      if (CONFIG.encoded) bytes = unscramble(bytes, CONFIG.key);

      // Play from in-memory data (blob:), not from a direct file link.
      audio.src = URL.createObjectURL(new Blob([bytes], { type: CONFIG.mimeType }));
      bytes = null;

      [playBtn, backBtn, fwdBtn, seek].forEach((el) => (el.disabled = false));
      status.textContent = "";
    } catch (err) {
      console.error(err);
      status.textContent = location.protocol === "file:"
        ? "Open this page from GitHub Pages (or a local server), not by double-clicking."
        : "Couldn't load the audio. Check the file path and key in player.js.";
    }
  }

  // ---------- controls ----------
  const fmt = (s) => {
    if (!isFinite(s)) return "0:00";
    s = Math.floor(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
  };
  const paint = (el) => el.style.setProperty("--p", (el.value / el.max) * 100 + "%");

  function toggle() {
    if (playBtn.disabled) return;
    audio.paused ? audio.play().catch(console.error) : audio.pause();
  }
  const skip = (sec) => {
    if (!isFinite(audio.duration)) return;
    audio.currentTime = Math.min(Math.max(audio.currentTime + sec, 0), audio.duration);
  };

  playBtn.addEventListener("click", toggle);
  backBtn.addEventListener("click", () => skip(-10));
  fwdBtn.addEventListener("click", () => skip(10));

  let dragging = false;
  seek.addEventListener("input", () => {
    dragging = true;
    paint(seek);
    if (isFinite(audio.duration)) cur.textContent = fmt((seek.value / 1000) * audio.duration);
  });
  seek.addEventListener("change", () => {
    if (isFinite(audio.duration)) audio.currentTime = (seek.value / 1000) * audio.duration;
    dragging = false;
  });

  vol.addEventListener("input", () => { audio.volume = vol.value / 100; paint(vol); });
  paint(vol);

  audio.addEventListener("loadedmetadata", () => (dur.textContent = fmt(audio.duration)));
  audio.addEventListener("timeupdate", () => {
    if (dragging || !isFinite(audio.duration)) return;
    seek.value = (audio.currentTime / audio.duration) * 1000;
    paint(seek);
    cur.textContent = fmt(audio.currentTime);
  });
  audio.addEventListener("play", () => {
    playBtn.classList.add("is-playing");
    playBtn.setAttribute("aria-label", "Pause");
    disc.classList.add("playing");
  });
  audio.addEventListener("pause", () => {
    playBtn.classList.remove("is-playing");
    playBtn.setAttribute("aria-label", "Play");
    disc.classList.remove("playing");
  });
  audio.addEventListener("ended", () => { audio.currentTime = 0; });

  // Lock-screen / headphone controls on phones
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: CONFIG.title, artist: CONFIG.artist });
    navigator.mediaSession.setActionHandler("play", () => audio.play());
    navigator.mediaSession.setActionHandler("pause", () => audio.pause());
    navigator.mediaSession.setActionHandler("seekbackward", () => skip(-10));
    navigator.mediaSession.setActionHandler("seekforward", () => skip(10));
  }

  // ---------- download deterrents ----------
  document.addEventListener("contextmenu", (e) => e.preventDefault()); // no right-click / "Save as"
  document.addEventListener("dragstart", (e) => e.preventDefault());
  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (k === "s" || k === "u" || k === "p")) e.preventDefault();             // save, view-source, print
    if (e.key === "F12" || (mod && (e.shiftKey || e.altKey) && ["i", "j", "c"].includes(k))) e.preventDefault(); // dev tools
    if (e.code === "Space" && e.target === document.body) { e.preventDefault(); toggle(); }
  });

  load();
})();
