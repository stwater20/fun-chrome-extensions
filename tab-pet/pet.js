// Shared by the service worker (toolbar icon) and the popup (big animated pet).
const PET = (() => {
  const MOODS = [
    { min: 0, key: "hungry", line: "So hungry… open a tab for me?" },
    { min: 4, key: "happy", line: "Yum. This is the perfect amount of tabs." },
    { min: 11, key: "full", line: "Pleasantly full. Maybe slow down?" },
    { min: 21, key: "stuffed", line: "Ooof. I need to lie down." },
    { min: 36, key: "bloated", line: "Please… close… something…" },
    { min: 61, key: "explode", line: "I'M GONNA BLOW!!" }
  ];
  function mood(tabs) {
    let m = MOODS[0];
    for (const x of MOODS) if (tabs >= x.min) m = x;
    return m;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ctx: 2D context, S: square size in px, tabs: open tab count, t: seconds (animation)
  function draw(ctx, S, tabs, t = 0, opts = {}) {
    const m = mood(tabs).key;
    const fat = clamp((tabs - 4) / 60, 0, 1);
    const tiny = S <= 20;
    ctx.clearRect(0, 0, S, S);

    const bob = opts.animate ? Math.sin(t * 3) * S * 0.015 : 0;
    const shakeX = m === "explode" && opts.animate ? (Math.random() - 0.5) * S * 0.02 : 0;
    const squish = opts.animate ? 1 + Math.sin(t * 3) * 0.02 : 1;
    const thin = m === "hungry" ? 0.8 : 1;

    const rx = S * (0.26 + fat * 0.21) * thin * squish;
    const ry = S * (0.27 + fat * 0.06) / squish;
    const cx = S / 2 + shakeX;
    const cy = S - ry - S * (tiny ? 0.04 : 0.1) + bob;
    const hue = 140 - fat * 140;
    const fill = `hsl(${hue},${m === "hungry" ? 35 : 70}%,${tiny ? 50 : 58}%)`;
    const dark = `hsl(${hue},55%,${tiny ? 20 : 25}%)`;
    const lw = Math.max(1, S * 0.03);

    // shadow
    if (!tiny) {
      ctx.fillStyle = "rgba(0,0,0,.15)";
      ctx.beginPath();
      ctx.ellipse(S / 2, S - S * 0.07, rx * 0.9, S * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // feet
    ctx.fillStyle = dark;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + s * rx * 0.45, cy + ry * 0.9, rx * 0.22, ry * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // body
    ctx.fillStyle = fill;
    ctx.strokeStyle = dark;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // ears
    if (!tiny) {
      ctx.fillStyle = fill;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * rx * 0.3, cy - ry * 0.85);
        ctx.lineTo(cx + s * rx * 0.55, cy - ry * 1.25);
        ctx.lineTo(cx + s * rx * 0.68, cy - ry * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // belly shine
      ctx.fillStyle = "rgba(255,255,255,.25)";
      ctx.beginPath();
      ctx.ellipse(cx - rx * 0.35, cy - ry * 0.4, rx * 0.18, ry * 0.12, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // eyes
    const ey = cy - ry * 0.2;
    const ex = rx * 0.36;
    const er = Math.max(1.2, S * 0.05);
    const blink = opts.animate && t % 4 < 0.12;
    ctx.fillStyle = dark;
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(1, S * 0.025);
    ctx.lineCap = "round";
    for (const s of [-1, 1]) {
      const x = cx + s * ex;
      ctx.beginPath();
      if (m === "explode") {
        ctx.moveTo(x - er, ey - er); ctx.lineTo(x + er, ey + er);
        ctx.moveTo(x + er, ey - er); ctx.lineTo(x - er, ey + er);
        ctx.stroke();
      } else if (blink || m === "happy" || m === "full") {
        ctx.arc(x, ey + er * 0.3, er, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      } else if (m === "bloated") {
        ctx.moveTo(x - er, ey); ctx.lineTo(x + er, ey);
        ctx.stroke();
      } else {
        ctx.arc(x, ey, er, 0, Math.PI * 2);
        ctx.fill();
        if (!tiny) {
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(x - er * 0.35, ey - er * 0.35, er * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = dark;
        }
      }
    }
    if (tiny) return;

    // blush
    if (["stuffed", "bloated", "explode", "full"].includes(m)) {
      ctx.fillStyle = "rgba(255,90,120,.45)";
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + s * rx * 0.6, ey + er * 1.8, er * 1.3, er * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // mouth
    const my = cy + ry * 0.22;
    const mw = rx * 0.22;
    ctx.beginPath();
    ctx.lineWidth = Math.max(1, S * 0.022);
    if (m === "hungry") {
      ctx.ellipse(cx, my, mw * 0.5, mw * 0.7 + Math.sin(t * 6) * mw * 0.15, 0, 0, Math.PI * 2);
      ctx.fillStyle = dark;
      ctx.fill();
    } else if (m === "happy") {
      ctx.arc(cx, my - mw * 0.4, mw, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    } else if (m === "full") {
      ctx.arc(cx, my - mw * 0.6, mw * 0.7, Math.PI * 0.25, Math.PI * 0.75);
      ctx.stroke();
    } else if (m === "stuffed") {
      ctx.moveTo(cx - mw, my);
      for (let i = 0; i <= 4; i++) ctx.lineTo(cx - mw + (i * mw) / 2, my + (i % 2 ? mw * 0.25 : 0));
      ctx.stroke();
    } else if (m === "bloated") {
      ctx.arc(cx, my + mw * 0.6, mw * 0.8, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    } else {
      ctx.moveTo(cx - mw, my);
      for (let i = 0; i <= 6; i++) ctx.lineTo(cx - mw + (i * mw) / 3, my + (i % 2 ? -mw * 0.3 : mw * 0.3));
      ctx.stroke();
    }
    // sweat
    if (m === "bloated" || m === "explode") {
      const drops = m === "explode" ? 3 : 2;
      for (let i = 0; i < drops; i++) {
        const fall = opts.animate ? ((t * 0.8 + i * 0.37) % 1) : 0.3;
        const x = cx + rx * (0.75 + i * 0.08) * (i % 2 ? -1 : 1);
        const y = cy - ry * 0.9 + fall * ry * 0.6;
        ctx.fillStyle = `rgba(90,170,255,${1 - fall})`;
        ctx.beginPath();
        ctx.moveTo(x, y - S * 0.035);
        ctx.quadraticCurveTo(x + S * 0.025, y + S * 0.01, x, y + S * 0.02);
        ctx.quadraticCurveTo(x - S * 0.025, y + S * 0.01, x, y - S * 0.035);
        ctx.fill();
      }
    }
  }
  return { draw, mood, MOODS };
})();
if (typeof self !== "undefined") self.PET = PET;
