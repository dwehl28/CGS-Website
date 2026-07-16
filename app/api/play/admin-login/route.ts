import {
  createAdminAppAccessToken,
  isValidAdminCredentials,
} from "@/lib/admin-auth";
import { normalizeString } from "@/lib/form-utils";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const username = normalizeString(body.username, 80);
  const password = normalizeString(body.password, 200);

  if (!isValidAdminCredentials(username, password)) {
    return Response.json(
      { message: "That admin username or password did not match." },
      { status: 401 }
    );
  }

  return Response.json({
    accessToken: createAdminAppAccessToken(),
    profile: {
      displayName: "CGS Admin",
      handle: "admin",
    },
  });
}
