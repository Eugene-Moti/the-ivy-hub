"""Regenerates the Ivy logo SVG + PNG icons from the traced centre-line geometry.

Run: python scripts/build-logo-assets.py   (needs Pillow)
Keep the path data in sync with src/lib/logo.ts.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent / "public"
GOLD, GOLD_LIGHT, GOLD_DARK, CHARCOAL = "#C99A30", "#E3C06A", "#9E7620", "#0E1512"
VB = (116, 72, 600, 616)  # x, y, w, h
STROKE = 33
AX = 416  # mirror axis

# Left-hand strokes as (svg path, polyline sampler). Right-hand strokes are mirrored.
def cubic(p0, p1, p2, p3, n=48):
    out = []
    for i in range(n + 1):
        t = i / n
        a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t ** 2, t ** 3
        out.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))
    return out

def quad(p0, p1, p2, n=24):
    out = []
    for i in range(n + 1):
        t = i / n
        a, b, c = (1 - t) ** 2, 2 * (1 - t) * t, t ** 2
        out.append((a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]))
    return out

TRUNK = [(416, 103), (416, 653)]
LEFT = [
    [(355, 167), (355, 275)],
    cubic((281, 223), (339, 256), (385, 290), (402, 344)) + quad((402, 344), (413, 378), (416, 400))[1:],
    cubic((237, 275), (296, 300), (346, 356), (349, 431)) + [(349, 595)],
    cubic((187, 326), (250, 351), (285, 389), (286, 452)) + [(286, 528)],
    cubic((149, 379), (197, 378), (219, 408), (226, 449)) + [(226, 459)],
]
# Paths run trunk-end to tip so draw-on animations grow outward (same data as src/lib/logo.ts).
LEFT_D = [
    "M355 275V167",
    "M416 400Q413 378 402 344C385 290 339 256 281 223",
    "M349 595V431C346 356 296 300 237 275",
    "M286 528V452C285 389 250 351 187 326",
    "M226 459V449C219 408 197 378 149 379",
]
RIGHT_D = [
    "M477 275V167",
    "M416 400Q419 378 430 344C447 290 493 256 551 223",
    "M483 595V431C486 356 536 300 595 275",
    "M546 528V452C547 389 582 351 645 326",
    "M606 459V449C613 408 635 378 683 379",
]

def mirror(pts):
    return [(2 * AX - x, y) for x, y in pts]

POLYS = [TRUNK] + [p for pair in LEFT for p in (pair, mirror(pair))]
PATHS = ["M416 653V103"] + [d for pair in zip(LEFT_D, RIGHT_D) for d in pair]

def write_svg():
    body = "\n    ".join(f'<path id="stroke-{i:02d}" d="{d}"/>' for i, d in enumerate(PATHS))
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VB[0]} {VB[1]} {VB[2]} {VB[3]}" role="img" aria-label="The Ivy Group">
  <defs>
    <linearGradient id="gold" x1="0" y1="{VB[1]}" x2="0" y2="{VB[1] + VB[3]}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{GOLD_LIGHT}"/>
      <stop offset="0.5" stop-color="{GOLD}"/>
      <stop offset="1" stop-color="{GOLD_DARK}"/>
    </linearGradient>
  </defs>
  <!-- 11 separate strokes: trunk, then mirrored branch pairs from top to bottom -->
  <g fill="none" stroke="url(#gold)" stroke-width="{STROKE}" stroke-linecap="round" stroke-linejoin="round">
    {body}
  </g>
</svg>
'''
    (ROOT / "ivy-logo.svg").write_text(svg, encoding="utf-8")
    # Favicon: same mark, flat gold (gradients render muddy at 16px).
    fav = svg.replace('stroke="url(#gold)"', f'stroke="{GOLD}"')
    (ROOT / "favicon.svg").write_text(fav, encoding="utf-8")

def render(size, bg=None, pad=0.18, radius=0.22):
    scale_up = 4
    S = size * scale_up
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if bg:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * radius), fill=bg)
    inner = S * (1 - 2 * pad)
    k = inner / max(VB[2], VB[3])
    ox = (S - VB[2] * k) / 2 - VB[0] * k
    oy = (S - VB[3] * k) / 2 - VB[1] * k
    w = max(1, round(STROKE * k))
    for poly in POLYS:
        pts = [(ox + x * k, oy + y * k) for x, y in poly]
        d.line(pts, fill=GOLD, width=w)
        # Round every joint (and the caps) so thick curves stay smooth.
        for x, y in pts:
            d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=GOLD)
    return im.resize((size, size), Image.LANCZOS)

def main():
    write_svg()
    icons = ROOT / "icons"
    icons.mkdir(exist_ok=True)
    render(192, CHARCOAL).save(icons / "icon-192.png")
    render(512, CHARCOAL).save(icons / "icon-512.png")
    render(512, CHARCOAL, pad=0.26, radius=0).save(icons / "icon-maskable-512.png")
    render(180, CHARCOAL, radius=0).save(icons / "apple-touch-icon.png")
    render(256, None, pad=0.04).save(ROOT / "ivy-logo.png")  # for emails (SVG is unreliable in mail clients)
    print("logo assets written to", ROOT)

if __name__ == "__main__":
    main()
