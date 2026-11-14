"""Built Astryx bundle against native LuCI-shaped forms; no router is modified."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sync_playwright = None
ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'board/files/www/luci-static/astryx/astryx.js'

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass

@unittest.skipUnless(sync_playwright and ASSETS.exists(), 'Build ui/astryx and install Playwright first')
class AstryxTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(headless=True)
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/ui/astryx/preview.html'

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.pw.stop(); cls.server.shutdown(); cls.server.server_close(); cls.thread.join()

    def setUp(self):
        self.page = self.browser.new_page(viewport={'width':1440,'height':1000})
        self.addCleanup(self.page.close)
        self.errors=[]
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))

    def tearDown(self): self.assertEqual(self.errors, [])

    def open(self, suffix=''):
        self.page.goto(self.url + suffix)
        self.page.wait_for_selector('body.nr-ready')


    def open_setting(self, term='网络接口'):
        self.page.get_by_role('button',name='搜索设置',exact=True).click()
        self.page.get_by_role('textbox',name='搜索全部管理页面').fill(term)
        self.page.locator('.nr-search-results a').click()
        self.page.wait_for_selector('.nr-managed-page[aria-busy="false"]')
        return self.page.frames[-1]

    def mobile(self): self.page.set_viewport_size({'width':390,'height':844})

    def tab(self, name): self.page.get_by_role('navigation',name='底部导航').get_by_role('link',name=name,exact=True).click()

    def test_search_finds_every_management_category_and_plugins(self):
        self.open()
        self.page.get_by_role('button', name='搜索设置', exact=True).click()
        box=self.page.get_by_role('textbox', name='搜索全部管理页面')
        for term in ['无线网络','防火墙','软件包','5G 蜂窝','示例插件']:
            box.fill(term)
            self.assertEqual(self.page.locator('.nr-search-results a').count(), 1)
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.get_by_role('dialog').count(),0)

    def test_mobile_bottom_tabs_are_persistent_single_page_navigation(self):
        self.mobile();self.open()
        self.page.evaluate('window.shellIdentity="same-document"')
        nav=self.page.get_by_role('navigation',name='底部导航')
        self.assertEqual(nav.get_by_role('link').count(),5)
        self.assertGreaterEqual(nav.bounding_box()['y'],750)
        for name, key in [('网络','network'),('应用','apps'),('系统','system'),('总览','overview')]:
            self.tab(name)
            self.page.wait_for_function('(key)=>new URLSearchParams(location.hash.slice(1)).get("tab")===key',arg=key)
            self.assertEqual(self.page.evaluate('shellIdentity'),'same-document')
            self.assertTrue(nav.is_visible())
            self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        self.tab('5G');self.page.wait_for_selector('iframe')
        self.assertIn('/network/cellular',self.page.locator('iframe').get_attribute('src'))
        self.assertEqual(self.page.evaluate('shellIdentity'),'same-document')

    def test_native_validation_save_and_unsaved_indicator_survive(self):
        self.open();frame=self.open_setting()
        address=frame.get_by_label('IPv4 地址',exact=True)
        address.fill('invalid')
        frame.get_by_role('button',name='保存并应用',exact=True).click()
        self.assertIsNone(frame.evaluate('fixtureSubmitted'))
        self.page.locator('.nr-dirty-badge').wait_for()
        address.fill('192.168.2.1')
        frame.get_by_role('button',name='保存并应用',exact=True).click()
        self.assertEqual(frame.evaluate('fixtureSubmitted.address'),'192.168.2.1')
        self.page.wait_for_selector('.nr-dirty-badge',state='detached')

    def test_dirty_navigation_can_cancel_or_discard(self):
        self.mobile();self.open();frame=self.open_setting()
        frame.get_by_label('IPv4 地址',exact=True).fill('192.168.2.1')
        self.page.locator('.nr-dirty-badge').wait_for();self.tab('系统')
        self.page.get_by_role('button',name='继续编辑',exact=True).click()
        self.assertEqual(frame.get_by_label('IPv4 地址',exact=True).input_value(),'192.168.2.1')
        self.tab('系统');self.page.get_by_role('button',name='放弃输入并离开',exact=True).click()
        self.page.wait_for_selector('iframe',state='detached')
        self.assertIn('tab=system',self.page.url)

    def test_browser_back_respects_dirty_inputs_and_restores_route(self):
        self.mobile();self.open();self.tab('网络');frame=self.open_setting()
        frame.get_by_label('IPv4 地址',exact=True).fill('192.168.2.1')
        self.page.locator('.nr-dirty-badge').wait_for()
        self.page.evaluate('history.back()')
        self.page.get_by_role('button',name='继续编辑',exact=True).click()
        self.assertEqual(frame.get_by_label('IPv4 地址',exact=True).input_value(),'192.168.2.1')
        self.page.wait_for_function('new URLSearchParams(location.hash.slice(1)).has("page")')
        self.page.evaluate('history.back()')
        self.page.get_by_role('button',name='放弃输入并离开',exact=True).click()
        self.page.wait_for_selector('iframe',state='detached')
        self.assertEqual(self.page.url.split('#')[1],'tab=network')

    def test_tab_restores_scroll_and_disposes_old_page_timers(self):
        self.mobile();self.open();frame=self.open_setting()
        self.page.evaluate('window.oldPageTicks=0')
        frame.evaluate('setInterval(()=>parent.oldPageTicks++,30);window.scrollTo(0,240)')
        frame.wait_for_function('scrollY>=230')
        self.page.wait_for_timeout(80)
        self.tab('系统');self.page.wait_for_selector('iframe',state='detached')
        ticks=self.page.evaluate('oldPageTicks');self.page.wait_for_timeout(100)
        self.assertEqual(self.page.evaluate('oldPageTicks'),ticks)
        self.tab('网络');self.page.wait_for_selector('.nr-managed-page[aria-busy="false"]')
        self.page.frames[-1].wait_for_function('scrollY>=230')
        self.assertEqual(self.page.locator('iframe').count(),1)

    def test_theme_and_modal_operation_stay_in_active_page(self):
        self.mobile();self.open();frame=self.open_setting()
        self.page.get_by_role('button',name='切换深色模式',exact=True).click()
        frame.wait_for_selector('html[data-theme="dark"]')
        frame.get_by_role('button',name='编辑',exact=True).first.click()
        self.page.wait_for_timeout(80);self.tab('系统')
        self.assertTrue(self.page.locator('.nr-nav-notice').is_visible())
        self.assertTrue(frame.locator('#modal_overlay .modal').is_visible())
        frame.get_by_role('button',name='关闭',exact=True).click()
        self.page.wait_for_timeout(80);self.tab('系统')
        self.page.wait_for_selector('iframe',state='detached')
        self.page.reload();self.page.wait_for_selector('html[data-theme="dark"]')

    def test_external_page_and_forged_messages_are_rejected(self):
        self.open('#tab=network&page=https%3A%2F%2Fevil.invalid%2Fadmin%2Fnetwork')
        self.assertEqual(self.page.locator('iframe').count(),0)
        self.assertIn('不可用',self.page.locator('.nr-empty').inner_text())
        self.page.evaluate('postMessage({type:"nradio:navigate",url:"/cgi-bin/luci/admin/system/reboot"},location.origin)')
        self.assertEqual(self.page.locator('iframe').count(),0)

    def test_reconnect_leaves_frame_and_navigates_top_document(self):
        self.open();frame=self.open_setting()
        self.page.route(self.url.split('/ui/')[0]+'/',lambda route:route.fulfill(body='<html><body>Reconnected</body></html>',content_type='text/html'))
        frame.evaluate('''() => {
          window.fixtureUI={pingDevice:async()=>({target:{src:location.origin+'/icons/loading.svg'}})};
          window.L={require:async()=>fixtureUI};
          const timeout=window.setTimeout;
          window.setTimeout=(fn,delay)=>timeout(fn,delay===5000?1:delay);
        }''')
        frame.evaluate((ROOT/'board/files/www/luci-static/resources/astryx-frame.js').read_text())
        frame.wait_for_function('typeof fixtureUI.awaitReconnect === "function"')
        frame.evaluate('fixtureUI.awaitReconnect(location.host)')
        self.page.wait_for_url(self.url.split('/ui/')[0]+'/')
        self.assertIn('Reconnected',self.page.locator('body').inner_text())

    def test_phone_landscape_keeps_bottom_tabs(self):
        self.page.set_viewport_size({'width':844,'height':390});self.open()
        self.assertTrue(self.page.get_by_role('navigation',name='底部导航').is_visible())
        self.assertFalse(self.page.locator('.nr-sidebar').is_visible())

    def test_existing_nradio_views_render_inside_mobile_theme(self):
        from test_ui import HARNESS
        self.mobile()
        for name in ('modem','upgrade','bootswitch'):
            with self.subTest(view=name):
                self.open();frame=self.open_setting()
                frame.evaluate(HARNESS+'\nvoid 0;')
                source=(ROOT/f'board/files/www/luci-static/resources/view/nradio/{name}.js').read_text()
                frame.evaluate('''async source=>{await mount(source);document.getElementById('maincontent').replaceChildren(document.body.lastElementChild);}''',source)
                self.assertTrue(frame.locator('#maincontent h2').is_visible())
                self.assertTrue(frame.evaluate('document.documentElement.scrollWidth<=innerWidth'))

    def test_login_keeps_server_auth_fields_and_posts_native_form(self):
        self.open('?login=1')
        self.assertGreater(self.page.get_by_role('button',name='登录管理中心').bounding_box()['width'],300)
        self.page.get_by_label('密码',exact=True).fill('test-only-password')
        self.page.get_by_role('button',name='登录管理中心',exact=True).click()
        self.assertEqual(self.page.evaluate('fixtureSubmitted'),{'luci_username':'root','luci_password':'test-only-password','token':'fixture-token'})
        self.assertEqual(self.page.locator('[name=luci_password]').get_attribute('autocomplete'),'current-password')

    def test_menu_bridge_keeps_filtered_routes_and_nested_tabs(self):
        self.open()
        self.page.evaluate("document.getElementById('maincontent').append(Object.assign(document.createElement('div'),{id:'tabmenu'}))")
        source=(ROOT / 'board/files/www/luci-static/resources/menu-astryx.js').read_text()
        self.page.evaluate('''async source => {
          const tree={children:{admin:{name:'admin',title:'管理',children:{
            network:{name:'network',title:'网络',children:{
              firewall:{name:'firewall',title:'防火墙',children:{
                rules:{name:'rules',title:'规则',children:{}},
                forwards:{name:'forwards',title:'转发',children:{}}
              }}
            }},
            restricted:{name:'restricted',title:'无权访问',hidden:true,children:{}}
          }}, guest:{name:'guest',title:'访客控制台',children:{}}}};
          const ui={menu:{load:async()=>tree,getChildren:node=>Object.values(node.children||{}).filter(n=>!n.hidden)}};
          const L={env:{dispatchpath:['admin','network','firewall','rules'],requestpath:['admin']},
            url:(...parts)=>'/cgi-bin/luci/'+parts.join('/'),bind:(fn,ctx)=>fn.bind(ctx)};
          const E=(tag,attrs,children)=>{const el=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));
            for(const child of Array.isArray(children)?children:children?[children]:[])el.append(child);return el;};
          const bridge=new Function('baseclass','ui','L','E','_','rpc',source)({extend:value=>value},ui,L,E,value=>value,{declare:()=>async()=>({})});
          await bridge.__init__();
          window.fixtureBridge=bridge;
        }''', source)
        self.assertEqual(self.page.evaluate('nradioMenu.menu.map(n=>n.title)'), ['网络','访客控制台'])
        self.assertEqual(self.page.locator('#tabmenu li.active a').inner_text(), '规则')
        self.assertEqual(self.page.locator('#tabmenu a').last.get_attribute('href'), '/cgi-bin/luci/admin/network/firewall/forwards')
        self.page.get_by_role('button',name='搜索设置',exact=True).click()
        self.page.get_by_role('textbox',name='搜索全部管理页面').fill('转发')
        self.assertEqual(self.page.locator('.nr-search-results a').get_attribute('href'), '/cgi-bin/luci/admin/network/firewall/forwards')


if __name__=='__main__': unittest.main()
