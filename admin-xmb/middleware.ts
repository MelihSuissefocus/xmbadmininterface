import { auth } from "@/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isOnDashboard = pathname.startsWith("/dashboard");
  const isOnLogin = pathname === "/login";
  const isOnRoot = pathname === "/";
  const isOnPasswordReset = pathname === "/forgot-password" || pathname === "/reset-password";

  if (isOnDashboard && !isLoggedIn) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }

  if ((isOnLogin || isOnRoot) && isLoggedIn) {
    return Response.redirect(new URL("/dashboard", req.nextUrl));
  }

  if (isOnRoot && !isLoggedIn) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};