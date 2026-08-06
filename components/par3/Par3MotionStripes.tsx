type Par3MotionStripesProps = {
  tone?: "cyan" | "gold" | "mixed";
  words?: [string, string];
};

export default function Par3MotionStripes({
  tone = "mixed",
  words,
}: Par3MotionStripesProps) {
  return (
    <div className={`par3-motion-stripes is-${tone}`} aria-hidden="true">
      {words ? (
        <div className="par3-kinetic-type">
          <strong>{words[0]}</strong>
          <strong>{words[1]}</strong>
        </div>
      ) : null}
      <i className="par3-signal-sweep" />
      {Array.from({ length: 8 }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}
