import type { Metadata } from "next";
import CglShell from "@/components/cgl/CglShell";
import CglAdminCentre from "@/components/cgl/CglAdminCentre";
export const metadata: Metadata = {
  title: "CGL League Administration",
  robots: { index: false, follow: false },
};
export default function CglAdminPage() {
  return (
    <CglShell>
      <CglAdminCentre />
    </CglShell>
  );
}
