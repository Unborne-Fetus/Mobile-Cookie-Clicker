#!/usr/bin/env python3
"""Pure local tests; no game distribution or iOS SDK required."""
import json
import plistlib
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
WEBSITE = ROOT / 'CookiePortIOS/Resources/Website'

def run(cmd):
    p = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    if p.returncode:
        raise AssertionError(f'{cmd}: {p.stdout}\n{p.stderr}')
    return p.stdout


def smoke():
    assert plistlib.loads((ROOT/'CookiePortIOS/Info.plist').read_bytes())['CFBundleDisplayName']=='Cookie Port'
    run(['plutil','-lint','--',str(ROOT/'CookiePortIOS.xcodeproj/project.pbxproj')])
    for js in list((WEBSITE/'compat').glob('*.js'))+[ROOT/'bundled_mods/CookiePortAndroidWoodenResizer/main.js']:
        run(['node','--check',str(js)])
    run(['swiftc','-frontend','-parse',str(ROOT/'CookiePortIOS/CookiePortIOSApp.swift'),str(ROOT/'CookiePortIOS/PortViewController.swift'),str(ROOT/'CookiePortIOS/AssetSchemeHandler.swift')])
    with tempfile.TemporaryDirectory(prefix='cookie-ios-test-') as t:
        steam = Path(t)/'Steam Cookie Clicker'
        game=steam/'resources/app/src'
        game.mkdir(parents=True)
        (game/'index.html').write_text('''<html><head><link href='../steam/fonts.css' rel='stylesheet' type='text/css'><script src="../steam/steam.js"></script><script src="main.js"></script></head><body>Hello</body></html>''')
        (game/'main.js').write_text('window.Game={};')
        (game/'style.css').write_text('body{}')
        (game/'img').mkdir()
        (game/'img/test.png').write_bytes(b'PNG')
        local=steam/'resources/app/mods/local'
        local.mkdir(parents=True)
        old=local/'OldResizer'
        old.mkdir()
        (old/'info.txt').write_text(json.dumps({'Name':'Old Resizer','ID':'CookiePort Android Panel Resizer','Disabled':0}))
        (old/'main.js').write_text('window.oldResizer=true;')
        testmod=local/'TestMod';testmod.mkdir()
        (testmod/'info.txt').write_text(json.dumps({'Name':'Test Mod','ID':'test-mod','Disabled':0}))
        (testmod/'main.js').write_text('window.testMod=true;')
        workshop=steam/'resources/app/mods/workshop';workshop.mkdir()
        with zipfile.ZipFile(workshop/'bad.zip','w') as z: z.writestr('../escape','X')
        with zipfile.ZipFile(workshop/'another.zip','w') as z:
            z.writestr('nested/info.txt',json.dumps({'Name':'Zip Mod','ID':'zip-test','Disabled':1}))
            z.writestr('nested/main.js','window.zipMod=true;')
        run([sys.executable,str(ROOT/'tools/prepare_game.py'),str(steam)])
        s=(WEBSITE/'game/index.html').read_text()
        assert 'steam.js' not in s and '../steam/fonts.css' not in s
        assert '/mods/catalog.js' in s and '/compat/ios-heralds.js' in s
        assert (WEBSITE/'game/img/test.png').exists()
        run([sys.executable,str(ROOT/'tools/sync_steam_mods.py'),str(steam)])
        catalog=json.loads((WEBSITE/'mods/catalog.json').read_text())
        mods=catalog['mods'];assert len(mods)==3,mods
        assert len([m for m in mods if m['id']=='CookiePort Android Panel Resizer'])==1
        assert mods[0]['origin']=='bundled' and mods[0]['version']=='1.7.0',mods[0]
        assert all(m['script'].startswith('/mods/') for m in mods)
        assert 'window.__cookiePortModCatalog' in (WEBSITE/'mods/catalog.js').read_text()
        run(['node','--check',str(WEBSITE/'mods/catalog.js')])
        run([sys.executable,str(ROOT/'tools/sync_steam_mods.py'),str(steam)])
        assert len(json.loads((WEBSITE/'mods/catalog.json').read_text())['mods'])==3
        print('PASS: source preparation, Electron stripping, browser assets, mod snapshots, ZIP safety, override precedence and rerun')
    # Scrub test source data and metadata from the shareable builder.
    shutil.rmtree(WEBSITE/'game')
    (WEBSITE/'game').mkdir()
    (WEBSITE/'game/.gitkeep').write_text('Your local Steam files go here.\n')
    shutil.rmtree(WEBSITE/'mods')
    (WEBSITE/'mods').mkdir()
    (WEBSITE/'mods/.gitkeep').write_text('Steam mods are generated locally.\n')
    (ROOT/'.cookie-steam-path').unlink(missing_ok=True)
    print('PASS: plists, Xcode project, Swift parsing and JavaScript syntax; private test fixtures removed')

if __name__=='__main__': smoke()
