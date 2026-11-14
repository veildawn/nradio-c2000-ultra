"""Chromium interaction checks using real views and a small LuCI RPC/form fixture.

Install with: python3 -m pip install playwright && python3 -m playwright install chromium
"""
from pathlib import Path
import unittest
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sync_playwright = None

ROOT = Path(__file__).resolve().parents[1]
HARNESS = r'''
String.prototype.format = function(...args) {
    let i = 0;
    return this.replace(/%(?:\.(\d+))?([sdf%])/g, (_, precision, kind) => {
        if (kind === '%') return '%';
        const value = args[i++];
        return kind === 'f' ? Number(value).toFixed(Number(precision || 0)) : kind === 'd' ? String(Math.floor(value)) : String(value);
    });
};
window.E = function(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
        if (typeof value === 'function') node.addEventListener(key, value);
        else node.setAttribute(key, value);
    }
    if (children != null) node.append(...(Array.isArray(children) ? children : [children]));
    return node;
};
window.L = { bind: (fn, ctx, ...args) => fn.bind(ctx, ...args) };
window.poll = { callbacks: [], add(fn) { this.callbacks.push(fn); } };
window.ui = {
    createHandlerFn(ctx, method, ...args) { return ev => {
        const target = ev.currentTarget;
        target.disabled = true;
        Promise.resolve((typeof method === 'string' ? ctx[method] : method).call(ctx, ...args, ev))
            .finally(() => { target.disabled = false; });
    }; },
    showModal(title, content) { this.hideModal(); document.body.append(E('div', { id: 'modal' }, [E('h3', {}, title), ...content])); },
    hideModal() { document.querySelector('#modal')?.remove(); },
    addNotification(_, node) { document.body.append(node); },
    awaitReconnect() {}
};
window.fields = {};
window.form = { Map: class {
    section() { return { tab() {}, taboption(tab, type, name) {
        const field = { value() {} }; fields[name] = field; return field;
    } }; }
    render() { return Promise.resolve(E('form', {}, '蜂窝设置')); }
}};
window.fake = {
    release: { tag: 'v-test', url: 'https://github.com/fw', sha256: 'a'.repeat(64), size: 1024, kernel_match: 1, current_kernel: '6.18.60', release_kernel: '6.18.60', same_base: 1 },
    status: { state: 'idle' }, boot: '1', calls: [], fail: '', slowCheck: false,
    modem: { present: true, enabled: '1', source: 'daemon', stamp_age: 5, check_interval: 30,
        sim: { phase: 'ready', configured_slot: 'auto', slot: 'esim' }, reg: {},
        signal: { sysmode: 'NR', rsrp_dbm: '-85' }, temp_dc: '730', wwan: { up: true, ip4: '10.0.0.2' } }
};
window.fs = { async exec(path, args = []) {
    const command = args[0] || 'modem'; fake.calls.push(command);
    if (fake.fail === command) throw Error('模拟连接中断');
    let data;
    if (path.endsWith('bootswitch')) {
        if (command === 'to-factory') fake.boot = '0';
        if (command === 'to-openwrt') fake.boot = '1';
        return {code: 0, stdout: `mtd=/dev/mtd1 boot_from_sd=${fake.boot} (test)`};
    }
    if (command === 'modem') data = fake.modem;
    if (command === 'check') {
        if (fake.slowCheck) await new Promise(resolve => { window.finishCheck = resolve; });
        data = fake.release;
    }
    if (command === 'status') data = fake.status;
    if (command === 'download') data = { started: true };
    if (command === 'preflight') data = { ready: 1 };
    if (command === 'flash') data = { started: true };
    return { code: 0, stdout: JSON.stringify(data) };
}};
window.mount = async function(source) {
    window.current = new Function('view', 'fs', 'ui', 'poll', 'form', 'L', 'E', source)(
        {extend: x => x}, fs, ui, poll, form, L, E);
    document.body.append(await current.render(await current.load()));
};
'''


@unittest.skipIf(sync_playwright is None, 'Optional Playwright dependency not installed')
class UITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.page = self.browser.new_page(viewport={'width': 390, 'height': 844})
        self.addCleanup(self.page.close)
        self.errors = []
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.page.set_content('<html lang="zh"><body></body></html>')
        self.page.evaluate(HARNESS + '\nvoid 0;')

    def tearDown(self):
        self.assertEqual(self.errors, [])

    def mount(self, name):
        source = (ROOT / f'board/files/www/luci-static/resources/view/nradio/{name}.js').read_text()
        self.page.evaluate('source => mount(source)', source)

    def test_upgrade_renders_before_network_check_finishes(self):
        self.page.evaluate('fake.slowCheck = true')
        self.mount('upgrade')
        self.assertTrue(self.page.get_by_role('heading', name='在线固件更新', exact=True).is_visible())
        self.assertTrue(self.page.get_by_role('button', name='下载固件到路由器').is_disabled())
        self.page.evaluate('finishCheck()')
        self.page.wait_for_function('!current.checking')
        self.assertTrue(self.page.get_by_role('button', name='下载固件到路由器').is_enabled())

    def test_download_restore_progress_rpc_error_and_completion(self):
        self.page.evaluate("fake.status = {state: 'downloading', bytes: 512, total: 1024, tag: 'v-old'}")
        self.mount('upgrade')
        self.assertEqual(self.page.get_by_role('progressbar').get_attribute('aria-valuenow'), '50')
        self.assertTrue(self.page.get_by_role('button', name='下载固件到路由器').is_disabled())
        self.page.evaluate("fake.fail = 'status'; current.refreshDownload()")
        self.assertIn('自动重试', self.page.locator('body').inner_text())
        self.page.evaluate("fake.fail = ''; fake.status = {state: 'done', have_image: true, tag: 'v-old', sha256: 'a'.repeat(64)}; current.refreshDownload()")
        self.assertIn('固件已就绪：v-old', self.page.locator('body').inner_text())
        self.page.get_by_role('button', name='清除配置升级', exact=True).click()
        self.page.wait_for_selector('#modal')
        self.assertIn('v-old', self.page.locator('#modal').inner_text())
        self.assertIn('192.168.1.1', self.page.locator('#modal').inner_text())

    def test_started_download_keeps_button_disabled(self):
        self.mount('upgrade')
        self.page.wait_for_function('!current.checking')
        self.page.evaluate("fake.status = {state:'downloading',bytes:100,total:1024,tag:'test'}")
        self.page.get_by_role('button', name='下载固件到路由器').click()
        self.page.wait_for_function('!current.busy')
        self.assertTrue(self.page.get_by_role('button', name='下载固件到路由器').is_disabled())
        self.assertTrue(self.page.get_by_role('button', name='重新检查').is_disabled())

    def test_kernel_unknown_and_mismatch_disable_download(self):
        self.mount('upgrade')
        self.page.wait_for_function('!current.checking')
        for match in (0, -1):
            self.page.evaluate('(match) => { fake.release.kernel_match = match; return current.handleCheck(true); }', match)
            self.assertTrue(self.page.get_by_role('button', name='下载固件到路由器').is_disabled())
        self.page.evaluate("fake.fail = 'check'; current.handleCheck(true)")
        self.assertTrue(self.page.get_by_role('button', name='重新检查').is_enabled())
        self.assertIn('重试', self.page.locator('body').inner_text())

    def test_download_start_error_and_flash_error_are_visible(self):
        self.mount('upgrade')
        self.page.wait_for_function('!current.checking')
        self.page.evaluate("fake.fail = 'download'; current.handleDownload()")
        self.assertIn('模拟连接中断', self.page.locator('body').inner_text())
        self.assertTrue(self.page.get_by_role('button', name='下载固件到路由器').is_enabled())
        self.page.evaluate("fake.fail = 'flash'; current.renderDownload({state:'done',have_image:true,tag:'test',sha256:'a'.repeat(64)}); current.doFlash(false, 'a'.repeat(64))")
        self.assertFalse(self.page.locator('#modal').count())
        self.assertTrue(self.page.get_by_role('button', name='保留配置升级', exact=True).is_enabled())

    def test_modem_stale_temperature_and_query_failure(self):
        self.mount('modem')
        self.assertIn('73.0', self.page.locator('#mt5700_temp').inner_text())
        self.page.evaluate('fake.modem.stamp_age = 90; current.refreshStatus()')
        self.assertEqual(self.page.locator('#mt5700_temp').inner_text(), '—')
        self.page.evaluate("fake.fail = 'modem'; current.refreshStatus()")
        self.assertNotIn('已连接', self.page.locator('#mt5700_wwan').inner_text())
        self.assertIn('自动重试', self.page.locator('#mt5700_meta').inner_text())
        self.assertEqual(self.page.locator('#mt5700_meta').count(), 1)
        self.assertTrue(self.page.evaluate("fields.apn.validate('', '3gnet') === true"))
        self.assertTrue(self.page.evaluate("typeof fields.apn.validate('', 'bad\\\"apn') === 'string'"))

    def test_modem_bad_first_response_still_renders_settings(self):
        self.page.evaluate("fake.fail = 'modem'")
        self.mount('modem')
        self.assertTrue(self.page.locator('form').is_visible())
        self.assertIn('自动重试', self.page.locator('#mt5700_meta').inner_text())
        self.page.evaluate("fake.fail = ''; fake.modem.enabled = '0'; current.refreshStatus()")
        self.assertIn('已关闭', self.page.locator('#mt5700_modem').inner_text())

    def test_pending_boot_target_has_reboot_and_cancel_actions(self):
        self.page.evaluate("fake.boot = '0'")
        self.mount('bootswitch')
        self.assertIn('下次重启进入', self.page.locator('body').inner_text())
        self.assertTrue(self.page.get_by_role('button', name='立即重启进入原厂系统…').is_visible())
        self.page.get_by_role('button', name='取消切换，保持 OpenWrt').click()
        self.page.get_by_role('button', name='切换到原厂系统…').wait_for()


if __name__ == '__main__':
    unittest.main()
