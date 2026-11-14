#!/usr/bin/env python3
"""Package only the built UI overlay, never a router firmware image."""
from pathlib import Path
import tarfile

ROOT = Path(__file__).resolve().parents[3]
FILES = ROOT / 'board/files'
ASSETS = FILES / 'www/luci-static/astryx'
for name in ('astryx.js', 'astryx.css', 'THIRD-PARTY-NOTICES.txt'):
    if not (ASSETS / name).is_file():
        raise SystemExit('Run npm --prefix ui/astryx run build first.')

output = ROOT / 'build/nradio-astryx-ui.tar.gz'
output.parent.mkdir(exist_ok=True)

def normalized(info):
    info.uid = info.gid = 0
    info.uname = info.gname = 'root'
    info.mode = 0o755 if info.isdir() or 'uci-defaults/' in info.name else 0o644
    return info

with tarfile.open(output, 'w:gz') as archive:
    for path in (
        ASSETS,
        FILES / 'www/luci-static/resources/menu-astryx.js',
        FILES / 'www/luci-static/resources/astryx-frame.js',
        FILES / 'usr/share/ucode/luci/template/themes/astryx',
        FILES / 'usr/share/ucode/luci/template/nradio/astryx.ut',
        FILES / 'usr/share/luci/menu.d/nradio-astryx.json',
        FILES / 'etc/uci-defaults/90-nradio-astryx-ui',
    ):
        archive.add(path, arcname=str(path.relative_to(FILES)), filter=normalized)
    archive.add(ROOT / 'ui/astryx/README.md', arcname='usr/share/doc/nradio-astryx/README.md', filter=normalized)
print(f'{output} ({output.stat().st_size:,} bytes)')
