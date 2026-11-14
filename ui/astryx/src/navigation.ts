export type Tab = "overview" | "network" | "cellular" | "apps" | "system";
export type Route = { tab: Tab; page?: string };
export const tabs: Tab[] = [
  "overview",
  "network",
  "cellular",
  "apps",
  "system",
];
export function pageTab(page: string): Tab {
  if (/\/nradio\/modem|\/network\/(?:modem|cellular)/.test(page))
    return "cellular";
  if (/\/network(?:\/|$)/.test(page)) return "network";
  if (/\/system(?:\/|$)|\/logout(?:\/|$)/.test(page)) return "system";
  if (/\/status(?:\/|$)/.test(page)) return "overview";
  return "apps";
}
export function parseRoute(hash: string): Route {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const page = params.get("page") || undefined;
  const selected = params.get("tab") as Tab;
  return {
    tab: tabs.includes(selected) ? selected : page ? pageTab(page) : "overview",
    page,
  };
}
export function routeHash(route: Route) {
  const params = new URLSearchParams({ tab: route.tab });
  if (route.page) params.set("page", route.page);
  return "#" + params.toString();
}
export function safePage(page: string, base: string): string | undefined {
  try {
    const url = new URL(page, location.href);
    if (
      document.getElementById("astryx-chrome")?.dataset.preview === "1" &&
      url.origin === location.origin &&
      url.pathname === "/ui/astryx/preview-page.html"
    )
      return url.pathname + url.search + url.hash;
    const roots = new Set([
      "admin",
      ...(window.nradioMenu?.menu || []).map((node) => node.key.split("/")[0]),
    ]);
    const prefix = base.replace(/\/$/, "");
    if (
      url.origin !== location.origin ||
      !Array.from(roots).some(
        (controller) =>
          url.pathname === `${prefix}/${controller}` ||
          url.pathname.startsWith(`${prefix}/${controller}/`),
      ) ||
      /\/astryx\/?$/.test(url.pathname)
    )
      return;
    return url.pathname + url.search + url.hash;
  } catch {
    return;
  }
}
