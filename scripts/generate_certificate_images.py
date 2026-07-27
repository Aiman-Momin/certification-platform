"""
Renders sample certificate images (screenshots) for the README/deliverables.
Two certificates are generated:
  1. assets/sample-participation-certificate.png (Phase 1)
  2. assets/sample-evaluation-certificate.png     (Phase 2, now includes an
     "Evaluator Voice Feedback" card -- name, title, written comment, and a
     reference to the audio feedback file/CID -- matching the reference
     certificate template's evaluator voice card style.)

Data is pulled directly from the metadata JSON files produced by the mint
scripts, so the images reflect the actual on-chain-minted tokens.

Run from the project root:
    python scripts/generate_certificate_images.py
"""
import json
import textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
METADATA_DIR = ROOT / "metadata"
ASSETS_DIR = ROOT / "assets"
ASSETS_DIR.mkdir(exist_ok=True)

def _find_font(*candidates):
    """Returns the first candidate font path that actually exists on this
    machine, so the same script works on Windows, macOS, and Linux without
    edits. Falls back to PIL's built-in default font if none are found."""
    for path in candidates:
        if Path(path).exists():
            return path
    return None  # signals font() to use PIL's built-in default


SERIF_BOLD = _find_font(
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",  # Linux
    "C:/Windows/Fonts/georgiab.ttf",  # Windows (Georgia Bold)
    "C:/Windows/Fonts/timesbd.ttf",   # Windows (Times New Roman Bold)
    "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",  # macOS
)
SERIF = _find_font(
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    "C:/Windows/Fonts/georgia.ttf",
    "C:/Windows/Fonts/times.ttf",
    "/System/Library/Fonts/Supplemental/Georgia.ttf",
)
SANS = _find_font(
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
)
SANS_BOLD = _find_font(
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
)
SANS_OBLIQUE = _find_font(
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
    "C:/Windows/Fonts/ariali.ttf",
    "/System/Library/Fonts/Supplemental/Arial Italic.ttf",
)
MONO = _find_font(
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    "C:/Windows/Fonts/consola.ttf",
    "/System/Library/Fonts/Supplemental/Courier New.ttf",
)

NAVY = (17, 40, 79)
GOLD = (176, 141, 87)
LIGHT_BG = (250, 248, 242)
GREEN = (34, 110, 68)
GREY = (90, 90, 90)
CARD_BG = (241, 245, 249)
CARD_BORDER = (210, 205, 190)

W, H = 1600, 1350  # taller now to fit the evaluator voice card


_font_cache = {}


def font(path, size):
    """Loads a truetype font at the given size, or falls back to PIL's
    built-in default font (always available, no file needed) if no system
    font could be located for this platform."""
    if path is None:
        return ImageFont.load_default(size=size) if hasattr(ImageFont, "load_default") else ImageFont.load_default()
    key = (path, size)
    if key not in _font_cache:
        try:
            _font_cache[key] = ImageFont.truetype(path, size)
        except OSError:
            _font_cache[key] = ImageFont.load_default(size=size) if hasattr(ImageFont, "load_default") else ImageFont.load_default()
    return _font_cache[key]


def draw_border(draw, h=H):
    draw.rectangle([20, 20, W - 20, h - 20], outline=GOLD, width=6)
    draw.rectangle([36, 36, W - 36, h - 36], outline=NAVY, width=2)


def center_text(draw, y, text, f, fill):
    bbox = draw.textbbox((0, 0), text, font=f)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) / 2, y), text, font=f, fill=fill)
    return bbox[3] - bbox[1]


def left_text(draw, x, y, text, f, fill):
    draw.text((x, y), text, font=f, fill=fill)
    bbox = draw.textbbox((0, 0), text, font=f)
    return bbox[3] - bbox[1]


def make_participation_certificate(meta, out_path):
    h = 1100
    img = Image.new("RGB", (W, h), LIGHT_BG)
    draw = ImageDraw.Draw(img)
    draw_border(draw, h)

    center_text(draw, 70, "PERFORMING ARTS CERTIFICATION ECOSYSTEM", font(SANS_BOLD, 26), NAVY)
    center_text(draw, 130, "CERTIFICATE OF PARTICIPATION", font(SERIF_BOLD, 54), NAVY)
    draw.line([(W / 2 - 260, 205), (W / 2 + 260, 205)], fill=GOLD, width=3)

    center_text(draw, 250, "This is to certify that", font(SERIF, 30), GREY)
    center_text(draw, 305, meta["participant"]["name"], font(SERIF_BOLD, 62), NAVY)

    wrapped = textwrap.fill(
        f'has successfully participated in "{meta["attributes"][2]["value"]}"', width=60
    )
    y = 400
    for line in wrapped.split("\n"):
        hh = center_text(draw, y, line, font(SERIF, 28), GREY)
        y += hh + 16

    y += 10
    center_text(draw, y, f'Workshop Date: {meta["attributes"][3]["value"]}', font(SANS, 22), GREY)

    badges = "TAMPER-PROOF   •   INSTANTLY VERIFIABLE   •   SHAREABLE DIGITALLY"
    center_text(draw, y + 55, badges, font(SANS_BOLD, 20), GREEN)

    footer_y = h - 230
    draw.line([(80, footer_y), (W - 80, footer_y)], fill=CARD_BORDER, width=1)
    lines = [
        f'Token ID: {meta["tokenId"]}    |    Contract: {meta["contractAddress"]}',
        f'Transaction Hash: {meta["transactionHash"]}',
        f'Network: {meta["network"]} (Polygon-compatible)    |    Issued: {meta["issuedAt"][:10]}',
        f'Verify: {meta["external_url"]}',
    ]
    yy = footer_y + 20
    for line in lines:
        hh = center_text(draw, yy, line, font(MONO, 18), NAVY)
        yy += hh + 12

    center_text(draw, h - 70, "Secured on Blockchain  •  Non-Transferable Soulbound Certificate", font(SANS, 18), GOLD)

    img.save(out_path)
    print(f"Saved {out_path}")


def draw_evaluator_card(draw, x, y, w, name, title, comment, audio_ref):
    """Draws one evaluator voice-feedback card, mirroring the reference
    template's evaluator card: name, title, a quoted written comment, and a
    line pointing at the audio file/CID (since a static image can't embed
    a real playable <audio> element, we show a clear 'listen at' reference
    instead -- same info, print-friendly)."""
    card_h = 190
    draw.rounded_rectangle([x, y, x + w, y + card_h], radius=14, fill=CARD_BG, outline=CARD_BORDER, width=2)

    pad = 26
    ty = y + pad
    left_text(draw, x + pad, ty, name, font(SANS_BOLD, 24), NAVY)
    ty += 32
    left_text(draw, x + pad, ty, title, font(SANS_OBLIQUE, 18), GREY)
    ty += 34

    wrapped = textwrap.fill(f'"{comment}"', width=78)
    for line in wrapped.split("\n")[:3]:
        left_text(draw, x + pad, ty, line, font(SERIF, 18), (60, 60, 60))
        ty += 24

    ty += 6
    icon_x = x + pad
    draw.ellipse([icon_x, ty, icon_x + 22, ty + 22], outline=GOLD, width=2)
    draw.polygon([(icon_x + 8, ty + 6), (icon_x + 8, ty + 16), (icon_x + 16, ty + 11)], fill=GOLD)
    left_text(draw, icon_x + 30, ty + 2, f"Voice Feedback: {audio_ref}", font(MONO, 15), GOLD)


def make_evaluation_certificate(meta, out_path):
    img = Image.new("RGB", (W, H), LIGHT_BG)
    draw = ImageDraw.Draw(img)
    draw_border(draw, H)

    center_text(draw, 55, "PERFORMING ARTS CERTIFICATION ECOSYSTEM", font(SANS_BOLD, 24), NAVY)
    center_text(draw, 105, "CERTIFICATE OF EVALUATION", font(SERIF_BOLD, 48), NAVY)
    draw.line([(W / 2 - 260, 172), (W / 2 + 260, 172)], fill=GOLD, width=3)

    center_text(draw, 200, "Awarded to", font(SERIF, 24), GREY)
    center_text(draw, 240, meta["participant"]["name"], font(SERIF_BOLD, 50), NAVY)
    center_text(draw, 300, meta["name"].replace("Evaluation Certificate - ", ""), font(SERIF, 24), GREY)

    grade = meta["marksAndGrade"]["grade"]
    marks = f'{meta["marksAndGrade"]["totalMarks"]} / {meta["marksAndGrade"]["maxMarks"]}'
    draw.ellipse([W / 2 - 65, 345, W / 2 + 65, 475], outline=GOLD, width=5)
    center_text(draw, 372, "GRADE", font(SANS_BOLD, 15), GREY)
    center_text(draw, 392, grade, font(SERIF_BOLD, 54), NAVY)
    center_text(draw, 490, f"Marks: {marks}", font(SANS_BOLD, 20), GREEN)

    params = meta["evaluationParameters"]
    param_str = "   |   ".join(f'{k.replace("_", " ").title()}: {v}' for k, v in params.items())
    y = 535
    hh = center_text(draw, y, param_str, font(SANS, 17), GREY)
    y += hh + 45

    center_text(draw, y, "EVALUATOR VOICE FEEDBACK", font(SANS_BOLD, 20), NAVY)
    y += 42

    card_w = W - 200
    card_x = 100
    audio_ref = meta.get("audioFeedbackUrl", "N/A")
    display_ref = audio_ref if len(audio_ref) <= 60 else audio_ref[:57] + "..."
    draw_evaluator_card(
        draw, card_x, y, card_w,
        meta["evaluatorName"],
        "Evaluator",
        meta["comments"],
        display_ref,
    )
    y += 190 + 30

    footer_y = y + 10
    draw.line([(80, footer_y), (W - 80, footer_y)], fill=CARD_BORDER, width=1)
    lines = [
        f'Token ID: {meta["tokenId"]}    |    Contract: {meta["contractAddress"]}',
        f'Transaction Hash: {meta["transactionHash"]}',
        f'Verify: {meta["external_url"]}',
    ]
    yy = footer_y + 20
    for line in lines:
        hh = center_text(draw, yy, line, font(MONO, 16), NAVY)
        yy += hh + 10

    center_text(draw, H - 55, "Secured on Blockchain  •  Non-Transferable Soulbound Certificate", font(SANS, 17), GOLD)

    img.save(out_path)
    print(f"Saved {out_path}")


def main():
    part_files = sorted(METADATA_DIR.glob("participation-*.json"), key=lambda p: p.stat().st_mtime)
    eval_files = sorted(METADATA_DIR.glob("evaluation-*.json"), key=lambda p: p.stat().st_mtime)

    for meta_path in part_files:
        meta = json.loads(meta_path.read_text())
        safe_name = meta["participant"]["name"].replace(" ", "-").lower()
        out_path = ASSETS_DIR / f'participation-{safe_name}-token{meta["tokenId"]}.png'
        make_participation_certificate(meta, out_path)

    for meta_path in eval_files:
        meta = json.loads(meta_path.read_text())
        safe_name = meta["participant"]["name"].replace(" ", "-").lower()
        out_path = ASSETS_DIR / f'evaluation-{safe_name}-token{meta["tokenId"]}.png'
        make_evaluation_certificate(meta, out_path)

    print(f"\nDone. {len(part_files)} participation + {len(eval_files)} evaluation certificate(s) generated.")


if __name__ == "__main__":
    main()