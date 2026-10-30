"""生成模板封面和示例上传图片。

全部图片由本脚本绘制，不含第三方素材。依赖 Pillow，产物已提交到仓库，平时不需要重新运行。
用法：python scripts/generate_demo_assets.py
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
COVER_DIR = ROOT / "backend" / "src" / "main" / "resources" / "demo"
SAMPLE_DIR = ROOT / "samples"
WIDTH, HEIGHT = 540, 960


def gradient(top, bottom, size=(WIDTH, HEIGHT)):
    width, height = size
    image = Image.new("RGB", (1, height))
    for y in range(height):
        t = y / max(height - 1, 1)
        image.putpixel((0, y), tuple(int(a + (b - a) * t) for a, b in zip(top, bottom)))
    return image.resize((width, height))


def glow(image, center, radius, color, blur=60):
    layer = Image.new("RGB", image.size, (0, 0, 0))
    x, y = center
    ImageDraw.Draw(layer).ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    pixels = Image.eval(layer, lambda value: min(255, value))
    return Image.blend(image, Image.composite(pixels, image, layer.convert("L")), 0.85)


def stars(image, rng, count=140, limit=0.65):
    draw = ImageDraw.Draw(image)
    for _ in range(count):
        x, y = rng.randrange(WIDTH), rng.randrange(int(HEIGHT * limit))
        size = rng.choice((1, 1, 1, 2, 3))
        shade = rng.randrange(170, 255)
        draw.ellipse((x, y, x + size, y + size), fill=(shade, shade, shade))


def ridge(image, rng, base, amplitude, color):
    phases = [rng.random() * math.tau for _ in range(3)]
    points = [(0, HEIGHT)]
    for x in range(0, WIDTH + 12, 12):
        wave = sum(math.sin(x / length + phase) for length, phase in zip((130, 57, 23), phases))
        points.append((x, base + wave * amplitude))
    points.append((WIDTH, HEIGHT))
    ImageDraw.Draw(image).polygon(points, fill=color)


def sea(image, rng, base, color):
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, base, WIDTH, HEIGHT), fill=color)
    for _ in range(46):
        y = rng.randrange(base + 8, HEIGHT)
        x = rng.randrange(WIDTH)
        length = rng.randrange(30, 150)
        draw.line((x, y, x + length, y), fill=tuple(min(255, c + 50) for c in color), width=2)


def bokeh(image, rng, colors, count=26):
    layer = image.convert("RGBA")
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for _ in range(count):
        radius = rng.randrange(18, 72)
        x, y = rng.randrange(WIDTH), rng.randrange(HEIGHT)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=rng.choice(colors) + (70,))
    return Image.alpha_composite(layer, overlay.filter(ImageFilter.GaussianBlur(3))).convert("RGB")


def silhouette(image, x, y, scale, color):
    draw = ImageDraw.Draw(image)
    head = 62 * scale
    draw.ellipse((x - head, y - head, x + head, y + head), fill=color)
    draw.rounded_rectangle((x - 140 * scale, y + 80 * scale, x + 140 * scale, y + 560 * scale),
                           radius=int(120 * scale), fill=color)


def paw(image, x, y, scale, color):
    draw = ImageDraw.Draw(image)
    draw.ellipse((x - 70 * scale, y - 40 * scale, x + 70 * scale, y + 80 * scale), fill=color)
    for dx, dy in ((-82, -70), (-30, -112), (30, -112), (82, -70)):
        draw.ellipse((x + (dx - 26) * scale, y + (dy - 32) * scale,
                      x + (dx + 26) * scale, y + (dy + 32) * scale), fill=color)


def frames(image, rows, columns, color):
    draw = ImageDraw.Draw(image)
    margin, gap = 56, 18
    cell_w = (WIDTH - margin * 2 - gap * (columns - 1)) / columns
    cell_h = (HEIGHT - margin * 2 - gap * (rows - 1)) / rows
    for row in range(rows):
        for column in range(columns):
            x = margin + column * (cell_w + gap)
            y = margin + row * (cell_h + gap)
            draw.rounded_rectangle((x, y, x + cell_w, y + cell_h), radius=18, outline=color, width=4)


def postcard(rng):
    image = glow(gradient((252, 170, 110), (120, 64, 140)), (390, 300), 90, (255, 236, 190))
    sea(image, rng, 620, (34, 92, 130))
    ridge(image, rng, 610, 26, (74, 50, 110))
    return image


def poster(rng):
    image = gradient((18, 12, 44), (214, 60, 112))
    image = glow(image, (270, 380), 170, (255, 196, 92), 40)
    silhouette(image, 270, 560, 0.9, (22, 12, 40))
    return image


def collage(rng):
    image = gradient((32, 40, 72), (60, 170, 160))
    image = bokeh(image, rng, [(255, 214, 120), (255, 120, 150), (120, 220, 255)])
    frames(image, 2, 2, (245, 245, 235))
    return image


def avatar(rng):
    image = gradient((10, 12, 40), (28, 8, 60))
    image = glow(image, (170, 300), 170, (0, 220, 255), 70)
    image = glow(image, (390, 640), 190, (255, 40, 180), 70)
    silhouette(image, 270, 420, 1.1, (8, 8, 22))
    return image


def portrait(rng):
    image = glow(gradient((250, 214, 196), (168, 110, 140)), (270, 300), 200, (255, 244, 220), 80)
    silhouette(image, 190, 440, 0.95, (86, 50, 84))
    silhouette(image, 350, 470, 0.95, (58, 36, 72))
    return image


def pet_star(rng):
    image = gradient((6, 10, 40), (46, 28, 96))
    stars(image, rng, 190, 0.8)
    image = glow(image, (150, 220), 70, (255, 240, 200), 25)
    ridge(image, rng, 730, 16, (14, 12, 40))
    paw(image, 270, 500, 1.3, (240, 214, 170))
    return image


def pet_album(rng):
    image = gradient((255, 214, 150), (236, 132, 96))
    for x, y, scale in ((150, 230, 0.8), (380, 470, 1.0), (170, 740, 0.9)):
        paw(image, x, y, scale, (120, 62, 52))
    return image


def festival(rng):
    image = gradient((130, 16, 28), (46, 8, 18))
    image = bokeh(image, rng, [(255, 196, 92), (255, 120, 80), (255, 230, 170)], 34)
    draw = ImageDraw.Draw(image)
    for x, y, r in ((270, 340, 118), (140, 190, 62), (405, 210, 70)):
        draw.ellipse((x - r, y - r * 0.85, x + r, y + r * 0.85), fill=(226, 54, 40))
        draw.rectangle((x - r * 0.3, y - r * 0.98, x + r * 0.3, y - r * 0.78), fill=(248, 200, 100))
        draw.rectangle((x - r * 0.3, y + r * 0.78, x + r * 0.3, y + r * 0.98), fill=(248, 200, 100))
    return image


def new_year(rng):
    image = gradient((12, 10, 44), (92, 22, 70))
    stars(image, rng, 90, 0.7)
    draw = ImageDraw.Draw(image)
    for cx, cy, color in ((170, 280, (255, 196, 92)), (380, 210, (255, 92, 130)), (300, 450, (120, 220, 255))):
        for index in range(36):
            angle = index / 36 * math.tau
            inner, outer = rng.randrange(20, 60), rng.randrange(95, 150)
            draw.line((cx + math.cos(angle) * inner, cy + math.sin(angle) * inner,
                       cx + math.cos(angle) * outer, cy + math.sin(angle) * outer), fill=color, width=2)
    ridge(image, rng, 790, 12, (10, 8, 26))
    return image


def wedding(rng):
    image = glow(gradient((250, 240, 232), (222, 190, 186)), (270, 330), 210, (255, 255, 250), 90)
    image = bokeh(image, rng, [(255, 255, 255), (246, 200, 200)], 20)
    draw = ImageDraw.Draw(image)
    draw.ellipse((120, 310, 340, 530), outline=(190, 150, 90), width=7)
    draw.ellipse((200, 310, 420, 530), outline=(190, 150, 90), width=7)
    return image


def landscape(rng):
    image = glow(gradient((142, 210, 240), (250, 222, 180)), (140, 250), 80, (255, 250, 220), 40)
    ridge(image, rng, 500, 34, (116, 152, 178))
    ridge(image, rng, 610, 30, (70, 122, 110))
    ridge(image, rng, 730, 24, (34, 80, 66))
    return image


def film(rng):
    image = gradient((54, 44, 38), (152, 112, 76))
    image = glow(image, (270, 360), 180, (240, 196, 130), 80)
    silhouette(image, 270, 450, 1.0, (40, 30, 26))
    draw = ImageDraw.Draw(image)
    for x in (0, WIDTH - 40):
        draw.rectangle((x, 0, x + 40, HEIGHT), fill=(14, 12, 12))
        for y in range(16, HEIGHT, 60):
            draw.rounded_rectangle((x + 10, y, x + 30, y + 30), radius=5, fill=(226, 216, 196))
    return image


COVERS = {
    "postcard": postcard, "poster": poster, "collage": collage, "avatar": avatar, "portrait": portrait,
    "pet-star": pet_star, "pet-album": pet_album, "festival": festival, "new-year": new_year,
    "wedding": wedding, "landscape": landscape, "film": film,
}


def main():
    COVER_DIR.mkdir(parents=True, exist_ok=True)
    SAMPLE_DIR.mkdir(parents=True, exist_ok=True)
    for seed, (name, draw) in enumerate(COVERS.items()):
        draw(random.Random(seed)).save(COVER_DIR / f"{name}.jpg", quality=86, optimize=True)

    samples = [("sample-1.jpg", landscape), ("sample-2.jpg", postcard), ("sample-3.png", pet_album), ("sample-4.png", wedding)]
    for seed, (filename, draw) in enumerate(samples, start=100):
        draw(random.Random(seed)).save(SAMPLE_DIR / filename)


if __name__ == "__main__":
    main()
