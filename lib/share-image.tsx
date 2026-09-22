/* eslint-disable @next/next/no-img-element */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { siteConfig } from "@/lib/site-content";

export const shareImageAlt = `${siteConfig.name} share image`;
export const shareImageSize = {
  width: 1200,
  height: 630,
};
export const shareImageContentType = "image/png";

async function loadLogoSource() {
  const logo = await readFile(
    join(process.cwd(), "public", "par3", "par3-logo.png")
  );
  return Uint8Array.from(logo).buffer;
}

export async function createShareImage() {
  const logoSrc = await loadLogoSource();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background:
            "linear-gradient(135deg, #02080e 0%, #082438 58%, #02080e 100%)",
          color: "#f7f3eb",
          padding: "48px",
          position: "relative",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-80px",
            width: "360px",
            height: "360px",
            borderRadius: "999px",
            background: "rgba(92, 210, 255, 0.16)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-140px",
            left: "-60px",
            width: "300px",
            height: "300px",
            borderRadius: "999px",
            background: "rgba(244, 180, 27, 0.18)",
          }}
        />

        <div
        style={{
          width: "70%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
        }}
      >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              alignSelf: "flex-start",
              border: "1px solid rgba(92, 210, 255, 0.25)",
              borderRadius: "999px",
              padding: "12px 18px",
              fontSize: 22,
              color: "#5cd2ff",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Saturday 7 November / The Tee Lounge
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div
              style={{
                fontSize: 78,
                lineHeight: 1.05,
                fontWeight: 700,
                maxWidth: "720px",
              }}
            >
              CGS Par 3 Championship II
            </div>
            <div
              style={{
                fontSize: 28,
                lineHeight: 1.5,
                color: "#d5dfdc",
                maxWidth: "720px",
              }}
            >
              24 players. Six pools. One champion. Live from 5:00pm.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              fontSize: 24,
              color: "#ca9367",
            }}
          >
            <div
              style={{
                width: "14px",
                height: "14px",
                borderRadius: "999px",
                background: "#f4b41b",
              }}
            />
            Registration now open / crossodoggolf.com
          </div>
        </div>

        <div
        style={{
          width: "30%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
          <div
            style={{
              width: "270px",
              height: "270px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "0",
              background: "rgba(2, 8, 14, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.18)",
            }}
          >
            {/* @ts-expect-error Satori accepts ArrayBuffer for image src */}
            <img src={logoSrc} width={230} height={230} alt={siteConfig.name} />
          </div>
        </div>
      </div>
    ),
    shareImageSize
  );
}
