"use client";

import { useEffect, useState } from "react";

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  complete: boolean;
};

function getTimeLeft(startsAt: string): TimeLeft {
  const difference = Math.max(0, new Date(startsAt).getTime() - Date.now());

  return {
    days: Math.floor(difference / 86_400_000),
    hours: Math.floor((difference / 3_600_000) % 24),
    minutes: Math.floor((difference / 60_000) % 60),
    seconds: Math.floor((difference / 1_000) % 60),
    complete: difference === 0,
  };
}

export default function Par3Countdown({ startsAt }: { startsAt: string }) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(startsAt));

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimeLeft(getTimeLeft(startsAt));
    }, 1_000);

    return () => window.clearInterval(interval);
  }, [startsAt]);

  if (timeLeft.complete) {
    return <p className="par3-countdown-live">Event underway</p>;
  }

  return (
    <div className="par3-countdown" aria-label="Time until the Par 3 Championship">
      {[
        [timeLeft.days, "Days"],
        [timeLeft.hours, "Hours"],
        [timeLeft.minutes, "Mins"],
        [timeLeft.seconds, "Secs"],
      ].map(([value, label]) => (
        <div key={String(label)}>
          <strong>{String(value).padStart(2, "0")}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
