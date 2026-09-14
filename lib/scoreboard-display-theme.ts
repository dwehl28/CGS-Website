export type ScoreboardDisplayTheme = "cgs" | "tee-lounge";

export function resolveScoreboardDisplayTheme(
  value: string | string[] | undefined
): ScoreboardDisplayTheme {
  const requestedTheme = Array.isArray(value) ? value[0] : value;
  return requestedTheme === "tee-lounge" ? "tee-lounge" : "cgs";
}
