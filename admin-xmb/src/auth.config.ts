import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      const isOnDashboard = pathname.startsWith("/dashboard");
      const isOnLogin = pathname === "/login";
      const isOnRoot = pathname === "/";

      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false;
      }

      if ((isOnLogin || isOnRoot) && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      if (isOnRoot && !isLoggedIn) {
        return Response.redirect(new URL("/login", nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

