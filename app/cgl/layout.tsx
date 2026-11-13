import type { Metadata } from "next";
import { connection } from "next/server";
import CglShell from "@/components/cgl/CglShell";
import { getCglSquareOperationalReadiness } from "@/lib/cgl-square";

export const metadata: Metadata = {
  title: { default: "CGL — Crossodog Golf League", template: "%s | CGL" },
  description:
    "Crossodog Golf League: GSPro simulator competitions, player statistics, A/B Grade championships and CGS rewards.",
  robots: { index: false, follow: false },
};

export default async function CglLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const readiness = await getCglSquareOperationalReadiness().catch(() => null);
  return (
    <CglShell oneOffSalesOpen={readiness?.oneOffActionsEnabled === true}>
      {children}
    </CglShell>
  );
}
