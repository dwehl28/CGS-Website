import Image from "next/image";

type TeeLoungeLogoProps = {
  className?: string;
};

export default function TeeLoungeLogo({ className = "" }: TeeLoungeLogoProps) {
  return (
    <div
      className={`tee-lounge-tv-logo ${className}`.trim()}
    >
      <Image
        src="/scoreboard/tee-lounge-logo.png"
        alt="The Tee Lounge, Premium Golf Simulators"
        width={1024}
        height={1024}
        priority
      />
    </div>
  );
}
