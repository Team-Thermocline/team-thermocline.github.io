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
    print(f"{pdf.relative_to(ROOT)} -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
