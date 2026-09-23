"use client";

import { useEffect, useRef, useState } from "react";

type DistanceUnit = "m" | "yd";
type ScorecardPattern =
  | "slashes"
  | "rings"
  | "waves"
  | "burst"
  | "grid"
  | "chevrons";

type ScorecardDesign = {
  name: string;
  tagline: string;
  primary: string;
  secondary: string;
  backgroundStart: string;
  backgroundMiddle: string;
  backgroundEnd: string;
  pattern: ScorecardPattern;
  logoSide: "left" | "right";
};

type ScorecardHole = {
  distance: string;
  par: string;
  score: string;
};

type HandicapAllocation = {
  playingHandicap: number | null;
  strokes: Array<number | null>;
  netScores: Array<number | null>;
};

type ScorecardDraft = {
  teamName: string;
  courseName: string;
  handicap: string;
  grossScore: string;
  netScore: string;
  roundDate: string;
  roundLabel: string;
  distanceUnit: DistanceUnit;
  designIndex: number;
  holes: ScorecardHole[];
};

type Notice = {
  tone: "info" | "success" | "error";
  message: string;
} | null;

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1350;
const DRAFT_STORAGE_KEY = "cgs-scorecard-studio-draft-v1";
const SCORECARD_DESIGNS: ScorecardDesign[] = [
  {
    name: "Sky Strike",
    tagline: "Fast lines. Big finish.",
    primary: "#65d7ff",
    secondary: "#ffbe18",
    backgroundStart: "#082c46",
    backgroundMiddle: "#020b13",
    backgroundEnd: "#0a1d2b",
    pattern: "slashes",
    logoSide: "left",
  },
  {
    name: "Gold Rush",
    tagline: "Built for the podium.",
    primary: "#ffca3a",
    secondary: "#41ccff",
    backgroundStart: "#352409",
    backgroundMiddle: "#080c12",
    backgroundEnd: "#102839",
    pattern: "rings",
    logoSide: "right",
  },
  {
    name: "Coastal Split",
    tagline: "Fresh air. Low numbers.",
    primary: "#52e2ff",
    secondary: "#d99b6c",
    backgroundStart: "#07364a",
    backgroundMiddle: "#04131d",
    backgroundEnd: "#29190e",
    pattern: "waves",
    logoSide: "left",
  },
  {
    name: "Night Flight",
    tagline: "After dark. All attack.",
    primary: "#2fbfff",
    secondary: "#ff9148",
    backgroundStart: "#071523",
    backgroundMiddle: "#02060b",
    backgroundEnd: "#28130b",
    pattern: "grid",
    logoSide: "right",
  },
  {
    name: "Trophy Gold",
    tagline: "Championship energy.",
    primary: "#ffbe18",
    secondary: "#6ae0ff",
    backgroundStart: "#3a2505",
    backgroundMiddle: "#071019",
    backgroundEnd: "#082a40",
    pattern: "burst",
    logoSide: "left",
  },
  {
    name: "Clubhouse Clash",
    tagline: "Different team. Same fight.",
    primary: "#70e4ff",
    secondary: "#ffb01f",
    backgroundStart: "#12324a",
    backgroundMiddle: "#030b12",
    backgroundEnd: "#312006",
    pattern: "chevrons",
    logoSide: "right",
  },
];

function hashString(value: string) {
  return [...value].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    0
  );
}

function getTeamDesignIndex(teamName: string) {
  return teamName.trim()
    ? hashString(teamName.trim().toLowerCase()) % SCORECARD_DESIGNS.length
    : 0;
}

function getDesign(index: number) {
  return SCORECARD_DESIGNS[
    ((index % SCORECARD_DESIGNS.length) + SCORECARD_DESIGNS.length) %
      SCORECARD_DESIGNS.length
  ];
}

function createBlankHoles(): ScorecardHole[] {
  return Array.from({ length: 18 }, () => ({
    distance: "",
    par: "",
    score: "",
  }));
}

function createBlankDraft(): ScorecardDraft {
  return {
    teamName: "",
    courseName: "",
    handicap: "",
    grossScore: "",
    netScore: "",
    roundDate: "",
    roundLabel: "",
    distanceUnit: "m",
    designIndex: 0,
    holes: createBlankHoles(),
  };
}

function restoreDraft(rawValue: string): ScorecardDraft | null {
  try {
    const parsed = JSON.parse(rawValue) as Partial<ScorecardDraft>;

    if (!Array.isArray(parsed.holes) || parsed.holes.length !== 18) {
      return null;
    }

    return {
      teamName: typeof parsed.teamName === "string" ? parsed.teamName : "",
      courseName:
        typeof parsed.courseName === "string" ? parsed.courseName : "",
      handicap: typeof parsed.handicap === "string" ? parsed.handicap : "",
      grossScore:
        typeof parsed.grossScore === "string" ? parsed.grossScore : "",
      netScore: typeof parsed.netScore === "string" ? parsed.netScore : "",
      roundDate:
        typeof parsed.roundDate === "string" ? parsed.roundDate : "",
      roundLabel:
        typeof parsed.roundLabel === "string" ? parsed.roundLabel : "",
      distanceUnit: parsed.distanceUnit === "yd" ? "yd" : "m",
      designIndex:
        typeof parsed.designIndex === "number" &&
        Number.isFinite(parsed.designIndex)
          ? parsed.designIndex
          : getTeamDesignIndex(
              typeof parsed.teamName === "string" ? parsed.teamName : ""
            ),
      holes: parsed.holes.map((hole) => ({
        distance: typeof hole?.distance === "string" ? hole.distance : "",
        par: typeof hole?.par === "string" ? hole.par : "",
        score: typeof hole?.score === "string" ? hole.score : "",
      })),
    };
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

function sumValues(values: string[]): number | null {
  const numbers = values.map(toNumber).filter((value): value is number => value !== null);

  if (numbers.length === 0) {
    return null;
  }

  return numbers.reduce((total, value) => total + value, 0);
}

function sumNumbers(values: Array<number | null>): number | null {
  const numbers = values.filter((value): value is number => value !== null);

  if (numbers.length === 0) {
    return null;
  }

  return numbers.reduce((total, value) => total + value, 0);
}

function getHandicapAllocation(
  holes: ScorecardHole[],
  handicapValue: string
): HandicapAllocation {
  const handicap = toNumber(handicapValue);
  const playingHandicap =
    handicap === null ? null : Math.max(0, Math.round(handicap));

  if (playingHandicap === null) {
    return {
      playingHandicap: null,
      strokes: holes.map(() => null),
      netScores: holes.map(() => null),
    };
  }

  const difficultyOrder = holes
    .map((hole, index) => ({
      index,
      par: toNumber(hole.par) ?? 0,
      distance: toNumber(hole.distance) ?? 0,
    }))
    .sort((left, right) => {
      if (right.par !== left.par) {
        return right.par - left.par;
      }

      if (right.distance !== left.distance) {
        return right.distance - left.distance;
      }

      return left.index - right.index;
    });

  const baseStrokes = Math.floor(playingHandicap / holes.length);
  const extraStrokes = playingHandicap % holes.length;
  const strokes = holes.map(() => baseStrokes);

  difficultyOrder.slice(0, extraStrokes).forEach(({ index }) => {
    strokes[index] += 1;
  });

  return {
    playingHandicap,
    strokes,
    netScores: holes.map((hole, index) => {
      const grossScore = toNumber(hole.score);
      return grossScore === null ? null : grossScore - strokes[index];
    }),
  };
}

function formatNumber(value: number | null, fractionDigits = 1): string {
  if (value === null) {
    return "--";
  }

  return new Intl.NumberFormat("en-AU", {
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function formatRelative(value: number | null): string {
  if (value === null) {
    return "--";
  }

  if (Math.abs(value) < 0.05) {
    return "E";
  }

  const formatted = formatNumber(Math.abs(value));
  return value > 0 ? `+${formatted}` : `-${formatted}`;
}

function formatRoundDate(value: string): string {
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
  weight = 900,
  family = '"Arial Black", "Aptos Display", "Bahnschrift", sans-serif'
) {
  let fontSize = startingSize;

  while (fontSize > minimumSize) {
    context.font = `${weight} ${fontSize}px ${family}`;
    if (context.measureText(text).width <= maxWidth) {
      break;
    }
    fontSize -= 1;
  }

  context.fillText(text, x, y);
}

function withAlpha(hexColor: string, alpha: number) {
  const normalized = hexColor.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
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

function drawTeamPattern(
  context: CanvasRenderingContext2D,
  design: ScorecardDesign,
  teamName: string
) {
  const teamHash = hashString(teamName || design.name);
  const horizontalShift = teamHash % 120;
  context.save();
  context.lineCap = "round";

  if (design.pattern === "slashes") {
    context.globalAlpha = 0.25;
    for (let index = 0; index < 10; index += 1) {
      context.strokeStyle = index % 2 === 0 ? design.primary : design.secondary;
      context.lineWidth = index % 3 === 0 ? 8 : 3;
      context.beginPath();
      context.moveTo(-90 + index * 22 + horizontalShift, 350 + index * 24);
      context.lineTo(250 + index * 24 + horizontalShift, 110 + index * 19);
      context.stroke();

      context.beginPath();
      context.moveTo(820 + index * 24 - horizontalShift, 1280 - index * 21);
      context.lineTo(1160 + index * 18 - horizontalShift, 1040 - index * 17);
      context.stroke();
    }
  }

  if (design.pattern === "rings") {
    context.globalAlpha = 0.22;
    for (let ringIndex = 0, radius = 90; radius < 590; ringIndex += 1, radius += 72) {
      context.strokeStyle = ringIndex % 2 === 0 ? design.primary : design.secondary;
      context.lineWidth = ringIndex % 2 === 0 ? 8 : 3;
      context.beginPath();
      context.arc(1050 - horizontalShift / 2, 180, radius, 0, Math.PI * 2);
      context.stroke();
    }
  }

  if (design.pattern === "waves") {
    context.globalAlpha = 0.24;
    for (let index = 0; index < 9; index += 1) {
      const waveY = 170 + index * 135;
      context.strokeStyle = index % 2 === 0 ? design.primary : design.secondary;
      context.lineWidth = index % 3 === 0 ? 7 : 3;
      context.beginPath();
      context.moveTo(-80, waveY);
      context.bezierCurveTo(
        210 + horizontalShift,
        waveY - 120,
        610 - horizontalShift,
        waveY + 120,
        1160,
        waveY - 10
      );
      context.stroke();
    }
  }

  if (design.pattern === "burst") {
    context.globalAlpha = 0.2;
    const originX = 910 - horizontalShift;
    const originY = 1160;
    for (let index = 0; index < 30; index += 1) {
      const angle = (Math.PI * 2 * index) / 30;
      const length = index % 2 === 0 ? 920 : 680;
      context.strokeStyle = index % 3 === 0 ? design.primary : design.secondary;
      context.lineWidth = index % 4 === 0 ? 7 : 2;
      context.beginPath();
      context.moveTo(originX, originY);
      context.lineTo(
        originX + Math.cos(angle) * length,
        originY + Math.sin(angle) * length
      );
      context.stroke();
    }
  }

  if (design.pattern === "grid") {
    context.globalAlpha = 0.18;
    context.lineWidth = 2;
    for (let offset = -900; offset < 1500; offset += 74) {
      context.strokeStyle = offset % 148 === 0 ? design.secondary : design.primary;
      context.beginPath();
      context.moveTo(offset + horizontalShift, 0);
      context.lineTo(offset + 660 + horizontalShift, CANVAS_HEIGHT);
      context.stroke();
    }
  }

  if (design.pattern === "chevrons") {
    context.globalAlpha = 0.2;
    for (let index = 0; index < 8; index += 1) {
      const inset = index * 58;
      context.strokeStyle = index % 2 === 0 ? design.primary : design.secondary;
      context.lineWidth = index % 2 === 0 ? 8 : 3;
      context.beginPath();
      context.moveTo(-160 + inset + horizontalShift, 190);
      context.lineTo(330 + inset + horizontalShift, 675);
      context.lineTo(-160 + inset + horizontalShift, 1160);
      context.stroke();
    }
  }

  context.globalAlpha = 0.045;
  context.fillStyle = design.primary;
  context.font = '900 520px "Arial Black", "Aptos Display", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(getTeamInitials(teamName), 540, 742);

  context.restore();
}

function getHoleTotal(holes: ScorecardHole[], key: keyof ScorecardHole) {
  return sumValues(holes.map((hole) => hole[key]));
}

function drawScoreMarker(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  score: number,
  par: number,
  design: ScorecardDesign
) {
  const scoreToPar = score - par;

  if (scoreToPar === 0) {
    return;
  }

  context.save();
  context.lineWidth = 2.5;
  context.strokeStyle =
    scoreToPar < 0 ? withAlpha(design.primary, 0.9) : withAlpha(design.secondary, 0.9);

  if (scoreToPar < 0) {
    const rings = scoreToPar <= -2 ? [18, 23] : [20];
    rings.forEach((radius) => {
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.stroke();
    });
  } else {
    const sizes = scoreToPar >= 2 ? [36, 46] : [40];
    sizes.forEach((size) => {
      context.strokeRect(x - size / 2, y - size / 2, size, size);
    });
  }

  context.restore();
}

function drawNineTable(
  context: CanvasRenderingContext2D,
  draft: ScorecardDraft,
  design: ScorecardDesign,
  startHole: number,
  y: number,
  label: string,
  totalLabel: string
) {
  const x = 54;
  const width = 972;
  const labelWidth = 132;
  const columnWidth = (width - labelWidth) / 10;
  const titleHeight = 40;
  const rowHeights = [42, 42, 42, 56, 56];
  const rows = [
    "HOLE",
    draft.distanceUnit === "m" ? "METRES" : "YARDS",
    "PAR",
    "GROSS",
    "NET",
  ];
  const holes = draft.holes.slice(startHole, startHole + 9);
  const allocation = getHandicapAllocation(draft.holes, draft.handicap);
  const netScores = allocation.netScores.slice(startHole, startHole + 9);
  const bodyY = y + titleHeight;
  const totalHeight = rowHeights.reduce((total, value) => total + value, 0);

  context.fillStyle = design.primary;
  context.font = '900 20px "Arial Black", "Aptos Display", sans-serif';
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(label, x, y + 17);

  context.fillStyle = "rgba(255,255,255,0.52)";
  context.font = '800 13px "Aptos", "Bahnschrift", sans-serif';
  context.letterSpacing = "2px";
  context.fillText(`${startHole + 1}-${startHole + 9}`, x + 150, y + 17);
  context.letterSpacing = "0px";

  fillRoundedRect(context, x, bodyY, width, totalHeight, 16, "rgba(3, 13, 23, 0.88)");
  strokeRoundedRect(
    context,
    x,
    bodyY,
    width,
    totalHeight,
    16,
    withAlpha(design.primary, 0.5),
    2
  );

  let rowY = bodyY;

  rows.forEach((rowLabel, rowIndex) => {
    const rowHeight = rowHeights[rowIndex];

    if (rowIndex === 0) {
      context.fillStyle = withAlpha(design.primary, 0.17);
      context.fillRect(x, rowY, width, rowHeight);
    } else if (rowIndex === 3) {
      context.fillStyle = withAlpha(design.secondary, 0.11);
      context.fillRect(x, rowY, width, rowHeight);
    } else if (rowIndex === 4) {
      context.fillStyle = withAlpha(design.primary, 0.13);
      context.fillRect(x, rowY, width, rowHeight);
    } else if (rowIndex % 2 === 0) {
      context.fillStyle = "rgba(255,255,255,0.025)";
      context.fillRect(x, rowY, width, rowHeight);
    }

    context.strokeStyle = "rgba(255,255,255,0.12)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x, rowY + rowHeight);
    context.lineTo(x + width, rowY + rowHeight);
    context.stroke();

    context.fillStyle =
      rowIndex === 3
        ? design.secondary
        : rowIndex === 4
          ? design.primary
          : "rgba(255,255,255,0.66)";
    context.font = `900 ${rowIndex >= 3 ? 16 : 14}px "Aptos", "Bahnschrift", sans-serif`;
    context.textAlign = "left";
    context.fillText(rowLabel, x + 18, rowY + rowHeight / 2 + 1);

    const values = holes.map((hole, index) => {
      if (rowIndex === 0) {
        return `${startHole + index + 1}`;
      }

      if (rowIndex === 1) {
        return hole.distance || "-";
      }

      if (rowIndex === 2) {
        return hole.par || "-";
      }

      if (rowIndex === 3) {
        return hole.score || "-";
      }

      return formatNumber(netScores[index], 0).replace("--", "-");
    });

    const total =
      rowIndex === 0
        ? totalLabel
        : rowIndex === 1
          ? formatNumber(getHoleTotal(holes, "distance"), 0)
          : rowIndex === 2
            ? formatNumber(getHoleTotal(holes, "par"), 0)
            : rowIndex === 3
              ? formatNumber(getHoleTotal(holes, "score"), 0)
              : formatNumber(sumNumbers(netScores), 0);

    [...values, total].forEach((value, columnIndex) => {
      const cellX = x + labelWidth + columnIndex * columnWidth;
      const isTotal = columnIndex === 9;

      if (isTotal) {
        context.fillStyle = withAlpha(
          design.secondary,
          rowIndex >= 3 ? 0.24 : 0.12
        );
        context.fillRect(cellX, rowY, columnWidth, rowHeight);
      }

      context.strokeStyle = "rgba(255,255,255,0.1)";
      context.beginPath();
      context.moveTo(cellX, rowY);
      context.lineTo(cellX, rowY + rowHeight);
      context.stroke();

      context.fillStyle = isTotal
        ? design.secondary
        : rowIndex >= 3 && value !== "-"
          ? "#ffffff"
          : "rgba(255,255,255,0.88)";
      context.font = `900 ${rowIndex >= 3 ? 21 : 17}px "Aptos Display", "Bahnschrift", sans-serif`;
      context.textAlign = "center";

      if (rowIndex === 3 && !isTotal) {
        const score = toNumber(holes[columnIndex]?.score ?? "");
        const par = toNumber(holes[columnIndex]?.par ?? "");

        if (score !== null && par !== null) {
          drawScoreMarker(
            context,
            cellX + columnWidth / 2,
            rowY + rowHeight / 2,
            score,
            par,
            design
          );
        }
      }

      context.fillText(value, cellX + columnWidth / 2, rowY + rowHeight / 2 + 1);
    });

    rowY += rowHeight;
  });
}

function drawMetricCard(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  design: ScorecardDesign,
  highlighted = false
) {
  const gradient = context.createLinearGradient(x, y, x, y + 142);
  gradient.addColorStop(
    0,
    highlighted ? design.secondary : withAlpha(design.primary, 0.22)
  );
  gradient.addColorStop(
    1,
    highlighted ? design.primary : "rgba(5, 22, 36, 0.98)"
  );
  fillRoundedRect(context, x, y, width, 142, 18, gradient);
  strokeRoundedRect(
    context,
    x,
    y,
    width,
    142,
    18,
    highlighted ? "rgba(255,255,255,0.52)" : withAlpha(design.primary, 0.48),
    2
  );

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = highlighted ? "rgba(3,17,29,0.68)" : "rgba(255,255,255,0.58)";
  context.font = '900 14px "Aptos", "Bahnschrift", sans-serif';
  context.fillText(label, x + width / 2, y + 38);

  context.fillStyle = highlighted ? "#06111e" : "#ffffff";
  context.font = '900 42px "Arial Black", "Aptos Display", sans-serif';
  context.fillText(value, x + width / 2, y + 91);
}

function drawScorecard(
  canvas: HTMLCanvasElement,
  draft: ScorecardDraft,
  logo: HTMLImageElement | null
) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const design = getDesign(draft.designIndex);

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const background = context.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  background.addColorStop(0, design.backgroundStart);
  background.addColorStop(0.48, design.backgroundMiddle);
  background.addColorStop(1, design.backgroundEnd);
  context.fillStyle = background;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const cyanGlow = context.createRadialGradient(90, 180, 20, 90, 180, 520);
  cyanGlow.addColorStop(0, withAlpha(design.primary, 0.34));
  cyanGlow.addColorStop(1, withAlpha(design.primary, 0));
  context.fillStyle = cyanGlow;
  context.fillRect(0, 0, 620, 720);

  const goldGlow = context.createRadialGradient(1030, 1180, 30, 1030, 1180, 470);
  goldGlow.addColorStop(0, withAlpha(design.secondary, 0.28));
  goldGlow.addColorStop(1, withAlpha(design.secondary, 0));
  context.fillStyle = goldGlow;
  context.fillRect(500, 760, 580, 590);

  drawTeamPattern(context, design, draft.teamName);

  context.save();
  context.globalAlpha = 0.08;
  context.strokeStyle = "#ffffff";
  context.lineWidth = 1;
  for (let y = 20; y < CANVAS_HEIGHT; y += 26) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(CANVAS_WIDTH, y);
    context.stroke();
  }
  context.restore();

  strokeRoundedRect(
    context,
    28,
    28,
    CANVAS_WIDTH - 56,
    CANVAS_HEIGHT - 56,
    30,
    withAlpha(design.primary, 0.58),
    3
  );
  strokeRoundedRect(
    context,
    39,
    39,
    CANVAS_WIDTH - 78,
    CANVAS_HEIGHT - 78,
    25,
    withAlpha(design.secondary, 0.3),
    2
  );

  const logoOnRight = design.logoSide === "right";
  const logoX = logoOnRight ? 828 : 64;
  const textX = logoOnRight ? 64 : 282;
  const metaX = logoOnRight ? 64 : 284;

  if (logo?.complete) {
    context.drawImage(logo, logoX, 58, 188, 188);
  } else {
    fillRoundedRect(context, logoX, 58, 188, 188, 28, "rgba(255,255,255,0.08)");
    context.fillStyle = design.primary;
    context.font = '900 52px "Arial Black", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("CGS", logoX + 94, 152);
  }

  context.fillStyle = design.secondary;
  context.font = '900 17px "Aptos", "Bahnschrift", sans-serif';
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.letterSpacing = "4px";
  context.fillText("OFFICIAL TEAM SCORECARD", textX + 4, 83);
  context.letterSpacing = "0px";

  context.fillStyle = "#ffffff";
  drawFittedText(
    context,
    (draft.teamName || "TEAM NAME").toUpperCase(),
    textX,
    151,
    724,
    58,
    33
  );

  context.fillStyle = design.primary;
  drawFittedText(
    context,
    (draft.courseName || "COURSE NAME").toUpperCase(),
    textX + 2,
    199,
    720,
    31,
    21,
    850,
    '"Aptos Display", "Bahnschrift", sans-serif'
  );

  const roundLabel = (draft.roundLabel || "ROUND / COMPETITION").toUpperCase();
  const dateLabel = formatRoundDate(draft.roundDate);
  fillRoundedRect(
    context,
    metaX,
    219,
    logoOnRight ? 330 : 342,
    38,
    19,
    withAlpha(design.primary, 0.14)
  );
  const dateX = metaX + (logoOnRight ? 342 : 354);
  fillRoundedRect(
    context,
    dateX,
    219,
    logoOnRight ? 230 : 244,
    38,
    19,
    withAlpha(design.secondary, 0.14)
  );
  context.font = '850 14px "Aptos", "Bahnschrift", sans-serif';
  context.textBaseline = "middle";
  context.fillStyle = "rgba(255,255,255,0.84)";
  context.textAlign = "left";
  context.fillText(roundLabel.slice(0, 34), metaX + 18, 238);
  context.fillStyle = design.secondary;
  context.fillText(dateLabel, dateX + 20, 238);

  const holesX = dateX + (logoOnRight ? 242 : 256);
  fillRoundedRect(context, holesX, 219, 112, 38, 19, design.primary);
  context.fillStyle = "#04111d";
  context.textAlign = "center";
  context.font = '900 14px "Aptos", "Bahnschrift", sans-serif';
  context.fillText("18 HOLES", holesX + 56, 238);

  context.fillStyle = "rgba(255,255,255,0.12)";
  context.fillRect(54, 285, 972, 1);

  drawNineTable(context, draft, design, 0, 308, "FRONT NINE", "OUT");
  drawNineTable(context, draft, design, 9, 596, "BACK NINE", "IN");

  const totalDistance = getHoleTotal(draft.holes, "distance");
  const totalPar = getHoleTotal(draft.holes, "par");
  const cardGrossScore = getHoleTotal(draft.holes, "score");
  const grossScore = toNumber(draft.grossScore) ?? cardGrossScore;
  const handicapAllocation = getHandicapAllocation(draft.holes, draft.handicap);
  const playingHandicap = handicapAllocation.playingHandicap;
  const calculatedNetScore =
    grossScore !== null && playingHandicap !== null
      ? grossScore - playingHandicap
      : null;
  const netScore = toNumber(draft.netScore) ?? calculatedNetScore;
  const toPar = netScore !== null && totalPar !== null ? netScore - totalPar : null;

  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(255,255,255,0.66)";
  context.font = '850 13px "Aptos", "Bahnschrift", sans-serif';
  const distanceLabel =
    totalDistance === null
      ? "TOTAL DISTANCE --"
      : `TOTAL DISTANCE ${formatNumber(totalDistance, 0)} ${draft.distanceUnit.toUpperCase()}`;
  context.fillText(`${distanceLabel}  /  18 HOLES`, 54, 904);
  context.fillStyle = design.primary;
  context.textAlign = "right";
  context.fillText(
    `NET STROKES / PAR 5S RANKED FIRST / PLAYING H'CAP ${formatNumber(playingHandicap, 0)}`,
    1026,
    904
  );

  const cardX = 54;
  const cardGap = 12;
  const cardWidth = (972 - cardGap * 4) / 5;
  const cardY = 939;
  const metrics = [
    ["TOTAL PAR", formatNumber(totalPar, 0)],
    ["GROSS", formatNumber(grossScore, 0)],
    ["PLAY H'CAP", formatNumber(playingHandicap, 0)],
    ["NET", formatNumber(netScore)],
    ["TO PAR", formatRelative(toPar)],
  ] as const;

  metrics.forEach(([label, value], index) => {
    drawMetricCard(
      context,
      cardX + index * (cardWidth + cardGap),
      cardY,
      cardWidth,
      label,
      value,
      design,
      index === 4
    );
  });

  const resultGradient = context.createLinearGradient(54, 1108, 1026, 1224);
  resultGradient.addColorStop(0, withAlpha(design.primary, 0.98));
  resultGradient.addColorStop(0.58, withAlpha(design.primary, 0.72));
  resultGradient.addColorStop(1, withAlpha(design.secondary, 0.96));
  fillRoundedRect(context, 54, 1111, 972, 118, 22, resultGradient);

  context.fillStyle = "rgba(3,17,29,0.7)";
  context.font = '900 15px "Aptos", "Bahnschrift", sans-serif';
  context.textAlign = "left";
  context.fillText(`FINAL TEAM RESULT / ${design.name.toUpperCase()}`, 82, 1146);

  context.fillStyle = "#ffffff";
  drawFittedText(
    context,
    `${(draft.teamName || "TEAM NAME").toUpperCase()}  ${formatRelative(toPar)}`,
    82,
    1200,
    910,
    46,
    28,
    900
  );

  context.fillStyle = "rgba(255,255,255,0.78)";
  context.textAlign = "left";
  context.font = '900 14px "Aptos", "Bahnschrift", sans-serif';
  context.fillText("CROSSODOG GOLF SOCIETY", 60, 1284);
  context.fillStyle = design.primary;
  context.textAlign = "right";
  context.fillText("CROSSODOGGOLF.COM", 1020, 1284);

  context.fillStyle = design.secondary;
  context.fillRect(60, 1304, 242, 5);
  context.fillStyle = design.primary;
  context.fillRect(312, 1304, 708, 5);
}

function getValidationMessage(draft: ScorecardDraft): string | null {
  const missingDetails = [
    !draft.teamName.trim() ? "team name" : null,
    !draft.courseName.trim() ? "course name" : null,
    !draft.handicap.trim() ? "handicap" : null,
  ].filter(Boolean);
  const missingDistances = draft.holes.filter((hole) => !hole.distance.trim()).length;
  const missingPars = draft.holes.filter((hole) => !hole.par.trim()).length;
  const missingScores = draft.holes.filter((hole) => !hole.score.trim()).length;
  const messages: string[] = [];

  if (missingDetails.length > 0) {
    messages.push(missingDetails.join(", "));
  }

  if (missingDistances > 0) {
    messages.push(`${missingDistances} hole distance${missingDistances === 1 ? "" : "s"}`);
  }

  if (missingPars > 0) {
    messages.push(`${missingPars} par value${missingPars === 1 ? "" : "s"}`);
  }

  if (missingScores > 0) {
    messages.push(`${missingScores} score${missingScores === 1 ? "" : "s"}`);
  }

  return messages.length > 0
    ? `Complete ${messages.join(", ")} before generating the finished card.`
    : null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("The image could not be created."));
      }
    }, "image/png");
  });
}

export default function ScorecardStudio() {
  const [draft, setDraft] = useState<ScorecardDraft>(createBlankDraft);
  const [draftReady, setDraftReady] = useState(false);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notice, setNotice] = useState<Notice>({
    tone: "info",
    message: "Your unfinished scorecard will auto-save in this browser.",
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const savedDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    const restoredDraft = savedDraft ? restoreDraft(savedDraft) : null;

    if (restoredDraft) {
      setDraft(restoredDraft);
      setNotice({
        tone: "success",
        message: "Your saved scorecard draft has been restored.",
      });
    }

    setDraftReady(true);
  }, []);

  useEffect(() => {
    const image = new Image();
    image.onload = () => setLogo(image);
    image.src = "/cgs-logo.png";
  }, []);

  useEffect(() => {
    if (!draftReady) {
      return;
    }

    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [draft, draftReady]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    drawScorecard(canvas, draft, logo);

    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) {
        drawScorecard(canvas, draft, logo);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [draft, logo]);

  function updateField<Key extends keyof Omit<ScorecardDraft, "holes">>(
    key: Key,
    value: ScorecardDraft[Key]
  ) {
    setDraft((currentDraft) => {
      const nextDraft = {
        ...currentDraft,
        [key]: value,
      };

      if (key === "teamName" && typeof value === "string") {
        nextDraft.designIndex = getTeamDesignIndex(value);
      }

      return nextDraft;
    });
    setNotice(null);
  }

  function updateHole(index: number, key: keyof ScorecardHole, value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      holes: currentDraft.holes.map((hole, holeIndex) =>
        holeIndex === index ? { ...hole, [key]: value } : hole
      ),
    }));
    setNotice(null);
  }

  function clearDraft() {
    setDraft(createBlankDraft());
    setShowValidation(false);
    setNotice({
      tone: "info",
      message: "The scorecard is blank and ready for a new team.",
    });
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  }

  function shuffleDesign() {
    const nextDesignIndex =
      (draft.designIndex + 1) % SCORECARD_DESIGNS.length;
    const nextDesign = getDesign(nextDesignIndex);

    setDraft((currentDraft) => ({
      ...currentDraft,
      designIndex: nextDesignIndex,
    }));
    setNotice({
      tone: "info",
      message: `${nextDesign.name} is now in the preview.`,
    });
  }

  async function generateScorecard() {
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
    setNotice({ tone: "info", message: "Preparing the full-size Instagram card..." });

    try {
      const exportedDesign = getDesign(draft.designIndex);
      const nextDesignIndex =
        (draft.designIndex + 1) % SCORECARD_DESIGNS.length;
      const nextDesign = getDesign(nextDesignIndex);
      await document.fonts.ready;
      drawScorecard(canvas, draft, logo);
      const blob = await canvasToBlob(canvas);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const teamSlug = slugify(draft.teamName) || "team";
      const courseSlug = slugify(draft.courseName) || "course";
      const designSlug = slugify(exportedDesign.name);
      link.href = objectUrl;
      link.download = `cgs-scorecard-${teamSlug}-${courseSlug}-${designSlug}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setShowValidation(false);
      setDraft((currentDraft) => ({
        ...currentDraft,
        designIndex: nextDesignIndex,
      }));
      setNotice({
        tone: "success",
        message: `${exportedDesign.name} downloaded at 1080 x 1350. The preview has rotated to ${nextDesign.name} for the next export.`,
      });
    } catch {
      setNotice({
        tone: "error",
        message: "The PNG could not be generated. Please refresh and try once more.",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  const validationMessage = showValidation ? getValidationMessage(draft) : null;
  const totals = {
    distance: getHoleTotal(draft.holes, "distance"),
    par: getHoleTotal(draft.holes, "par"),
    score: getHoleTotal(draft.holes, "score"),
  };
  const handicapAllocation = getHandicapAllocation(draft.holes, draft.handicap);
  const playingHandicap = handicapAllocation.playingHandicap;
  const gross = toNumber(draft.grossScore) ?? totals.score;
  const calculatedNet =
    gross !== null && playingHandicap !== null
      ? gross - playingHandicap
      : null;
  const net =
    toNumber(draft.netScore) ?? calculatedNet;
  const toPar = net !== null && totals.par !== null ? net - totals.par : null;
  const currentDesign = getDesign(draft.designIndex);
  const noticeClasses = {
    info: "border-sky-300/20 bg-sky-300/8 text-sky-100",
    success: "border-emerald-300/20 bg-emerald-300/8 text-emerald-100",
    error: "border-red-300/30 bg-red-300/10 text-red-100",
  };

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.08fr)_minmax(400px,0.72fr)] xl:items-start">
      <div className="space-y-8">
        <section className="panel overflow-hidden rounded-[2rem]">
          <div className="border-b border-white/8 bg-[linear-gradient(120deg,rgba(101,215,255,0.15),rgba(255,190,24,0.08))] px-6 py-6 md:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--sky)]">
                  Card details
                </p>
                <h2 className="mt-2 text-3xl text-white">Set up the round</h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-300">
                  Start with the team and course, add official totals if needed,
                  then enter each hole below. The graphic updates live on the right.
                </p>
              </div>
              <span className="w-fit rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--gold)]">
                Instagram 4:5
              </span>
            </div>
          </div>

          <div className="grid gap-5 p-6 md:grid-cols-2 md:p-8">
            <div>
              <label className="field-label" htmlFor="scorecard-team">
                Team name
              </label>
              <input
                id="scorecard-team"
                type="text"
                className="field-control"
                value={draft.teamName}
                onChange={(event) => updateField("teamName", event.target.value)}
                placeholder="e.g. Team Crossodog"
                aria-invalid={showValidation && !draft.teamName.trim()}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="scorecard-course">
                Course name
              </label>
              <input
                id="scorecard-course"
                type="text"
                className="field-control"
                value={draft.courseName}
                onChange={(event) => updateField("courseName", event.target.value)}
                placeholder="e.g. Pebble Beach Golf Links"
                aria-invalid={showValidation && !draft.courseName.trim()}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="scorecard-round-label">
                Round or competition
              </label>
              <input
                id="scorecard-round-label"
                type="text"
                className="field-control"
                value={draft.roundLabel}
                onChange={(event) => updateField("roundLabel", event.target.value)}
                placeholder="Optional, e.g. Season 4 - Round 1"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="scorecard-round-date">
                Round date
              </label>
              <input
                id="scorecard-round-date"
                type="date"
                className="field-control"
                value={draft.roundDate}
                onChange={(event) => updateField("roundDate", event.target.value)}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="scorecard-handicap">
                Team handicap
              </label>
              <input
                id="scorecard-handicap"
                type="number"
                step="0.1"
                min="0"
                className="field-control"
                value={draft.handicap}
                onChange={(event) => updateField("handicap", event.target.value)}
                placeholder="e.g. 6.4"
                aria-invalid={showValidation && !draft.handicap.trim()}
              />
              <p className="field-hint">
                Rounded to a playing handicap of {formatNumber(playingHandicap, 0)} for
                hole-by-hole stroke allocation.
              </p>
            </div>

            <div>
              <label className="field-label" htmlFor="scorecard-distance-unit">
                Distance unit
              </label>
              <select
                id="scorecard-distance-unit"
                className="field-control"
                value={draft.distanceUnit}
                onChange={(event) =>
                  updateField("distanceUnit", event.target.value as DistanceUnit)
                }
              >
                <option value="m">Metres</option>
                <option value="yd">Yards</option>
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="scorecard-gross-score">
                Gross score
              </label>
              <input
                id="scorecard-gross-score"
                type="number"
                step="0.1"
                className="field-control"
                value={draft.grossScore}
                onChange={(event) => updateField("grossScore", event.target.value)}
                placeholder={`Auto from holes: ${formatNumber(totals.score, 0)}`}
              />
              <p className="field-hint">
                Optional. Leave blank to use the total of all 18 hole scores.
              </p>
            </div>

            <div>
              <label className="field-label" htmlFor="scorecard-net-score">
                Net score
              </label>
              <input
                id="scorecard-net-score"
                type="number"
                step="0.1"
                className="field-control"
                value={draft.netScore}
                onChange={(event) => updateField("netScore", event.target.value)}
                placeholder={`Auto after handicap: ${formatNumber(calculatedNet)}`}
              />
              <p className="field-hint">
                Optional. Enter the official net result if it differs from the rounded
                playing-handicap calculation.
              </p>
            </div>
          </div>
        </section>

        <section className="panel rounded-[2rem] p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--gold)]">
                Hole-by-hole input
              </p>
              <h2 className="mt-2 text-3xl text-white">Complete the scorecard</h2>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                Every distance, par, and score is required for the final download.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.13em]">
              <span className="rounded-full bg-white/6 px-3 py-2 text-zinc-300">
                Par {formatNumber(totals.par, 0)}
              </span>
              <span className="rounded-full bg-white/6 px-3 py-2 text-zinc-300">
                Gross {formatNumber(gross, 0)}
              </span>
              <span className="rounded-full bg-[var(--gold)]/12 px-3 py-2 text-[var(--gold)]">
                Net {formatNumber(net)} / {formatRelative(toPar)}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-[1.2rem] border border-[var(--sky)]/20 bg-[var(--sky)]/7 px-4 py-3 text-sm leading-6 text-sky-100">
              <span className="font-black text-white">Net strokes:</span>{" "}
              {playingHandicap === null
                ? "enter a handicap to calculate each hole."
                : `${playingHandicap} shot${playingHandicap === 1 ? "" : "s"} allocated with par 5s first, then longer par 4s and par 3s.`}
            </div>
            <div className="rounded-[1.2rem] border border-[var(--gold)]/20 bg-[var(--gold)]/7 px-4 py-3 text-sm leading-6 text-amber-100">
              <span className="font-black text-white">Gross score key:</span>{" "}
              circle birdie, double circle eagle or better, square bogey, double
              square double bogey or worse.
            </div>
          </div>

          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            {[0, 9].map((startHole) => (
              <div
                key={startHole}
                className="overflow-hidden rounded-[1.5rem] border border-white/8 bg-black/16"
              >
                <div className="flex items-center justify-between border-b border-white/8 bg-white/5 px-4 py-4">
                  <h3 className="text-xl text-white">
                    {startHole === 0 ? "Front nine" : "Back nine"}
                  </h3>
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sky)]">
                    Holes {startHole + 1}-{startHole + 9}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[570px] border-collapse">
                    <thead>
                      <tr className="border-b border-white/8 text-left text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                        <th className="px-4 py-3">Hole</th>
                        <th className="px-2 py-3">
                          {draft.distanceUnit === "m" ? "Metres" : "Yards"}
                        </th>
                        <th className="px-2 py-3">Par</th>
                        <th className="px-2 py-3">Score</th>
                        <th className="px-2 py-3">Shots</th>
                        <th className="px-3 py-3">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.holes.slice(startHole, startHole + 9).map((hole, index) => {
                        const holeIndex = startHole + index;
                        const holeStrokes = handicapAllocation.strokes[holeIndex];
                        const holeNet = handicapAllocation.netScores[holeIndex];
                        return (
                          <tr
                            key={holeIndex}
                            className="border-b border-white/6 last:border-b-0"
                          >
                            <th className="px-4 py-3 text-left text-sm font-black text-white">
                              {holeIndex + 1}
                            </th>
                            {(["distance", "par", "score"] as const).map((field) => (
                              <td key={field} className="px-2 py-2.5">
                                <label className="sr-only" htmlFor={`hole-${holeIndex + 1}-${field}`}>
                                  Hole {holeIndex + 1} {field}
                                </label>
                                <input
                                  id={`hole-${holeIndex + 1}-${field}`}
                                  type="number"
                                  inputMode="numeric"
                                  min={field === "distance" ? 1 : 0}
                                  step="1"
                                  className="w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center text-sm font-bold text-white outline-none transition focus:border-[var(--sky)] focus:bg-[var(--sky)]/8"
                                  value={hole[field]}
                                  onChange={(event) =>
                                    updateHole(holeIndex, field, event.target.value)
                                  }
                                  aria-invalid={showValidation && !hole[field].trim()}
                                  placeholder="-"
                                />
                              </td>
                            ))}
                            <td className="px-2 py-2.5 text-center">
                              <span
                                className="inline-flex min-w-9 justify-center rounded-full border border-[var(--sky)]/20 bg-[var(--sky)]/8 px-2 py-2 text-sm font-black text-[var(--sky)]"
                                title="Calculated handicap strokes received on this hole"
                              >
                                {holeStrokes ?? "-"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center text-base font-black text-[var(--gold)]">
                              {formatNumber(holeNet, 0)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 rounded-[1.4rem] border border-white/8 bg-white/4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Distance</p>
              <p className="mt-1 text-lg font-black text-white">
                {formatNumber(totals.distance, 0)} {draft.distanceUnit}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Total par</p>
              <p className="mt-1 text-lg font-black text-white">{formatNumber(totals.par, 0)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Playing handicap</p>
              <p className="mt-1 text-lg font-black text-[var(--sky)]">{formatNumber(playingHandicap, 0)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Gross score</p>
              <p className="mt-1 text-lg font-black text-white">{formatNumber(gross)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Net score</p>
              <p className="mt-1 text-lg font-black text-white">{formatNumber(net)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Result</p>
              <p className="mt-1 text-lg font-black text-[var(--gold)]">{formatRelative(toPar)}</p>
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
            aria-label="Live preview of the finished CGS team scorecard"
          />
        </section>

        <section className="panel rounded-[1.6rem] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--sky)]">
                Export control
              </p>
              <h2 className="mt-2 text-2xl text-white">Ready for Instagram</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
              1080 x 1350
            </span>
          </div>

          <div className="mt-5 rounded-[1.2rem] border border-white/8 bg-black/12 px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                  Current team look
                </p>
                <p className="mt-1 text-lg font-black text-white">
                  {currentDesign.name}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  {currentDesign.tagline}
                </p>
              </div>
              <div className="flex gap-2" aria-hidden="true">
                <span
                  className="h-8 w-8 rounded-full border-2 border-white/70"
                  style={{ backgroundColor: currentDesign.primary }}
                />
                <span
                  className="h-8 w-8 rounded-full border-2 border-white/70"
                  style={{ backgroundColor: currentDesign.secondary }}
                />
              </div>
            </div>
          </div>

          {notice ? (
            <div
              className={`mt-5 rounded-[1.1rem] border px-4 py-3 text-sm leading-6 ${noticeClasses[notice.tone]}`}
              role={notice.tone === "error" ? "alert" : "status"}
              aria-live="polite"
            >
              {notice.message}
            </div>
          ) : null}

          {validationMessage && !notice ? (
            <p className="mt-4 text-sm leading-6 text-red-200">{validationMessage}</p>
          ) : null}

          <button
            type="button"
            className="btn-primary mt-5 w-full justify-center"
            onClick={generateScorecard}
            disabled={isGenerating}
          >
            {isGenerating
              ? "Generating full-size PNG..."
              : `Generate ${currentDesign.name} PNG`}
          </button>
          <button
            type="button"
            className="btn-secondary mt-3 w-full justify-center"
            onClick={shuffleDesign}
            disabled={isGenerating}
          >
            Shuffle design preview
          </button>
          <button
            type="button"
            className="btn-secondary mt-3 w-full justify-center"
            onClick={clearDraft}
          >
            Clear for a new team
          </button>

          <p className="mt-4 text-xs leading-6 text-zinc-500">
            Each successful export advances to a different CGS team design. The PNG
            uses the exact preview shown above and is sized for a portrait Instagram
            feed post.
          </p>
        </section>
      </aside>
    </div>
  );
}
