"""Draws the icon for each extension at 512px and saves 16/32/48/128 PNGs."""
import math
import os
import random
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 512
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def base(c1, c2):
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    grad = Image.new("RGBA", (S, S))
    gd = ImageDraw.Draw(grad)
    for y in range(S):
        t = y / S
        col = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)) + (255,)
        gd.line([(0, y), (S, y)], fill=col)
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([16, 16, S - 16, S - 16], radius=112, fill=255)
    img.paste(grad, (0, 0), mask)
    return img, ImageDraw.Draw(img)


def save(img, name):
    d = os.path.join(ROOT, name, "icons")
    os.makedirs(d, exist_ok=True)
    for size in (16, 32, 48, 128):
        img.resize((size, size), Image.LANCZOS).save(os.path.join(d, f"{size}.png"))
    img.save(os.path.join(d, "512.png"))


def typing():
    img, d = base((255, 61, 119), (138, 43, 226))
    # keycap
    d.rounded_rectangle([130, 170, 382, 400], radius=40, fill=(40, 20, 60))
    d.rounded_rectangle([150, 180, 362, 360], radius=32, fill=(255, 255, 255))
    f = ImageFont.truetype(SANS, 150)
    d.text((256, 270), "A", font=f, fill=(255, 61, 119), anchor="mm")
    random.seed(3)
    for i in range(14):
        a = random.uniform(-math.pi * 0.95, -math.pi * 0.05)
        r = random.uniform(150, 215)
        x, y = 256 + math.cos(a) * r, 230 + math.sin(a) * r * 0.75
        s = random.uniform(10, 22)
        col = random.choice([(255, 204, 0), (255, 255, 255), (0, 230, 255)])
        d.ellipse([x - s, y - s, x + s, y + s], fill=col)
    save(img, "typing-rampage")


def physics():
    img, d = base((58, 134, 255), (20, 40, 120))
    d.rectangle([60, 410, 452, 430], fill=(255, 255, 255, 90))
    blocks = [((110, 330, 250, 410), 0, (255, 209, 102)), ((260, 300, 400, 410), 0, (239, 71, 111)),
              ((170, 200, 330, 290), -14, (6, 214, 160)), ((290, 90, 380, 180), 22, (255, 255, 255))]
    for (x0, y0, x1, y1), ang, col in blocks:
        layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        ld.rounded_rectangle([x0, y0, x1, y1], radius=14, fill=col)
        ld.line([(x0 + 20, y0 + 28), (x1 - 30, y0 + 28)], fill=(0, 0, 0, 70), width=10)
        ld.line([(x0 + 20, y0 + 52), (x1 - 50, y0 + 52)], fill=(0, 0, 0, 50), width=8)
        layer = layer.rotate(ang, center=((x0 + x1) / 2, (y0 + y1) / 2), resample=Image.BICUBIC)
        img.alpha_composite(layer)
    d = ImageDraw.Draw(img)
    for y in (70, 110):
        d.line([(335, y - 40), (335, y - 10)], fill=(255, 255, 255, 140), width=8)
    save(img, "page-physics")


def pet():
    img, d = base((207, 238, 254), (255, 248, 236))
    cx, cy, rx, ry = 256, 300, 160, 140
    d.polygon([(190, 185), (225, 105), (255, 190)], fill=(80, 200, 120), outline=(30, 80, 45))
    d.polygon([(322, 185), (287, 105), (257, 190)], fill=(80, 200, 120), outline=(30, 80, 45))
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(80, 200, 120), outline=(30, 80, 45), width=14)
    for s in (-1, 1):
        x = cx + s * 58
        d.ellipse([x - 22, 250, x + 22, 300], fill=(30, 80, 45))
        d.ellipse([x - 12, 258, x + 2, 274], fill=(255, 255, 255))
        d.ellipse([x + s * 45 - 26, 312, x + s * 45 + 26, 334], fill=(255, 120, 150))
    d.arc([206, 300, 306, 370], 20, 160, fill=(30, 80, 45), width=12)
    save(img, "tab-pet")


def graffiti():
    img, d = base((30, 30, 44), (60, 30, 70))
    random.seed(8)
    for col, pts in [((255, 77, 109), [(70, 330), (140, 250), (210, 330), (280, 240)]), ((46, 196, 182), [(90, 420), (230, 380), (420, 430)])]:
        d.line(pts, fill=col, width=30, joint="curve")
        for p in pts:
            d.ellipse([p[0] - 15, p[1] - 15, p[0] + 15, p[1] + 15], fill=col)
    note = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    nd = ImageDraw.Draw(note)
    nd.rectangle([230, 80, 430, 270], fill=(255, 242, 122))
    nd.rectangle([230, 80, 430, 110], fill=(240, 220, 90))
    for y in (150, 190, 230):
        nd.line([(255, y), (400 - (y % 3) * 20, y)], fill=(90, 80, 40), width=10)
    note = note.rotate(-8, center=(330, 175), resample=Image.BICUBIC)
    img.alpha_composite(note)
    save(img, "web-graffiti")


def wikirace():
    img, d = base((123, 92, 255), (255, 111, 177))
    f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", 230)
    d.text((215, 285), "W", font=f, fill=(255, 255, 255), anchor="mm")
    # flag
    d.line([(370, 110), (370, 420)], fill=(255, 255, 255), width=14)
    for i in range(4):
        for j in range(3):
            col = (20, 20, 30) if (i + j) % 2 == 0 else (255, 255, 255)
            d.rectangle([377 + i * 22, 112 + j * 22, 399 + i * 22, 134 + j * 22], fill=col)
    for i, y in enumerate((150, 200, 250)):
        d.line([(40, y), (110 - i * 20, y)], fill=(255, 255, 255, 160), width=10)
    save(img, "wiki-race")


def dungeon():
    img, d = base((40, 36, 64), (13, 12, 20))
    f = ImageFont.truetype(MONO, 70)
    grid = ["######", "#····#", "#·@··#", "#··g·#", "#····>", "######"]
    for j, row in enumerate(grid):
        for i, ch in enumerate(row):
            col = {"#": (108, 106, 144), "@": (255, 209, 102), "g": (239, 71, 111), ">": (255, 255, 255)}.get(ch, (70, 68, 100))
            d.text((86 + i * 68, 86 + j * 68), ch, font=f, fill=col, anchor="mm")
    save(img, "page-dungeon")


def symphony():
    img, d = base((255, 111, 177), (123, 92, 255))
    for i, h in enumerate([60, 120, 180, 110, 150, 80, 200, 130]):
        x = 70 + i * 48
        d.rounded_rectangle([x, 430 - h, x + 30, 430], radius=12, fill=(255, 255, 255, 110))
    d.ellipse([140, 290, 240, 370], fill=(255, 255, 255))
    d.ellipse([290, 250, 390, 330], fill=(255, 255, 255))
    d.rectangle([222, 110, 240, 330], fill=(255, 255, 255))
    d.rectangle([372, 70, 390, 290], fill=(255, 255, 255))
    d.polygon([(222, 110), (390, 70), (390, 120), (222, 160)], fill=(255, 255, 255))
    save(img, "page-symphony")


def timemachine():
    img, d = base((0, 128, 128), (0, 70, 90))
    d.rounded_rectangle([80, 110, 432, 360], radius=30, fill=(200, 200, 200), outline=(40, 40, 40), width=10)
    d.rectangle([115, 140, 397, 320], fill=(5, 12, 6))
    f = ImageFont.truetype(MONO, 64)
    d.text((140, 200), ">_", font=f, fill=(51, 255, 102), anchor="lm")
    for y in range(142, 320, 8):
        d.line([(116, y), (396, y)], fill=(0, 0, 0, 90), width=2)
    d.rectangle([220, 360, 292, 400], fill=(170, 170, 170))
    d.rounded_rectangle([160, 395, 352, 425], radius=8, fill=(200, 200, 200), outline=(40, 40, 40), width=6)
    # clock hands badge
    d.ellipse([350, 50, 470, 170], fill=(255, 209, 102), outline=(40, 40, 40), width=8)
    d.line([(410, 110), (410, 72)], fill=(40, 40, 40), width=10)
    d.line([(410, 110), (440, 122)], fill=(40, 40, 40), width=10)
    save(img, "time-machine")


for fn in (typing, physics, pet, graffiti, wikirace, dungeon, symphony, timemachine):
    fn()
print("icons done")
