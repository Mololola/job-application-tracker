import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/gmail";

export async function GET() {
  return NextResponse.redirect(getGoogleAuthUrl());
}
