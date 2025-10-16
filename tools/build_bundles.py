#!/usr/bin/env python3
"""
Super simple script

Builds bundle/ in each update into bundle.zip
"""

import os
import sys
import zipfile
from pathlib import Path


def find_bundle_folders(root_dir):
    """Find all bundle/ folders in the updates directory."""
    bundle_folders = []
    updates_dir = Path(root_dir) / "src" / "updates"

    if not updates_dir.exists():
        print(f"❌ Updates directory not found: {updates_dir}")
        return []

    for item in updates_dir.iterdir():
        if item.is_dir():
            bundle_dir = item / "bundle"
            if bundle_dir.exists() and bundle_dir.is_dir():
                bundle_folders.append((item.name, bundle_dir))

    return bundle_folders


def create_bundle_zip(bundle_folder, output_path):
    """Create a zip file from a bundle folder."""
    try:
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(bundle_folder):
                for file in files:
                    file_path = os.path.join(root, file)
                    # Calculate relative path from bundle folder
                    arc_path = os.path.relpath(file_path, bundle_folder)
                    zipf.write(file_path, arc_path)

        print(f"✅ Created: {output_path}")
        return True
    except Exception as e:
        print(f"❌ Error creating {output_path}: {e}")
        return False


def main():
    """Main build function."""
    print("🔨 Building bundle zip files...")

    # Get the project root (parent of tools directory)
    project_root = Path(__file__).parent.parent

    # Find all bundle folders
    bundle_folders = find_bundle_folders(project_root)

    if not bundle_folders:
        print("ℹ️  No bundle folders found to build")
        return

    print(f"📦 Found {len(bundle_folders)} bundle folders:")

    success_count = 0
    for update_name, bundle_folder in bundle_folders:
        print(f"  - {update_name}")

        # Create zip file in the same directory as the bundle folder
        output_path = bundle_folder.parent / "bundle.zip"

        if create_bundle_zip(bundle_folder, output_path):
            success_count += 1

    print(
        f"\n✅ Successfully built {success_count}/{len(bundle_folders)} bundle zip files"
    )

    if success_count == len(bundle_folders):
        print("🎉 All bundles built successfully!")
    else:
        print("⚠️  Some bundles failed to build")
        sys.exit(1)


if __name__ == "__main__":
    main()
