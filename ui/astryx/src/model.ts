export type MenuNode = {
  title: string;
  url: string;
  key: string;
  active: boolean;
  children: MenuNode[];
};
export type Bridge = {
  menu: MenuNode[];
  title: string;
  breadcrumb: string[];
  error?: string;
};
export type DeviceStatus = {
  board: {
    hostname?: string;
    model?: string;
    release?: { description?: string };
  } | null;
  info: {
    uptime?: number;
    memory?: { total?: number; free?: number; available?: number };
    load?: number[];
  } | null;
  interfaces:
    | {
        interface: string;
        up: boolean;
        proto?: string;
        ["ipv4-address"]?: { address: string; mask: number }[];
      }[]
    | null;
};
declare global {
  interface Window {
    nradioMenu?: Bridge;
    nradioReadStatus?: () => Promise<DeviceStatus>;
  }
}
export const root = document.getElementById("astryx-chrome")!;
export const zh = document.documentElement.lang.toLowerCase().startsWith("zh");
export const t = (cn: string, en: string) => (zh ? cn : en);
export const base = root.dataset.base || "/cgi-bin/luci";
export const titles = {
  overview: t("总览", "Home"),
  network: t("网络", "Network"),
  cellular: "5G",
  apps: t("应用", "Apps"),
  system: t("系统", "System"),
};
