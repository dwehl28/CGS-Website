"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminAuthenticated } from "@/lib/admin-auth";
import {
  type AdminInboxSubmission,
  type AdminSubmissionStatus,
  updateInboxSubmissionStatus,
} from "@/lib/admin-dashboard";

function normalizeInboxType(value: FormDataEntryValue | null): AdminInboxSubmission["type"] | null {
  if (value === "membership" || value === "contact" || value === "event") {
    return value;
  }

  return null;
}

function normalizeStatus(value: FormDataEntryValue | null): AdminSubmissionStatus | null {
  if (value === "new" || value === "contacted" || value === "closed") {
    return value;
  }

  return null;
}

function normalizeReturnTo(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "/clubhouse-admin/inbox";
  }

  const normalizedValue = value.trim();

  if (!normalizedValue.startsWith("/clubhouse-admin/inbox")) {
    return "/clubhouse-admin/inbox";
  }

  return normalizedValue;
}

export async function updateInboxSubmissionStatusAction(formData: FormData) {
  await requireAdminAuthenticated();

  const type = normalizeInboxType(formData.get("type"));
  const status = normalizeStatus(formData.get("status"));
  const id = Number(formData.get("id"));
  const returnTo = normalizeReturnTo(formData.get("return_to"));

  if (!type || !status || !Number.isFinite(id)) {
    redirect(returnTo);
  }

  try {
    await updateInboxSubmissionStatus(type, id, status);
  } catch (error) {
    console.error("Update inbox submission status action error:", error);
  }

  revalidatePath("/clubhouse-admin");
  revalidatePath("/clubhouse-admin/inbox");
  redirect(returnTo);
}
