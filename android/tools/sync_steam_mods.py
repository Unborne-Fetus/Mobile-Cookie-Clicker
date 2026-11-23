#!/usr/bin/env python3
"""Snapshot a *user's own* installed Steam Cookie Clicker mods into a PRIVATE APK build.

This is part of the original port's local build system, not a mod downloader.
Do not distribute APKs or generated assets without appropriate permissions.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'app' / 'src' / 'main' / 'assets' / 'mods'
GAME_DIR = ROOT / 'app' / 'src' / 'main' / 'assets' / 'game'
STEAM_PATH_FILE = ROOT / '.cookie-steam-path'
MAX_ZIP_FILE = 60 * 1024 * 1024
MAX_ZIP_TOTAL = 250 * 1024 * 1024


def resolve_steam(install):
    base = Path(install).expanduser().resolve()
    for item in (base, base / 'resources' / 'app', base.parent):
        if (item / 'src' / 'index.html').is_file() and (item / 'mods').is_dir():
            return item
    return None


def safe_filename(name):
    return all(c not in name for c in ('/', '\\', ':', '\x00')) and name not in ('.', '..')


def info_from(path):
    try:
        obj = json.loads(path.read_text(encoding='utf-8-sig'))
        if not isinstance(obj, dict):
            return None
        return obj
    except (UnicodeError, json.JSONDecodeError, OSError):
        return None


def unpack_safe(zip_path, out):
    total = 0
    with zipfile.ZipFile(zip_path) as archive:
        for member in archive.infolist():
            path = member.filename.replace('\\', '/')
            parts = path.split('/')
            if (path.startswith('/') or ':' in path or any(x in ('.', '..') for x in parts) or '\x00' in path):
                raise ValueError('Unsafe path in zip')
            if member.file_size > MAX_ZIP_FILE:
                raise ValueError('Mod ZIP contains an oversized file')
            total += member.file_size
            if total > MAX_ZIP_TOTAL:
                raise ValueError('Mod ZIP too large')
            # Reject symlinks and other nonregular Unix entries.
            mode = (member.external_attr >> 16) & 0o170000
            if mode not in (0, 0o040000, 0o100000):
                raise ValueError('Unsupported ZIP entry type')
        archive.extractall(out)


def find_mods(folder):
    if not folder.is_dir():
        return []
    candidates = []
    for child in sorted(folder.iterdir(), key=lambda p: p.name.casefold()):
        if child.is_dir() and not child.is_symlink():
            if (child / 'info.txt').is_file():
                candidates.append((child, None))
            else:
                # Steam may put a single nested directory or zipped item beneath the workshop ID.
                for sub in sorted(child.iterdir(), key=lambda p: p.name.casefold()):
                    if sub.is_dir() and not sub.is_symlink() and (sub / 'info.txt').is_file():
                        candidates.append((sub, None))
                    elif sub.is_file() and sub.suffix.lower() == '.zip':
                        candidates.append((sub, 'zip'))
        elif child.is_file() and child.suffix.lower() == '.zip':
            candidates.append((child, 'zip'))
    return candidates


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('install', nargs='?', help='Cookie Clicker Steam installation root, or resources/app folder')
    args = parser.parse_args()
    given = args.install or (STEAM_PATH_FILE.read_text(encoding='utf8').strip() if STEAM_PATH_FILE.is_file() else None)
    if not given:
        given = os.environ.get('COOKIE_CLICKER_STEAM') or r'C:\Program Files (x86)\Steam\steamapps\common\Cookie Clicker'
    steam = resolve_steam(given)
    if steam is None:
        print(f'ERROR: Cannot find Steam Cookie Clicker mods at {given}', file=sys.stderr)
        print('Run START-HERE.bat to provide the Steam folder, or set COOKIE_CLICKER_STEAM.', file=sys.stderr)
        return 2
    # Retain the successful path for subsequent builds, including custom Steam libraries.
    STEAM_PATH_FILE.write_text(str(steam), encoding='utf8')
    target_parent = TARGET.parent
    target_parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='cookie-mod-pack-') as work:
        stage = Path(work) / 'mods'
        stage.mkdir()
        found = []
        seen = set()
        warnings = []
        # The source-only builder ships its own version of the standalone
        # wooden-resizer mod. It is deliberately FIRST: an older Steam copy
        # with the same mod ID must not override it in the Android APK.
        for scope in ('bundled', 'local', 'workshop'):
            source_dir = (ROOT / 'bundled_mods') if scope == 'bundled' else (steam / 'mods' / scope)
            for item, typ in find_mods(source_dir):
                source = item
                if typ == 'zip':
                    # Do not use len(found) for the scratch directory name. A mod
                    # can fail validation without being appended to `found`, and
                    # then the next ZIP would try to reuse the same directory.
                    # mkdtemp always allocates a fresh extraction directory.
                    try:
                        tmp = Path(tempfile.mkdtemp(prefix='unzipped-', dir=work))
                        unpack_safe(item, tmp)
                        info_files = list(tmp.rglob('info.txt'))
                        if len(info_files) != 1:
                            raise ValueError('expected one info.txt')
                        source = info_files[0].parent
                    except (OSError, ValueError, RuntimeError, NotImplementedError, zipfile.BadZipFile) as exc:
                        warnings.append(f'{item.name}: could not unpack ({exc})')
                        continue
                metadata = info_from(source / 'info.txt')
                if metadata is None:
                    warnings.append(f'{source}: invalid info.txt; ignored')
                    continue
                mod_id = str(metadata.get('ID') or metadata.get('Name') or source.name).strip()
                if not mod_id or len(mod_id) > 140:
                    warnings.append(f'{source}: invalid mod ID; ignored')
                    continue
                # Game treats duplicate mod IDs as the same mod; don't boot twice.
                normalized_id = ''.join(ch if ch.isalnum() or ch == ' ' else ' ' for ch in mod_id).casefold()
                if normalized_id in seen:
                    warnings.append(f'{source}: duplicate mod ID {mod_id!r}; ignored')
                    continue
                seen.add(normalized_id)
                has_main = (source / 'main.js').is_file()
                if not has_main:
                    warnings.append(f'{source}: packaged, but no main.js (language-only mod is not activated)')
                # Give every output directory a deterministic, collision-safe name.
                basename = ''.join(ch if ch.isascii() and (ch.isalnum() or ch in '-_') else '_' for ch in source.name)[:50] or 'mod'
                output_name = f'{len(found):03d}_{basename}'
                output = stage / scope / output_name
                output.parent.mkdir(exist_ok=True, parents=True)
                shutil.copytree(source, output, ignore=shutil.ignore_patterns('*.log', 'Thumbs.db'), symlinks=False)
                deps = metadata.get('Dependencies', [])
                if not isinstance(deps, list): deps = []
                deps = [str(d) for d in deps if isinstance(d, str)][:40]
                try:
                    disabled = int(metadata.get('Disabled', 0)) == 1
                except (ValueError, TypeError):
                    disabled = True
                found.append({
                    'key': f'{"local" if scope == "bundled" else scope}:{normalized_id}',
                    'id': mod_id,
                    'name': str(metadata.get('Name') or mod_id)[:160],
                    'author': str(metadata.get('Author') or '')[:160],
                    'description': str(metadata.get('Description') or '')[:1000],
                    'version': str(metadata.get('ModVersion') or ''),
                    'origin': scope,
                    'dependencies': deps,
                    'enabledDefault': (not disabled) if has_main else False,
                    'supported': has_main,
                    'script': ('/assets/mods/' + scope + '/' + output_name + '/main.js') if has_main else None,
                })
        (stage / 'catalog.json').write_text(json.dumps({'schema': 1, 'mods': found}, ensure_ascii=False, indent=2), encoding='utf8')
        if TARGET.exists(): shutil.rmtree(TARGET)
        shutil.copytree(stage, TARGET)
    enabled = sum(1 for m in found if m['enabledDefault'])
    runnable = sum(1 for m in found if m['supported'])
    print(f'PACKAGED {len(found)} mod(s) (builder-included + Steam): {runnable} with JavaScript entrypoints, {enabled} enabled by info.txt defaults.')
    if any(m['origin'] == 'bundled' for m in found): print('Wooden Panel Resizer: included automatically from builder source (latest bundled version takes precedence).')
    print(f'Source: {steam / "mods"}')
    print(f'Destination: {TARGET}')
    print('Note: Steam enabled toggles/load order are not reliably exposed by mod files; Android remembers changes you make in Options > Mods.')
    for w in warnings: print('WARNING:', w)
    print('Reminder: this APK embeds third-party mod files. Build for personal testing; do not redistribute without rights.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
