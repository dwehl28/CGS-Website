import type { FaqItem } from "@/lib/site-content";

type FAQSectionProps = {
  title: string;
  intro?: string;
  items: FaqItem[];
};

export default function FAQSection({
  title,
  intro,
  items,
}: FAQSectionProps) {
  return (
    <section className="panel rounded-[2rem] p-8 md:p-10">
      <h2 className="text-3xl">{title}</h2>
      {intro ? (
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">{intro}</p>
      ) : null}

      <div className="mt-8 grid gap-4">
        {items.map((item) => (
          <details
            key={item.question}
            className="faq-item rounded-[1.35rem] border border-white/8 bg-black/18 px-5 py-4"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-lg font-semibold text-white">
              <span>{item.question}</span>
              <span className="text-sm uppercase tracking-[0.18em] text-[var(--sky)]">
                Answer
              </span>
            </summary>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
