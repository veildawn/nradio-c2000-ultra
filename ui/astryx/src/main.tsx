import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {Theme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral/built';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import './style.css';

export type MenuNode = {title: string; url: string; key: string; active: boolean; children: MenuNode[]};
type Bridge = {menu: MenuNode[]; title: string; breadcrumb: string[]; error?: string};
declare global {
  interface Window { nradioMenu?: Bridge; }
}
const root = document.getElementById('astryx-chrome')!;
const signedIn = root.dataset.authenticated === '1';
const hostname = root.dataset.hostname || 'OpenWrt';
const zh = document.documentElement.lang.toLowerCase().startsWith('zh');
const t = (cn: string, en: string) => zh ? cn : en;

function Icon({name, size = 20}: {name: string; size?: number}) {
  const paths: Record<string, React.ReactNode> = {
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>,
    moon: <path d="M20 14a8 8 0 0 1-10-10 8.5 8.5 0 1 0 10 10Z"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    arrow: <path d="m9 6 6 6-6 6"/>,
    status: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    network: <><path d="M3 8a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0m-9 4a4 4 0 0 1 6 0"/><circle cx="12" cy="20" r=".7"/></>,
    system: <><rect x="4" y="4" width="16" height="12" rx="2"/><path d="M8 21h8m-4-5v5"/></>,
    services: <><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 5 9 5 9-5"/></>,
    logout: <><path d="M9 3H4v18h5m6-14 5 5-5 5M8 12h12"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.services}</svg>;
}

function Brand() {
  return <span className="nr-brand"><span className="nr-symbol" aria-hidden="true">n<span>▹</span></span><span>NRadio<small>NETWORK OS</small></span></span>;
}
function flatten(menu: MenuNode[], parents: string[] = []): {node: MenuNode; parents: string[]}[] {
  return menu.flatMap(node => [{node, parents}, ...flatten(node.children, [...parents, node.title])]);
}
function useColorMode() {
  const [dark, setDark] = useState(() => {
    try { const saved = localStorage.getItem('nradio-color-mode'); if (saved) return saved === 'dark'; } catch {}
    return matchMedia('(prefers-color-scheme: dark)').matches;
  });
  useEffect(() => {
    document.documentElement.dataset.darkmode = String(dark);
    try { localStorage.setItem('nradio-color-mode', dark ? 'dark' : 'light'); } catch {}
  }, [dark]);
  return [dark, setDark] as const;
}
function MenuGroup({node, close}: {node: MenuNode; close: () => void}) {
  const [open, setOpen] = useState(node.active || node.key.endsWith('/status') || node.children.length === 0);
  useEffect(() => { if (node.active) setOpen(true); }, [node.active]);
  const icon = node.key.split('/')[1] || 'services';
  if (!node.children.length)
    return <a className={`nr-group-link ${node.active ? 'is-active' : ''}`} href={node.url} aria-current={node.active ? 'page' : undefined} onClick={close}><Icon name={icon}/>{node.title}</a>;
  return <section className="nr-nav-group">
    <button className={`nr-group-heading ${node.active ? 'is-current' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={`menu-${node.key.replaceAll('/', '-')}`}>
      <Icon name={icon}/><span>{node.title}</span><span className={open ? 'nr-chevron open' : 'nr-chevron'}><Icon name="arrow" size={14}/></span>
    </button>
    <div id={`menu-${node.key.replaceAll('/', '-')}`} hidden={!open} className="nr-nav-items">
      {node.children.map(child => <a key={child.key} className={child.active ? 'is-active' : ''} href={child.url} aria-current={child.active ? 'page' : undefined} onClick={close}><span className="nr-nav-dot"/>{child.title}</a>)}
    </div>
  </section>;
}
function Indicators() {
  const target = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const original = document.getElementById('indicators');
    if (original && target.current) target.current.appendChild(original);
  }, []);
  return <div className="nr-indicator-slot" ref={target}/>;
}
function App() {
  const [dark, setDark] = useColorMode();
  const [menu, setMenu] = useState<Bridge>(window.nradioMenu || {menu: [], title: '', breadcrumb: []});
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    const media = matchMedia('(max-width: 760px)');
    const changed = () => { setMobile(media.matches); if (!media.matches) setDrawer(false); };
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  const mobileNav = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { document.body.classList.toggle('nr-menu-ready', menu.menu.length > 0); }, [menu]);
  useEffect(() => {
    const update = () => setMenu(window.nradioMenu || {menu: [], title: '', breadcrumb: []});
    const keys = (e: KeyboardEvent) => {
      if (signedIn && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch(value => !value); }
      if (e.key === 'Escape') { setDrawer(false); menuButton.current?.focus(); }
    };
    window.addEventListener('nradio-menu', update);
    window.addEventListener('keydown', keys);
    document.body.classList.add('nr-ready');
    return () => { window.removeEventListener('nradio-menu', update); window.removeEventListener('keydown', keys); };
  }, []);
  useEffect(() => {
    document.body.classList.toggle('nr-menu-open', drawer);
    document.getElementById('maincontent')!.inert = drawer;
    if (drawer) mobileNav.current?.querySelector<HTMLElement>('button, a')?.focus();
    const trap = (event: KeyboardEvent) => {
      if (!drawer || event.key !== 'Tab') return;
      const items = Array.from(mobileNav.current?.querySelectorAll<HTMLElement>('a, button') || []).filter(el => el.getClientRects().length > 0);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [drawer]);
  const results = flatten(menu.menu).filter(({node, parents}) => `${parents.join(' ')} ${node.title}`.toLowerCase().includes(query.toLowerCase())).slice(0, 60);
  const toggleLabel = dark ? t('切换浅色模式', 'Use light mode') : t('切换深色模式', 'Use dark mode');
  return <Theme theme={neutralTheme} mode={dark ? 'dark' : 'light'}>
    {signedIn ? <>
      <aside id="nr-navigation" className={`nr-sidebar ${drawer ? 'is-open' : ''}`} inert={mobile && !drawer} ref={mobileNav} aria-label={t('主导航', 'Main navigation')}>
        <div className="nr-sidebar-brand"><a href={root.dataset.home || '/cgi-bin/luci/'} aria-label="NRadio"><Brand/></a><button className="nr-mobile-close" aria-label={t('关闭菜单', 'Close menu')} onClick={() => {setDrawer(false); menuButton.current?.focus();}}><Icon name="close"/></button></div>
        <div className="nr-workspace"><span className="nr-device-icon"><Icon name="system"/></span><span>{hostname}<small>C2000 Ultra</small></span><span className="nr-local-dot" title={t('本地管理', 'Local management')}/></div>
        <div className="nr-nav-caption">{t('设备管理', 'DEVICE MANAGEMENT')}</div>
        <nav>{menu.menu.map(node => <MenuGroup node={node} key={node.key} close={() => setDrawer(false)}/>)}</nav>
        {!menu.menu.length && <p className="nr-menu-message" role="status">{menu.error || t('正在加载管理菜单…', 'Loading navigation…')}</p>}
        <div className="nr-sidebar-bottom"><span className="nr-avatar">N</span><span>{t('本地管理会话', 'Local session')}<small>{t('配置与数据保存在设备上', 'Settings stay on your device')}</small></span></div>
      </aside>
      {drawer && <button className="nr-drawer-overlay" aria-label={t('关闭菜单', 'Close menu')} onClick={() => setDrawer(false)}/>}
      <header className="nr-topbar">
        <button ref={menuButton} className="nr-mobile-trigger" aria-label={t('打开菜单', 'Open menu')} aria-expanded={drawer} aria-controls="nr-navigation" onClick={() => setDrawer(!drawer)}><Icon name="menu"/></button>
        <div className="nr-breadcrumb"><span>{t('设备', 'Device')}</span><Icon name="arrow" size={12}/><strong>{menu.breadcrumb.join(' / ') || t('管理中心', 'Management')}</strong></div>
        <div className="nr-topbar-actions">
          <Button label={t('搜索设置', 'Search settings')} variant="ghost" icon={<Icon name="search" size={18}/>} onClick={() => setSearch(true)} size="sm"/>
          <span className="nr-key-hint">⌘ K</span>
          <Indicators/>
          <Button label={toggleLabel} variant="ghost" icon={<Icon name={dark ? 'sun' : 'moon'} size={18}/>} isIconOnly onClick={() => setDark(!dark)} size="sm"/>
        </div>
      </header>
      <Dialog isOpen={search} onOpenChange={setSearch} width={620}>
        <DialogHeader title={t('找到你需要的设置', 'Find a setting')} onOpenChange={setSearch}/>
        <div className="nr-search-body"><TextInput label={t('搜索全部管理页面', 'Search all management pages')} value={query} onChange={setQuery} placeholder={t('例如：无线、防火墙、5G…', 'Wireless, firewall, cellular…')} hasAutoFocus hasClear/>
          <div className="nr-search-results" aria-live="polite">
            {results.map(({node, parents}) => <a key={node.key} href={node.url}><span><strong>{node.title}</strong><small>{parents.join(' / ') || t('管理中心', 'Management')}</small></span><Icon name="arrow" size={16}/></a>)}
            {!results.length && <p>{t('没有匹配的设置。试试其他关键词。', 'No matching settings. Try a different keyword.')}</p>}
          </div>
        </div>
      </Dialog>
    </> : <>
      <div className="nr-login-brand"><Brand/></div>
      <div className="nr-login-hero"><span className="nr-eyebrow">NRADIO / NETWORK OS</span><h1>{t('每一处连接，', 'Every connection.')}<br/>{t('清晰可见。', 'Clearly in view.')}</h1><p>{t('从无线网络到 5G 蜂窝，在一个界面中掌握你的设备。', 'Wireless, cellular and your device — together in one place.')}</p><div className="nr-network-art" aria-hidden="true"><div className="nr-orbit orbit-one"/><div className="nr-orbit orbit-two"/><div className="nr-orbit orbit-three"/><span className="nr-art-core"><Icon name="network" size={54}/></span><span className="nr-art-label label-one">5G</span><span className="nr-art-label label-two">Wi-Fi 7</span><span className="nr-art-label label-three">2.5 GbE</span></div></div>
      <div className="nr-login-theme"><Button label={toggleLabel} variant="ghost" icon={<Icon name={dark ? 'sun' : 'moon'}/>} isIconOnly onClick={() => setDark(!dark)}/></div>
      <LoginAction/>
    </>}
  </Theme>;
}
function LoginAction() {
  const [target] = useState(() => {
    const submit = document.querySelector<HTMLInputElement>('#maincontent input[type="submit"]');
    if (!submit) return null;
    const host = document.createElement('div');
    host.className = 'nr-login-action';
    submit.after(host);
    submit.hidden = true;
    submit.tabIndex = -1;
    const username = document.querySelector<HTMLInputElement>('[name="luci_username"]');
    const password = document.querySelector<HTMLInputElement>('[name="luci_password"]');
    if (username) username.autocomplete = 'username';
    if (password) password.autocomplete = 'current-password';
    for (const input of [username, password]) {
      if (!input) continue;
      input.id ||= `nr-${input.name}`;
      const label = input.closest('.cbi-value')?.querySelector('label');
      if (label) label.htmlFor = input.id;
    }
    return host;
  });
  return target ? createPortal(<Button label={t('登录管理中心', 'Sign in')} variant="primary" type="submit" width="100%"/>, target) : null;
}
createRoot(root).render(<App/>);
