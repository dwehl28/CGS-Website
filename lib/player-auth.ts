import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isValidAdminAppAccessToken } from "@/lib/admin-auth";

const ADMIN_APP_USER = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "admin@crossodoggolf.com",
  user_metadata: {
    display_name: "CGS Admin",
    nickname: "Admin",
  },
};

export async function getAuthenticatedPlayerFromRequest(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    return {
      user: null,
      isAdmin: false,
      error: "Missing authentication token.",
    };
  }

  if (isValidAdminAppAccessToken(token)) {
    return {
      user: ADMIN_APP_USER,
      isAdmin: true,
      error: null,
    };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return {
      user: null,
      isAdmin: false,
      error: "Invalid or expired authentication token.",
    };
  }

  return {
    user: data.user,
    isAdmin: false,
    error: null,
  };
}
