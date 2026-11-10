import type { Metadata } from "next";
import Link from "next/link";
import AdminShell, { AdminAccessState } from "@/components/admin/AdminShell";
import ClubhouseAdminLogin from "@/components/ClubhouseAdminLogin";
import Par3FormatControl from "@/components/admin/Par3FormatControl";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Par 3 format calculator",
  robots: { index: false, follow: false },
};

export default async function Par3FormatPreviewPage() {
  if (!(await isAdminAuthenticated())) {
    return <AdminAccessState eyebrow="Private route" title="Par 3 format calculator" description="Sign in to preview tournament formats."><ClubhouseAdminLogin /></AdminAccessState>;
  }
  return (
    <AdminShell eyebrow="Par 3 organiser" title="Tournament format calculator"
      description="Explore pool sizes and qualification before changing an event. This calculator does not read or update your tournament records."
      actions={<Link href="/clubhouse-admin/par3" className="btn-secondary">Back to tournament control</Link>}>
      <Par3FormatControl eventId={0} initialPoolSizes={[4, 4, 4, 4, 4, 4]}
        initialFinalsSize={16} assignedCounts={[]} activePlayerCount={0}
        locked={false} lockReason="" allocationLocked={false} previewOnly />
    </AdminShell>
  );
}
