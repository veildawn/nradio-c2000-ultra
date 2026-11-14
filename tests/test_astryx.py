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

    def test_search_finds_every_management_category_and_plugins(self):
        self.open()
        self.page.get_by_role('button', name='搜索设置', exact=True).click()
        box=self.page.get_by_role('textbox', name='搜索全部管理页面')
        for term in ['无线网络','防火墙','软件包','5G 蜂窝','示例插件']:
            box.fill(term)
            self.assertEqual(self.page.locator('.nr-search-results a').count(), 1)
            self.assertIn(term, self.page.locator('.nr-search-results a').inner_text())
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.get_by_role('dialog').count(),0)

    def test_menu_bridge_keeps_filtered_routes_and_nested_tabs(self):
        self.open()
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
          const bridge=new Function('baseclass','ui','L','E','_',source)({extend:value=>value},ui,L,E,value=>value);
          await bridge.__init__();
          window.fixtureBridge=bridge;
        }''', source)
        self.assertEqual(self.page.evaluate('nradioMenu.menu.map(n=>n.title)'), ['网络','访客控制台'])
        self.assertEqual(self.page.locator('#tabmenu li.active a').inner_text(), '规则')
        self.assertEqual(self.page.locator('#tabmenu a').last.get_attribute('href'), '/cgi-bin/luci/admin/network/firewall/forwards')
        self.page.get_by_role('button',name='搜索设置',exact=True).click()
        self.page.get_by_role('textbox',name='搜索全部管理页面').fill('转发')
        self.assertEqual(self.page.locator('.nr-search-results a').get_attribute('href'), '/cgi-bin/luci/admin/network/firewall/forwards')

    def test_native_validation_save_and_unsaved_indicator_survive(self):
        self.open()
        address=self.page.get_by_label('IPv4 地址',exact=True)
        address.fill('invalid')
        self.page.get_by_role('button',name='保存并应用',exact=True).click()
        self.assertIsNone(self.page.evaluate('fixtureSubmitted'))
        self.assertTrue(self.page.locator('.nr-topbar #fixture-changes').is_visible())
        address.fill('192.168.2.1')
        self.page.get_by_role('button',name='保存并应用',exact=True).click()
        self.assertEqual(self.page.evaluate('fixtureSubmitted.address'),'192.168.2.1')
        self.assertFalse(self.page.locator('#fixture-changes').is_visible())

    def test_theme_persistence_and_legacy_modal(self):
        self.open()
        self.page.get_by_role('button',name='切换深色模式',exact=True).click()
        self.page.reload(); self.page.wait_for_selector('html[data-theme="dark"]')
        self.page.get_by_role('button',name='编辑',exact=True).first.click()
        self.assertTrue(self.page.locator('#modal_overlay .modal').is_visible())
        self.page.get_by_role('button',name='关闭',exact=True).click()
        self.assertEqual(self.page.locator('#modal_overlay').count(),0)

    def test_mobile_navigation_and_no_horizontal_overflow(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.open()
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        self.page.get_by_role('button',name='打开菜单',exact=True).click()
        self.assertTrue(self.page.locator('.nr-sidebar.is-open').is_visible())
        self.page.get_by_role('button',name='系统',exact=True).click()
        self.page.locator('.nr-nav-items').get_by_role('link',name='在线固件更新',exact=True).click()
        self.page.wait_for_url('**/*page=upgrade')

    def test_existing_nradio_views_render_inside_mobile_theme(self):
        from test_ui import HARNESS
        self.page.set_viewport_size({'width':390,'height':844})
        for name in ('modem','upgrade','bootswitch'):
            with self.subTest(view=name):
                self.open()
                self.page.evaluate(HARNESS + '\nvoid 0;')
                source=(ROOT / f'board/files/www/luci-static/resources/view/nradio/{name}.js').read_text()
                self.page.evaluate('''async source => {
                    await mount(source);
                    document.getElementById('maincontent').replaceChildren(document.body.lastElementChild);
                }''', source)
                self.assertTrue(self.page.locator('#maincontent h2').is_visible())
                self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
                self.assertGreater(self.page.locator('#maincontent button:visible').count(),0)

    def test_login_keeps_server_auth_fields_and_posts_native_form(self):
        self.open('?login=1')
        self.assertGreater(self.page.get_by_role('button',name='登录管理中心').bounding_box()['width'], 300)
        self.page.get_by_label('密码',exact=True).fill('test-only-password')
        self.page.get_by_role('button',name='登录管理中心',exact=True).click()
        self.assertEqual(self.page.evaluate('fixtureSubmitted'), {'luci_username':'root','luci_password':'test-only-password','token':'fixture-token'})
        self.assertEqual(self.page.locator('[name=luci_password]').count(),1)
        self.assertEqual(self.page.locator('[name=luci_password]').get_attribute('autocomplete'),'current-password')

if __name__=='__main__': unittest.main()
