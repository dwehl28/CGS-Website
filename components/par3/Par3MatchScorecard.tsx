export default function Par3MatchScorecard({ number }: { number: number }) {
  return (
    <article className="par3-match-scorecard" aria-label={`Blank player match scorecard ${number}`}>
      <header className="par3-match-scorecard__header">
        <div><span>CGS Par 3 Championship II</span><h2>Match result</h2></div>
      </header>

      <div className="par3-match-scorecard__simple-fields">
        {["Player A", "Player B", "Winner & Score"].map((label) => (
          <div className="par3-match-scorecard__simple-field" key={label}>
            <strong>{label}</strong>
            <span className="par3-match-scorecard__write-line" aria-label={`Write ${label.toLowerCase()} here`} />
          </div>
        ))}
      </div>
    </article>
  );
}
