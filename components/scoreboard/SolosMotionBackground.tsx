import Image from "next/image";

type SolosMotionBackgroundProps = {
  variant: "banner" | "portrait" | "tv";
};

export default function SolosMotionBackground({
  variant,
}: SolosMotionBackgroundProps) {
  return (
    <div
      className={`solos-motion solos-motion-${variant}`}
      aria-hidden="true"
    >
      <div className="solos-motion-dust solos-motion-dust-rear" />
      <div className="solos-motion-dust solos-motion-dust-front" />
      <div className="solos-motion-sun">
        <span />
      </div>
      <div className="solos-motion-tumbleweed">
        <Image
          src="/scoreboard/solos-tumbleweed.png"
          alt=""
          width={320}
          height={320}
          sizes="320px"
        />
      </div>
    </div>
  );
}
