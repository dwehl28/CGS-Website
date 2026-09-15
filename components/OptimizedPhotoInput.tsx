"use client";

import {
  type ChangeEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

type OptimizedPhotoInputProps = {
  id?: string;
  name: string;
  label: string;
  className?: string;
  labelClassName?: string;
};

type PhotoInputState =
  | { status: "idle"; message: string }
  | { status: "processing"; message: string }
  | { status: "ready"; message: string }
  | { status: "error"; message: string };

const ACCEPTED_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const TARGET_UPLOAD_BYTES = 2 * 1024 * 1024;
const OPTIMIZATION_ATTEMPTS = [
  { maxEdge: 1600, quality: 0.84 },
  { maxEdge: 1400, quality: 0.78 },
  { maxEdge: 1200, quality: 0.72 },
  { maxEdge: 1000, quality: 0.66 },
] as const;

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))}KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
}

function loadPhoto(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("This photo could not be read. Try exporting it as a JPG."));
    };
    image.src = objectUrl;
  });
}

function renderOptimizedPhoto(
  image: HTMLImageElement,
  maxEdge: number,
  quality: number
) {
  const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longestEdge > maxEdge ? maxEdge / longestEdge : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("This browser could not prepare the photo for upload.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("This browser could not prepare the photo for upload."));
      },
      "image/webp",
      quality
    );
  });
}

async function optimizePhoto(file: File) {
  if (!ACCEPTED_PHOTO_TYPES.has(file.type)) {
    throw new Error(
      "Choose a JPG, PNG or WebP photo. HEIC photos need to be exported as JPG first."
    );
  }

  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Choose a photo smaller than 25MB.");
  }

  if (file.size <= TARGET_UPLOAD_BYTES) {
    return file;
  }

  const image = await loadPhoto(file);
  let smallestBlob: Blob | null = null;

  for (const attempt of OPTIMIZATION_ATTEMPTS) {
    const blob = await renderOptimizedPhoto(
      image,
      attempt.maxEdge,
      attempt.quality
    );

    if (!smallestBlob || blob.size < smallestBlob.size) {
      smallestBlob = blob;
    }

    if (blob.size <= TARGET_UPLOAD_BYTES) {
      break;
    }
  }

  if (!smallestBlob || smallestBlob.size > TARGET_UPLOAD_BYTES) {
    throw new Error("This photo is still too large after resizing. Try a smaller image.");
  }

  const outputType = ACCEPTED_PHOTO_TYPES.has(smallestBlob.type)
    ? smallestBlob.type
    : "image/webp";
  const extension =
    outputType === "image/png" ? "png" : outputType === "image/jpeg" ? "jpg" : "webp";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "player-photo";
  return new File([smallestBlob], `${baseName}.${extension}`, {
    type: outputType,
    lastModified: Date.now(),
  });
}

function assignPhotoToInput(input: HTMLInputElement, file: File) {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
}

export default function OptimizedPhotoInput({
  id,
  name,
  label,
  className = "grid gap-3",
  labelClassName = "field-label",
}: OptimizedPhotoInputProps) {
  const generatedId = useId();
  const inputId = id ?? `optimized-photo-${generatedId}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef(0);
  const [state, setState] = useState<PhotoInputState>({
    status: "idle",
    message: "JPG, PNG or WebP up to 25MB. Large photos resize automatically.",
  });

  useEffect(() => {
    const form = inputRef.current?.form;

    if (!form) {
      return;
    }

    const handleReset = () => {
      selectionRef.current += 1;
      inputRef.current?.setCustomValidity("");
      setState({
        status: "idle",
        message: "JPG, PNG or WebP up to 25MB. Large photos resize automatically.",
      });
    };

    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, []);

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const selectedPhoto = input.files?.[0];

    if (!selectedPhoto) {
      return;
    }

    const selectionId = selectionRef.current + 1;
    selectionRef.current = selectionId;
    input.value = "";
    input.setCustomValidity("Please wait while the photo is prepared.");
    setState({
      status: "processing",
      message: "Preparing photo for a reliable upload...",
    });

    try {
      const preparedPhoto = await optimizePhoto(selectedPhoto);

      if (selectionRef.current !== selectionId || !inputRef.current) {
        return;
      }

      assignPhotoToInput(inputRef.current, preparedPhoto);
      inputRef.current.setCustomValidity("");
      setState({
        status: "ready",
        message: `Ready to upload: ${formatFileSize(preparedPhoto.size)}.`,
      });
    } catch (error) {
      if (selectionRef.current !== selectionId || !inputRef.current) {
        return;
      }

      inputRef.current.setCustomValidity("");
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "This photo could not be prepared. Try a different JPG or PNG.",
      });
    }
  }

  return (
    <div className={className}>
      <label className={labelClassName} htmlFor={inputId}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp"
        className="field-control"
        onChange={handlePhotoChange}
        aria-describedby={`${inputId}-status`}
      />
      <p
        id={`${inputId}-status`}
        className={`text-xs leading-5 ${
          state.status === "error"
            ? "text-red-300"
            : state.status === "ready"
              ? "text-emerald-300"
              : "text-zinc-500"
        }`}
        aria-live="polite"
      >
        {state.message}
      </p>
    </div>
  );
}
