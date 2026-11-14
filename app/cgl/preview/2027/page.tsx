import Link from "next/link";
import CglPublicExperience from "@/components/cgl/CglPublicExperience";
import { createCglPreviewSnapshot } from "@/scripts/cgl-preview-snapshot";
import s from "@/components/cgl/Cgl2027.module.css";
export default function Cgl2027Preview() {
  return (
    <>
      <div className={s.notice}>
        <strong>
          2027 presentation preview · fictional players and scores.
        </strong>{" "}
        Calculated with the new division and best-eight rules. Unresolved ties
        stay pending. No live records, payments or rewards are changed.{" "}
        <Link href="/cgl/preview/season-1">Review the Season 1 launch design</Link>
        {" · "}
        <Link href="/cgl">Return to the public clubhouse</Link>.
      </div>
      <CglPublicExperience
        section="leaderboard"
        previewData={createCglPreviewSnapshot()}
      />
    </>
  );
}
