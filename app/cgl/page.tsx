import CglPublicExperience from "@/components/cgl/CglPublicExperience";
import CglTrialPlayers from "@/components/cgl/CglTrialPlayers";
import { getCglTrialRoster } from "@/lib/cgl-roster";

export default async function CglHomePage() {
  const roster = await getCglTrialRoster();
  return (
    <CglPublicExperience>
      <CglTrialPlayers roster={roster} />
    </CglPublicExperience>
  );
}
