import type { ReactNode } from "react";
import Link from "next/link";

import AdminNav from "@/components/admin/AdminNav";

type AdminShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
};

export default function AdminShell({
  eyebrow,
  title,
  description,
  actions,
  children,
}: AdminShellProps) {
  return (
    <main className="min-h-screen text-white">
      <section className="page-shell max-w-7xl">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="eyebrow">{eyebrow}</div>
              <h1 className="mt-6 text-4xl md:text-5xl">{title}</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">
                {description}
              </p>
            </div>

            {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
          </div>

          <div className="flex flex-col gap-4 rounded-[1.6rem] border border-white/8 bg-white/4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <AdminNav />
            <div className="text-sm leading-7 text-zinc-400">
              Private CGS operations area. Public site changes made here can flow
              straight into the live experience.
            </div>
          </div>
        </div>

        <div className="mt-10">{children}</div>
      </section>
    </main>
  );
}

type AdminAccessStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function AdminAccessState({
  eyebrow,
  title,
  description,
  children,
}: AdminAccessStateProps) {
  return (
    <main className="min-h-screen text-white">
      <section className="page-shell max-w-4xl">
        <div className="panel rounded-[2rem] p-8 md:p-10">
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="mt-6 text-4xl md:text-5xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
            {description}
          </p>

          {children ? <div className="mt-8">{children}</div> : null}
        </div>
      </section>
    </main>
  );
}

export function AdminQuickLink({
  href,
  label,
  detail,
}: {
  href: string;
  label: string;
  detail: string;
}) {
  return (
    <Link href={href} className="subtle-grid-card block rounded-[1.35rem] px-4 py-4">
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{detail}</p>
    </Link>
  );
}
