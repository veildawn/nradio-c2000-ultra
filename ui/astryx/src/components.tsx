import React from "react";
import type { MenuNode } from "./model";
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    overview: (
      <>
        <path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z" />
      </>
    ),
    cellular: (
      <>
        <path d="M4 19v-3m5 3v-7m5 7V8m5 11V4" />
      </>
    ),
    apps: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <path d="M17.5 14v7M14 17.5h7" />
      </>
    ),
    back: <path d="m14 5-7 7 7 7" />,
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    moon: <path d="M20 14a8 8 0 0 1-10-10 8.5 8.5 0 1 0 10 10Z" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </>
    ),
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    arrow: <path d="m9 6 6 6-6 6" />,
    status: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    network: (
      <>
        <path d="M3 8a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0m-9 4a4 4 0 0 1 6 0" />
        <circle cx="12" cy="20" r=".7" />
      </>
    ),
    system: (
      <>
        <rect x="4" y="4" width="16" height="12" rx="2" />
        <path d="M8 21h8m-4-5v5" />
      </>
    ),
    services: (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 5 9 5 9-5" />
      </>
    ),
    logout: (
      <>
        <path d="M9 3H4v18h5m6-14 5 5-5 5M8 12h12" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.services}
    </svg>
  );
}

export function Brand() {
  return (
    <span className="nr-brand">
      <span className="nr-symbol" aria-hidden="true">
        n<span>▹</span>
      </span>
      <span>
        NRadio<small>NETWORK OS</small>
      </span>
    </span>
  );
}
export function flatten(
  menu: MenuNode[],
  parents: string[] = [],
): { node: MenuNode; parents: string[] }[] {
  return menu.flatMap((node) => [
    { node, parents },
    ...flatten(node.children, [...parents, node.title]),
  ]);
}
