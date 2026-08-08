import Image from "next/image";

export default function Loading() {
  return (
    <main className="par3-route-loading">
      <Image
        src="/par3/par3-logo.png"
        alt="CGS Par 3"
        width={180}
        height={180}
        priority
      />
      <div>
        <span>12 September 2026</span>
        <h1>CGS Par 3 Championship</h1>
        <p>Loading tournament centre</p>
      </div>
    </main>
  );
}
