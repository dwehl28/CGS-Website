import Link from "next/link";
import type { ReactNode } from "react";

type PageIntroAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
  external?: boolean;
};

type PageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: PageIntroAction[];
  align?: "left" | "center";
  children?: ReactNode;
};

export default function PageIntro({
  eyebrow,
  title,
  description,
  actions = [],
  align = "left",
  children,
}: PageIntroProps) {
  const centered = align === "center";

  return (
    <section
      className={`page-intro ${centered ? "text-center" : ""}`}
    >
      <div className={centered ? "mx-auto max-w-3xl" : "max-w-3xl"}>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="mt-6 text-5xl md:text-6xl">{title}</h1>
        <p className="mt-5 text-lg leading-8 text-zinc-300">{description}</p>

        {actions.length > 0 ? (
          <div
            className={`mt-8 flex flex-wrap gap-4 ${
              centered ? "justify-center" : ""
            }`}
          >
            {actions.map((action) =>
              action.external ? (
                <a
                  key={`${action.href}-${action.label}`}
                  href={action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={action.variant === "secondary" ? "btn-secondary" : "btn-primary"}
                >
                  {action.label}
                </a>
              ) : (
                <Link
                  key={`${action.href}-${action.label}`}
                  href={action.href}
                  className={action.variant === "secondary" ? "btn-secondary" : "btn-primary"}
                >
                  {action.label}
                </Link>
              )
            )}
          </div>
        ) : null}
      </div>

      {children ? <div className="mt-8">{children}</div> : null}
    </section>
  );
}
