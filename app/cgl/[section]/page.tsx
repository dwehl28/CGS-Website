import { notFound } from "next/navigation";
import CglPublicExperience from "@/components/cgl/CglPublicExperience";

const sections = [
  "memberships",
  "calendar",
  "competition",
  "annual",
  "prizes",
  "rules",
  "archive",
  "faq",
  "how-it-works",
];
export default async function CglInformationPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  return <CglPublicExperience section={section} />;
}
