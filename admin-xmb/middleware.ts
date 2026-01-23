import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check for session cookie (authjs.session-token or __Secure-authjs.session-token)
  const sessionToken = request.cookies.get("authjs.session-token")?.value 
    || request.cookies.get("__Secure-authjs.session-token")?.value;
  
  const isLoggedIn = !!sessionToken;

  const isOnDashboard = pathname.startsWith("/dashboard");
  const isOnLogin = pathname === "/login";
  const isOnRoot = pathname === "/";
  const isOnPasswordReset = pathname === "/forgot-password" || pathname === "/reset-password";

  // Allow password reset pages
  if (isOnPasswordReset) {
    return NextResponse.next();
  }

  if (isOnDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if ((isOnLogin || isOnRoot) && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isOnRoot && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|favicon.png|.*\\..*).*)"],
};