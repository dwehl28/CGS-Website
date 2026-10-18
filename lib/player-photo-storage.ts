import { randomUUID } from "node:crypto";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const CGS_PLAYER_PHOTO_BUCKET = "cgs-player-photos";
const CGS_PLAYER_PHOTO_SIZE_LIMIT = 5 * 1024 * 1024;
const CGS_PLAYER_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

function getPhotoFileExtension(contentType: string) {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "";
  }
}

async function ensureCgsPlayerPhotoBucket() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: buckets, error: listError } =
    await supabaseAdmin.storage.listBuckets();

  if (listError) {
    throw listError;
  }

  if (buckets.some((bucket) => bucket.id === CGS_PLAYER_PHOTO_BUCKET)) {
    return;
  }

  const { error: createError } = await supabaseAdmin.storage.createBucket(
    CGS_PLAYER_PHOTO_BUCKET,
    {
      public: true,
      fileSizeLimit: CGS_PLAYER_PHOTO_SIZE_LIMIT,
      allowedMimeTypes: [...CGS_PLAYER_PHOTO_MIME_TYPES],
    }
  );

  if (createError) {
    throw createError;
  }
}

export async function uploadCgsPlayerPhotoAsset(directory: string, file: File) {
  if (file.size <= 0) {
    return "";
  }

  if (file.size > CGS_PLAYER_PHOTO_SIZE_LIMIT) {
    throw new Error("Player photos must be 5MB or smaller.");
  }

  if (
    !CGS_PLAYER_PHOTO_MIME_TYPES.includes(
      file.type as (typeof CGS_PLAYER_PHOTO_MIME_TYPES)[number]
    )
  ) {
    throw new Error("Player photos must be JPG, PNG, or WebP.");
  }

  const safeDirectory = directory
    .replace(/[^a-zA-Z0-9/_-]/g, "")
    .replace(/^\/+|\/+$/g, "");

  if (!safeDirectory) {
    throw new Error("A player photo destination is required.");
  }

  await ensureCgsPlayerPhotoBucket();

  const supabaseAdmin = getSupabaseAdmin();
  const extension = getPhotoFileExtension(file.type);
  const objectPath = `${safeDirectory}/${Date.now().toString(36)}-${randomUUID()}.${extension}`;
  const { error } = await supabaseAdmin.storage
    .from(CGS_PLAYER_PHOTO_BUCKET)
    .upload(objectPath, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const { data } = supabaseAdmin.storage
    .from(CGS_PLAYER_PHOTO_BUCKET)
    .getPublicUrl(objectPath);

  return data.publicUrl;
}

export async function deleteCgsPlayerPhotoDirectory(directory: string) {
  const safeDirectory = directory
    .replace(/[^a-zA-Z0-9/_-]/g, "")
    .replace(/^\/+|\/+$/g, "");

  if (!safeDirectory) {
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: files, error: listError } = await supabaseAdmin.storage
    .from(CGS_PLAYER_PHOTO_BUCKET)
    .list(safeDirectory, { limit: 1000 });

  if (listError) {
    const message = listError.message.toLowerCase();
    if (message.includes("bucket") && message.includes("not found")) {
      return;
    }
    throw listError;
  }

  const paths = (files ?? [])
    .filter((file) => file.name)
    .map((file) => `${safeDirectory}/${file.name}`);

  if (paths.length === 0) {
    return;
  }

  const { error: removeError } = await supabaseAdmin.storage
    .from(CGS_PLAYER_PHOTO_BUCKET)
    .remove(paths);

  if (removeError) {
    throw removeError;
  }
}

export async function pruneCgsPlayerPhotoDirectory(
  directory: string,
  keepPublicUrl: string
) {
  const safeDirectory = directory
    .replace(/[^a-zA-Z0-9/_-]/g, "")
    .replace(/^\/+|\/+$/g, "");

  if (!safeDirectory) {
    return;
  }

  let keepFileName = "";

  try {
    keepFileName = decodeURIComponent(
      new URL(keepPublicUrl).pathname.split("/").at(-1) ?? ""
    );
  } catch {
    // A blank or external replacement URL means no uploaded file needs preserving.
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: files, error: listError } = await supabaseAdmin.storage
    .from(CGS_PLAYER_PHOTO_BUCKET)
    .list(safeDirectory, { limit: 1000 });

  if (listError) {
    const message = listError.message.toLowerCase();
    if (message.includes("bucket") && message.includes("not found")) {
      return;
    }
    throw listError;
  }

  const stalePaths = (files ?? [])
    .filter((file) => file.name && file.name !== keepFileName)
    .map((file) => `${safeDirectory}/${file.name}`);

  if (stalePaths.length === 0) {
    return;
  }

  const { error: removeError } = await supabaseAdmin.storage
    .from(CGS_PLAYER_PHOTO_BUCKET)
    .remove(stalePaths);

  if (removeError) {
    throw removeError;
  }
}
