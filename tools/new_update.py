#!/usr/bin/env python3
import os
from pathlib import Path
from datetime import datetime


def main():
    update_name = input("Enter update name (e.g., 'week-7-status'): ").strip()

    if not update_name:
        print("❌ Update name cannot be empty")
        return

    # Create paths
    project_root = Path(__file__).parent.parent
    updates_dir = project_root / "src" / "updates"
    update_dir = updates_dir / update_name
    bundle_dir = update_dir / "bundle"
    readme_path = update_dir / "README.md"

    # Check if already exists
    if update_dir.exists():
        print(f"❌ Update '{update_name}' already exists!")
        return

    # Create directories
    try:
        bundle_dir.mkdir(parents=True, exist_ok=True)
        print(f"✅ Created folder: {update_name}/")
        print(f"✅ Created folder: {update_name}/bundle/")
    except Exception as e:
        print(f"❌ Error creating directories: {e}")
        return

    # Create README
    try:
        current_date = datetime.now().strftime("%Y-%m-%d")
        readme_content = f"""---
date: {current_date}
---

# {update_name.replace('-', ' ').title()}

TODO: Add description and details for this update.

## Files

Add files to the `bundle/` directory:
- bundle/file1.pdf
- bundle/file2.docx
- etc.

## Build

Run `npm run build:bundles` to create the bundle.zip file for production.
"""
        readme_path.write_text(readme_content)
        print(f"✅ Created README.md")
    except Exception as e:
        print(f"❌ Error creating README: {e}")
        return

    print("\n🎉 Update folder created successfully!")
    print(f"\nLocation: {update_dir}")


if __name__ == "__main__":
    main()
