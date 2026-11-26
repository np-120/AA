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
  key:      "change-this-secret-key", // MUST match the key you typed in encode-audio.html

  // Tracking — paste your Google Apps Script Web App URL (ends in /exec).
  // Leave "" to turn tracking off (the name popup still shows).
  logUrl:   "",
  askName:  true,                  // false = no popup
  rememberName: true               // true = returning visitors on the same device aren't asked again
};
/* ========================================================= */

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const playBtn = $("play"), backBtn = $("back"), fwdBtn = $("fwd");
  const seek = $("seek"), vol = $("volume");
  const cur = $("current"), dur = $("duration");
  const disc = $("disc"), status = $("status");
  const gate = $("gate"), gateForm = $("gateForm"), nameInput = $("nameInput"), nameErr = $("nameErr");
  const listenerLine = $("listener");

  $("title").textContent = CONFIG.title;
  $("artist").textContent = CONFIG.artist;
  document.title = CONFIG.title;

  // ---------- small storage helpers (never crash if storage is blocked) ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const randId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  let visitorId = store.get("ap_visitor");
  if (!visitorId) { visitorId = randId(); store.set("ap_visitor", visitorId); }
  const sessionId = randId();
  let listenerName = CONFIG.rememberName ? (store.get("ap_name") || "") : "";

  // ---------- device details ----------
  function deviceInfo() {
    const ua = navigator.userAgent || "";
    let os = "Other", browser = "Other", device = "Desktop";

    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) { os = "iPadOS"; device = "Tablet"; }
    else if (/iPhone|iPod/.test(ua)) { os = "iOS"; device = "Mobile"; }
    else if (/Android/.test(ua)) { os = "Android"; device = /Mobile/.test(ua) ? "Mobile" : "Tablet"; }
    else if (/Windows/.test(ua)) os = "Windows";
    else if (/CrOS/.test(ua)) os = "ChromeOS";
    else if (/Macintosh|Mac OS X/.test(ua)) os = "macOS";
    else if (/Linux/.test(ua)) os = "Linux";

    const ver = (re) => { const m = ua.match(re); return m ? " " + m[1] : ""; };
    if (os === "Android") os += ver(/Android ([\d.]+)/);
    if (os === "iOS" || os === "iPadOS") os += ver(/OS (\d+[_\d]*)/).replace(/_/g, ".");

    if (/SamsungBrowser/.test(ua)) browser = "Samsung Internet" + ver(/SamsungBrowser\/(\d+)/);
    else if (/Edg\//.test(ua)) browser = "Edge" + ver(/Edg\/(\d+)/);
    else if (/OPR\/|Opera/.test(ua)) browser = "Opera" + ver(/OPR\/(\d+)/);
    else if (/FxiOS|Firefox\//.test(ua)) browser = "Firefox" + ver(/(?:Firefox|FxiOS)\/(\d+)/);
    else if (/CriOS|Chrome\//.test(ua)) browser = "Chrome" + ver(/(?:Chrome|CriOS)\/(\d+)/);
    else if (/Safari\//.test(ua)) browser = "Safari" + ver(/Version\/(\d+)/);

    let tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}

    return {
      device, os, browser,
      screen: (screen.width || 0) + "x" + (screen.height || 0),
      language: navigator.language || "",
      timezone: tz,
      userAgent: ua
    };
  }
  const DEVICE = deviceInfo();

  // ---------- send a record to Google Sheets ----------
  function log(event, extra) {
    if (!CONFIG.logUrl) return;
    const body = JSON.stringify(Object.assign({
      event,
      name: listenerName,
      visitorId,
      sessionId,
      track: CONFIG.title,
      clientTime: new Date().toString(),
      page: location.href
    }, DEVICE, extra || {}));
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });

    // sendBeacon survives the tab closing; fetch is the fallback
    if (navigator.sendBeacon && navigator.sendBeacon(CONFIG.logUrl, blob)) return;
    fetch(CONFIG.logUrl, { method: "POST", mode: "no-cors", keepalive: true, body: blob }).catch(() => {});
  }

  // The audio element is never added to the page, so there is no
  // native player and no "Download" option in any browser menu.
  const audio = new Audio();
  audio.preload = "auto";
  audio.disableRemotePlayback = true;

  // ---------- unlock logic: controls work only when audio is loaded AND a name is given ----------
  let audioReady = false;
  const unlocked = () => audioReady && (!CONFIG.askName || !!listenerName);
  function refreshControls() {
    const on = unlocked();
    [playBtn, backBtn, fwdBtn, seek].forEach((el) => (el.disabled = !on));
  }

  function showListener() {
    if (!CONFIG.askName || !listenerName) { listenerLine.hidden = true; return; }
    listenerLine.hidden = false;
    listenerLine.textContent = "Listening as " + listenerName + " · ";
    const a = document.createElement("a");
    a.textContent = "not you?";
    a.addEventListener("click", () => {
      audio.pause();
      listenerName = "";
      store.del("ap_name");
      showListener();
      refreshControls();
      openGate();
    });
    listenerLine.appendChild(a);
  }

  function openGate() {
    gate.hidden = false;
    nameInput.value = "";
    nameErr.textContent = "";
    setTimeout(() => nameInput.focus(), 50);
  }

  gateForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const n = nameInput.value.replace(/\s+/g, " ").trim();
    if (n.length < 2) { nameErr.textContent = "Please enter your name."; return; }
    listenerName = n.slice(0, 60);
    if (CONFIG.rememberName) store.set("ap_name", listenerName);
    gate.hidden = true;
    showListener();
    refreshControls();
    log("opened");
  });

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

      audioReady = true;
      refreshControls();
      status.textContent = "";
    } catch (err) {
      console.error(err);
      status.textContent = location.protocol === "file:"
        ? "Open this page from GitHub Pages (or a local server), not by double-clicking."
        : "Couldn't load the audio. Check the file path and key in player.js.";
    }
  }

  // ---------- listening stats ----------
  let listened = 0;          // seconds actually heard this session
  let lastPos = 0;
  let reported = 0;          // seconds already sent
  let needNewPlay = true;    // next "play" counts as a new play (first time, or after it finished)
  let playNumber = 0;

  audio.addEventListener("timeupdate", () => {
    const d = audio.currentTime - lastPos;
    if (!audio.paused && d > 0 && d < 2) listened += d;   // ignore jumps from seeking
    lastPos = audio.currentTime;
  });
  audio.addEventListener("seeking", () => { lastPos = audio.currentTime; });

  function reportProgress(event) {
    const s = Math.round(listened);
    if (s <= reported) return;
    reported = s;
    log(event, { seconds: s, position: Math.round(audio.currentTime), duration: Math.round(audio.duration || 0), playNumber });
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
    if (!unlocked()) { if (CONFIG.askName && !listenerName) openGate(); return; }
    audio.paused ? audio.play().catch(console.error) : audio.pause();
  }
  const skip = (sec) => {
    if (!unlocked() || !isFinite(audio.duration)) return;
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
    // Safety net: block playback if somehow started without a name
    if (CONFIG.askName && !listenerName) { audio.pause(); openGate(); return; }
    playBtn.classList.add("is-playing");
    playBtn.setAttribute("aria-label", "Pause");
    disc.classList.add("playing");
    if (needNewPlay) {
      needNewPlay = false;
      playNumber++;
      log("play", { playNumber, duration: Math.round(audio.duration || 0) });
    }
  });
  audio.addEventListener("pause", () => {
    playBtn.classList.remove("is-playing");
    playBtn.setAttribute("aria-label", "Play");
    disc.classList.remove("playing");
  });
  audio.addEventListener("ended", () => {
    reportProgress("completed");
    reported = 0; listened = 0;   // each replay is measured on its own
    needNewPlay = true;
    audio.currentTime = 0;
    lastPos = 0;
  });

  // When the visitor leaves / switches tab, send how long they listened
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") reportProgress("left"); });
  window.addEventListener("pagehide", () => reportProgress("left"));

  // Lock-screen / headphone controls on phones
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: CONFIG.title, artist: CONFIG.artist });
    navigator.mediaSession.setActionHandler("play", () => { if (unlocked()) audio.play(); });
    navigator.mediaSession.setActionHandler("pause", () => audio.pause());
    navigator.mediaSession.setActionHandler("seekbackward", () => skip(-10));
    navigator.mediaSession.setActionHandler("seekforward", () => skip(10));
  }

  // ---------- download deterrents ----------
  document.addEventListener("contextmenu", (e) => { if (e.target !== nameInput) e.preventDefault(); });
  document.addEventListener("dragstart", (e) => e.preventDefault());
  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (k === "s" || k === "u" || k === "p")) e.preventDefault();             // save, view-source, print
    if (e.key === "F12" || (mod && (e.shiftKey || e.altKey) && ["i", "j", "c"].includes(k))) e.preventDefault(); // dev tools
    if (e.code === "Space" && e.target === document.body) { e.preventDefault(); toggle(); }
  });

  // ---------- start ----------
  if (CONFIG.askName && !listenerName) openGate();
  else if (CONFIG.askName) { showListener(); log("opened"); }
  refreshControls();
  load();
})();
