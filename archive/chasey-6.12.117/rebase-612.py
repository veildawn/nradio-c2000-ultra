import subprocess
import shutil
from pathlib import Path

root = Path("/mnt/lima-colima/owrt/immortalwrt")
work = Path("/tmp/kcheck")
drop_root = Path("/Users/veildawn/Documents/Projects/nradio-c2000-ultra/build/dropped-patches")
drop_root.mkdir(parents=True, exist_ok=True)
src = work / "linux-6.12.117"
if not (src / "Makefile").exists():
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir()
    print("extract", flush=True)
    subprocess.check_call(["tar", "-C", str(work), "-xf", str(root / "dl/linux-6.12.117.tar.xz")])

dirs = [
    root / "target/linux/generic/backport-6.12",
    root / "target/linux/generic/pending-6.12",
    root / "target/linux/generic/hack-6.12",
    root / "target/linux/mediatek/patches-6.12",
]
state = Path("/tmp/kcheck-applied.txt")
applied_names = set(state.read_text().split()) if state.exists() else set()
print("already", len(applied_names), flush=True)
failed = None
new_applied = 0
dropped = 0
for d in dirs:
    if not d.exists():
        continue
    for p in sorted(x for x in d.iterdir() if x.suffix == ".patch"):
        key = str(p.relative_to(root))
        if key in applied_names:
            continue
        data = p.read_bytes()
        fwd = subprocess.run(
            ["patch", "-f", "-p1", "--dry-run", "-d", str(src)],
            input=data,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if fwd.returncode == 0:
            subprocess.run(
                ["patch", "-f", "-p1", "-d", str(src)],
                input=data,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=True,
            )
            applied_names.add(key)
            new_applied += 1
            continue
        rev = subprocess.run(
            ["patch", "--fuzz=0", "-f", "-p1", "-R", "--dry-run", "-d", str(src)],
            input=data,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if rev.returncode == 0:
            dest = drop_root / p.name
            if dest.exists():
                dest = drop_root / (p.parent.name + "-" + p.name)
            shutil.move(str(p), str(dest))
            print("DROP", key, flush=True)
            dropped += 1
            continue
        detail = subprocess.run(
            ["patch", "-f", "-p1", "--dry-run", "-d", str(src)],
            input=data,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        out = detail.stdout.decode(errors="replace")
        if "can't find file to patch" in out or "No file to patch" in out:
            dest = drop_root / p.name
            if dest.exists():
                dest = drop_root / (p.parent.name + "-" + p.name)
            shutil.move(str(p), str(dest))
            print("SKIP-MISSING", key, flush=True)
            dropped += 1
            continue
        failed = key
        print(out[-2500:])
        break
    if failed:
        break
state.write_text("\n".join(sorted(applied_names)) + "\n")
print("new_applied", new_applied, "dropped", dropped, "total", len(applied_names))
print("FAILED", failed)
