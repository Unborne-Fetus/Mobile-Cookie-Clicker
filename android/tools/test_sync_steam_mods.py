#!/usr/bin/env python3
"""Self-contained regression test for Steam-mod snapshot extraction."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import zipfile

SOURCE_SCRIPT = Path(__file__).resolve().with_name('sync_steam_mods.py')


def makezip(path, files):
    with zipfile.ZipFile(path, 'w') as zf:
        for member, data in files.items():
            zf.writestr(member, data)


def main():
    with tempfile.TemporaryDirectory(prefix='cookie-mod-regression-') as d:
        root = Path(d)
        project = root / 'cookie-clicker-android-port'
        tools = project / 'tools'
        tools.mkdir(parents=True)
        shutil.copy2(SOURCE_SCRIPT, tools / SOURCE_SCRIPT.name)
        bundled_source = SOURCE_SCRIPT.parents[1] / 'bundled_mods'
        if bundled_source.is_dir():
            shutil.copytree(bundled_source, project / 'bundled_mods')
        steam = root / 'steam' / 'resources' / 'app'
        (steam / 'src').mkdir(parents=True)
        (steam / 'src' / 'index.html').write_text('<html></html>')
        local = steam / 'mods' / 'local'
        workshop = steam / 'mods' / 'workshop'
        local.mkdir(parents=True)
        workshop.mkdir(parents=True)
        # An outdated Steam installation of the same ID must not override
        # the builder's latest bundled resizer, and must not load twice.
        old_resizer = local / 'CookiePortAndroidWoodenResizer'
        old_resizer.mkdir()
        (old_resizer / 'info.txt').write_text(json.dumps({
            'ID': 'CookiePort Android Panel Resizer', 'Name': 'OLD RESIZER', 'ModVersion': '1.0.0'}))
        (old_resizer / 'main.js').write_text("window.oldResizer=true;")
        simple = local / 'Simple Mod'
        simple.mkdir()
        (simple / 'info.txt').write_text(json.dumps({'ID': 'simple', 'Name': 'Simple Mod'}))
        (simple / 'main.js').write_text("Game.registerMod('simple', {});")

        # Regression: first ZIP has an invalid manifest, second is corrupt;
        # neither should consume an output slot. The old code uses len(found)
        # as the temporary directory name and would crash on the second ZIP.
        makezip(workshop / '01-no-manifest.zip', {'readme.txt': 'not a mod'})
        (workshop / '02-corrupt.zip').write_bytes(b'not a real zip')
        makezip(workshop / '03-valid.zip', {
            'outer/inner/info.txt': json.dumps({'ID': 'valid', 'Name': 'Valid ZIP', 'Dependencies': ['simple']}),
            'outer/inner/main.js': "Game.registerMod('valid', {});",
        })
        (workshop / '123456').mkdir()
        makezip(workshop / '123456' / '04-valid.zip', {
            'info.txt': json.dumps({'ID': 'nested', 'Name': 'Nested ZIP'}),
            'main.js': "Game.registerMod('nested', {});",
        })
        makezip(workshop / '05-duplicate.zip', {
            'info.txt': json.dumps({'ID': 'simple', 'Name': 'Duplicate'}),
            'main.js': "Game.registerMod('simple', {});",
        })
        makezip(workshop / '06-unsafe.zip', {
            '../outside.txt': 'do not extract',
            'info.txt': json.dumps({'ID':'unsafe'})
        })
        for run_no in (1, 2):
            result = subprocess.run([sys.executable, str(tools / SOURCE_SCRIPT.name), str(steam)],
                                    text=True, capture_output=True)
            if result.returncode:
                raise AssertionError(f'Run {run_no} failed:\n{result.stdout}\n{result.stderr}')
            catalog = json.loads((project / 'app/src/main/assets/mods/catalog.json').read_text())
            ids = [m['id'] for m in catalog['mods']]
            assert ids == ['CookiePort Android Panel Resizer', 'simple', 'valid', 'nested'], ids
            assert '01-no-manifest.zip: could not unpack' in result.stdout
            assert '02-corrupt.zip: could not unpack' in result.stdout
            assert '06-unsafe.zip: could not unpack' in result.stdout
            assert 'duplicate mod ID' in result.stdout
            assert 'PACKAGED 4 mod(s)' in result.stdout
            resizer = catalog['mods'][0]
            assert resizer['origin'] == 'bundled' and resizer['version'] == '1.7.0', resizer
            assert not (root / 'outside.txt').exists()
            for item in catalog['mods']:
                entry = project / 'app/src/main' / item['script'].lstrip('/')
                assert entry.is_file(), str(entry)
        print('PASS: multiple failed ZIPs, valid nested ZIPs, duplicate IDs, path validation, repeated builds')
    return 0


if __name__ == '__main__':
    sys.exit(main())
