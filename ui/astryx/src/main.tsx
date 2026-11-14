import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Brand, Icon, flatten } from "./components";
import { Content } from "./content";
import { useNavigation } from "./useNavigation";
import {
  pageTab,
  routeHash,
  safePage,
  tabs,
  type Route,
  type Tab,
} from "./navigation";
import { root, t, base, titles, type Bridge, type MenuNode } from "./model";
import "./style.css";
const signedIn = root.dataset.authenticated === "1";
const hostname = root.dataset.hostname || "OpenWrt";
function useColorMode() {
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem("nradio-color-mode");
      if (saved) return saved === "dark";
    } catch {}
    return matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    document.documentElement.dataset.darkmode = String(dark);
    try {
      localStorage.setItem("nradio-color-mode", dark ? "dark" : "light");
    } catch {}
  }, [dark]);
  return [dark, setDark] as const;
}

function MenuGroup({
  node,
  selected,
  openPage,
}: {
  node: MenuNode;
  selected?: string;
  openPage: (node: MenuNode) => void;
}) {
  const active = selected?.startsWith(node.url);
  const [open, setOpen] = useState(!!active);
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);
  function link(event: React.MouseEvent, item: MenuNode) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    openPage(item);
  }
  if (!node.children.length)
    return (
      <a
        className="nr-group-link"
        href={node.url}
        onClick={(event) => link(event, node)}
      >
        <Icon name={node.key.split("/")[1]} />
        {node.title}
      </a>
    );
  return (
    <section className="nr-nav-group">
      <button
        className={`nr-group-heading ${active ? "is-current" : ""}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name={node.key.split("/")[1]} />
        <span>{node.title}</span>
        <span className={`nr-chevron ${open ? "open" : ""}`}>
          <Icon name="arrow" size={14} />
        </span>
      </button>
      <div className="nr-nav-items" hidden={!open}>
        {node.children.map((child) => (
          <a
            key={child.key}
            href={child.url}
            className={selected?.startsWith(child.url) ? "is-active" : ""}
            onClick={(event) => link(event, child)}
          >
            <span className="nr-nav-dot" />
            {child.title}
          </a>
        ))}
      </div>
    </section>
  );
}
function App() {
  const [dark, setDark] = useColorMode();
  const [menu, setMenu] = useState<Bridge>(
    window.nradioMenu || { menu: [], title: "", breadcrumb: [] },
  );
  const [search, setSearch] = useState(false),
    [query, setQuery] = useState("");
  const [title, setTitle] = useState(t("总览", "Home")),
    [dirty, setDirty] = useState(false);
  const router = useNavigation(signedIn);
  const scroll = useRef(new Map<string, number>()),
    tabRoutes = useRef<Partial<Record<Tab, Route>>>({});
  const { route } = router;
  useEffect(() => {
    tabRoutes.current[route.tab] = route;
  }, [route]);
  useEffect(() => {
    const update = () =>
      setMenu(window.nradioMenu || { menu: [], title: "", breadcrumb: [] });
    const openSearch = () => setSearch(true);
    const keys = (event: KeyboardEvent) => {
      if (
        signedIn &&
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setSearch((value) => !value);
      }
    };
    addEventListener("nradio-menu", update);
    addEventListener("keydown", keys);
    addEventListener("nradio-search", openSearch);
    document.body.classList.add("nr-ready");
    if (signedIn) document.body.classList.add("nr-spa");
    return () => {
      removeEventListener("nradio-menu", update);
      removeEventListener("keydown", keys);
      removeEventListener("nradio-search", openSearch);
    };
  }, []);
  useEffect(() => {
    document.body.classList.toggle("nr-menu-ready", menu.menu.length > 0);
  }, [menu]);
  function navigate(next: Route) {
    if (next.page) {
      const safe = safePage(next.page, base);
      if (!safe) return;
      next = { ...next, page: safe };
      if (/\/logout\/?(?:[?#]|$)/.test(safe)) {
        router.guard(() => {
          location.assign(safe);
        });
        return;
      }
    }
    setSearch(false);
    router.navigate(next);
  }
  function openPage(node: MenuNode) {
    navigate({ tab: pageTab(node.url), page: node.url });
  }
  function selectTab(tab: Tab) {
    navigate(tab === route.tab ? { tab } : tabRoutes.current[tab] || { tab });
  }
  const results = flatten(menu.menu)
    .filter(({ node, parents }) =>
      `${parents.join(" ")} ${node.title}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .slice(0, 60);
  const toggleLabel = dark
    ? t("切换浅色模式", "Use light mode")
    : t("切换深色模式", "Use dark mode");
  return (
    <Theme theme={neutralTheme} mode={dark ? "dark" : "light"}>
      {signedIn ? (
        <>
          <aside
            className="nr-sidebar"
            aria-label={t("主导航", "Main navigation")}
          >
            <div className="nr-sidebar-brand">
              <a
                href="#tab=overview"
                onClick={(event) => {
                  event.preventDefault();
                  navigate({ tab: "overview" });
                }}
              >
                <Brand />
              </a>
            </div>
            <div className="nr-workspace">
              <span className="nr-device-icon">
                <Icon name="system" />
              </span>
              <span>
                {hostname}
                <small>{root.dataset.model || "C2000 Ultra"}</small>
              </span>
              <span className="nr-local-dot" />
            </div>
            <div className="nr-nav-caption">{t("管理中心", "MANAGEMENT")}</div>
            <nav>
              <div className="nr-desktop-tabs">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    className={route.tab === tab ? "is-active" : ""}
                    onClick={() => selectTab(tab)}
                  >
                    <Icon name={tab} />
                    {titles[tab]}
                  </button>
                ))}
              </div>
              <div className="nr-nav-caption nr-all-settings">
                {t("全部设置", "ALL SETTINGS")}
              </div>
              {menu.menu.map((node) => (
                <MenuGroup
                  key={node.key}
                  node={node}
                  selected={route.page}
                  openPage={openPage}
                />
              ))}
            </nav>
            {!menu.menu.length && (
              <p className="nr-menu-message" role="status">
                {menu.error || t("正在加载管理菜单…", "Loading navigation…")}
              </p>
            )}
            <div className="nr-sidebar-bottom">
              <span className="nr-avatar">N</span>
              <span>
                {t("本地管理会话", "Local session")}
                <small>
                  {t("配置与数据保存在设备上", "Settings stay on your device")}
                </small>
              </span>
            </div>
          </aside>
          <header className="nr-topbar">
            <div className="nr-page-title">
              {route.page ? (
                <button
                  className="nr-back"
                  aria-label={t("返回", "Back")}
                  onClick={() => router.back()}
                >
                  <Icon name="back" />
                </button>
              ) : (
                <span className="nr-mobile-mark" aria-hidden="true">
                  n
                </span>
              )}
              <div>
                <small>{hostname}</small>
                <strong>{route.page ? title : titles[route.tab]}</strong>
              </div>
            </div>
            <div className="nr-topbar-actions">
              {dirty && (
                <span className="nr-dirty-badge">{t("未保存", "Unsaved")}</span>
              )}
              <Button
                label={t("搜索设置", "Search settings")}
                variant="ghost"
                icon={<Icon name="search" />}
                isIconOnly
                onClick={() => setSearch(true)}
              />
              <Button
                label={toggleLabel}
                variant="ghost"
                icon={<Icon name={dark ? "sun" : "moon"} />}
                isIconOnly
                onClick={() => setDark(!dark)}
              />
            </div>
          </header>
          <nav
            className="nr-bottom-tabs"
            aria-label={t("底部导航", "Tab navigation")}
          >
            {tabs.map((tab) => (
              <a
                key={tab}
                href={routeHash({ tab })}
                aria-current={route.tab === tab ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  selectTab(tab);
                }}
              >
                <span className="nr-tab-icon">
                  <Icon name={tab} size={23} />
                </span>
                <span>{titles[tab]}</span>
              </a>
            ))}
          </nav>
          {createPortal(
            !window.nradioMenu ? (
              <div className="nr-empty" role="status">
                {t("正在加载管理菜单…", "Loading navigation…")}
              </div>
            ) : menu.error ? (
              <div className="nr-empty" role="alert">
                <p>{menu.error}</p>
                <Button
                  label={t("重新加载", "Reload")}
                  onClick={() => location.reload()}
                />
              </div>
            ) : (
              <Content
                route={route}
                menu={menu.menu}
                dark={dark}
                navigate={navigate}
                onTitle={setTitle}
                scroll={scroll.current}
                onState={(state) => {
                  setDirty(state.dirty);
                  router.setPageState(state);
                }}
              />
            ),
            document.getElementById("maincontent")!,
          )}
          {router.blocked && (
            <div className="nr-nav-notice" role="status">
              {t(
                "请先完成或关闭当前操作，再切换页面。",
                "Complete or close the current operation before switching pages.",
              )}
              <button
                onClick={() => router.setBlocked(false)}
                aria-label={t("关闭提示", "Dismiss")}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
          <Dialog isOpen={search} onOpenChange={setSearch} width={620}>
            <DialogHeader
              title={t("找到你需要的设置", "Find a setting")}
              onOpenChange={setSearch}
            />
            <div className="nr-search-body">
              <TextInput
                label={t("搜索全部管理页面", "Search all management pages")}
                value={query}
                onChange={setQuery}
                placeholder={t(
                  "例如：无线、防火墙、5G…",
                  "Wireless, firewall, cellular…",
                )}
                hasAutoFocus
                hasClear
              />
              <div className="nr-search-results" aria-live="polite">
                {results.map(({ node, parents }) => (
                  <a
                    key={node.key}
                    href={node.url}
                    onClick={(event) => {
                      if (
                        event.ctrlKey ||
                        event.metaKey ||
                        event.shiftKey ||
                        event.altKey
                      )
                        return;
                      event.preventDefault();
                      openPage(node);
                    }}
                  >
                    <span>
                      <strong>{node.title}</strong>
                      <small>
                        {parents.join(" / ") || t("管理中心", "Management")}
                      </small>
                    </span>
                    <Icon name="arrow" size={16} />
                  </a>
                ))}
                {!results.length && (
                  <p>
                    {t(
                      "没有匹配的设置。试试其他关键词。",
                      "No matching settings. Try another keyword.",
                    )}
                  </p>
                )}
              </div>
            </div>
          </Dialog>
          <Dialog
            isOpen={!!router.pending}
            onOpenChange={(open) => {
              if (!open) router.cancel();
            }}
            width={420}
          >
            <DialogHeader
              title={t("离开当前设置？", "Leave these settings?")}
              onOpenChange={(open) => {
                if (!open) router.cancel();
              }}
            />
            <p className="nr-confirm-copy">
              {t(
                "当前页面有尚未保存的输入。离开后这些输入将丢失；已经保存到设备的配置不会被撤销。",
                "Unsaved inputs on this page will be lost. Configuration already saved to the device is unaffected.",
              )}
            </p>
            <div className="nr-confirm-actions">
              <Button
                label={t("继续编辑", "Keep editing")}
                variant="secondary"
                onClick={router.cancel}
              />
              <Button
                label={t("放弃输入并离开", "Discard and leave")}
                variant="primary"
                onClick={router.discard}
              />
            </div>
          </Dialog>
        </>
      ) : (
        <>
          <div className="nr-login-brand">
            <Brand />
          </div>
          <div className="nr-login-hero">
            <span className="nr-eyebrow">NRADIO / NETWORK OS</span>
            <h1>
              {t("每一处连接，", "Every connection.")}
              <br />
              {t("清晰可见。", "Clearly in view.")}
            </h1>
            <p>
              {t(
                "从无线网络到 5G 蜂窝，在一个界面中掌握你的设备。",
                "Wireless, cellular and your device — together in one place.",
              )}
            </p>
            <div className="nr-network-art" aria-hidden="true">
              <div className="nr-orbit orbit-one" />
              <div className="nr-orbit orbit-two" />
              <div className="nr-orbit orbit-three" />
              <span className="nr-art-core">
                <Icon name="network" size={54} />
              </span>
              <span className="nr-art-label label-one">5G</span>
              <span className="nr-art-label label-two">Wi-Fi 7</span>
              <span className="nr-art-label label-three">2.5 GbE</span>
            </div>
          </div>
          <div className="nr-login-theme">
            <Button
              label={toggleLabel}
              variant="ghost"
              icon={<Icon name={dark ? "sun" : "moon"} />}
              isIconOnly
              onClick={() => setDark(!dark)}
            />
          </div>
          <LoginAction />
        </>
      )}
    </Theme>
  );
}
function LoginAction() {
  const [target] = useState(() => {
    const submit = document.querySelector<HTMLInputElement>(
      '#maincontent input[type="submit"]',
    );
    if (!submit) return null;
    const host = document.createElement("div");
    host.className = "nr-login-action";
    submit.after(host);
    submit.hidden = true;
    submit.tabIndex = -1;
    const username = document.querySelector<HTMLInputElement>(
      '[name="luci_username"]',
    );
    const password = document.querySelector<HTMLInputElement>(
      '[name="luci_password"]',
    );
    if (username) username.autocomplete = "username";
    if (password) password.autocomplete = "current-password";
    for (const input of [username, password]) {
      if (!input) continue;
      input.id ||= `nr-${input.name}`;
      const label = input.closest(".cbi-value")?.querySelector("label");
      if (label) label.htmlFor = input.id;
    }
    return host;
  });
  return target
    ? createPortal(
        <Button
          label={t("登录管理中心", "Sign in")}
          variant="primary"
          type="submit"
          width="100%"
        />,
        target,
      )
    : null;
}
createRoot(root).render(<App />);
