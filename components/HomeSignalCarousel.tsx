"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SpotlightItem = {
  key: string;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  highlights: string[];
};

type HomeSignalCarouselProps = {
  items: SpotlightItem[];
};

export default function HomeSignalCarousel({
  items,
}: HomeSignalCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length);
    }, 6500);

    return () => window.clearInterval(timer);
  }, [items.length]);

  const activeItem = items[activeIndex] ?? items[0];

  if (!activeItem) {
    return null;
  }

  return (
    <div className="panel rounded-[2rem] p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">
            Signal board
          </p>
          <h2 className="mt-2 text-3xl">What CGS is building</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {items.map((item, index) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                index === activeIndex
                  ? "bg-sky-300 text-slate-950"
                  : "border border-white/12 bg-white/5 text-zinc-200"
              }`}
            >
              {item.eyebrow}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(135deg,rgba(123,211,255,0.22),rgba(255,255,255,0.04))] p-6">
          <div className="eyebrow">{activeItem.eyebrow}</div>
          <h3 className="mt-5 text-4xl">{activeItem.title}</h3>
          <p className="mt-4 max-w-xl leading-7 text-zinc-300">
            {activeItem.description}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={activeItem.href}
              className="rounded-full bg-sky-300 px-5 py-3 font-semibold text-slate-950"
            >
              {activeItem.ctaLabel}
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
          {activeItem.highlights.map((highlight, index) => (
            <div
              key={`${activeItem.key}-${highlight}`}
              className="interactive-card rounded-[1.5rem] border border-white/10 bg-black/18 p-5"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Point {index + 1}
              </p>
              <p className="mt-3 text-lg text-zinc-100">{highlight}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        {items.map((item, index) => (
          <span
            key={item.key}
            className={`h-1 rounded-full transition-all ${
              index === activeIndex ? "w-14 bg-sky-300" : "w-6 bg-white/12"
            }`}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
