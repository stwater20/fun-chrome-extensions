"""Builds Chrome Web Store screenshots (1280x800) and small promo tiles (440x280)
from the test-run screenshots. Usage: python3 tools/store_assets.py <shots dir>"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "tests", "shots")
OUT = os.path.join(ROOT, "store")
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

INFO = {
    "typing-rampage": ("Typing Rampage", ((255, 61, 119), (138, 43, 226)), ["typing-rampage", ("popup-typing-rampage",)]),
    "page-physics": ("Page Physics", ((58, 134, 255), (20, 40, 120)), ["page-physics", "page-physics-zero-g"]),
    "tab-pet": ("Tab Pet", ((120, 200, 255), (255, 214, 160)), [("popup-tab-pet-2", "popup-tab-pet-18", "popup-tab-pet-75"), ("popup-tab-pet-48",)]),
    "web-graffiti": ("Web Graffiti", ((30, 30, 44), (60, 30, 70)), ["web-graffiti", "options-web-graffiti"]),
    "wiki-race": ("Wiki Race", ((123, 92, 255), (255, 111, 177)), ["wiki-race-hud", "wiki-race-win", ("popup-wiki-race",)]),
    "page-dungeon": ("Page Dungeon", ((40, 36, 64), (13, 12, 20)), ["page-dungeon", "page-dungeon-later"]),
    "page-symphony": ("Page Symphony", ((255, 111, 177), (123, 92, 255)), ["page-symphony"]),
    "time-machine": ("Web Time Machine", ((0, 128, 128), (0, 70, 90)),
                     ["time-machine-win95", "time-machine-geocities", "time-machine-terminal", "time-machine-amber", ("popup-time-machine",)]),
}


def gradient(w, h, c1, c2):
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)], fill=tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)))
    return img


def popup_scene(names, colors):
    """Popups are small, so they're shown floating on a branded backdrop."""
    bg = gradient(1280, 800, *colors)
    ims = [Image.open(os.path.join(SHOTS, n + ".png")).convert("RGB") for n in names]
    scale = min(1.0, 700 / max(i.height for i in ims), 1180 / (sum(i.width for i in ims) + 40 * (len(ims) - 1)))
    if len(ims) == 1:
        scale = min(1.45, 700 / ims[0].height)
    ims = [i.resize((int(i.width * scale), int(i.height * scale)), Image.LANCZOS) for i in ims]
    total = sum(i.width for i in ims) + 40 * (len(ims) - 1)
    x = (1280 - total) // 2
    for im in ims:
        y = (800 - im.height) // 2
        shadow = Image.new("RGBA", (im.width + 60, im.height + 60), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle([30, 36, im.width + 30, im.height + 36], 16, fill=(0, 0, 0, 110))
        shadow = shadow.filter(ImageFilter.GaussianBlur(14))
        bg.paste(shadow, (x - 30, y - 30), shadow)
        mask = Image.new("L", im.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1], 12, fill=255)
        bg.paste(im, (x, y), mask)
        x += im.width + 40
    return bg


def tile(name, title, colors):
    t = gradient(440, 280, *colors)
    icon = Image.open(os.path.join(ROOT, name, "icons", "512.png")).resize((150, 150), Image.LANCZOS)
    t.paste(icon, (34, 65), icon)
    d = ImageDraw.Draw(t)
    words = title.split(" ")
    f = ImageFont.truetype(SANS, 34 if len(title) < 14 else 28)
    lines = [" ".join(words[: (len(words) + 1) // 2]), " ".join(words[(len(words) + 1) // 2:])] if len(words) > 1 else [title]
    light = sum(colors[0]) > 520
    for i, line in enumerate(l for l in lines if l):
        d.text((206, 112 + i * 44), line, font=f, fill=(40, 30, 20) if light else (255, 255, 255))
    return t


for name, (title, colors, shots) in INFO.items():
    out = os.path.join(OUT, name)
    os.makedirs(out, exist_ok=True)
    for i, s in enumerate(shots, 1):
        img = popup_scene(s, colors) if isinstance(s, tuple) else Image.open(os.path.join(SHOTS, s + ".png")).convert("RGB").resize((1280, 800))
        img.save(os.path.join(out, f"screenshot-{i}.png"))
    tile(name, title, colors).save(os.path.join(out, "promo-small-440x280.png"))
    print(name, len(shots), "screenshots")


# ---------- marquee promo tile (1400x560) ----------
TAGLINES = {
    "typing-rampage": "Every keystroke explodes.",
    "page-physics": "One click and the page loses gravity.",
    "tab-pet": "A little blob that eats your tabs.",
    "web-graffiti": "Sticky notes and doodles on any website.",
    "wiki-race": "Article to article, links only. Go!",
    "page-dungeon": "Every web page is a dungeon.",
    "page-symphony": "Every website has a theme song.",
    "time-machine": "Send any website back in time.",
}
MARQUEE_SHOT = {"tab-pet": "screenshot-1", "wiki-race": "screenshot-2", "time-machine": "screenshot-2"}


def marquee(name, title, colors):
    W, H = 1400, 560
    m = gradient(W, H, *colors)
    light = sum(colors[0]) > 520
    fg = (40, 30, 20) if light else (255, 255, 255)
    sub = (90, 75, 60) if light else (235, 230, 255)
    icon = Image.open(os.path.join(ROOT, name, "icons", "512.png")).resize((150, 150), Image.LANCZOS)
    m.paste(icon, (80, 110), icon)
    d = ImageDraw.Draw(m)
    d.text((80, 300), title, font=ImageFont.truetype(SANS, 64 if len(title) < 14 else 56), fill=fg)
    tf = ImageFont.truetype(SANS.replace("-Bold", ""), 30)
    words, lines, cur = TAGLINES[name].split(), [], ""
    for w in words:
        if d.textlength((cur + " " + w).strip(), font=tf) > 520:
            lines.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    lines.append(cur)
    for i, l in enumerate(lines):
        d.text((82, 390 + i * 42), l, font=tf, fill=sub)
    # screenshot in a rounded frame, slightly tilted, bleeding off the right edge
    shot = Image.open(os.path.join(OUT, name, MARQUEE_SHOT.get(name, "screenshot-1") + ".png")).convert("RGB").resize((760, 475), Image.LANCZOS)
    frame = Image.new("RGBA", (800, 515), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    fd.rounded_rectangle([0, 0, 799, 514], 22, fill=(255, 255, 255, 255))
    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, shot.width - 1, shot.height - 1], 14, fill=255)
    frame.paste(shot, (20, 20), mask)
    frame = frame.rotate(-4, expand=True, resample=Image.BICUBIC)
    shadow = Image.new("RGBA", (frame.width + 80, frame.height + 80), (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 120), (40, 52), frame.split()[3])
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))
    m = m.convert("RGBA")
    m.alpha_composite(shadow, (680 - 40, 10))
    m.alpha_composite(frame, (680, 0))
    return m.convert("RGB")


for name, (title, colors, _) in INFO.items():
    marquee(name, title, colors).save(os.path.join(OUT, name, "promo-marquee-1400x560.png"))
print("marquees done")
