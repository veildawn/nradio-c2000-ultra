"""Run the real updater with fake network/sysupgrade commands in a temp directory.

No firmware or block device is written. Only the OpenWrt JSON API is emulated.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]

JSON_SH = r'''
json_init() { export JSON_OUTPUT='{}'; }
json_add_string() { JSON_OUTPUT=$(python3 "$JSON_HELPER" add "$1" string "$2"); export JSON_OUTPUT; }
json_add_int() { JSON_OUTPUT=$(python3 "$JSON_HELPER" add "$1" int "$2"); export JSON_OUTPUT; }
json_add_boolean() { JSON_OUTPUT=$(python3 "$JSON_HELPER" add "$1" bool "$2"); export JSON_OUTPUT; }
json_dump() { printf '%s\n' "$JSON_OUTPUT"; }
json_load() { export JSON_INPUT="$1" JSON_PATH=''; }
json_select() {
    if [ "$1" = .. ]; then JSON_PATH="${JSON_PATH%/*}"; else JSON_PATH="$JSON_PATH/$1"; fi
    export JSON_PATH
}
json_get_var() { eval "$1=$(python3 "$JSON_HELPER" get "$2")"; }
json_get_keys() { eval "$1=$(python3 "$JSON_HELPER" keys)"; }
json_cleanup() { :; }
'''
JSON_PY = '''
import json, os, shlex, sys
mode = sys.argv[1]
if mode == 'add':
    obj = json.loads(os.environ['JSON_OUTPUT'])
    key, kind, value = sys.argv[2:]
    obj[key] = int(value or 0) if kind == 'int' else bool(int(value)) if kind == 'bool' else value
    print(json.dumps(obj, ensure_ascii=False))
else:
    obj = json.loads(os.environ['JSON_INPUT'])
    for key in os.environ['JSON_PATH'].split('/'):
        if key: obj = obj[int(key)] if isinstance(obj, list) else obj[key]
    if mode == 'get': value = obj.get(sys.argv[2], '')
    else: value = ' '.join(map(str, range(len(obj)))) if isinstance(obj, list) else ' '.join(obj)
    print(shlex.quote(str(value)))
'''


class UpgradeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='nradio-test-')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.env = dict(os.environ, TEST_ROOT=str(self.root), JSON_HELPER=str(self.root / 'json_helper.py'))
        (self.root / 'json_helper.py').write_text(JSON_PY)
        (self.root / 'json.sh').write_text(JSON_SH)
        self.image = self.root / 'fixture.bin'
        self.image.write_bytes(b'nradio test firmware\n' * 1024)
        self.digest = hashlib.sha256(self.image.read_bytes()).hexdigest()
        self.url = 'https://github.com/veildawn/nradio-c2000-ultra/releases/download/test/firmware.bin'
        self.tag = 'v-test-r38246'
        self.metadata = dict(tag=self.tag, url=self.url, sha256=self.digest, size=self.image.stat().st_size,
                             kernel_match=1, release_kernel='6.18.60')
        self.cache = self.root / 'c2000-upgrade.release'
        self.cache.write_text(json.dumps(self.metadata))
        self.state = self.root / 'c2000-upgrade.state'
        self.bin = self.root / 'c2000-upgrade-sysupgrade.bin'
        self.lock = self.root / 'c2000-upgrade.lock'
        self.stub('uname', 'echo 6.18.60')
        self.stub('wget', '''
while [ "$1" != -O ]; do shift; done
shift
[ ! -e "$TEST_ROOT/fail-download" ] || exit 4
while [ -e "$TEST_ROOT/pause-download" ]; do sleep 0.1; done
cp "$TEST_ROOT/fixture.bin" "$1"
''')
        self.stub('uclient-fetch', 'echo call >> "$TEST_ROOT/api-calls"; cat "$TEST_ROOT/release.json"')
        self.stub('ubus', 'echo \'{"release":{"revision":"r38246-test","builddate":1794614400}}\'')
        self.stub('sysupgrade', '''
printf '%s\\n' "$*" >> "$TEST_ROOT/flash-calls"
[ ! -e "$TEST_ROOT/reject-image" ] || exit 1
[ "$1" = -T ] || [ ! -e "$TEST_ROOT/fail-flash" ]
''')
        src = (ROOT / 'board/files/usr/sbin/c2000-upgrade').read_text()
        src = src.replace('. /lib/functions.sh', '').replace('. /usr/share/libubox/jshn.sh', f'. "{self.root}/json.sh"')
        src = src.replace('/tmp/c2000-upgrade', str(self.root / 'c2000-upgrade'))
        src = src.replace('/sbin/sysupgrade', str(self.root / 'commands/sysupgrade'))
        self.script = self.root / 'updater'
        self.script.write_text(src)
        self.env['PATH'] = str(self.root / 'commands') + ':' + self.env['PATH']

    def stub(self, name, content):
        directory = self.root / 'commands'
        directory.mkdir(exist_ok=True)
        path = directory / name
        path.write_text('#!/bin/sh\n' + content + '\n')
        path.chmod(0o755)

    def call(self, *args, ok=True):
        r = subprocess.run(['/bin/sh', str(self.script), *args], env=self.env, text=True, capture_output=True, timeout=20)
        self.assertEqual(r.returncode == 0, ok, r.stdout + r.stderr)
        return json.loads(r.stdout)

    def download(self, ok=True, digest=None):
        return self.call('download', self.url, digest or self.digest, '', self.tag, ok=ok)

    def settle(self, state='done'):
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if self.state.exists() and self.state.read_text().startswith('state=' + state + '\n') and not self.lock.exists():
                return
            time.sleep(0.05)
        self.fail('worker did not settle: ' + (self.state.read_text() if self.state.exists() else 'missing state'))

    def staged(self):
        self.bin.write_bytes(self.image.read_bytes())
        self.state.write_text(f'state=done\nexpected={self.digest}\nsha256={self.digest}\ntag={self.tag}\nkernel=6.18.60\ntotal={self.image.stat().st_size}\n')

    def test_download_verified_and_status_survives_new_process(self):
        self.assertTrue(self.download()['started'])
        self.settle()
        st = self.call('status')
        self.assertEqual((st['state'], st['sha256'], st['bytes'], st['total']),
                         ('done', self.digest, self.image.stat().st_size, self.image.stat().st_size))
        self.assertEqual(self.call('preflight', self.digest)['ready'], 1)

    def test_duplicate_start_cannot_delete_active_download(self):
        pause = self.root / 'pause-download'
        pause.touch()
        try:
            self.download()
            self.assertIn('正在进行', self.download(ok=False)['error'])
        finally:
            pause.unlink()
            self.settle()

    def test_network_failure_allows_retry(self):
        fail = self.root / 'fail-download'
        fail.touch()
        self.download()
        self.settle('error')
        self.assertFalse(self.bin.exists())
        fail.unlink()
        self.download()
        self.settle()

    def test_digest_failure_never_stages_image(self):
        self.image.write_bytes(b'corrupt download')
        self.download()
        self.settle('error')
        self.assertFalse(self.bin.exists())
        self.assertIn('SHA-256', self.call('status')['msg'])

    def test_untrusted_digest_and_kernel_mismatch_are_rejected(self):
        self.assertIn('Release', self.download(ok=False, digest='a' * 64)['error'])
        for match in (0, -1):
            self.metadata['kernel_match'] = match
            self.cache.write_text(json.dumps(self.metadata))
            self.assertIn('内核', self.download(ok=False)['error'])
        self.assertFalse(self.state.exists())

    def test_stale_worker_recovery_and_progress_error(self):
        self.lock.mkdir()
        pid = self.lock / 'pid'
        pid.write_text('99999999\n')
        os.utime(pid, (1, 1))
        self.state.write_text('state=downloading\n')
        self.assertEqual(self.call('status')['state'], 'error')
        self.download()
        self.settle()

    def test_preflight_rejects_changed_image_wrong_selection_and_bad_format(self):
        self.staged()
        self.assertIn('变更', self.call('preflight', 'a' * 64, ok=False)['error'])
        self.bin.write_bytes(b'tampered')
        self.assertIn('SHA-256', self.call('preflight', self.digest, ok=False)['error'])
        self.staged()
        (self.root / 'reject-image').touch()
        self.assertIn('兼容性', self.call('preflight', self.digest, ok=False)['error'])
        self.assertFalse(self.lock.exists())

    def test_flash_revalidates_and_reports_worker_failure(self):
        self.staged()
        (self.root / 'fail-flash').touch()
        self.assertIn('变更', self.call('flash', 'reset', 'a' * 64, ok=False)['error'])
        self.assertTrue(self.call('flash', 'reset', self.digest)['started'])
        self.settle('error')
        calls = (self.root / 'flash-calls').read_text().splitlines()
        self.assertTrue(calls[0].startswith('-T '))
        self.assertTrue(calls[1].startswith('-n '))

    def test_successful_flash_handoff_is_not_reported_as_immediate_failure(self):
        self.staged()
        hold = self.root / 'hold-shutdown'
        hold.touch()
        self.stub('sleep', """
if [ "$1" = 300 ]; then
    touch "$TEST_ROOT/awaiting-shutdown"
    while [ -e "$TEST_ROOT/hold-shutdown" ]; do /bin/sleep 0.1; done
fi
""")
        self.call('flash', 'keep', self.digest)
        try:
            deadline = time.monotonic() + 5
            while not (self.root / 'awaiting-shutdown').exists() and time.monotonic() < deadline:
                time.sleep(0.05)
            self.assertTrue((self.root / 'awaiting-shutdown').exists())
            self.assertEqual(self.call('status')['state'], 'flashing')
        finally:
            hold.unlink()
            self.settle('error')

    def test_interrupted_lock_creation_can_be_recovered(self):
        self.lock.mkdir()
        os.utime(self.lock, (1, 1))
        self.download()
        self.settle()

    def test_cached_check_avoids_network_and_force_refreshes(self):
        self.assertEqual(self.call('check')['tag'], self.tag)
        self.assertFalse((self.root / 'api-calls').exists())
        (self.root / 'release.json').write_text(json.dumps(dict(tag_name=self.tag,
            name='NRadio Linux 6.18.60', published_at='2026-11-14T00:00:00Z', assets=[dict(
                name='openwrt-nradio_c2000-ultra-squashfs-sysupgrade.bin', browser_download_url=self.url,
                size=1024, digest='sha256:' + self.digest)])))
        self.assertEqual(self.call('check', 'force')['kernel_match'], 1)
        self.assertEqual((self.root / 'api-calls').read_text(), 'call\n')


if __name__ == '__main__':
    unittest.main()
