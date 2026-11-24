import CglPublicExperience from "@/components/cgl/CglPublicExperience";
import { connection } from "next/server";

async function getRequestClock() {
  await connection();
  return Date.now();
}

export default async function CglHomePage() {
  const initialClock = await getRequestClock();
  return <CglPublicExperience initialClock={initialClock} />;
}
