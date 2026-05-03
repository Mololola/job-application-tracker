import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForUser } from "@/lib/gmail";
import { USER_COOKIE } from "@/lib/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/settings?error=missing_code", request.url));
  }

  try {
    const user = await exchangeCodeForUser(code);
    const response = NextResponse.redirect(new URL("/settings?connected=1", request.url));
    response.cookies.set(USER_COOKIE, user.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/settings?error=oauth_failed", request.url));
  }
}
