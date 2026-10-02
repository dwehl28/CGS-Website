import type { Metadata } from "next";
import Image from "next/image";
import {
  Camera,
  CheckCircle2,
  ImageDown,
  ScanLine,
  ShieldCheck,
} from "lucide-react";

import ScorecardStudio from "@/components/admin/ScorecardStudio";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Free Golf Scorecard Maker",
  description:
    "Turn a photographed or manually entered golf scorecard into a polished CGS Instagram graphic, with hole-by-hole gross and nett scoring.",
  path: "/scorecard",
});

export default function PublicScorecardStudioPage() {
  return (
    <main className="min-h-screen bg-[#020a12] text-white">
      <section className="scorecard-public-hero relative isolate overflow-hidden border-b border-sky-300/15 bg-[radial-gradient(circle_at_83%_18%,rgba(255,190,24,0.24),transparent_24%),radial-gradient(circle_at_12%_28%,rgba(45,198,255,0.25),transparent_30%),linear-gradient(135deg,#0b3855_0%,#03111e_48%,#241704_100%)]">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(115deg,transparent_0_64%,rgba(101,215,255,0.12)_64.2%_64.5%,transparent_64.7%),radial-gradient(rgba(255,255,255,0.16)_0.7px,transparent_0.7px)] bg-[size:auto,7px_7px] opacity-55" />
        <div className="mx-auto grid w-[min(1500px,calc(100%-32px))] items-center gap-12 py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.6fr)] lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 border border-sky-200/25 bg-sky-300/8 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-sky-200">
              <Camera className="h-4 w-4" /> Free CGS scorecard studio
            </span>
            <h1 className="mt-6 max-w-5xl font-[var(--font-space-grotesk)] text-[clamp(3.2rem,7vw,7.6rem)] font-black leading-[0.84] tracking-[-0.075em] uppercase">
              From clubhouse card to{" "}
              <span className="text-[var(--gold)]">Instagram ready.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-sky-50/72">
              Photograph a completed card or enter the round manually. Review the
              imported values, then download a bold 1080 x 1350 result graphic in
              the CGS style.
            </p>

            <div className="mt-8 grid max-w-3xl gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-3">
              {[
                [ScanLine, "Photo read", "Scores, pars and distances"],
                [CheckCircle2, "Editable", "Check every value before export"],
                [ImageDown, "Ready to post", "Full-size Instagram PNG"],
              ].map(([Icon, title, detail]) => (
                <div key={String(title)} className="bg-[#04131f]/88 p-5">
                  <Icon className="h-6 w-6 text-[var(--sky)]" />
                  <strong className="mt-3 block text-sm uppercase tracking-[0.08em]">
                    {String(title)}
                  </strong>
                  <span className="mt-1 block text-xs leading-5 text-zinc-400">
                    {String(detail)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-5 translate-x-5 translate-y-5 border-2 border-[var(--sky)]/45" />
            <div className="relative overflow-hidden border border-white/15 bg-[#06111e] p-7 shadow-[0_40px_100px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <Image
                  src="/cgs-logo.png"
                  alt="Crossodog Golf Society"
                  width={84}
                  height={84}
                  className="h-16 w-16 object-contain"
                />
                <span className="text-right text-[10px] font-black uppercase tracking-[0.2em] text-[var(--gold)]">
                  Any course
                  <br /> Any round length
                </span>
              </div>
              <div className="py-8">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--sky)]">
                  Three simple steps
                </p>
                <ol className="mt-5 space-y-4">
                  {[
                    "Enter the player or team name",
                    "Take or upload the full scorecard",
                    "Review, style, and download",
                  ].map((step, index) => (
                    <li key={step} className="flex items-center gap-4 text-sm text-zinc-200">
                      <b className="grid h-9 w-9 shrink-0 place-items-center bg-[var(--gold)] text-[#07111b]">
                        0{index + 1}
                      </b>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="flex items-start gap-3 border-t border-white/10 pt-5 text-xs leading-5 text-zinc-400">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                Photos are used for one-time analysis and are not saved by CGS.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto w-[min(1600px,calc(100%-28px))] py-12 md:py-20">
        <div className="scorecard-public-intro mb-8 flex flex-col gap-3 border-l-4 border-[var(--gold)] pl-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--sky)]">
              Build your post
            </p>
            <h2 className="mt-2 text-3xl text-white md:text-5xl">
              Start with a photo or enter it by hand.
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-zinc-400">
            Nothing is published automatically. Your draft stays in this browser,
            and every imported number remains editable before download.
          </p>
        </div>
        <ScorecardStudio />
      </section>
    </main>
  );
}
