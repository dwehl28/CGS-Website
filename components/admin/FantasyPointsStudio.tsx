"use client";

import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";

import {
  getScorecardHandicapAllocation,
  parseScorecardDraftSnapshot,
  SCORECARD_DRAFT_STORAGE_KEY,
  type ScorecardDraftSnapshot,
} from "@/lib/scorecard-storage";

type FantasyDraft = {
  teamName: string;
  courseName: string;
  roundLabel: string;
  roundDate: string;
  playerNames: string;
  longestDrive: string;
  averageDrive: string;
  girPercent: string;
  firPercent: string;
  holesPlayed: string;
  eagles: string;
  birdies: string;
  pars: string;
  bogeys: string;
  doubleBogeys: string;
  totalPar: string;
  resultScore: string;
  manualLabel: string;
  manualPoints: string;
};

type FantasyPoints = {
  longestDrive: number;
  averageDrive: number;
  gir: number;
  fir: number;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubleBogeys: number;
  holeScoring: number;
  result: number;
  manual: number;
  resultToPar: number | null;
  total: number;
};

type Notice = {
  tone: "info" | "success" | "error";
  message: string;
} | null;

type MediaKind = "photo" | "logo";

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1350;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const FANTASY_DRAFT_STORAGE_KEY = "cgs-fantasy-points-studio-draft-v1";

const SCORE_VALUES = {
  eagles: 4,
  birdies: 3,
  pars: 2,
  bogeys: 1,
  doubleBogeys: -3,
} as const;

function createBlankDraft(): FantasyDraft {
  return {
    teamName: "",
    courseName: "",
    roundLabel: "",
    roundDate: "",
    playerNames: "",
    longestDrive: "",
    averageDrive: "",
    girPercent: "",
    firPercent: "",
    holesPlayed: "",
    eagles: "0",
    birdies: "0",
    pars: "0",
    bogeys: "0",
    doubleBogeys: "0",
    totalPar: "",
    resultScore: "",
    manualLabel: "Bonus / correction",
    manualPoints: "",
  };
}

function restoreFantasyDraft(rawValue: string): FantasyDraft | null {
  try {
    const parsed = JSON.parse(rawValue) as Partial<FantasyDraft>;
    const blankDraft = createBlankDraft();
    const restoredDraft = Object.fromEntries(
      Object.keys(blankDraft).map((key) => {
        const field = key as keyof FantasyDraft;
        return [field, typeof parsed[field] === "string" ? parsed[field] : blankDraft[field]];
      })
    ) as FantasyDraft;

    if (!restoredDraft.holesPlayed) {
      const restoredHoleCount = getScoringHoleCount(restoredDraft);
      restoredDraft.holesPlayed =
        restoredHoleCount > 0 ? String(restoredHoleCount) : "";
    }

    return restoredDraft;
  } catch {
    return null;
  }
}

function toNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberOrZero(value: string) {
  return toNumber(value) ?? 0;
}

function sumNumbers(values: Array<number | null>): number | null {
  const numbers = values.filter((value): value is number => value !== null);

  if (numbers.length === 0) {
    return null;
  }

  return numbers.reduce((total, value) => total + value, 0);
}

function formatNumber(value: number | null, fractionDigits = 1) {
  if (value === null) {
    return "--";
  }

  return new Intl.NumberFormat("en-AU", {
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function formatPoints(value: number, signed = true) {
  const rounded = Math.round((value + Number.EPSILON) * 10) / 10;
  const formatted = formatNumber(rounded);

  if (signed && rounded > 0) {
    return `+${formatted}`;
  }

  return formatted;
}

function formatRelative(value: number | null) {
  if (value === null) {
    return "--";
  }

  if (value === 0) {
    return "E";
  }

  return value > 0 ? `+${formatNumber(value)}` : `-${formatNumber(Math.abs(value))}`;
}

function formatRoundDate(value: string) {
  if (!value) {
    return "ROUND DATE";
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) {
    return value.toUpperCase();
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .toUpperCase();
}

function calculateFantasyPoints(draft: FantasyDraft): FantasyPoints {
  const totalPar = toNumber(draft.totalPar);
  const resultScore = toNumber(draft.resultScore);
  const resultToPar =
    totalPar !== null && resultScore !== null ? resultScore - totalPar : null;

  const points = {
    longestDrive: numberOrZero(draft.longestDrive) / 10,
    averageDrive: numberOrZero(draft.averageDrive) / 10,
    gir: Math.max(0, Math.min(100, numberOrZero(draft.girPercent))) / 10,
    fir: Math.max(0, Math.min(100, numberOrZero(draft.firPercent))) / 10,
    eagles: numberOrZero(draft.eagles) * SCORE_VALUES.eagles,
    birdies: numberOrZero(draft.birdies) * SCORE_VALUES.birdies,
    pars: numberOrZero(draft.pars) * SCORE_VALUES.pars,
    bogeys: numberOrZero(draft.bogeys) * SCORE_VALUES.bogeys,
    doubleBogeys:
      numberOrZero(draft.doubleBogeys) * SCORE_VALUES.doubleBogeys,
    result: resultToPar === null ? 0 : -resultToPar,
    manual: numberOrZero(draft.manualPoints),
  };
  const holeScoring =
    points.eagles +
    points.birdies +
    points.pars +
    points.bogeys +
    points.doubleBogeys;

  return {
    ...points,
    holeScoring,
    resultToPar,
    total: Object.values(points).reduce((total, value) => total + value, 0),
  };
}

function getScoringHoleCount(draft: FantasyDraft) {
  return (
    numberOrZero(draft.eagles) +
    numberOrZero(draft.birdies) +
    numberOrZero(draft.pars) +
    numberOrZero(draft.bogeys) +
    numberOrZero(draft.doubleBogeys)
  );
}

function deriveDraftFromScorecard(
  snapshot: ScorecardDraftSnapshot,
  currentDraft: FantasyDraft
) {
  const scoringCounts = {
    eagles: 0,
    birdies: 0,
    pars: 0,
    bogeys: 0,
    doubleBogeys: 0,
  };
  const handicapAllocation = getScorecardHandicapAllocation(
    snapshot.holes,
    snapshot.handicap
  );
  const completedHoles = snapshot.holes
    .map((hole, index) => ({
      par: toNumber(hole.par),
      score: toNumber(hole.score),
      netScore: handicapAllocation.netScores[index],
    }))
    .filter(
      (
        hole
      ): hole is { par: number; score: number; netScore: number | null } =>
        hole.par !== null && hole.score !== null
    );

  completedHoles.forEach(({ par, score, netScore }) => {
    const scoreToPar = (netScore ?? score) - par;

    if (scoreToPar <= -2) {
      scoringCounts.eagles += 1;
    } else if (scoreToPar === -1) {
      scoringCounts.birdies += 1;
    } else if (scoreToPar === 0) {
      scoringCounts.pars += 1;
    } else if (scoreToPar === 1) {
      scoringCounts.bogeys += 1;
    } else {
      scoringCounts.doubleBogeys += 1;
    }
  });

  const totalPar = sumNumbers(completedHoles.map(({ par }) => par));
  const holeGross = sumNumbers(completedHoles.map(({ score }) => score));
  const grossScore = toNumber(snapshot.grossScore) ?? holeGross;
  const playingHandicap = handicapAllocation.playingHandicap;
  const calculatedNet =
    grossScore !== null && playingHandicap !== null
      ? grossScore - playingHandicap
      : grossScore;
  const resultScore = toNumber(snapshot.netScore) ?? calculatedNet;

  return {
    ...currentDraft,
    teamName: snapshot.teamName || currentDraft.teamName,
    courseName: snapshot.courseName || currentDraft.courseName,
    roundLabel: snapshot.roundLabel || currentDraft.roundLabel,
    roundDate: snapshot.roundDate || currentDraft.roundDate,
    holesPlayed:
      completedHoles.length > 0
        ? String(completedHoles.length)
        : currentDraft.holesPlayed,
    eagles: String(scoringCounts.eagles),
    birdies: String(scoringCounts.birdies),
    pars: String(scoringCounts.pars),
    bogeys: String(scoringCounts.bogeys),
    doubleBogeys: String(scoringCounts.doubleBogeys),
    totalPar: totalPar === null ? currentDraft.totalPar : String(totalPar),
    resultScore:
      resultScore === null ? currentDraft.resultScore : String(resultScore),
  };
}

function hasUsableScorecardData(snapshot: ScorecardDraftSnapshot) {
  return Boolean(
    snapshot.teamName.trim() ||
      snapshot.courseName.trim() ||
      snapshot.holes.some(
        (hole) => hole.par.trim() || hole.score.trim() || hole.distance.trim()
      )
  );
}

function roundedPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function fillRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string | CanvasGradient
) {
  roundedPath(context, x, y, width, height, radius);
  context.fillStyle = fillStyle;
  context.fill();
}

function strokeRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  strokeStyle: string,
  lineWidth = 2
) {
  roundedPath(context, x, y, width, height, radius);
  context.strokeStyle = strokeStyle;
  context.lineWidth = lineWidth;
  context.stroke();
}

function drawFittedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  startingSize: number,
  minimumSize: number,
  weight = 900
) {
  const safeText = text.trim();
  let fontSize = startingSize;

  while (fontSize > minimumSize) {
    context.font = `${weight} ${fontSize}px "Arial Black", "Aptos Display", "Bahnschrift", sans-serif`;
    if (context.measureText(safeText).width <= maxWidth) {
      break;
    }
    fontSize -= 1;
  }

  context.font = `${weight} ${Math.max(fontSize, minimumSize)}px "Arial Black", "Aptos Display", "Bahnschrift", sans-serif`;

  let fittedText = safeText;
  if (context.measureText(fittedText).width > maxWidth) {
    const suffix = "...";
    while (
      fittedText.length > 1 &&
      context.measureText(`${fittedText}${suffix}`).width > maxWidth
    ) {
      fittedText = fittedText.slice(0, -1).trimEnd();
    }
    fittedText = `${fittedText}${suffix}`;
  }

  context.fillText(fittedText, x, y);
}

function getTeamInitials(teamName: string) {
  const words = teamName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !["team", "the"].includes(word.toLowerCase()));

  if (words.length === 0) {
    return "CGS";
  }

  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;

  context.save();
  roundedPath(context, x, y, width, height, radius);
  context.clip();
  context.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight
  );
  context.restore();
}

function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;

  context.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight
  );
}

function drawPerformanceCard(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  rawValue: string,
  points: number,
  accent: string
) {
  const width = 234;
  const height = 144;
  const gradient = context.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, `${accent}36`);
  gradient.addColorStop(1, "rgba(3, 14, 24, 0.97)");
  fillRoundedRect(context, x, y, width, height, 18, gradient);
  strokeRoundedRect(context, x, y, width, height, 18, `${accent}8f`, 2);

  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(255,255,255,0.58)";
  context.font = '900 13px "Aptos", "Bahnschrift", sans-serif';
  context.fillText(label, x + 18, y + 30);

  context.fillStyle = "#ffffff";
  context.font = '900 32px "Arial Black", "Aptos Display", sans-serif';
  context.fillText(rawValue, x + 18, y + 78);

  context.fillStyle = accent;
  context.font = '900 19px "Aptos Display", "Bahnschrift", sans-serif';
  context.fillText(`${formatPoints(points)} PTS`, x + 18, y + 119);
}

function drawScoringCategory(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  label: string,
  count: string,
  points: number,
  accent: string
) {
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(255,255,255,0.54)";
  context.font = '900 12px "Aptos", "Bahnschrift", sans-serif';
  context.fillText(label, x + width / 2, y + 34);

  context.fillStyle = "#ffffff";
  context.font = '900 40px "Arial Black", "Aptos Display", sans-serif';
  context.fillText(count || "0", x + width / 2, y + 86);

  context.fillStyle = accent;
  context.font = '900 18px "Aptos Display", "Bahnschrift", sans-serif';
  context.fillText(`${formatPoints(points)} PTS`, x + width / 2, y + 137);
}

function drawFantasyCard(
  canvas: HTMLCanvasElement,
  draft: FantasyDraft,
  cgsLogo: HTMLImageElement | null,
  teamPhoto: HTMLImageElement | null,
  teamLogo: HTMLImageElement | null
) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const points = calculateFantasyPoints(draft);
  const scoringHoleCount = getScoringHoleCount(draft);
  const holesPlayed = toNumber(draft.holesPlayed) ?? scoringHoleCount;
  const sky = "#55d8ff";
  const gold = "#ffbe18";
  const coral = "#ff725f";

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const background = context.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  background.addColorStop(0, "#0a3550");
  background.addColorStop(0.42, "#020a12");
  background.addColorStop(1, "#382207");
  context.fillStyle = background;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  context.save();
  context.globalAlpha = 0.16;
  context.lineCap = "round";
  for (let index = 0; index < 13; index += 1) {
    context.strokeStyle = index % 3 === 0 ? gold : sky;
    context.lineWidth = index % 4 === 0 ? 10 : 3;
    context.beginPath();
    context.moveTo(-120 + index * 34, 390 + index * 18);
    context.lineTo(430 + index * 42, -50 + index * 12);
    context.stroke();

    context.beginPath();
    context.moveTo(720 + index * 36, 1390 - index * 22);
    context.lineTo(1160 + index * 28, 1040 - index * 18);
    context.stroke();
  }
  context.restore();

  const topGlow = context.createRadialGradient(110, 90, 0, 110, 90, 520);
  topGlow.addColorStop(0, "rgba(85,216,255,0.28)");
  topGlow.addColorStop(1, "rgba(85,216,255,0)");
  context.fillStyle = topGlow;
  context.fillRect(0, 0, 650, 580);

  const bottomGlow = context.createRadialGradient(1040, 1250, 0, 1040, 1250, 480);
  bottomGlow.addColorStop(0, "rgba(255,190,24,0.25)");
  bottomGlow.addColorStop(1, "rgba(255,190,24,0)");
  context.fillStyle = bottomGlow;
  context.fillRect(520, 760, 560, 590);

  strokeRoundedRect(context, 28, 28, 1024, 1294, 30, "rgba(85,216,255,0.64)", 3);
  strokeRoundedRect(context, 40, 40, 1000, 1270, 24, "rgba(255,190,24,0.28)", 2);

  if (cgsLogo?.complete) {
    drawContainedImage(context, cgsLogo, 58, 55, 128, 128);
  }

  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillStyle = gold;
  context.font = '900 16px "Aptos", "Bahnschrift", sans-serif';
  context.letterSpacing = "4px";
  context.fillText("CGS WEEKLY FANTASY RETURN", 214, 76);
  context.letterSpacing = "0px";

  context.fillStyle = "#ffffff";
  drawFittedText(
    context,
    (draft.teamName || "TEAM NAME").toUpperCase(),
    214,
    139,
    800,
    54,
    30
  );

  context.fillStyle = sky;
  drawFittedText(
    context,
    (draft.courseName || "COURSE NAME").toUpperCase(),
    216,
    180,
    800,
    27,
    18,
    850
  );

  context.fillStyle = "rgba(255,255,255,0.68)";
  drawFittedText(
    context,
    `${(draft.roundLabel || "ROUND / COMPETITION").toUpperCase()}  /  ${formatRoundDate(draft.roundDate)}`,
    216,
    214,
    620,
    14,
    10,
    850
  );

  fillRoundedRect(context, 862, 190, 138, 36, 18, "rgba(85,216,255,0.16)");
  strokeRoundedRect(
    context,
    862,
    190,
    138,
    36,
    18,
    "rgba(85,216,255,0.52)",
    2
  );
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = sky;
  context.font = '900 13px "Aptos", "Bahnschrift", sans-serif';
  context.fillText(
    `${formatNumber(holesPlayed, 0)} HOLE${holesPlayed === 1 ? "" : "S"}`,
    931,
    208
  );

  const heroX = 54;
  const heroY = 242;
  const heroWidth = 972;
  const heroHeight = 260;
  fillRoundedRect(context, heroX, heroY, heroWidth, heroHeight, 26, "#071929");

  if (teamPhoto?.complete) {
    drawCoverImage(context, teamPhoto, heroX, heroY, heroWidth, heroHeight, 26);
  } else {
    const placeholder = context.createLinearGradient(
      heroX,
      heroY,
      heroX + heroWidth,
      heroY + heroHeight
    );
    placeholder.addColorStop(0, "#0a4968");
    placeholder.addColorStop(0.55, "#06121e");
    placeholder.addColorStop(1, "#4a3008");
    fillRoundedRect(context, heroX, heroY, heroWidth, heroHeight, 26, placeholder);
    context.save();
    roundedPath(context, heroX, heroY, heroWidth, heroHeight, 26);
    context.clip();
    context.globalAlpha = 0.09;
    context.fillStyle = "#ffffff";
    context.font = '900 190px "Arial Black", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(getTeamInitials(draft.teamName), 540, 360);
    context.globalAlpha = 0.46;
    context.fillStyle = sky;
    context.font = '900 13px "Aptos", "Bahnschrift", sans-serif';
    context.letterSpacing = "5px";
    context.fillText("TEAM PROFILE", 540, 459);
    context.letterSpacing = "0px";
    context.restore();
  }

  context.save();
  roundedPath(context, heroX, heroY, heroWidth, heroHeight, 26);
  context.clip();
  const heroOverlay = context.createLinearGradient(heroX, heroY, heroX, heroY + heroHeight);
  heroOverlay.addColorStop(0, "rgba(2,8,14,0.08)");
  heroOverlay.addColorStop(0.48, "rgba(2,8,14,0.2)");
  heroOverlay.addColorStop(1, "rgba(2,8,14,0.92)");
  context.fillStyle = heroOverlay;
  context.fillRect(heroX, heroY, heroWidth, heroHeight);
  context.restore();
  strokeRoundedRect(context, heroX, heroY, heroWidth, heroHeight, 26, "rgba(85,216,255,0.56)", 2);

  fillRoundedRect(context, 846, 265, 136, 136, 22, "rgba(3,13,22,0.84)");
  strokeRoundedRect(context, 846, 265, 136, 136, 22, "rgba(255,190,24,0.72)", 3);
  if (teamLogo?.complete) {
    drawContainedImage(context, teamLogo, 860, 279, 108, 108);
  } else {
    context.fillStyle = gold;
    context.font = '900 47px "Arial Black", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(getTeamInitials(draft.teamName), 914, 333);
  }

  const rosterNames = draft.playerNames
    .split(/[\n,]+/)
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 6);
  const rosterLines =
    rosterNames.length > 3
      ? [rosterNames.slice(0, 3).join("  /  "), rosterNames.slice(3).join("  /  ")]
      : [rosterNames.join("  /  ")];
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillStyle = "rgba(255,255,255,0.58)";
  context.font = '900 12px "Aptos", "Bahnschrift", sans-serif';
  context.fillText("TEAM SHEET", 82, 420);
  context.fillStyle = "#ffffff";
  rosterLines.forEach((line, index) => {
    drawFittedText(
      context,
      (line || "ADD PLAYER NAMES").toUpperCase(),
      82,
      rosterLines.length === 1 ? 464 : 448 + index * 29,
      662,
      rosterLines.length === 1 ? 24 : 19,
      rosterLines.length === 1 ? 16 : 13,
      850
    );
  });

  const totalGradient = context.createLinearGradient(774, 386, 1000, 478);
  totalGradient.addColorStop(0, sky);
  totalGradient.addColorStop(1, gold);
  fillRoundedRect(context, 774, 386, 226, 92, 20, totalGradient);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(2,12,20,0.7)";
  context.font = '900 12px "Aptos", "Bahnschrift", sans-serif';
  context.fillText("FANTASY POINTS", 887, 408);
  context.fillStyle = "#06111e";
  context.font = '900 46px "Arial Black", "Aptos Display", sans-serif';
  context.fillText(formatPoints(points.total, false), 887, 449);

  context.textAlign = "left";
  context.fillStyle = sky;
  context.font = '900 18px "Arial Black", "Aptos Display", sans-serif';
  context.fillText("PERFORMANCE METRICS", 54, 541);

  drawPerformanceCard(
    context,
    54,
    559,
    "LONGEST DRIVE",
    `${formatNumber(toNumber(draft.longestDrive))}m`,
    points.longestDrive,
    sky
  );
  drawPerformanceCard(
    context,
    300,
    559,
    "AVERAGE DRIVE",
    `${formatNumber(toNumber(draft.averageDrive))}m`,
    points.averageDrive,
    gold
  );
  drawPerformanceCard(
    context,
    546,
    559,
    "GREENS IN REG.",
    `${formatNumber(toNumber(draft.girPercent))}%`,
    points.gir,
    sky
  );
  drawPerformanceCard(
    context,
    792,
    559,
    "FAIRWAYS IN REG.",
    `${formatNumber(toNumber(draft.firPercent))}%`,
    points.fir,
    gold
  );

  context.fillStyle = gold;
  context.font = '900 18px "Arial Black", "Aptos Display", sans-serif';
  context.fillText("NETT SCORING RETURN", 54, 746);
  const scoringY = 764;
  fillRoundedRect(context, 54, scoringY, 972, 176, 20, "rgba(3,14,24,0.91)");
  strokeRoundedRect(context, 54, scoringY, 972, 176, 20, "rgba(255,190,24,0.4)", 2);

  const scoreColumns = [
    ["EAGLES+", draft.eagles, points.eagles, sky],
    ["BIRDIES", draft.birdies, points.birdies, sky],
    ["PARS", draft.pars, points.pars, "#ffffff"],
    ["BOGEYS", draft.bogeys, points.bogeys, gold],
    ["DOUBLE+", draft.doubleBogeys, points.doubleBogeys, coral],
  ] as const;
  const scoreColumnWidth = 972 / scoreColumns.length;

  scoreColumns.forEach(([label, count, scorePoints, accent], index) => {
    const x = 54 + index * scoreColumnWidth;
    if (index > 0) {
      context.strokeStyle = "rgba(255,255,255,0.1)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x, scoringY + 22);
      context.lineTo(x, scoringY + 154);
      context.stroke();
    }
    drawScoringCategory(
      context,
      x,
      scoringY,
      scoreColumnWidth,
      label,
      count,
      scorePoints,
      accent
    );
  });

  const resultGradient = context.createLinearGradient(54, 970, 684, 1140);
  resultGradient.addColorStop(0, "rgba(85,216,255,0.27)");
  resultGradient.addColorStop(1, "rgba(4,18,30,0.96)");
  fillRoundedRect(context, 54, 970, 630, 170, 20, resultGradient);
  strokeRoundedRect(context, 54, 970, 630, 170, 20, "rgba(85,216,255,0.48)", 2);

  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(255,255,255,0.55)";
  context.font = '900 13px "Aptos", "Bahnschrift", sans-serif';
  context.fillText("OVERALL RESULT", 78, 1003);
  context.fillText("RESULT POINTS", 370, 1003);
  context.strokeStyle = "rgba(255,255,255,0.12)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(338, 994);
  context.lineTo(338, 1103);
  context.stroke();
  context.fillStyle = "#ffffff";
  context.font = '900 54px "Arial Black", "Aptos Display", sans-serif';
  context.fillText(formatRelative(points.resultToPar), 78, 1062);
  context.fillStyle = sky;
  context.font = '900 38px "Arial Black", "Aptos Display", sans-serif';
  context.fillText(`${formatPoints(points.result)} PTS`, 370, 1060);
  context.fillStyle = "rgba(255,255,255,0.5)";
  context.font = '800 13px "Aptos", "Bahnschrift", sans-serif';
  drawFittedText(
    context,
    `RESULT ${formatNumber(toNumber(draft.resultScore))} / PAR ${formatNumber(toNumber(draft.totalPar))} / ${formatNumber(holesPlayed, 0)} HOLES`,
    78,
    1112,
    572,
    13,
    11,
    800
  );

  fillRoundedRect(context, 696, 970, 330, 170, 20, "rgba(255,190,24,0.11)");
  strokeRoundedRect(context, 696, 970, 330, 170, 20, "rgba(255,190,24,0.45)", 2);
  context.fillStyle = "rgba(255,255,255,0.55)";
  context.font = '900 13px "Aptos", "Bahnschrift", sans-serif';
  context.fillText("NETT HOLE POINTS", 720, 1003);
  context.fillStyle = gold;
  context.font = '900 42px "Arial Black", "Aptos Display", sans-serif';
  context.fillText(`${formatPoints(points.holeScoring)} PTS`, 720, 1062);
  context.fillStyle = "rgba(255,255,255,0.62)";
  context.font = '850 13px "Aptos", "Bahnschrift", sans-serif';
  drawFittedText(
    context,
    `${formatNumber(numberOrZero(draft.eagles), 0)} EAGLES / ${formatNumber(numberOrZero(draft.birdies), 0)} BIRDIES / ${formatNumber(numberOrZero(draft.pars), 0)} PARS`,
    720,
    1112,
    278,
    15,
    11,
    850
  );

  const finalGradient = context.createLinearGradient(54, 1165, 1026, 1287);
  finalGradient.addColorStop(0, sky);
  finalGradient.addColorStop(0.58, "#3baed4");
  finalGradient.addColorStop(1, gold);
  fillRoundedRect(context, 54, 1165, 972, 122, 22, finalGradient);
  context.fillStyle = "rgba(3,17,29,0.72)";
  context.font = '900 14px "Aptos", "Bahnschrift", sans-serif';
  drawFittedText(
    context,
    points.manual === 0
      ? "FINAL FANTASY TOTAL"
      : `FINAL FANTASY TOTAL / ${formatPoints(points.manual)} ADJUSTMENT INCLUDED`,
    82,
    1200,
    610,
    14,
    11,
    900
  );
  context.fillStyle = "#ffffff";
  drawFittedText(
    context,
    (draft.teamName || "TEAM NAME").toUpperCase(),
    82,
    1256,
    625,
    39,
    24
  );
  context.textAlign = "right";
  context.fillStyle = "#06111e";
  context.font = '900 48px "Arial Black", "Aptos Display", sans-serif';
  context.fillText(`${formatPoints(points.total, false)} PTS`, 998, 1240);

  context.textBaseline = "alphabetic";
  context.textAlign = "left";
  context.fillStyle = "rgba(255,255,255,0.72)";
  context.font = '850 11px "Aptos", "Bahnschrift", sans-serif';
  context.fillText("DRIVES / 10  •  GIR + FIR / 10  •  STABLEFORD FANTASY  •  RESULT TO PAR", 58, 1313);
  context.fillStyle = sky;
  context.textAlign = "right";
  context.fillText("CROSSODOGGOLF.COM", 1022, 1313);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = "image/png",
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("The image could not be created."));
        }
      },
      type,
      quality
    );
  });
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be loaded."));
    image.src = source;
  });
}

async function prepareUploadedImage(file: File, kind: MediaKind) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a PNG, JPG, or WebP image.");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("That image is larger than 12 MB. Please choose a smaller file.");
  }

  const sourceUrl = URL.createObjectURL(file);

  try {
    const sourceImage = await loadImage(sourceUrl);
    const maxWidth = kind === "photo" ? 1800 : 900;
    const maxHeight = kind === "photo" ? 1100 : 900;
    const scale = Math.min(
      1,
      maxWidth / sourceImage.naturalWidth,
      maxHeight / sourceImage.naturalHeight
    );
    const resizeCanvas = document.createElement("canvas");
    resizeCanvas.width = Math.max(1, Math.round(sourceImage.naturalWidth * scale));
    resizeCanvas.height = Math.max(1, Math.round(sourceImage.naturalHeight * scale));
    const resizeContext = resizeCanvas.getContext("2d");

    if (!resizeContext) {
      throw new Error("The image could not be prepared.");
    }

    resizeContext.drawImage(
      sourceImage,
      0,
      0,
      resizeCanvas.width,
      resizeCanvas.height
    );

    const outputType = kind === "photo" ? "image/jpeg" : "image/png";
    const resizedBlob = await canvasToBlob(resizeCanvas, outputType, 0.9);
    const previewUrl = URL.createObjectURL(resizedBlob);
    const image = await loadImage(previewUrl);

    return { image, previewUrl };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function getValidationMessage(draft: FantasyDraft) {
  const holesPlayed = toNumber(draft.holesPlayed);
  const hasValidHoleCount =
    holesPlayed !== null &&
    Number.isInteger(holesPlayed) &&
    holesPlayed >= 1 &&
    holesPlayed <= 18;
  const missing = [
    !draft.teamName.trim() ? "team name" : null,
    !draft.courseName.trim() ? "course name" : null,
    toNumber(draft.longestDrive) === null ? "longest drive" : null,
    toNumber(draft.averageDrive) === null ? "average drive" : null,
    toNumber(draft.girPercent) === null ? "GIR percentage" : null,
    toNumber(draft.firPercent) === null ? "FIR percentage" : null,
    !hasValidHoleCount ? "holes played (1-18)" : null,
    toNumber(draft.totalPar) === null ? "round par" : null,
    toNumber(draft.resultScore) === null ? "overall result score" : null,
  ].filter(Boolean);

  const scoringHoleCount = getScoringHoleCount(draft);

  if (holesPlayed !== null && hasValidHoleCount && scoringHoleCount !== holesPlayed) {
    missing.push(
      `${formatNumber(holesPlayed, 0)} scoring results (currently ${formatNumber(scoringHoleCount, 0)})`
    );
  }

  return missing.length > 0
    ? `Complete ${missing.join(", ")} before generating the fantasy card.`
    : null;
}

export default function FantasyPointsStudio() {
  const [draft, setDraft] = useState<FantasyDraft>(createBlankDraft);
  const [draftReady, setDraftReady] = useState(false);
  const [cgsLogo, setCgsLogo] = useState<HTMLImageElement | null>(null);
  const [teamPhoto, setTeamPhoto] = useState<HTMLImageElement | null>(null);
  const [teamLogo, setTeamLogo] = useState<HTMLImageElement | null>(null);
  const [teamPhotoUrl, setTeamPhotoUrl] = useState("");
  const [teamLogoUrl, setTeamLogoUrl] = useState("");
  const [mediaBusy, setMediaBusy] = useState<MediaKind | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [notice, setNotice] = useState<Notice>({
    tone: "info",
    message:
      "Stats auto-save in this browser. Uploaded images stay only for this session.",
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoUrlRef = useRef<string | null>(null);
  const logoUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const savedDraft = window.localStorage.getItem(FANTASY_DRAFT_STORAGE_KEY);
    const restoredDraft = savedDraft ? restoreFantasyDraft(savedDraft) : null;

    if (restoredDraft) {
      setDraft(restoredDraft);
      setNotice({
        tone: "success",
        message: "Your saved fantasy-points draft has been restored.",
      });
    } else {
      const scorecardValue = window.localStorage.getItem(
        SCORECARD_DRAFT_STORAGE_KEY
      );
      const scorecardDraft = scorecardValue
        ? parseScorecardDraftSnapshot(scorecardValue)
        : null;

      if (scorecardDraft && hasUsableScorecardData(scorecardDraft)) {
        setDraft((currentDraft) =>
          deriveDraftFromScorecard(scorecardDraft, currentDraft)
        );
        setNotice({
          tone: "success",
          message:
            "The current scorecard supplied the team details, round length, nett hole scoring, par, and overall result.",
        });
      }
    }

    setDraftReady(true);
  }, []);

  useEffect(() => {
    const image = new Image();
    image.onload = () => setCgsLogo(image);
    image.src = "/cgs-logo.png";
  }, []);

  useEffect(() => {
    if (!draftReady) {
      return;
    }

    window.localStorage.setItem(
      FANTASY_DRAFT_STORAGE_KEY,
      JSON.stringify(draft)
    );
  }, [draft, draftReady]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    drawFantasyCard(canvas, draft, cgsLogo, teamPhoto, teamLogo);

    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) {
        drawFantasyCard(canvas, draft, cgsLogo, teamPhoto, teamLogo);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cgsLogo, draft, teamLogo, teamPhoto]);

  useEffect(() => {
    return () => {
      if (photoUrlRef.current) {
        URL.revokeObjectURL(photoUrlRef.current);
      }
      if (logoUrlRef.current) {
        URL.revokeObjectURL(logoUrlRef.current);
      }
    };
  }, []);

  function updateField(field: keyof FantasyDraft, value: string) {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
    setNotice(null);
  }

  function importCurrentScorecard() {
    const rawValue = window.localStorage.getItem(SCORECARD_DRAFT_STORAGE_KEY);
    const scorecardDraft = rawValue
      ? parseScorecardDraftSnapshot(rawValue)
      : null;

    if (!scorecardDraft || !hasUsableScorecardData(scorecardDraft)) {
      setNotice({
        tone: "error",
        message:
          "No scorecard with team or hole data was found in this browser yet.",
      });
      return;
    }

    setDraft((currentDraft) =>
      deriveDraftFromScorecard(scorecardDraft, currentDraft)
    );
    setShowValidation(false);
    setNotice({
      tone: "success",
      message:
        "Imported the round length, team details, nett hole scoring, par, and the scorecard net result.",
    });
  }

  async function handleMediaUpload(
    kind: MediaKind,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    setMediaBusy(kind);
    setNotice({ tone: "info", message: "Optimising the image for the graphic..." });

    try {
      const prepared = await prepareUploadedImage(file, kind);
      const urlRef = kind === "photo" ? photoUrlRef : logoUrlRef;

      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
      }
      urlRef.current = prepared.previewUrl;

      if (kind === "photo") {
        setTeamPhoto(prepared.image);
        setTeamPhotoUrl(prepared.previewUrl);
      } else {
        setTeamLogo(prepared.image);
        setTeamLogoUrl(prepared.previewUrl);
      }

      setNotice({
        tone: "success",
        message: `${kind === "photo" ? "Team photo" : "Team logo"} added and resized safely for export.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "The image could not be prepared.",
      });
    } finally {
      input.value = "";
      setMediaBusy(null);
    }
  }

  function clearDraft() {
    setDraft(createBlankDraft());
    setShowValidation(false);
    setTeamPhoto(null);
    setTeamLogo(null);
    setTeamPhotoUrl("");
    setTeamLogoUrl("");

    if (photoUrlRef.current) {
      URL.revokeObjectURL(photoUrlRef.current);
      photoUrlRef.current = null;
    }
    if (logoUrlRef.current) {
      URL.revokeObjectURL(logoUrlRef.current);
      logoUrlRef.current = null;
    }

    window.localStorage.removeItem(FANTASY_DRAFT_STORAGE_KEY);
    setNotice({
      tone: "info",
      message: "The fantasy sheet is blank and ready for a new team.",
    });
  }

  async function generateGraphic() {
    const validationMessage = getValidationMessage(draft);

    if (validationMessage) {
      setShowValidation(true);
      setNotice({ tone: "error", message: validationMessage });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      setNotice({
        tone: "error",
        message: "The preview is not ready yet. Please try again in a moment.",
      });
      return;
    }

    setIsGenerating(true);
    setNotice({ tone: "info", message: "Preparing the full-size Instagram graphic..." });

    try {
      await document.fonts.ready;
      drawFantasyCard(canvas, draft, cgsLogo, teamPhoto, teamLogo);
      const blob = await canvasToBlob(canvas);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const teamSlug = slugify(draft.teamName) || "team";
      const roundSlug = slugify(draft.roundLabel) || "round";
      link.href = objectUrl;
      link.download = `cgs-fantasy-points-${teamSlug}-${roundSlug}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setShowValidation(false);
      setNotice({
        tone: "success",
        message: "Fantasy points graphic downloaded at 1080 x 1350.",
      });
    } catch {
      setNotice({
        tone: "error",
        message: "The PNG could not be generated. Please refresh and try again.",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  const points = calculateFantasyPoints(draft);
  const scoringHoleCount = getScoringHoleCount(draft);
  const roundHoleCount = toNumber(draft.holesPlayed);
  const hasValidRoundHoleCount =
    roundHoleCount !== null &&
    Number.isInteger(roundHoleCount) &&
    roundHoleCount >= 1 &&
    roundHoleCount <= 18;
  const scoringMatchesRound =
    hasValidRoundHoleCount && scoringHoleCount === roundHoleCount;
  const noticeClasses = {
    info: "border-sky-300/20 bg-sky-300/8 text-sky-100",
    success: "border-emerald-300/20 bg-emerald-300/8 text-emerald-100",
    error: "border-red-300/30 bg-red-300/10 text-red-100",
  };
  const performanceFields = [
    {
      field: "longestDrive" as const,
      label: "Longest drive",
      suffix: "m",
      points: points.longestDrive,
      placeholder: "e.g. 286",
      max: undefined,
    },
    {
      field: "averageDrive" as const,
      label: "Average drive",
      suffix: "m",
      points: points.averageDrive,
      placeholder: "e.g. 242",
      max: undefined,
    },
    {
      field: "girPercent" as const,
      label: "GIR",
      suffix: "%",
      points: points.gir,
      placeholder: "e.g. 72.2",
      max: 100,
    },
    {
      field: "firPercent" as const,
      label: "FIR",
      suffix: "%",
      points: points.fir,
      placeholder: "e.g. 64.3",
      max: 100,
    },
  ];
  const scoringFields = [
    { field: "eagles" as const, label: "Eagles or better", rate: "+4", points: points.eagles },
    { field: "birdies" as const, label: "Birdies", rate: "+3", points: points.birdies },
    { field: "pars" as const, label: "Pars", rate: "+2", points: points.pars },
    { field: "bogeys" as const, label: "Bogeys", rate: "+1", points: points.bogeys },
    {
      field: "doubleBogeys" as const,
      label: "Double bogey or worse",
      rate: "-3",
      points: points.doubleBogeys,
    },
  ];

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.08fr)_minmax(400px,0.72fr)] xl:items-start">
      <div className="space-y-8">
        <section className="panel overflow-hidden rounded-[2rem]">
          <div className="border-b border-white/8 bg-[linear-gradient(120deg,rgba(85,216,255,0.16),rgba(255,190,24,0.09))] px-6 py-6 md:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--sky)]">
                  Team identity
                </p>
                <h2 className="mt-2 text-3xl text-white">Set up the fantasy sheet</h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-300">
                  Import the active scorecard for the automatic parts, then add the
                  team details and performance stats that are not captured hole by hole.
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={importCurrentScorecard}
              >
                Import current scorecard
              </button>
            </div>
          </div>

          <div className="grid gap-5 p-6 md:grid-cols-2 md:p-8">
            <div>
              <label className="field-label" htmlFor="fantasy-team-name">
                Team name
              </label>
              <input
                id="fantasy-team-name"
                className="field-control"
                value={draft.teamName}
                onChange={(event) => updateField("teamName", event.target.value)}
                placeholder="e.g. Team Crossodog"
                aria-invalid={showValidation && !draft.teamName.trim()}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="fantasy-course-name">
                Course name
              </label>
              <input
                id="fantasy-course-name"
                className="field-control"
                value={draft.courseName}
                onChange={(event) => updateField("courseName", event.target.value)}
                placeholder="e.g. Cabot Cliffs"
                aria-invalid={showValidation && !draft.courseName.trim()}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="fantasy-round-label">
                Round or competition
              </label>
              <input
                id="fantasy-round-label"
                className="field-control"
                value={draft.roundLabel}
                onChange={(event) => updateField("roundLabel", event.target.value)}
                placeholder="e.g. Season 4 - Round 1"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="fantasy-round-date">
                Round date
              </label>
              <input
                id="fantasy-round-date"
                type="date"
                className="field-control"
                value={draft.roundDate}
                onChange={(event) => updateField("roundDate", event.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="field-label" htmlFor="fantasy-player-names">
                Player names
              </label>
              <textarea
                id="fantasy-player-names"
                className="field-control min-h-28 resize-y"
                value={draft.playerNames}
                onChange={(event) => updateField("playerNames", event.target.value)}
                placeholder={"One player per line, up to six\nDan\nWade\nBlake\nRyobi"}
              />
            </div>
          </div>
        </section>

        <section className="panel rounded-[2rem] p-6 md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--gold)]">
            Team media
          </p>
          <h2 className="mt-2 text-3xl text-white">Add the team look</h2>
          <p className="mt-2 text-sm leading-7 text-zinc-400">
            Images are resized before use and are not placed in browser storage. Add
            them again after a refresh or when preparing another team.
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-white/8 bg-black/15 p-4">
              <div
                className="aspect-[16/9] rounded-[1.1rem] border border-white/10 bg-[linear-gradient(135deg,#0a405c,#07111c_55%,#3b2608)] bg-cover bg-center"
                style={teamPhotoUrl ? { backgroundImage: `url(${teamPhotoUrl})` } : undefined}
                aria-label="Team photo preview"
              />
              <label className="field-label mt-4" htmlFor="fantasy-team-photo">
                Team photo
              </label>
              <input
                id="fantasy-team-photo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="field-control"
                disabled={mediaBusy !== null}
                onChange={(event) => void handleMediaUpload("photo", event)}
              />
            </div>

            <div className="rounded-[1.5rem] border border-white/8 bg-black/15 p-4">
              <div
                className="mx-auto aspect-square max-w-[220px] rounded-[1.1rem] border border-white/10 bg-[radial-gradient(circle,#123b54,#06111e)] bg-contain bg-center bg-no-repeat"
                style={teamLogoUrl ? { backgroundImage: `url(${teamLogoUrl})` } : undefined}
                aria-label="Team logo preview"
              />
              <label className="field-label mt-4" htmlFor="fantasy-team-logo">
                Team logo
              </label>
              <input
                id="fantasy-team-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="field-control"
                disabled={mediaBusy !== null}
                onChange={(event) => void handleMediaUpload("logo", event)}
              />
            </div>
          </div>
        </section>

        <section className="panel rounded-[2rem] p-6 md:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--sky)]">
                Performance data
              </p>
              <h2 className="mt-2 text-3xl text-white">Driving and accuracy</h2>
            </div>
            <span className="w-fit rounded-full border border-[var(--sky)]/20 bg-[var(--sky)]/8 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--sky)]">
              Value divided by 10
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {performanceFields.map((item) => (
              <div
                key={item.field}
                className="rounded-[1.35rem] border border-white/8 bg-white/4 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <label className="field-label" htmlFor={`fantasy-${item.field}`}>
                    {item.label}
                  </label>
                  <span className="text-sm font-black text-[var(--gold)]">
                    {formatPoints(item.points)} pts
                  </span>
                </div>
                <div className="relative">
                  <input
                    id={`fantasy-${item.field}`}
                    type="number"
                    min="0"
                    max={item.max}
                    step="0.1"
                    className="field-control pr-12"
                    value={draft[item.field]}
                    onChange={(event) => updateField(item.field, event.target.value)}
                    placeholder={item.placeholder}
                    aria-invalid={showValidation && toNumber(draft[item.field]) === null}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-zinc-500">
                    {item.suffix}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel rounded-[2rem] p-6 md:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--gold)]">
                Nett Stableford-style return
              </p>
              <h2 className="mt-2 text-3xl text-white">Nett hole scoring</h2>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                These counts use each hole score after allocated handicap strokes and
                remain editable for corrections.
              </p>
            </div>
            <span
              className={`w-fit rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.14em] ${
                scoringMatchesRound
                  ? "border-emerald-300/20 bg-emerald-300/8 text-emerald-200"
                  : "border-amber-300/20 bg-amber-300/8 text-amber-200"
              }`}
            >
              {hasValidRoundHoleCount
                ? `${formatNumber(scoringHoleCount, 0)} / ${formatNumber(roundHoleCount, 0)} holes`
                : `${formatNumber(scoringHoleCount, 0)} holes counted`}
            </span>
          </div>

          <div className="mt-6 max-w-sm">
            <label className="field-label" htmlFor="fantasy-holes-played">
              Holes played
            </label>
            <input
              id="fantasy-holes-played"
              type="number"
              min="1"
              max="18"
              step="1"
              className="field-control"
              value={draft.holesPlayed}
              onChange={(event) => updateField("holesPlayed", event.target.value)}
              placeholder="e.g. 12"
              aria-invalid={showValidation && !hasValidRoundHoleCount}
            />
            <p className="field-hint">
              Imported automatically from Scorecard Studio. The scoring categories
              below must add up to this number.
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {scoringFields.map((item) => (
              <div
                key={item.field}
                className="rounded-[1.35rem] border border-white/8 bg-white/4 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <label
                    className="field-label min-h-10"
                    htmlFor={`fantasy-${item.field}`}
                  >
                    {item.label}
                  </label>
                  <span className="rounded-full bg-white/6 px-2 py-1 text-[10px] font-black text-zinc-400">
                    {item.rate}
                  </span>
                </div>
                <input
                  id={`fantasy-${item.field}`}
                  type="number"
                  min="0"
                  step="1"
                  className="field-control text-center"
                  value={draft[item.field]}
                  onChange={(event) => updateField(item.field, event.target.value)}
                  aria-invalid={showValidation && hasValidRoundHoleCount && !scoringMatchesRound}
                />
                <p className="mt-3 text-center text-sm font-black text-[var(--sky)]">
                  {formatPoints(item.points)} pts
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel rounded-[2rem] p-6 md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--sky)]">
            Final calculation
          </p>
          <h2 className="mt-2 text-3xl text-white">Result and manual adjustment</h2>
          <p className="mt-2 text-sm leading-7 text-zinc-400">
            The import uses the scorecard net result when available. Change the result
            score if you want the fantasy post to use gross instead.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="fantasy-total-par">
                Round par
              </label>
              <input
                id="fantasy-total-par"
                type="number"
                min="1"
                step="1"
                className="field-control"
                value={draft.totalPar}
                onChange={(event) => updateField("totalPar", event.target.value)}
                placeholder="e.g. 47 for 12 holes"
                aria-invalid={showValidation && toNumber(draft.totalPar) === null}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="fantasy-result-score">
                Overall result score
              </label>
              <input
                id="fantasy-result-score"
                type="number"
                step="0.1"
                className="field-control"
                value={draft.resultScore}
                onChange={(event) => updateField("resultScore", event.target.value)}
                placeholder="e.g. 69"
                aria-invalid={showValidation && toNumber(draft.resultScore) === null}
              />
              <p className="field-hint">
                {formatRelative(points.resultToPar)} to par = {formatPoints(points.result)} points.
              </p>
            </div>
            <div>
              <label className="field-label" htmlFor="fantasy-manual-label">
                Manual adjustment label
              </label>
              <input
                id="fantasy-manual-label"
                className="field-control"
                value={draft.manualLabel}
                onChange={(event) => updateField("manualLabel", event.target.value)}
                placeholder="e.g. Long putt bonus"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="fantasy-manual-points">
                Manual points
              </label>
              <input
                id="fantasy-manual-points"
                type="number"
                step="0.1"
                className="field-control"
                value={draft.manualPoints}
                onChange={(event) => updateField("manualPoints", event.target.value)}
                placeholder="Use positive or negative points"
              />
            </div>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-[var(--gold)]/25 bg-[linear-gradient(120deg,rgba(85,216,255,0.12),rgba(255,190,24,0.13))] p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">
                  Live fantasy total
                </p>
                <p className="mt-2 text-sm text-zinc-300">
                  Performance, hole scoring, result and manual adjustment combined.
                </p>
              </div>
              <p className="whitespace-nowrap text-4xl font-black text-[var(--gold)] sm:text-5xl">
                {formatPoints(points.total, false)} pts
              </p>
            </div>
          </div>
        </section>
      </div>

      <aside className="space-y-5 xl:sticky xl:top-6">
        <section className="overflow-hidden rounded-[2rem] border border-[var(--sky)]/22 bg-[#020a12] p-3 shadow-[0_28px_80px_rgba(0,0,0,0.38)]">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block aspect-[4/5] w-full rounded-[1.45rem] bg-[#06111e]"
            aria-label="Live preview of the CGS fantasy points graphic"
          />
        </section>

        <section className="panel rounded-[2rem] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--sky)]">
                Export control
              </p>
              <h2 className="mt-2 text-2xl text-white">Ready for Instagram</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black tracking-[0.14em] text-zinc-300">
              1080 X 1350
            </span>
          </div>

          {notice ? (
            <div
              className={`mt-5 rounded-[1.2rem] border px-4 py-3 text-sm leading-6 ${noticeClasses[notice.tone]}`}
              role={notice.tone === "error" ? "alert" : "status"}
            >
              {notice.message}
            </div>
          ) : null}

          <button
            type="button"
            className="btn-primary mt-5 w-full justify-center"
            onClick={() => void generateGraphic()}
            disabled={isGenerating || mediaBusy !== null}
          >
            {isGenerating ? "Generating..." : "Generate fantasy points PNG"}
          </button>
          <button
            type="button"
            className="btn-secondary mt-3 w-full justify-center"
            onClick={importCurrentScorecard}
          >
            Refresh from Scorecard Studio
          </button>
          <button
            type="button"
            className="btn-secondary mt-3 w-full justify-center"
            onClick={clearDraft}
          >
            Clear for a new team
          </button>
        </section>
      </aside>
    </div>
  );
}
