"""
Generates HTML certificates (Phase 2 / evaluation) with a REAL, embedded,
playable audio player for the evaluator's voice feedback -- not just a text
link. Opening any resulting .html file in a browser shows the certificate
with an actual <audio> play button that plays the evaluator's real voice
note directly from IPFS.

BATCH MODE: processes every evaluation metadata file found, generating one
HTML certificate per participant in a single run -- this is what you'd
actually use for a real cohort of participants, not just a single demo file.

This is separate from generate_certificate_images.py (which makes static
PNGs for quick sharing/printing -- those can only ever show a link, since a
flat image can't contain playable audio). Use this HTML version whenever you
want the actual voice, not just a reference to it.

Run from the project root:
    python scripts/generate_html_certificate.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
METADATA_DIR = ROOT / "metadata"
ASSETS_DIR = ROOT / "assets" / "certificates"
TEMPLATE_PATH = Path(__file__).resolve().parent / "certificate_template.html"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)


def all_evaluation_metadata():
    files = sorted(METADATA_DIR.glob("evaluation-*.json"), key=lambda p: p.stat().st_mtime)
    if not files:
        raise SystemExit("No evaluation metadata found -- run phase2_mint.js first.")
    return files


def render_certificate(meta, template):
    params = meta["evaluationParameters"]
    param_str = "  |  ".join(f'{k.replace("_", " ").title()}: {v}' for k, v in params.items())
    marks = f'{meta["marksAndGrade"]["totalMarks"]} / {meta["marksAndGrade"]["maxMarks"]}'

    replacements = {
        "{{PARTICIPANT_NAME}}": meta["participant"]["name"],
        "{{EVENT_NAME}}": meta["name"].replace("Evaluation Certificate - ", ""),
        "{{GRADE}}": meta["marksAndGrade"]["grade"],
        "{{MARKS}}": marks,
        "{{PARAMETERS}}": param_str,
        "{{EVALUATOR_NAME}}": meta["evaluatorName"],
        "{{EVALUATOR_TITLE}}": meta.get("evaluatorTitle", "Evaluator"),
        "{{COMMENTS}}": meta["comments"],
        "{{AUDIO_URL}}": meta["audioFeedbackUrl"],
        "{{TOKEN_ID}}": str(meta["tokenId"]),
        "{{CONTRACT_ADDRESS}}": meta["contractAddress"],
        "{{TX_HASH}}": meta["transactionHash"],
        "{{VERIFY_URL}}": meta["external_url"],
    }

    html = template
    for placeholder, value in replacements.items():
        html = html.replace(placeholder, str(value))
    return html


def main():
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    files = all_evaluation_metadata()

    generated = []
    for meta_path in files:
        meta = json.loads(meta_path.read_text())
        html = render_certificate(meta, template)

        safe_name = meta["participant"]["name"].replace(" ", "-").lower()
        out_path = ASSETS_DIR / f'certificate-{safe_name}-token{meta["tokenId"]}.html'
        out_path.write_text(html, encoding="utf-8")
        generated.append((meta["participant"]["name"], out_path))
        print(f'Generated: {meta["participant"]["name"]:25s} -> {out_path}')

    print(f"\nDone. {len(generated)} certificate(s) generated in {ASSETS_DIR}")
    print("Each is a standalone HTML file with a real, playable audio player.")
    print("Next step for a real cohort: upload each file (e.g. to IPFS via Pinata)")
    print("and send participants their own certificate LINK -- not the raw file.")


if __name__ == "__main__":
    main()