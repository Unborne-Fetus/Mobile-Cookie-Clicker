#!/usr/bin/env python3
"""Prepare a private iOS build from your own Cookie Clicker Steam files.
Copies game files to the local Xcode project; never downloads or distributes the game.
"""
import argparse
import os
from pathlib import Path
import re
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'CookiePortIOS' / 'Resources' / 'Website' / 'game'
STEAM_PATH_FILE = ROOT / '.cookie-steam-path'


def find_source(given):
    base = Path(given).expanduser().resolve()
    for p in (base, base / 'src', base / 'resources' / 'app' / 'src'):
        if all((p / f).is_file() for f in ('index.html', 'main.js', 'style.css')):
            return p
    return None


def prep_html(path):
    html = path.read_text(encoding='utf-8-sig')
    html = re.sub(r'<link\b[^>]*href=[\'\"]\.\./steam/fonts\.css[\'\"][^>]*>', '', html, flags=re.I)
    html = re.sub(r'<script\b[^>]*src=[\'\"]\.\./steam/steam\.js[\'\"][^>]*>\s*</script>', '', html, flags=re.I)
    injected = '''<!-- iOS-only compatibility, loaded after the original main.js -->
<link rel="stylesheet" href="/compat/ios-touch-compat.css">
<script src="/mods/catalog.js"></script>
<script src="/compat/steam-snapshot-mods.js"></script>
<script src="/compat/ios-heralds.js"></script>
<script src="/compat/window-achievement-layout.js"></script>
'''
    if '</head>' not in html.lower():
        raise ValueError('The Steam game index does not have a closing </head>.')
    html = re.sub(r'</head>', injected + '</head>', html, count=1, flags=re.I)
    path.write_text(html, encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('steam_path', help='Steam Cookie Clicker folder OR its resources/app/src folder')
    args = parser.parse_args()
    source = find_source(args.steam_path)
    if not source:
        print('ERROR: Please select the Cookie Clicker Steam folder containing resources/app/src.', file=sys.stderr)
        return 2
    if TARGET.exists():
        shutil.rmtree(TARGET)
    shutil.copytree(source, TARGET, ignore=shutil.ignore_patterns('Thumbs.db','*.log','*.bak'), symlinks=False)
    prep_html(TARGET / 'index.html')
    if (source.parent / 'mods').is_dir():
        STEAM_PATH_FILE.write_text(str(source.parent), encoding='utf-8')
    print(f'PREPARED iOS game files: {source}')
    print(f'Private Xcode bundle destination: {TARGET}')
    print('The generated IPA will contain copyrighted game files. Do not distribute without permission.')
    return 0

if __name__ == '__main__':
    sys.exit(main())
