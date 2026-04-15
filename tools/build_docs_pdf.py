#!/usr/bin/env python3
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
BUILD = DOCS / "_build"
LATEX_DIR = BUILD / "latex"
OUT = ROOT / "static" / "docs" / "latest.pdf"
APPENDICES_DIR = DOCS / "Appendicies"


def merge_pdfs(out_path: Path, appendix_pdfs: list[Path]) -> bool:
    """
    Merge OUT + appendix PDFs into OUT.
    Prefers system tools to avoid extra Python deps.
    """
    if not appendix_pdfs:
        return True

    pdftk = shutil.which("pdftk")
    qpdf = shutil.which("qpdf")

    tmp = out_path.with_suffix(".merged.tmp.pdf")
    inputs = [str(out_path), *map(str, appendix_pdfs)]

    if pdftk:
        # pdftk A B cat output out.pdf
        cmd = [pdftk, *inputs, "cat", "output", str(tmp)]
        proc = subprocess.run(cmd, cwd=ROOT)
        if proc.returncode == 0 and tmp.exists():
            tmp.replace(out_path)
            return True
        return False

    if qpdf:
        # qpdf --empty --pages A B -- out.pdf
        cmd = [qpdf, "--empty", "--pages", *inputs, "--", str(tmp)]
        proc = subprocess.run(cmd, cwd=ROOT)
        if proc.returncode == 0 and tmp.exists():
            tmp.replace(out_path)
            return True
        return False

    print(
        "error: appendix PDFs exist but neither pdftk nor qpdf is installed; cannot merge",
        file=sys.stderr,
    )
    return False


def main() -> int:
    cmd = [
        sys.executable,
        "-m",
        "sphinx",
        "-M",
        "latexpdf",
        str(DOCS),
        str(BUILD),
    ]
    proc = subprocess.run(cmd, cwd=ROOT)
    if proc.returncode != 0:
        return proc.returncode

    pdfs = list(LATEX_DIR.glob("*.pdf"))
    if not pdfs:
        print(f"error: no PDF in {LATEX_DIR}", file=sys.stderr)
        return 1

    pdf = max(pdfs, key=lambda p: p.stat().st_mtime)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(pdf, OUT)

    # Optionally append any PDFs in docs/Appendicies/ to the end of the generated PDF.
    if APPENDICES_DIR.exists():
        appendix_pdfs = sorted(APPENDICES_DIR.glob("*.pdf"))
        if appendix_pdfs:
            ok = merge_pdfs(OUT, appendix_pdfs)
            if not ok:
                return 1

    print(f"{pdf.relative_to(ROOT)} -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
