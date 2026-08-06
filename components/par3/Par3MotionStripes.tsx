type Par3MotionStripesProps = {
  tone?: "cyan" | "gold" | "mixed";
};

export default function Par3MotionStripes({
  tone = "mixed",
}: Par3MotionStripesProps) {
  return (
    <div className={`par3-motion-stripes is-${tone}`} aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}
