import type { UserRole } from "@prisma/client";
import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async signIn({ user }) {
      const email = user.email?.trim().toLowerCase();

      if (!email) {
        return false;
      }

      const databaseUser = await prisma.user.findUnique({
        where: { email },
        select: {
          isActive: true,
        },
      });

      return databaseUser?.isActive === true;
    },

    async jwt({ token }) {
      const email = token.email?.trim().toLowerCase();

      if (!email) {
        throw new Error("Authenticated account has no email address.");
      }

      const databaseUser = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          role: true,
          isActive: true,
        },
      });

      if (!databaseUser || !databaseUser.isActive) {
        throw new Error("User is not allowed.");
      }

      token.userId = databaseUser.id;
      token.role = databaseUser.role;

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId;
        session.user.role = token.role;
      }

      return session;
    },
  },
};

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export function userHasRole(
  user: AuthenticatedUser,
  allowedRoles: readonly UserRole[]
): boolean {
  return allowedRoles.includes(user.role);
}
