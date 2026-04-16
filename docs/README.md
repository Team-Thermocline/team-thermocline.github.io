# Sphinx docs

RST sources and `conf.py` live in this folder. The site serves the built HTML from `static/sphinx/`
under the URL prefix `/sphinx/` while the browser URL for the framed manual stays under `/docs/…`
(built by `npm run docs:build`, or full `npm run build`).

## Setup

```bash
pipenv install -r docs/requirements.txt
```

PDF builds need a TeX stack (`latexmk` + TeX Live), same as GitHub Actions.

## Live preview while editing

```bash
pip install sphinx-autobuild
sphinx-autobuild docs docs/_build/livehtml --open-browser
```
