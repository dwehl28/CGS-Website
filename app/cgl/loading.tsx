export default function CglLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: 320,
        display: "grid",
        placeContent: "center",
        gap: 12,
        padding: 32,
        textAlign: "center",
        color: "#284f43",
      }}
    >
      <strong style={{ fontSize: 28, letterSpacing: "-.04em" }}>CGL.</strong>
      <p style={{ fontSize: 14 }}>Loading your league…</p>
    </div>
  );
}
