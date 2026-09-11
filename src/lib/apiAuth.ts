import type { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  userHasRole,
  type AuthenticatedUser,
} from "@/lib/auth";

type ApiAuthorizationResult =
  | {
      user: AuthenticatedUser;
      response: null;
    }
  | {
      user: null;
      response: NextResponse;
    };

export async function requireApiUser(
  allowedRoles?: readonly UserRole[]
): Promise<ApiAuthorizationResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  if (allowedRoles && !userHasRole(user, allowedRoles)) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  return {
    user,
    response: null,
  };
}
