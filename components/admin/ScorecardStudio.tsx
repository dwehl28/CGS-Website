"use client";

import { useEffect, useRef, useState } from "react";

type DistanceUnit = "m" | "yd";

type ScorecardHole = {
  distance: string;
  par: string;
  score: string;
};

type ScorecardDraft = {
  teamName: string;
  courseName: string;
  handicap: string;
  roundDate: string;
  roundLabel: string;
  distanceUnit: DistanceUnit;
  holes: ScorecardHole[];
};

type Notice = {
  tone: "info" | "success" | "error";
  message: string;
} | null;

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1350;
const DRAFT_STORAGE_KEY = "cgs-scorecard-studio-draft-v1";

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
    roundDate: "",
    roundLabel: "",
    distanceUnit: "m",
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
      roundDate:
        typeof parsed.roundDate === "string" ? parsed.roundDate : "",
      roundLabel:
        typeof parsed.roundLabel === "string" ? parsed.roundLabel : "",
      distanceUnit: parsed.distanceUnit === "yd" ? "yd" : "m",
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

function drawDecorativeStreaks(context: CanvasRenderingContext2D) {
  context.save();
  context.globalAlpha = 0.24;
  context.lineCap = "round";

  for (let index = 0; index < 9; index += 1) {
    context.strokeStyle = index % 2 === 0 ? "#33cfff" : "#ffbe18";
    context.lineWidth = index % 3 === 0 ? 8 : 3;
    context.beginPath();
    context.moveTo(-90 + index * 22, 330 + index * 24);
    context.lineTo(250 + index * 24, 110 + index * 19);
    context.stroke();

    context.beginPath();
    context.moveTo(850 + index * 24, 1260 - index * 21);
    context.lineTo(1160 + index * 18, 1040 - index * 17);
    context.stroke();
  }

  context.restore();
}

function getHoleTotal(holes: ScorecardHole[], key: keyof ScorecardHole) {
  return sumValues(holes.map((hole) => hole[key]));
}

function drawNineTable(
  context: CanvasRenderingContext2D,
  draft: ScorecardDraft,
  startHole: number,
  y: number,
  label: string,
  totalLabel: string
) {
  const x = 54;
  const width = 972;
  const labelWidth = 132;
  const columnWidth = (width - labelWidth) / 10;
  const titleHeight = 44;
  const rowHeights = [50, 54, 58, 68];
  const rows = ["HOLE", draft.distanceUnit === "m" ? "METRES" : "YARDS", "PAR", "SCORE"];
  const holes = draft.holes.slice(startHole, startHole + 9);
  const bodyY = y + titleHeight;
  const totalHeight = rowHeights.reduce((total, value) => total + value, 0);

  context.fillStyle = "#69dcff";
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
  strokeRoundedRect(context, x, bodyY, width, totalHeight, 16, "rgba(101, 215, 255, 0.5)", 2);

  let rowY = bodyY;

  rows.forEach((rowLabel, rowIndex) => {
    const rowHeight = rowHeights[rowIndex];

    if (rowIndex === 0) {
      context.fillStyle = "rgba(101, 215, 255, 0.17)";
      context.fillRect(x, rowY, width, rowHeight);
    } else if (rowIndex === 3) {
      context.fillStyle = "rgba(255, 190, 24, 0.11)";
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

    context.fillStyle = rowIndex === 3 ? "#ffca3a" : "rgba(255,255,255,0.66)";
    context.font = `900 ${rowIndex === 3 ? 17 : 14}px "Aptos", "Bahnschrift", sans-serif`;
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

      return hole.score || "-";
    });

    const total =
      rowIndex === 0
        ? totalLabel
        : rowIndex === 1
          ? formatNumber(getHoleTotal(holes, "distance"), 0)
          : rowIndex === 2
            ? formatNumber(getHoleTotal(holes, "par"), 0)
            : formatNumber(getHoleTotal(holes, "score"), 0);

    [...values, total].forEach((value, columnIndex) => {
      const cellX = x + labelWidth + columnIndex * columnWidth;
      const isTotal = columnIndex === 9;

      if (isTotal) {
        context.fillStyle = rowIndex === 3 ? "rgba(255,190,24,0.24)" : "rgba(255,190,24,0.12)";
        context.fillRect(cellX, rowY, columnWidth, rowHeight);
      }

      context.strokeStyle = "rgba(255,255,255,0.1)";
      context.beginPath();
      context.moveTo(cellX, rowY);
      context.lineTo(cellX, rowY + rowHeight);
      context.stroke();

      context.fillStyle = isTotal
        ? "#ffca3a"
        : rowIndex === 3 && value !== "-"
          ? "#ffffff"
          : "rgba(255,255,255,0.88)";
      context.font = `900 ${rowIndex === 3 ? 24 : 18}px "Aptos Display", "Bahnschrift", sans-serif`;
      context.textAlign = "center";
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
  highlighted = false
) {
  const gradient = context.createLinearGradient(x, y, x, y + 142);
  gradient.addColorStop(0, highlighted ? "#ffca3a" : "rgba(16, 42, 62, 0.98)");
  gradient.addColorStop(1, highlighted ? "#ffad0a" : "rgba(5, 22, 36, 0.98)");
  fillRoundedRect(context, x, y, width, 142, 18, gradient);
  strokeRoundedRect(
    context,
    x,
    y,
    width,
    142,
    18,
    highlighted ? "rgba(255,255,255,0.52)" : "rgba(101,215,255,0.42)",
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

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const background = context.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  background.addColorStop(0, "#061a2a");
  background.addColorStop(0.48, "#020b13");
  background.addColorStop(1, "#071b28");
  context.fillStyle = background;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const cyanGlow = context.createRadialGradient(90, 180, 20, 90, 180, 520);
  cyanGlow.addColorStop(0, "rgba(42, 198, 255, 0.34)");
  cyanGlow.addColorStop(1, "rgba(42, 198, 255, 0)");
  context.fillStyle = cyanGlow;
  context.fillRect(0, 0, 620, 720);

  const goldGlow = context.createRadialGradient(1030, 1180, 30, 1030, 1180, 470);
  goldGlow.addColorStop(0, "rgba(255, 190, 24, 0.26)");
  goldGlow.addColorStop(1, "rgba(255, 190, 24, 0)");
  context.fillStyle = goldGlow;
  context.fillRect(500, 760, 580, 590);

  drawDecorativeStreaks(context);

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

  strokeRoundedRect(context, 28, 28, CANVAS_WIDTH - 56, CANVAS_HEIGHT - 56, 30, "rgba(101,215,255,0.5)", 3);
  strokeRoundedRect(context, 39, 39, CANVAS_WIDTH - 78, CANVAS_HEIGHT - 78, 25, "rgba(255,190,24,0.24)", 2);

  if (logo?.complete) {
    context.drawImage(logo, 64, 58, 188, 188);
  } else {
    fillRoundedRect(context, 64, 58, 188, 188, 28, "rgba(255,255,255,0.08)");
    context.fillStyle = "#65d7ff";
    context.font = '900 52px "Arial Black", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("CGS", 158, 152);
  }

  context.fillStyle = "#ffbe18";
  context.font = '900 17px "Aptos", "Bahnschrift", sans-serif';
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.letterSpacing = "4px";
  context.fillText("OFFICIAL TEAM SCORECARD", 286, 83);
  context.letterSpacing = "0px";

  context.fillStyle = "#ffffff";
  drawFittedText(
    context,
    (draft.teamName || "TEAM NAME").toUpperCase(),
    282,
    151,
    724,
    58,
    33
  );

  context.fillStyle = "#65d7ff";
  drawFittedText(
    context,
    (draft.courseName || "COURSE NAME").toUpperCase(),
    284,
    199,
    720,
    31,
    21,
    850,
    '"Aptos Display", "Bahnschrift", sans-serif'
  );

  const roundLabel = (draft.roundLabel || "ROUND / COMPETITION").toUpperCase();
  const dateLabel = formatRoundDate(draft.roundDate);
  fillRoundedRect(context, 284, 219, 342, 38, 19, "rgba(101,215,255,0.14)");
  fillRoundedRect(context, 638, 219, 244, 38, 19, "rgba(255,190,24,0.14)");
  context.font = '850 14px "Aptos", "Bahnschrift", sans-serif';
  context.textBaseline = "middle";
  context.fillStyle = "rgba(255,255,255,0.84)";
  context.textAlign = "left";
  context.fillText(roundLabel.slice(0, 34), 302, 238);
  context.fillStyle = "#ffca3a";
  context.fillText(dateLabel, 658, 238);

  fillRoundedRect(context, 894, 219, 112, 38, 19, "#65d7ff");
  context.fillStyle = "#04111d";
  context.textAlign = "center";
  context.font = '900 14px "Aptos", "Bahnschrift", sans-serif';
  context.fillText("18 HOLES", 950, 238);

  context.fillStyle = "rgba(255,255,255,0.12)";
  context.fillRect(54, 285, 972, 1);

  drawNineTable(context, draft, 0, 308, "FRONT NINE", "OUT");
  drawNineTable(context, draft, 9, 596, "BACK NINE", "IN");

  const totalDistance = getHoleTotal(draft.holes, "distance");
  const totalPar = getHoleTotal(draft.holes, "par");
  const grossScore = getHoleTotal(draft.holes, "score");
  const handicap = toNumber(draft.handicap);
  const netScore = grossScore !== null && handicap !== null ? grossScore - handicap : null;
  const toPar = netScore !== null && totalPar !== null ? netScore - totalPar : null;

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(255,255,255,0.66)";
  context.font = '850 15px "Aptos", "Bahnschrift", sans-serif';
  const distanceLabel =
    totalDistance === null
      ? "TOTAL DISTANCE --"
      : `TOTAL DISTANCE ${formatNumber(totalDistance, 0)} ${draft.distanceUnit.toUpperCase()}`;
  context.fillText(`${distanceLabel}  /  18 HOLES`, CANVAS_WIDTH / 2, 904);

  const cardX = 54;
  const cardGap = 12;
  const cardWidth = (972 - cardGap * 4) / 5;
  const cardY = 939;
  const metrics = [
    ["TOTAL PAR", formatNumber(totalPar, 0)],
    ["GROSS", formatNumber(grossScore, 0)],
    ["H'CAP", formatNumber(handicap)],
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
      index === 4
    );
  });

  const resultGradient = context.createLinearGradient(54, 1108, 1026, 1224);
  resultGradient.addColorStop(0, "rgba(37, 190, 239, 0.95)");
  resultGradient.addColorStop(0.58, "rgba(22, 128, 171, 0.95)");
  resultGradient.addColorStop(1, "rgba(255, 190, 24, 0.92)");
  fillRoundedRect(context, 54, 1111, 972, 118, 22, resultGradient);

  context.fillStyle = "rgba(3,17,29,0.7)";
  context.font = '900 15px "Aptos", "Bahnschrift", sans-serif';
  context.textAlign = "left";
  context.fillText("FINAL TEAM RESULT", 82, 1146);

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
  context.fillStyle = "#65d7ff";
  context.textAlign = "right";
  context.fillText("CROSSODOGGOLF.COM", 1020, 1284);

  context.fillStyle = "#ffbe18";
  context.fillRect(60, 1304, 242, 5);
  context.fillStyle = "#65d7ff";
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
    setDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
    }));
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
      await document.fonts.ready;
      drawScorecard(canvas, draft, logo);
      const blob = await canvasToBlob(canvas);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const teamSlug = slugify(draft.teamName) || "team";
      const courseSlug = slugify(draft.courseName) || "course";
      link.href = objectUrl;
      link.download = `cgs-scorecard-${teamSlug}-${courseSlug}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setShowValidation(false);
      setNotice({
        tone: "success",
        message: "Scorecard generated at 1080 x 1350 and downloaded as a PNG.",
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
  const handicap = toNumber(draft.handicap);
  const net =
    totals.score !== null && handicap !== null ? totals.score - handicap : null;
  const toPar = net !== null && totals.par !== null ? net - totals.par : null;
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
                  Start with the team and course, then enter each hole below. The
                  finished graphic updates live on the right.
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
                className="field-control"
                value={draft.handicap}
                onChange={(event) => updateField("handicap", event.target.value)}
                placeholder="e.g. 6.4"
                aria-invalid={showValidation && !draft.handicap.trim()}
              />
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
                Gross {formatNumber(totals.score, 0)}
              </span>
              <span className="rounded-full bg-[var(--gold)]/12 px-3 py-2 text-[var(--gold)]">
                Net {formatNumber(net)} / {formatRelative(toPar)}
              </span>
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
                  <table className="w-full min-w-[430px] border-collapse">
                    <thead>
                      <tr className="border-b border-white/8 text-left text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                        <th className="px-4 py-3">Hole</th>
                        <th className="px-2 py-3">
                          {draft.distanceUnit === "m" ? "Metres" : "Yards"}
                        </th>
                        <th className="px-2 py-3">Par</th>
                        <th className="px-2 py-3">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.holes.slice(startHole, startHole + 9).map((hole, index) => {
                        const holeIndex = startHole + index;
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 rounded-[1.4rem] border border-white/8 bg-white/4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
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
            {isGenerating ? "Generating full-size PNG..." : "Generate scorecard PNG"}
          </button>
          <button
            type="button"
            className="btn-secondary mt-3 w-full justify-center"
            onClick={clearDraft}
          >
            Clear for a new team
          </button>

          <p className="mt-4 text-xs leading-6 text-zinc-500">
            The PNG uses the exact preview shown above and is sized for a portrait
            Instagram feed post.
          </p>
        </section>
      </aside>
    </div>
  );
}
