#!/usr/bin/env python3
"""Static checks for a user's private copy of desktop game assets."""
from pathlib import Path
root = Path(__file__).resolve().parents[1]
a = root / 'app' / 'src' / 'main' / 'assets' / 'game'
required = ['index.html', 'main.js', 'style.css', 'base64.js',
            'minigameGarden.js', 'minigameGrimoire.js',
            'minigameMarket.js', 'minigamePantheon.js']
missing = [name for name in required if not (a / name).is_file()]
if missing:
    print('Local mode incomplete. Missing: ' + ', '.join(missing))
    raise SystemExit(1)
for folder in ['img', 'snd', 'loc']:
    if not (a / folder).is_dir():
        print(f'Warning: missing {folder}/')
html = (a / 'index.html').read_text(encoding='utf-8', errors='replace')
if ('electron' in html.lower()) or ('../steam' in html.lower()):
    print('Warning: the game page refers to desktop-specific code; mobile compatibility may require adaptation')
print('Static checks passed; actual gameplay and offline operation still need Android device testing.')
