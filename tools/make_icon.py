"""Generates the Bifă app icon (1024x1024, no transparency) into the asset catalog.
Run:  python tools/make_icon.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

S = 4096  # supersampled, downscaled to 1024 at the end
OUT = Path(__file__).resolve().parent.parent / "Bifa" / "Assets.xcassets" / "AppIcon.appiconset" / "AppIcon.png"


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size, c1, c2):
    """Diagonal gradient top-left -> bottom-right."""
    small = 256
    img = Image.new("RGB", (small, small))
    px = img.load()
    for y in range(small):
        for x in range(small):
            t = (x + y) / (2 * (small - 1))
            px[x, y] = lerp(c1, c2, t)
    return img.resize((size, size), Image.BICUBIC)


coral = (255, 138, 92)
violet = (124, 92, 250)
img = gradient(S, coral, violet).convert("RGBA")

# soft light blob top-left for depth
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse([-S * 0.25, -S * 0.3, S * 0.7, S * 0.55], fill=(255, 255, 255, 45))
img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(S * 0.15)))

# card (slightly tilted) with shadow
card_w = int(S * 0.54)
radius = int(card_w * 0.24)
cx, cy = S // 2, int(S * 0.53)


def card_layer(fill, offset=(0, 0)):
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x0 = cx - card_w // 2 + offset[0]
    y0 = cy - card_w // 2 + offset[1]
    d.rounded_rectangle([x0, y0, x0 + card_w, y0 + card_w], radius=radius, fill=fill)
    return layer


shadow = card_layer((60, 25, 110, 75), (0, int(S * 0.035))).filter(ImageFilter.GaussianBlur(S * 0.03))
shadow = shadow.rotate(-6, resample=Image.BICUBIC, center=(cx, cy))
img = Image.alpha_composite(img, shadow)

card = card_layer((255, 255, 255, 255))

# checkmark drawn with gradient color, masked
check_mask = Image.new("L", (S, S), 0)
cd = ImageDraw.Draw(check_mask)
w = int(S * 0.075)
p1 = (cx - card_w * 0.27, cy + card_w * 0.02)
p2 = (cx - card_w * 0.07, cy + card_w * 0.22)
p3 = (cx + card_w * 0.29, cy - card_w * 0.22)
cd.line([p1, p2, p3], fill=255, width=w, joint="curve")
for p in (p1, p2, p3):
    cd.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=255)
check_color = Image.new("RGBA", (S, S), (0, 0, 0, 0))
cg = gradient(card_w, (255, 112, 72), (112, 76, 250)).convert("RGBA")
check_color.paste(cg, (cx - card_w // 2, cy - card_w // 2))
card.paste(check_color, (0, 0), check_mask)
card = card.rotate(-6, resample=Image.BICUBIC, center=(cx, cy))
img = Image.alpha_composite(img, card)

# yellow bell badge, top-right of the card
bx, by = int(cx + card_w * 0.47), int(cy - card_w * 0.47)
br = int(S * 0.115)
badge = Image.new("RGBA", (S, S), (0, 0, 0, 0))
bd = ImageDraw.Draw(badge)
bd.ellipse([bx - br + S * 0.008, by - br + S * 0.02, bx + br + S * 0.008, by + br + S * 0.02], fill=(60, 20, 90, 90))
badge = badge.filter(ImageFilter.GaussianBlur(S * 0.012))
bd = ImageDraw.Draw(badge)
bd.ellipse([bx - br, by - br, bx + br, by + br], fill=(255, 205, 64, 255))
# bell
bw = br * 0.95
top = by - bw * 0.52
bd.ellipse([bx - bw * 0.36, top, bx + bw * 0.36, top + bw * 0.72], fill="white")
bd.polygon([
    (bx - bw * 0.36, by - bw * 0.12),
    (bx + bw * 0.36, by - bw * 0.12),
    (bx + bw * 0.52, by + bw * 0.30),
    (bx - bw * 0.52, by + bw * 0.30),
], fill="white")
bd.rounded_rectangle([bx - bw * 0.58, by + bw * 0.24, bx + bw * 0.58, by + bw * 0.38], radius=int(bw * 0.07), fill="white")
bd.ellipse([bx - bw * 0.12, by + bw * 0.36, bx + bw * 0.12, by + bw * 0.58], fill="white")
bd.ellipse([bx - bw * 0.07, top - bw * 0.1, bx + bw * 0.07, top + bw * 0.06], fill="white")
img = Image.alpha_composite(img, badge)

OUT.parent.mkdir(parents=True, exist_ok=True)
img.convert("RGB").resize((1024, 1024), Image.LANCZOS).save(OUT)
print("saved", OUT)
