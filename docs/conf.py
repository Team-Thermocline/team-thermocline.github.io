project = "Team Thermocline"
copyright = "2026, Team Thermocline"
author = "Team Thermocline"

extensions = []

templates_path = []
exclude_patterns = [
    "README.md",
    "requirements.txt",
    "_build",
    "Thumbs.db",
    ".DS_Store",
]

root_doc = "index"

html_theme = "alabaster"
html_static_path = ["_static"]
html_css_files = ["custom.css"]

html_theme_options = {
    "show_relbars": False,
    "show_powered_by": False,
    "sidebar_width": "260px",
    "page_width": "1100px",
    "font_family": "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial",
    "head_font_family": "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial",
}

