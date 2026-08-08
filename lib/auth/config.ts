import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { loginSchema } from "@/lib/validation/auth";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Usuario / Email", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { username, password } = parsed.data;

        const configuredDevEmail = process.env.DEV_ADMIN_EMAIL || "admin@sdigital.local";
        const isLocalDevelopment = process.env.NEXTAUTH_URL?.includes("localhost") === true;
        let persistedDevUser: { email: string; name: string | null; username: string | null } | null = null;
        if (isLocalDevelopment) {
          try {
            const { prisma } = await import("@/lib/db/prisma");
            persistedDevUser = await prisma.user.findUnique({
              where: { id: "dev-admin-001" },
              select: { email: true, name: true, username: true },
            });
          } catch {
            // El login demo sigue funcionando si la base aún no tiene credenciales.
          }
        }
        const devUsernames = ["admin", "admin@sdigital.local", configuredDevEmail, persistedDevUser?.email, "admin local", "micael"].filter(Boolean).map((value) => value!.toLowerCase());
        const DEV_PASSWORD = "Admin1234!";

        if (
          isLocalDevelopment &&
          devUsernames.includes(username.toLowerCase().trim()) &&
          password === DEV_PASSWORD
        ) {
          return {
            id: "dev-admin-001",
            email: persistedDevUser?.email || configuredDevEmail,
            name: persistedDevUser?.name || "Micael Cedano",
          };
        }

        try {
          const { verifyUserCredentials } = await import(
            "@/lib/auth/credentials"
          );
          return await verifyUserCredentials(username, password);
        } catch (err) {
          console.warn("[auth] Error al verificar credenciales en DB", err);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 horas
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
  trustHost: true,
});
