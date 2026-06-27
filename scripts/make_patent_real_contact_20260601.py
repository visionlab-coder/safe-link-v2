from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / "docs" / "generated" / "patent-real-app-screens-20260601"
CONTACT = DIR / "contact_sheet.png"


def font(size, bold=False):
    path = Path(r"C:\Windows\Fonts\malgunbd.ttf" if bold else r"C:\Windows\Fonts\malgun.ttf")
    return ImageFont.truetype(str(path), size=size) if path.exists() else ImageFont.load_default()


files = sorted(p for p in DIR.glob("*.png") if p.name != "contact_sheet.png")
thumbs = []
for p in files:
    img = Image.open(p).convert("RGB")
    img.thumbnail((320, 210))
    canvas = Image.new("RGB", (360, 265), "#F7F4EE")
    d = ImageDraw.Draw(canvas)
    canvas.paste(img, (20, 48))
    d.text((18, 14), p.name[:42], font=font(14, True), fill="#111827")
    thumbs.append(canvas)

cols = 3
rows = (len(thumbs) + cols - 1) // cols
sheet = Image.new("RGB", (360 * cols, 265 * rows), "#FFFFFF")
for i, thumb in enumerate(thumbs):
    sheet.paste(thumb, ((i % cols) * 360, (i // cols) * 265))
sheet.save(CONTACT)
print(CONTACT)
