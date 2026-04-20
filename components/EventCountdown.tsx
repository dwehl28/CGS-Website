"use client";

import { useEffect, useMemo, useState } from "react";

type EventCountdownProps = {
  startDate: string;
  endDate?: string;
  className?: string;
};

function getCountdownLabel(startDate: string, endDate?: string, now = new Date()) {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : undefined;

  if (Number.isNaN(start.getTime())) {
    return "Date TBC";
  }

  if (end && now >= start && now <= end) {
    return "Happening now";
  }

  if (now < start) {
    const diffMs = start.getTime() - now.getTime();
    const totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;

    if (days > 0) {
      return `${days} day${days === 1 ? "" : "s"} to go`;
    }

    return `${hours} hour${hours === 1 ? "" : "s"} to go`;
  }

  return "Completed";
}

export default function EventCountdown({
  startDate,
  endDate,
  className = "",
}: EventCountdownProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  const label = useMemo(
    () => getCountdownLabel(startDate, endDate, now),
    [endDate, now, startDate]
  );

  return (
    <div
      className={`inline-flex items-center rounded-full border border-[rgba(92,210,255,0.26)] bg-[rgba(92,210,255,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] ${className}`}
    >
      {label}
    </div>
  );
}
