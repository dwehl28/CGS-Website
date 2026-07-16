"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  clearAdminSession,
  createAdminSession,
  isValidAdminCredentials,
  requireAdminAuthenticated,
} from "@/lib/admin-auth";
import {
  createClubhouseUpdate,
  setClubhouseUpdatePublishedState,
} from "@/lib/clubhouse-updates";
import { normalizeString } from "@/lib/form-utils";

export type AdminActionState = {
  message: string;
};

function parseOptionalDate(value: string) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
}

function isValidCallToActionHref(value: string) {
  return value.startsWith("/") || /^https:\/\/.+/i.test(value);
}

export async function loginAdminAction(
  _previousState: AdminActionState,
  formData: FormData
) {
  const submittedUsername = normalizeString(formData.get("username"), 80);
  const submittedPassword = normalizeString(formData.get("password"), 200);

  if (
    !submittedUsername ||
    !submittedPassword ||
    !isValidAdminCredentials(submittedUsername, submittedPassword)
  ) {
    return {
      message: "That admin username or password did not match. Try again.",
    };
  }

  await createAdminSession();
  revalidatePath("/clubhouse-admin");
  redirect("/clubhouse-admin");
}

export async function logoutAdminAction() {
  await clearAdminSession();
  revalidatePath("/clubhouse-admin");
  redirect("/clubhouse-admin");
}

export async function createClubhouseUpdateAction(
  _previousState: AdminActionState,
  formData: FormData
) {
  try {
    await requireAdminAuthenticated();
  } catch {
    return {
      message: "Your admin session expired. Refresh and sign in again.",
    };
  }

  const title = normalizeString(formData.get("title"), 120);
  const summary = normalizeString(formData.get("summary"), 320);
  const statusLabel =
    normalizeString(formData.get("status_label"), 60) || "Clubhouse note";
  const ctaLabel = normalizeString(formData.get("cta_label"), 40);
  const ctaHref = normalizeString(formData.get("cta_href"), 240);
  const startsAt = parseOptionalDate(normalizeString(formData.get("starts_at"), 40));
  const endsAt = parseOptionalDate(normalizeString(formData.get("ends_at"), 40));
  const isPinned = formData.get("is_pinned") === "on";

  if (!title || !summary) {
    return {
      message: "Title and summary are required for a clubhouse update.",
    };
  }

  if ((ctaLabel && !ctaHref) || (!ctaLabel && ctaHref)) {
    return {
      message: "If you add a call-to-action, include both the label and the link.",
    };
  }

  if (ctaHref && !isValidCallToActionHref(ctaHref)) {
    return {
      message: "Links must either start with / for internal pages or https:// for external ones.",
    };
  }

  try {
    await createClubhouseUpdate({
      title,
      summary,
      statusLabel,
      ctaLabel,
      ctaHref,
      startsAt,
      endsAt,
      isPinned,
    });
  } catch (error) {
    console.error("Create clubhouse update action error:", error);
    return {
      message:
        "The update could not be saved. Check that the latest Supabase migration has been applied.",
    };
  }

  revalidatePath("/");
  revalidatePath("/clubhouse-admin");

  return {
    message: "Clubhouse update saved and pushed into the live feed.",
  };
}

export async function toggleClubhouseUpdateVisibilityAction(formData: FormData) {
  await requireAdminAuthenticated();

  const id = Number(formData.get("id"));
  const nextPublishedState = formData.get("next_state") === "published";

  if (!Number.isFinite(id)) {
    redirect("/clubhouse-admin");
  }

  try {
    await setClubhouseUpdatePublishedState(id, nextPublishedState);
  } catch (error) {
    console.error("Toggle clubhouse update action error:", error);
  }

  revalidatePath("/");
  revalidatePath("/clubhouse-admin");
  redirect("/clubhouse-admin");
}
