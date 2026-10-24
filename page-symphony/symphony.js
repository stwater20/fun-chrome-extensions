// Page Symphony — turns the DOM into a song. Same site, same key; same page, same tune.
(() => {
  if (window.__pageSymphony) {
    window.__pageSymphony.close();
    return;
  }

  // ---------- deterministic musical choices ----------
  const hash = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  };
  const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const MODES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    pentatonic: [0, 2, 4, 7, 9]
  };
  const hostHash = hash(location.hostname);
  const rootNote = hostHash % 12;
  const modeName = Object.keys(MODES)[(hostHash >> 4) % 5];
  const scale = MODES[modeName];
  const bpm = 84 + ((hostHash >> 8) % 48);
  const spb = 60 / bpm;
  const midi = (deg, oct = 0) => {
    const n = scale.length;
    const d = ((deg % n) + n) % n;
    return 48 + rootNote + 12 * (oct + Math.floor(deg / n)) + scale[d];
  };
  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ---------- read the page into a score ----------
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  function score() {
    const out = [];
    const els = document.body.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,blockquote,a[href],img,button,input,select,textarea,pre");
    for (const el of els) {
      if (out.length >= 500) break;
      if (el.closest("#__page-symphony")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const tag = el.tagName;
      const text = clean(el.innerText || el.alt || el.value || el.getAttribute("aria-label") || "");
      // skip links/headings already covered by their parent paragraph or list item
      if (tag === "A" && el.closest("p,li,h1,h2,h3,h4,h5,h6,blockquote")) continue;
      if (/^H[1-6]$/.test(tag)) {
        if (!text) continue;
        const big = tag === "H1" || tag === "H2";
        out.push({ el, kind: "chord", deg: hash(text) % scale.length, beats: big ? 4 : 2, big, label: text });
      } else if (tag === "P" || tag === "BLOCKQUOTE") {
        const words = text.split(/\s+/).filter(Boolean).slice(0, 10);
        if (words.length < 3) continue;
        out.push({ el, kind: "melody", words, beats: words.length * 0.5, label: text });
      } else if (tag === "LI") {
        if (el.querySelector("li")) continue;
        const words = text.split(/\s+/).filter(Boolean).slice(0, 4);
        if (!words.length) continue;
        out.push({ el, kind: "arp", words, beats: Math.max(1, words.length * 0.5), label: text });
      } else if (tag === "A") {
        if (!text) continue;
        out.push({ el, kind: "ding", deg: hash(text) % 7, beats: 0.5, label: "🔗 " + text });
      } else if (tag === "IMG") {
        if (r.width < 40) continue;
        out.push({ el, kind: "shimmer", deg: Math.round((r.width / Math.max(r.height, 1)) * 3), beats: 1, label: "🖼 " + (clean(el.alt) || "image") });
      } else if (tag === "PRE") {
        out.push({ el, kind: "code", seed: hash(text), beats: 2, label: "</> code" });
      } else {
        out.push({ el, kind: "click", beats: 0.25, label: "🔘 " + (text || tag.toLowerCase()) });
      }
    }
    if (!out.length) out.push({ el: document.body, kind: "chord", deg: 0, beats: 4, big: true, label: document.title || "silence" });
    return out;
  }
  const SCORE = score();
  const totalBeats = SCORE.reduce((a, e) => a + e.beats, 0);

  // ---------- audio engine ----------
  let ac, master, reverb, dry, streamDest, noiseBuf;
  function initAudio() {
    if (ac) return;
    ac = new AudioContext();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master = ac.createGain();
    master.gain.value = 0.8;
    master.connect(comp);
    comp.connect(ac.destination);
    streamDest = ac.createMediaStreamDestination();
    comp.connect(streamDest);
    dry = ac.createGain();
    dry.connect(master);
    reverb = ac.createConvolver();
    const len = ac.sampleRate * 2.4;
    const ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    reverb.buffer = ir;
    const wet = ac.createGain();
    wet.gain.value = 0.35;
    reverb.connect(wet).connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }
  function out(node, rev = 0.3) {
    node.connect(dry);
    if (rev) {
      const s = ac.createGain();
      s.gain.value = rev;
      node.connect(s).connect(reverb);
    }
  }
  function voice({ type = "sine", f, t, dur, vol = 0.2, a = 0.01, r = 0.25, rev = 0.3, filter, detune = 0 }) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.detune.value = detune;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.setValueAtTime(vol, t + Math.max(a, dur - r));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + r);
    let last = o;
    if (filter) {
      const bq = ac.createBiquadFilter();
      bq.type = "lowpass";
      bq.frequency.setValueAtTime(filter, t);
      o.connect(bq);
      last = bq;
    }
    last.connect(g);
    out(g, rev);
    o.start(t);
    o.stop(t + dur + r + 0.05);
  }
  const pluck = (m, t, vol = 0.18) => voice({ type: "triangle", f: freq(m), t, dur: 0.05, vol, a: 0.004, r: 0.35 });
  function pad(ms, t, dur) {
    for (const m of ms)
      for (const dt of [-7, 7])
        voice({ type: "sawtooth", f: freq(m), t, dur, vol: 0.045, a: 0.4, r: 0.8, filter: 1400, detune: dt, rev: 0.6 });
  }
  function bell(m, t) {
    const car = ac.createOscillator();
    const mod = ac.createOscillator();
    const mg = ac.createGain();
    car.frequency.value = freq(m);
    mod.frequency.value = freq(m) * 3.5;
    mg.gain.setValueAtTime(freq(m) * 2, t);
    mg.gain.exponentialRampToValueAtTime(1, t + 1.2);
    mod.connect(mg).connect(car.frequency);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    car.connect(g);
    out(g, 0.6);
    car.start(t); mod.start(t);
    car.stop(t + 1.7); mod.stop(t + 1.7);
  }
  function noise(t, dur, type, f, vol) {
    const s = ac.createBufferSource();
    s.buffer = noiseBuf;
    const bq = ac.createBiquadFilter();
    bq.type = type;
    bq.frequency.value = f;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bq).connect(g);
    out(g, 0.1);
    s.start(t);
    s.stop(t + dur + 0.02);
  }
  function kick(t) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g);
    out(g, 0);
    o.start(t);
    o.stop(t + 0.32);
  }
  const snare = (t) => { noise(t, 0.16, "bandpass", 1800, 0.28); voice({ type: "triangle", f: 190, t, dur: 0.02, vol: 0.15, a: 0.002, r: 0.08, rev: 0.05 }); };
  const hat = (t, open) => noise(t, open ? 0.18 : 0.04, "highpass", 7000, open ? 0.08 : 0.06);

  // ---------- playback ----------
  let chordDeg = 0;
  function play(ev, t) {
    switch (ev.kind) {
      case "chord": {
        chordDeg = ev.deg;
        const tri = [ev.deg, ev.deg + 2, ev.deg + 4].map((d) => midi(d, 0));
        pad(tri, t, ev.beats * spb);
        if (ev.big) noise(t, 1.4, "highpass", 5000, 0.07); // cymbal swell
        break;
      }
      case "melody":
        ev.words.forEach((w, i) => {
          if (w.length <= 2) return; // short words breathe
          const deg = hash(w.toLowerCase()) % 8 + chordDeg;
          const oct = /^[A-Z]/.test(w) ? 2 : 1;
          voice({ type: "sine", f: freq(midi(deg, oct)), t: t + i * 0.5 * spb, dur: 0.5 * spb * 0.8, vol: 0.14, a: 0.01, r: 0.12, rev: 0.35 });
          voice({ type: "triangle", f: freq(midi(deg, oct)), t: t + i * 0.5 * spb, dur: 0.05, vol: 0.05, a: 0.003, r: 0.15 });
        });
        break;
      case "arp":
        ev.words.forEach((w, i) => pluck(midi(chordDeg + [0, 2, 4, 7][i % 4], 1), t + i * 0.5 * spb));
        break;
      case "ding":
        pluck(midi(ev.deg + chordDeg, 2), t, 0.16);
        pluck(midi(ev.deg + chordDeg + 4, 2), t + 0.06, 0.08);
        break;
      case "shimmer":
        bell(midi(chordDeg + ev.deg, 2), t);
        bell(midi(chordDeg + ev.deg + 2, 2), t + spb / 2);
        break;
      case "code":
        for (let i = 0; i < 8; i++)
          voice({ type: "square", f: freq(midi(chordDeg + ((ev.seed >> (i * 3)) % 7), 1)), t: t + i * 0.25 * spb, dur: 0.06, vol: 0.05, a: 0.002, r: 0.04, rev: 0.1, filter: 3000 });
        break;
      case "click":
        noise(t, 0.03, "bandpass", 3500, 0.2);
        break;
    }
  }
  function grid(step, t, progress) {
    // step = eighth note index. The beat gets busier as the page goes on.
    const bar = step % 8;
    if (bar === 0 || bar === 4 || (progress > 0.5 && bar === 7)) kick(t);
    if (bar === 2 || bar === 6) snare(t);
    if (progress > 0.15) hat(t, bar === 7 && progress > 0.6);
    if (step % 2 === 0) voice({ type: "sine", f: freq(midi(chordDeg, -1)), t, dur: spb * 0.8, vol: 0.22, a: 0.01, r: 0.1, rev: 0 });
  }

  let playing = false, startedAt = 0, nextT = 0, idx = 0, step = 0, gridT = 0, endT = 0, timer = 0;
  const highlights = [];
  function scheduler() {
    const ahead = ac.currentTime + 0.15;
    while (idx < SCORE.length && nextT < ahead) {
      const ev = SCORE[idx];
      play(ev, nextT);
      highlights.push({ t: nextT, ev, i: idx });
      nextT += ev.beats * spb;
      idx++;
    }
    while (gridT < ahead && gridT < endT) {
      grid(step, gridT, (gridT - startedAt) / (endT - startedAt));
      gridT += spb / 2;
      step++;
    }
  }
  function start() {
    initAudio();
    if (ac.state === "suspended") ac.resume();
    if (!playing && idx === 0) {
      startedAt = nextT = gridT = ac.currentTime + 0.1;
      endT = startedAt + Math.ceil(totalBeats / 4) * 4 * spb;
    }
    playing = true;
    clearInterval(timer);
    timer = setInterval(scheduler, 25);
    ui();
  }
  function pause() {
    playing = false;
    if (ac) ac.suspend();
    ui();
  }
  function stop() {
    playing = false;
    clearInterval(timer);
    if (recorder && recorder.state === "recording") recorder.stop();
    if (ac) { ac.close(); ac = null; }
    idx = 0; step = 0; chordDeg = 0; highlights.length = 0;
    unhighlight();
    ui();
  }

  // ---------- visuals ----------
  let lit = null, litStyle = null;
  function unhighlight() {
    if (lit) {
      lit.style.outline = litStyle[0];
      lit.style.outlineOffset = litStyle[1];
      lit.style.transition = litStyle[2];
    }
    lit = null;
  }
  function highlight(ev) {
    unhighlight();
    lit = ev.el;
    litStyle = [lit.style.outline, lit.style.outlineOffset, lit.style.transition];
    const hue = (chordDeg * 51 + rootNote * 30) % 360;
    lit.style.transition = "outline-color .2s";
    lit.style.outline = `3px solid hsl(${hue} 90% 60%)`;
    lit.style.outlineOffset = "3px";
    if (follow) {
      const r = lit.getBoundingClientRect();
      if (r.top < 60 || r.bottom > innerHeight - 120) lit.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
  function frame() {
    if (!window.__pageSymphony) return;
    if (ac && playing) {
      while (highlights.length && highlights[0].t <= ac.currentTime) {
        const h = highlights.shift();
        highlight(h.ev);
        $(".now").textContent = h.ev.label.slice(0, 80);
      }
      const p = Math.min(1, (ac.currentTime - startedAt) / Math.max(0.1, endT - startedAt));
      $(".prog i").style.width = p * 100 + "%";
      if (idx >= SCORE.length && ac.currentTime > endT + 1.5) {
        if (loop) { stop(); start(); }
        else { stop(); $(".now").textContent = "fin."; }
      }
    }
    requestAnimationFrame(frame);
  }

  // ---------- recording ----------
  let recorder = null, chunks = [];
  function record() {
    if (recorder && recorder.state === "recording") {
      recorder.stop();
      return;
    }
    stop();
    initAudio();
    chunks = [];
    const type = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
    recorder = new MediaRecorder(streamDest.stream, { mimeType: type });
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${location.hostname.replace(/^www\./, "")}-theme.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      ui();
    };
    recorder.start();
    start();
    ui();
  }

  // ---------- player UI ----------
  let follow = true, loop = false;
  const host = document.createElement("div");
  host.id = "__page-symphony";
  host.style.cssText = "position:fixed;left:16px;bottom:16px;z-index:2147483647;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    .p{width:300px;background:#141224f2;color:#fff;border-radius:16px;padding:12px 14px;font:13px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;
      box-shadow:0 14px 40px rgba(0,0,0,.4)}
    .top{display:flex;align-items:center;gap:8px}
    .disc{width:34px;height:34px;border-radius:50%;background:conic-gradient(#ff6fb1,#7b5cff,#2ec4b6,#ff6fb1);flex:none;position:relative}
    .disc:after{content:"";position:absolute;inset:12px;border-radius:50%;background:#141224}
    .spin .disc{animation:spin 2.4s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    .title{flex:1;min-width:0}
    .title b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .title span{font-size:11.5px;color:#aaa6c8}
    .x{all:unset;cursor:pointer;opacity:.6;padding:4px}
    .x:hover{opacity:1}
    .now{margin:10px 0 6px;font-size:12px;color:#d9d5f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:16px}
    .prog{height:4px;background:#ffffff1f;border-radius:2px;overflow:hidden}
    .prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,#ff6fb1,#7b5cff)}
    .btns{display:flex;gap:6px;margin-top:10px}
    .btns button{all:unset;cursor:pointer;flex:1;text-align:center;padding:7px 0;border-radius:9px;background:#ffffff14;font-size:14px}
    .btns button:hover{background:#ffffff26}
    .btns button.on{background:#7b5cff}
    .btns button.rec.on{background:#e63946}
    .big{flex:1.6!important;font-weight:700}
  </style>
  <div class="p">
    <div class="top"><div class="disc"></div><div class="title"><b></b><span></span></div><button class="x" title="Close">✕</button></div>
    <div class="now">Press play to hear this page.</div>
    <div class="prog"><i></i></div>
    <div class="btns">
      <button class="big play" title="Play / pause">▶ Play</button>
      <button class="stop" title="Stop">⏹</button>
      <button class="rec" title="Record the whole song to a file">⏺</button>
      <button class="follow on" title="Scroll along with the music">👁</button>
      <button class="loop" title="Loop">🔁</button>
    </div>
  </div>`;
  document.documentElement.appendChild(host);
  const $ = (s) => root.querySelector(s);
  $(".title b").textContent = `${location.hostname.replace(/^www\./, "")} theme`;
  $(".title span").textContent = `${NOTE_NAMES[rootNote]} ${modeName} · ${bpm} bpm · ${Math.round((totalBeats * spb) / 6) / 10} min`;
  function ui() {
    $(".play").textContent = playing ? "⏸ Pause" : "▶ Play";
    $(".p").classList.toggle("spin", playing);
    $(".rec").classList.toggle("on", !!recorder && recorder.state === "recording");
    $(".rec").textContent = recorder && recorder.state === "recording" ? "⏹ Save" : "⏺";
  }
  $(".play").onclick = () => (playing ? pause() : start());
  $(".stop").onclick = () => { stop(); $(".now").textContent = "Stopped."; $(".prog i").style.width = "0"; };
  $(".rec").onclick = record;
  $(".follow").onclick = () => { follow = !follow; $(".follow").classList.toggle("on", follow); };
  $(".loop").onclick = () => { loop = !loop; $(".loop").classList.toggle("on", loop); };
  $(".x").onclick = close;

  function close() {
    stop();
    host.remove();
    window.__pageSymphony = null;
  }
  window.__pageSymphony = { close };
  requestAnimationFrame(frame);
})();
