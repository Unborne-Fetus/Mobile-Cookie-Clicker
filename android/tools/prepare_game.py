#!/usr/bin/env python3
"""Copies a user's local, legitimately acquired Cookie Clicker game files for PRIVATE builds.

The generated APK includes the copied game files. Do not publish it without
permission from the copyright owner. No game files are distributed by this repo.
"""
import argparse
from pathlib import Path
import shutil
import sys

root = Path(__file__).resolve().parents[1]
output = root / 'app' / 'src' / 'main' / 'assets' / 'game'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('path', type=Path, help='Steam Cookie Clicker folder OR resources/app/src')
    args = parser.parse_args()
    base = args.path.expanduser().resolve()
    candidates = [base, base / 'src', base / 'resources' / 'app' / 'src']
    source = next((p for p in candidates if (p / 'index.html').is_file() and
                   (p / 'main.js').is_file() and (p / 'style.css').is_file()), None)
    if not source:
        print('Could not find index.html, main.js, and style.css under the given folder.', file=sys.stderr)
        sys.exit(2)
    if output.exists():
        for child in output.iterdir():
            if child.is_dir(): shutil.rmtree(child)
            else: child.unlink()
    output.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, output, dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns('Thumbs.db', '*.log', '*.bak'))
    # Remember which Steam installation to snapshot mods from on every subsequent build.
    if (source.parent / 'mods').is_dir():
        (root / '.cookie-steam-path').write_text(str(source.parent), encoding='utf8')
        print(f'Steam mod source configured: {source.parent / "mods"}')
    print(f'Copied game files from: {source}')
    print(f'Into: {output}')
    print('These assets will be bundled into your PRIVATE APK. Do NOT distribute without permission.')
    print('Steam-specific Electron/Steamworks scripts may need adaptation for Android WebView.')


if __name__ == '__main__': main()
