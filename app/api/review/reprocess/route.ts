import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { reprocessStoredEmailsForUser } from "@/lib/reprocess";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/settings?error=not_connected", request.url), { status: 303 });

  try {
    const result = await reprocessStoredEmailsForUser(user.id);
    const params = new URLSearchParams({
      reprocessed: String(result.reclassified),
      confirmed: String(result.confirmed),
      pending: String(result.pending),
      ignored: String(result.ignored),
      deletedApplications: String(result.deletedApplications)
    });
    return NextResponse.redirect(new URL(`/dashboard?${params.toString()}`, request.url), { status: 303 });
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/settings?error=reprocess_failed", request.url), { status: 303 });
  }
}
