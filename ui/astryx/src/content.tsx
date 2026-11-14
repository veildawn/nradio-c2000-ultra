import { useEffect, useRef, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Icon, flatten } from "./components";
import {
  base,
  root,
  t,
  titles,
  type MenuNode,
  type DeviceStatus,
} from "./model";
import { pageTab, safePage, type Route } from "./navigation";

type Props = {
  route: Route;
  menu: MenuNode[];
  dark: boolean;
  navigate: (route: Route) => void;
  onState: (state: { dirty: boolean; busy: boolean }) => void;
  onTitle: (title: string) => void;
  scroll: Map<string, number>;
};
export function Content(props: Props) {
  const { route, menu } = props;
  const all = flatten(menu).map(({ node }) => node);
  const cell = all.find((node) => pageTab(node.url) === "cellular");
  const page = route.page || (route.tab === "cellular" ? cell?.url : undefined);
  if (page) {
    const safe = safePage(page, base);
    return safe ? (
      <ManagedPage key={safe} {...props} page={safe} />
    ) : (
      <div className="nr-empty" role="alert">
        {t(
          "该页面地址不可用。请从底部导航重新选择。",
          "This page address is unavailable. Choose a page from navigation.",
        )}
      </div>
    );
  }
  if (route.tab === "cellular")
    return (
      <div className="nr-empty">
        <Icon name="cellular" size={36} />
        <h2>{t("暂无蜂窝管理入口", "Cellular management unavailable")}</h2>
        <p>
          {t(
            "当前账户或设备没有可用的蜂窝管理页面。",
            "No cellular management page is available to this account or device.",
          )}
        </p>
      </div>
    );
  return <Hub key={route.tab} {...props} />;
}

function useDeviceStatus(enabled: boolean, menu: MenuNode[]) {
  const [data, setData] = useState<DeviceStatus | null>(null),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true,
      timer: ReturnType<typeof setTimeout> | undefined,
      running = false;
    async function read() {
      if (!alive || running || document.hidden) return;
      running = true;
      try {
        if (!window.nradioReadStatus) throw new Error("Status unavailable");
        const next = await window.nradioReadStatus();
        if (alive) {
          setData(next);
          setError(!next.board && !next.info && !next.interfaces);
        }
      } catch {
        if (alive) {
          setData(null);
          setError(true);
        }
      } finally {
        running = false;
        if (alive) {
          setLoading(false);
          timer = setTimeout(read, 15000);
        }
      }
    }
    function visibility() {
      if (!document.hidden) {
        clearTimeout(timer);
        void read();
      }
    }
    void read();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [enabled, menu, revision]);
  return {
    data,
    loading,
    error,
    refresh: () => {
      setLoading(true);
      setRevision((value) => value + 1);
    },
  };
}

const descriptions: Record<string, [string, string]> = {
  network: ["接口、地址与连接方式", "Interfaces, addresses and connections"],
  wireless: [
    "Wi-Fi 名称、安全与无线设备",
    "Wi-Fi, security and wireless devices",
  ],
  cellular: ["SIM、信号与蜂窝上网", "SIM, signal and cellular access"],
  dhcp: ["地址分配与域名解析", "Address allocation and DNS"],
  firewall: ["区域、规则与端口转发", "Zones, rules and port forwarding"],
  apps: ["应用访问统计与限制", "Application activity and access control"],
  routing: ["静态路由与路由规则", "Static routes and routing rules"],
  system: ["设备、时间与语言", "Device, time and language"],
  admin: ["密码与管理权限", "Password and access"],
  flash: ["备份、恢复与固件", "Backup, restore and firmware"],
  package_manager: ["管理设备上的软件包", "Manage installed packages"],
  fwupdate: ["检查、下载与安装更新", "Check, download and install updates"],
  bootswitch: ["选择下次启动的系统", "Choose the next boot system"],
  overview: ["查看完整设备状态", "View detailed device status"],
  realtime: ["流量、负载与连接", "Traffic, load and connections"],
  syslog: ["查看系统运行日志", "View system logs"],
  reboot: ["重新启动设备", "Restart this device"],
  logout: ["结束当前管理会话", "End the current session"],
};
function description(node: MenuNode) {
  const pair = descriptions[node.key.split("/").at(-1) || ""];
  return pair ? t(...pair) : t("打开管理页面", "Open management page");
}

function Hub({ route, menu, navigate, scroll, onTitle, onState }: Props) {
  const status = useDeviceStatus(
    route.tab === "overview" || route.tab === "network",
    menu,
  );
  const viewport = useRef<HTMLDivElement>(null);
  const { data, loading, error } = status;
  const groups = menu.filter((node) => {
    if (route.tab === "overview") return node.key === "admin/status";
    if (route.tab === "network") return node.key === "admin/network";
    if (route.tab === "system")
      return node.key === "admin/system" || node.key === "admin/logout";
    return ![
      "admin/status",
      "admin/network",
      "admin/system",
      "admin/logout",
    ].includes(node.key);
  });
  useEffect(() => {
    onTitle(titles[route.tab]);
    onState({ dirty: false, busy: false });
    if (viewport.current)
      viewport.current.scrollTop = scroll.get(route.tab) || 0;
  }, []);
  const interfaces =
    data?.interfaces?.filter((item) => item.interface !== "loopback") || [];
  const up = interfaces.filter((item) => item.up).length;
  const uptime = data?.info?.uptime;
  const memory = data?.info?.memory;
  const used =
    memory?.total && (memory.available ?? memory.free) != null
      ? Math.round(
          (1 - (memory.available ?? memory.free!) / memory.total) * 100,
        )
      : null;
  function link(node: MenuNode) {
    navigate({ tab: pageTab(node.url), page: node.url });
  }
  return (
    <div
      className="nr-hub"
      ref={viewport}
      onScroll={(event) => scroll.set(route.tab, event.currentTarget.scrollTop)}
    >
      {root.dataset.preview && (
        <p className="nr-preview-note">
          {t(
            "界面预览 · 演示数据，操作仅作用于本地预览",
            "Preview · demo data; actions only affect this preview",
          )}
        </p>
      )}
      <div className="nr-hub-heading">
        <div>
          <h1>
            {route.tab === "overview"
              ? t("设备总览", "Device overview")
              : titles[route.tab]}
          </h1>
          <p>
            {route.tab === "overview"
              ? t(
                  "连接状态与设备资源",
                  "Connections and device resources",
                )
              : route.tab === "network"
                ? t(
                    "接口、无线与访问规则",
                    "Interfaces, wireless and access rules",
                  )
                : route.tab === "system"
                  ? t(
                      "设备配置、固件与维护",
                      "Device configuration, firmware and maintenance",
                    )
                  : t("已安装的服务与插件", "Installed services and plugins")}
          </p>
        </div>
        {(route.tab === "overview" || route.tab === "network") && (
          <Button
            label={t("刷新设备状态", "Refresh device status")}
            variant="ghost"
            isIconOnly
            icon={<Icon name="refresh" />}
            onClick={status.refresh}
            isDisabled={loading}
          />
        )}
      </div>
      {(route.tab === "overview" || route.tab === "network") && (
        <>
          <section className="nr-connection-card" aria-live="polite">
            <div className="nr-connection-icon">
              <Icon name="ethernet" size={24} />
            </div>
            <div>
              <span>{t("网络接口", "Network interfaces")}</span>
              <h2>
                {loading
                  ? t("正在读取…", "Loading…")
                  : error
                    ? t("暂时无法读取", "Status unavailable")
                    : data?.interfaces
                      ? t(`${up} 个接口已连接`, `${up} interfaces up`)
                      : t("无接口读取权限", "Interface status unavailable")}
              </h2>
              <p>{data?.board?.model || root.dataset.model || "NRadio"}</p>
            </div>
            <span
              aria-hidden="true"
              className={`nr-status-dot ${up ? "is-online" : ""}`}
            />
          </section>
          {error && (
            <p className="nr-inline-error" role="status">
              {t(
                "设备状态读取失败，可稍后重试；管理入口仍可使用。",
                "Could not read device status. Retry later; management pages remain available.",
              )}
            </p>
          )}
          {route.tab === "overview" && (
            <div className="nr-metrics">
              <article>
                <span>{t("运行时间", "Uptime")}</span>
                <strong>
                  {uptime == null
                    ? "—"
                    : uptime >= 86400
                      ? `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h`
                      : `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`}
                </strong>
              </article>
              <article>
                <span>{t("内存使用", "Memory used")}</span>
                <strong>{used == null ? "—" : `${used}%`}</strong>
              </article>
              <article>
                <span>{t("系统负载", "System load")}</span>
                <strong>
                  {data?.info?.load?.length
                    ? (data.info.load[0] / 65536).toFixed(2)
                    : "—"}
                </strong>
              </article>
            </div>
          )}
          {interfaces.length > 0 && (
            <section className="nr-interface-list">
              <h2>{t("当前连接", "Connections")}</h2>
              <div className="nr-interface-rows">
                {interfaces.map((item) => (
                  <div key={item.interface}>
                    <span className="nr-setting-icon">
                      <Icon
                        name={
                          item.interface.startsWith("wwan")
                            ? "cellular"
                            : "ethernet"
                        }
                      />
                    </span>
                    <span>
                      <strong>{item.interface.toUpperCase()}</strong>
                      <small>
                        {item["ipv4-address"]?.[0]?.address ||
                          t("无 IPv4 地址", "No IPv4 address")}
                      </small>
                    </span>
                    <span
                      className={`nr-connection-label ${item.up ? "is-online" : ""}`}
                    >
                      {item.up ? t("已连接", "Up") : t("未连接", "Down")}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
      {groups.map((group) => (
        <section
          className="nr-settings-section"
          key={group.key}
          aria-label={group.title}
        >
          {group.title !== titles[route.tab] && <h2>{group.title}</h2>}
          <div className="nr-setting-list">
            {(group.children.length ? group.children : [group]).map((node) => (
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
                  link(node);
                }}
              >
                <span>
                  <strong>{node.title}</strong>
                  <small>{description(node)}</small>
                </span>
                <Icon name="arrow" size={18} />
              </a>
            ))}
          </div>
        </section>
      ))}
      {!groups.length && route.tab === "apps" && (
        <div className="nr-empty">
          <Icon name="apps" size={36} />
          <h2>{t("应用会出现在这里", "Your apps appear here")}</h2>
          <p>
            {t(
              "已安装且当前账户有权访问的插件会自动加入。",
              "Installed plugins accessible to this account appear automatically.",
            )}
          </p>
        </div>
      )}
      <p className="nr-hub-footer">
        NRadio · {root.dataset.version || "OpenWrt"}
      </p>
    </div>
  );
}

function ManagedPage(props: Props & { page: string }) {
  const { page, dark, scroll } = props;
  const frame = useRef<HTMLIFrameElement>(null),
    latest = useRef(props);
  latest.current = props;
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setLoading(true);
    setError(false);
    props.onState({ dirty: false, busy: false });
    props.onTitle(
      flatten(props.menu).find(({ node }) => node.url === page)?.node.title ||
        titles[props.route.tab],
    );
    const timeout = setTimeout(() => {
      setLoading(false);
      setError(true);
    }, 15000);
    function message(event: MessageEvent) {
      if (
        event.origin !== location.origin ||
        event.source !== frame.current?.contentWindow ||
        !event.data
      )
        return;
      const data = event.data,
        current = latest.current;
      if (data.type === "nradio:ready") {
        clearTimeout(timeout);
        setLoading(false);
        setError(false);
        if (typeof data.title === "string") current.onTitle(data.title);
        frame.current?.contentWindow?.postMessage(
          { type: "nradio:restore", y: scroll.get(page) || 0 },
          location.origin,
        );
        frame.current?.contentWindow?.postMessage(
          { type: "nradio:theme", dark: current.dark },
          location.origin,
        );
      }
      if (data.type === "nradio:state")
        current.onState({
          dirty: data.dirty === true,
          busy: data.busy === true,
        });
      if (data.type === "nradio:search")
        dispatchEvent(new Event("nradio-search"));
      if (data.type === "nradio:reconnect" && typeof data.url === "string") {
        try {
          const url = new URL(data.url);
          if (
            ["http:", "https:"].includes(url.protocol) &&
            !url.username &&
            !url.password
          ) {
            current.onState({ dirty: false, busy: false });
            location.assign(url.origin + "/");
          }
        } catch {
          /* Ignore invalid reconnect targets. */
        }
      }
      if (data.type === "nradio:scroll" && Number.isFinite(data.y))
        scroll.set(page, Math.max(0, data.y));
      if (data.type === "nradio:navigate" && typeof data.url === "string") {
        const target = safePage(data.url, base);
        if (target) current.navigate({ tab: pageTab(target), page: target });
      }
      if (data.type === "nradio:auth") {
        // Reauthenticate at the shell URL so login is never trapped in a frame.
        current.onState({ dirty: false, busy: false });
        location.reload();
      }
    }
    addEventListener("message", message);
    return () => {
      clearTimeout(timeout);
      removeEventListener("message", message);
    };
  }, [page, attempt]);
  useEffect(() => {
    frame.current?.contentWindow?.postMessage(
      { type: "nradio:theme", dark },
      location.origin,
    );
  }, [dark]);
  return (
    <div className="nr-managed-page" aria-busy={loading}>
      {loading && (
        <div className="nr-page-loading" role="status">
          <span className="nr-spinner" />
          {t("正在打开设置…", "Opening settings…")}
        </div>
      )}
      {error && (
        <div className="nr-page-error" role="alert">
          <p>
            {t(
              "页面响应较慢或无法加载。",
              "The page is slow or could not load.",
            )}
          </p>
          <Button
            label={t("重试", "Retry")}
            onClick={() => setAttempt((value) => value + 1)}
          />
        </div>
      )}
      <iframe
        key={attempt}
        ref={frame}
        src={page}
        title={t("设备管理详情", "Device management details")}
        onLoad={() => {
          frame.current?.contentWindow?.postMessage(
            { type: "nradio:hello" },
            location.origin,
          );
          try {
            if (
              !frame.current?.contentDocument?.getElementById("astryx-chrome")
            ) {
              const document = frame.current?.contentDocument;
              if (
                document?.getElementById("maincontent") &&
                document.querySelector('script[src*="/luci.js"]')
              ) {
                latest.current.onState({ dirty: false, busy: false });
                location.assign(frame.current!.contentWindow!.location.href);
                return;
              }
              setLoading(false);
              setError(true);
            }
          } catch {
            setLoading(false);
            setError(true);
          }
        }}
      />
    </div>
  );
}
