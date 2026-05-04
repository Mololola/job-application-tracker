import { NextRequest, NextResponse } from "next/server";
import { ApplicationStatus, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function isTerminalStatus(status: ApplicationStatus): boolean {
  return status === "REJECTED" || status === "WITHDRAWN";
}

function chooseMergedStatus(
  sourceStatus: ApplicationStatus,
  targetStatus: ApplicationStatus,
): ApplicationStatus {
  const priority: ApplicationStatus[] = [
    "REJECTED",
    "OFFER",
    "INTERVIEW",
    "AI_INTERVIEW",
    "CODING_TASK",
    "ASSESSMENT",
    "APPLIED",
    "WITHDRAWN",
    "UNKNOWN",
  ];

  const sourceIndex = priority.indexOf(sourceStatus);
  const targetIndex = priority.indexOf(targetStatus);

  if (sourceIndex === -1) return targetStatus;
  if (targetIndex === -1) return sourceStatus;

  return sourceIndex < targetIndex ? sourceStatus : targetStatus;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 },
      );
    }

    const { id: sourceApplicationId } = await context.params;
    const body = await request.json();

    const targetApplicationId = cleanText(body.targetApplicationId);

    if (!targetApplicationId) {
      return NextResponse.json(
        { error: "Target application is required." },
        { status: 400 },
      );
    }

    if (sourceApplicationId === targetApplicationId) {
      return NextResponse.json(
        { error: "You cannot merge an application into itself." },
        { status: 400 },
      );
    }

    const [sourceApplication, targetApplication] = await Promise.all([
      prisma.application.findFirst({
        where: {
          id: sourceApplicationId,
          userId: user.id,
        },
        include: {
          events: true,
          tasks: true,
          candidates: true,
        },
      }),
      prisma.application.findFirst({
        where: {
          id: targetApplicationId,
          userId: user.id,
        },
      }),
    ]);

    if (!sourceApplication) {
      return NextResponse.json(
        { error: "Source application not found." },
        { status: 404 },
      );
    }

    if (!targetApplication) {
      return NextResponse.json(
        { error: "Target application not found." },
        { status: 404 },
      );
    }

    const mergedStatus = chooseMergedStatus(
      sourceApplication.status,
      targetApplication.status,
    );

    const result = await prisma.$transaction(async (tx) => {
      await tx.applicationEvent.updateMany({
        where: {
          applicationId: sourceApplication.id,
        },
        data: {
          applicationId: targetApplication.id,
        },
      });

      await tx.task.updateMany({
        where: {
          applicationId: sourceApplication.id,
        },
        data: {
          applicationId: targetApplication.id,
        },
      });

      await tx.emailCandidate.updateMany({
        where: {
          applicationId: sourceApplication.id,
        },
        data: {
          applicationId: targetApplication.id,
          reviewStatus: "CONFIRMED",
        },
      });

      const updatedTarget = await tx.application.update({
        where: {
          id: targetApplication.id,
        },
        data: {
          status: mergedStatus,
          updatedAt: new Date(),
        },
      });

      let cancelledTasks = 0;

      if (isTerminalStatus(mergedStatus)) {
        const taskUpdate = await tx.task.updateMany({
          where: {
            applicationId: targetApplication.id,
            status: TaskStatus.TODO,
          },
          data: {
            status: TaskStatus.CANCELLED,
          },
        });

        cancelledTasks = taskUpdate.count;
      }

      await tx.applicationEvent.create({
        data: {
          applicationId: targetApplication.id,
          type: "GENERAL_UPDATE",
          emailSubject: "Manual merge",
          emailFrom: "manual",
          emailDate: new Date(),
          gmailMessageId: `manual-merge-${sourceApplication.id}-${targetApplication.id}-${Date.now()}`,
          summary: `Merged duplicate application "${sourceApplication.company} — ${sourceApplication.position}" into this application.`,
          confidence: 1,
          deadline: null,
        },
      });

      await tx.application.delete({
        where: {
          id: sourceApplication.id,
        },
      });

      return {
        targetApplication: updatedTarget,
        movedEvents: sourceApplication.events.length,
        movedTasks: sourceApplication.tasks.length,
        movedEmails: sourceApplication.candidates.length,
        cancelledTasks,
      };
    });

    return NextResponse.json({
      ok: true,
      targetApplicationId: result.targetApplication.id,
      movedEvents: result.movedEvents,
      movedTasks: result.movedTasks,
      movedEmails: result.movedEmails,
      cancelledTasks: result.cancelledTasks,
    });
  } catch (error) {
    console.error("Failed to merge applications", error);

    return NextResponse.json(
      { error: "Failed to merge applications." },
      { status: 500 },
    );
  }
}
