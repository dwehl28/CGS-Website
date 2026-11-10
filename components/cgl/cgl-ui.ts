"use client";

import { useEffect, useState } from "react";

export type CglRow = Record<string, unknown>;
export type CglSnapshot = {
  status?: string;
  message?: string;
  [key: string]: unknown;
};
export function rows(value: unknown): CglRow[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is CglRow =>
          !!item && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}
export function row(value: unknown): CglRow {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as CglRow)
    : {};
}
export function str(value: unknown, fallback = "—"): string {
  return typeof value === "string" && value
    ? value
    : typeof value === "number"
      ? String(value)
      : fallback;
}
export function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
export function aud(cents: unknown): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: num(cents) % 100 ? 2 : 0,
  }).format(num(cents) / 100);
}
export function date(value: unknown, withTime = false): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    return "To be confirmed";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime
      ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" }
      : {}),
    timeZone: "Australia/Brisbane",
  }).format(new Date(value));
}
export function playerName(result: CglRow): string {
  return str(
    result.sgt_username ??
      result.username ??
      row(result.member).sgt_username ??
      result.player,
    "Player",
  );
}
export function availableWeek(week: CglRow): boolean {
  const now = Date.now();
  return (
    ["published", "open"].includes(str(week.status, "")) &&
    typeof week.opens_at === "string" &&
    Date.parse(week.opens_at) <= now &&
    typeof week.closes_at === "string" &&
    Date.parse(week.closes_at) > now
  );
}
export function useCglPublic(enabled = true) {
  const [data, setData] = useState<CglSnapshot>({ status: "loading" });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch("/api/cgl/public", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const value = await response.json();
        setData(
          response.ok || value.status === "setup_required"
            ? value
            : {
                status: "error",
                message:
                  "League information could not be loaded. Please try again.",
              },
        );
      })
      .catch((error) => {
        if (error.name !== "AbortError")
          setData({
            status: "error",
            message:
              "League information could not be loaded. Please try again.",
          });
      });
    return () => controller.abort();
  }, [enabled]);
  return data;
}
