import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/settings?error=not_connected", request.url), { status: 303 });

  const formData = await request.formData();
  const taskId = formData.get("taskId")?.toString();
  if (!taskId) return NextResponse.redirect(new URL("/tasks", request.url), { status: 303 });

  const task = await prisma.task.findFirst({
    where: { id: taskId, application: { userId: user.id } }
  });

  if (task) {
    await prisma.task.updateMany({
      where: {
        applicationId: task.applicationId,
        type: task.type,
        status: "TODO"
      },
      data: { status: "DONE" }
    });

    await prisma.application.updateMany({
      where: {
        id: task.applicationId,
        status: { in: ["INTERVIEW", "AI_INTERVIEW", "CODING_TASK", "ASSESSMENT"] }
      },
      data: { status: "APPLIED" }
    });
  }

  return NextResponse.redirect(new URL("/tasks", request.url), { status: 303 });
}
