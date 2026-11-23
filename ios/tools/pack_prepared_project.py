#!/usr/bin/env python3
"""Zip prepared private Xcode project for transfer from Windows to your own Mac."""
from pathlib import Path
import zipfile
import sys
root = Path(__file__).resolve().parents[1]
if not (root / 'CookiePortIOS/Resources/Website/game/index.html').is_file():
    sys.exit('Game files not prepared yet. Run PREPARE-ON-WINDOWS.bat first.')
out = root.parent / 'cookie-clicker-ios-prepared-PRIVATE.zip'
with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    count=0
    for file in sorted(root.rglob('*')):
        if not file.is_file(): continue
        relative=file.relative_to(root)
        if any(p in ('output','.build','__pycache__','.git') for p in relative.parts): continue
        if file.name.startswith('.cookie-steam-path'): continue
        z.write(file, Path(root.name)/relative)
        count+=1
print(f'CREATED {out} with {count} files')
print('PRIVATE — includes original Cookie Clicker game/mod assets; do not publicly share.')
