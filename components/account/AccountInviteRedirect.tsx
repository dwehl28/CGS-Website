"use client";

import { useEffect } from "react";

export default function AccountInviteRedirect() {
  useEffect(() => {
    if (window.location.pathname.replace(/\/$/, "") === "/account/setup") return;

    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const type = fragment.get("type") ?? query.get("type");
    const expired = [fragment, query].some((params) => params.get("error_code") === "otp_expired");
    if (type !== "invite" && type !== "recovery" && !expired) return;

    const setupQuery = new URLSearchParams();
    for (const key of ["type", "error", "error_code", "error_description"]) {
      const value = query.get(key);
      if (value !== null) setupQuery.set(key, value);
    }
    const search = setupQuery.size ? `?${setupQuery.toString()}` : "";
    window.location.replace(`/account/setup${search}${window.location.hash}`);
  }, []);

  return null;
}
