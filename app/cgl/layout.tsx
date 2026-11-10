import type { Metadata } from "next";
import CglShell from "@/components/cgl/CglShell";

export const metadata: Metadata = {
  title: { default: "CGL — Crossodog Golf League", template: "%s | CGL" },
  description:
    "Crossodog Golf League: GSPro simulator competitions, player statistics, A/B Grade championships and CGS rewards.",
  robots: { index: false, follow: false },
};

export default function CglLayout({ children }: { children: React.ReactNode }) {
  return <CglShell>{children}</CglShell>;
}
