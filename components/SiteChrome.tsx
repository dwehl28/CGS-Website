"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

type SiteChromeProps = {
  children: ReactNode;
};

function isStreamAssetPath(pathname: string) {
  return (
    /^\/scoreboard\/[^/]+\/(?:stream|banner)\/?$/.test(pathname) ||
    /^\/stream\/ambrose\/[^/]+\/leaderboard\/?$/.test(pathname) ||
    /^\/stream\/ambrose\/[^/]+\/player\/[^/]+\/?$/.test(pathname) ||
    /^\/stream\/brackets\/[^/]+\/?$/.test(pathname) ||
    /^\/stream\/par3-showdown\/?$/.test(pathname)
  );
}

export default function SiteChrome({ children }: SiteChromeProps) {
  const pathname = usePathname();
  const isStreamAsset = isStreamAssetPath(pathname);

  if (isStreamAsset) {
    return <div className="site-shell stream-shell">{children}</div>;
  }

  if (pathname.startsWith("/clubhouse-admin")) {
    return <div className="site-shell admin-shell">{children}</div>;
  }

  return (
    <div className="site-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <SiteHeader />
      <div id="main-content">{children}</div>
      <SiteFooter />
    </div>
  );
}
