"""Regression fixtures for the shell AT parser and nonblocking status path."""
from pathlib import Path
import os
import shlex
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / 'board/files/usr/sbin/mt5700-status').read_text()


class ModemTests(unittest.TestCase):
    def parse(self, raw):
        start = SOURCE.index('CFUN="" CPIN=')
        end = SOURCE.index('\nreg_stat()', start)
        code = 'RAW=' + shlex.quote(raw) + '\n' + SOURCE[start:end]
        fields = ['CFUN', 'CPIN', 'IMSI', 'ICCID', 'COPS', 'CSQ', 'HCSQ', 'HCSQV', 'CEREG', 'C5GREG', 'SCICHG', 'CHIPTEMP']
        code += "\nprintf '%s\\n' " + ' '.join('"$' + f + '"' for f in fields)
        res = subprocess.run(['sh', '-c', code], capture_output=True, text=True, check=True)
        return dict(zip(fields, res.stdout.splitlines()))

    def test_nr_sweep_with_urcs_and_last_response_wins(self):
        result = self.parse('''AT+CPIN?
+CPIN: SIM PIN
OK
+CPIN: READY
460060123456789
^ICCID: 89860601234567890000
+COPS: 0,2,"46006",11
^HCSQ: "NR",54,170,26
+CEREG: 2,1,"0001","1234",7
+C5GREG: 2,1,"0001","1234",11
^SCICHG: 1,0
^CHIPTEMP: 65535,610,730
+CFUN: 1
OK''')
        self.assertEqual(result['CPIN'], 'READY')
        self.assertEqual(result['IMSI'], '460060123456789')
        self.assertEqual(result['ICCID'], '89860601234567890000')
        self.assertEqual((result['HCSQ'], result['HCSQV']), ('NR', '54,170,26'))
        self.assertEqual(result['CHIPTEMP'], '65535,610,730')
        self.assertEqual(result['SCICHG'], '1,0')

    def test_empty_no_service_and_lte(self):
        self.assertEqual(self.parse('ERROR\nOK')['CPIN'], '')
        self.assertEqual(self.parse('^HCSQ: "NOSERVICE"')['HCSQV'], '')
        result = self.parse('^HCSQ: "LTE",60,55,100,20\n+CSQ: 18,99')
        self.assertEqual(result['CSQ'], '18 99')
        self.assertEqual(result['HCSQV'], '60,55,100,20')

    def test_web_status_never_invokes_gcom_for_stale_snapshot(self):
        with tempfile.TemporaryDirectory(prefix='nradio-status-') as tmp:
            path = Path(tmp)
            prefix = SOURCE[:SOURCE.index('# ---- parse raw AT burst')]
            prefix = prefix.replace('. /lib/functions.sh', '').replace('. /usr/share/libubox/jshn.sh', '')
            prefix = prefix.replace('[ "$(board_name)" = "nradio,c2000-ultra" ] || exit 0', '')
            prefix = prefix.replace('/tmp/mt5700.status.raw', str(path / 'raw'))
            # Substitute only the hardware discovery, leaving the AT decision intact.
            prefix = prefix.replace('\nfind_modem_usb\n', '\nfind_modem_usb() { :; }\n')
            stubs = '''
uci() { echo /dev/null; }
lock() { return 0; }
ubus() { echo '{"pending": false}'; }
gcom() { echo called >> "$TEST_MARKER"; printf 'OK\\n'; }
timeout() { shift; "$@"; }
'''
            env = dict(os.environ, TEST_MARKER=str(path / 'calls'))
            script = path / 'status'
            script.write_text(stubs + prefix + '\nprintf "%s\\n" "$SOURCE"\n')
            snapshot = path / 'raw'
            snapshot.write_text('OK\n')
            os.utime(snapshot, (1, 1))
            subprocess.run(['sh', str(script)], env=env, capture_output=True, check=True)
            self.assertFalse((path / 'calls').exists())
            subprocess.run(['sh', str(script), '--refresh'], env=env, capture_output=True, check=True)
            self.assertEqual((path / 'calls').read_text(), 'called\n')


if __name__ == '__main__':
    unittest.main()
