import { NextRequest, NextResponse } from "next/server";
import { ApplicationStatus, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

const VALID_STATUSES = new Set<string>(Object.values(ApplicationStatus));

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

function isTerminalStatus(status: ApplicationStatus): boolean {
  return status === "REJECTED" || status === "WITHDRAWN";
}

export async function PATCH(
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

    const { id } = await context.params;
    const body = await request.json();

    const company = cleanText(body.company);
    const position = cleanText(body.position);
    const status = cleanText(body.status);

    if (!company) {
      return NextResponse.json(
        { error: "Company is required." },
        { status: 400 },
      );
    }

    if (!position) {
      return NextResponse.json(
        { error: "Position is required." },
        { status: 400 },
      );
    }

    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { error: `Invalid status: ${status}` },
        { status: 400 },
      );
    }

    const existingApplication = await prisma.application.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        tasks: true,
      },
    });

    if (!existingApplication) {
      return NextResponse.json(
        { error: "Application not found." },
        { status: 404 },
      );
    }

    const nextStatus = status as ApplicationStatus;

    const result = await prisma.$transaction(async (tx) => {
      const updatedApplication = await tx.application.update({
        where: {
          id,
        },
        data: {
          company,
          position,
          status: nextStatus,
        },
      });

      let cancelledTasks = 0;

      if (isTerminalStatus(nextStatus)) {
        const taskUpdate = await tx.task.updateMany({
          where: {
            applicationId: id,
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
          applicationId: id,
          type: "GENERAL_UPDATE",
          emailSubject: "Manual correction",
          emailFrom: "manual",
          emailDate: new Date(),
          gmailMessageId: `manual-${id}-${Date.now()}`,
          summary: `Application manually corrected. Company: ${company}. Position: ${position}. Status: ${nextStatus}.`,
          confidence: 1,
          deadline: null,
        },
      });

      return {
        updatedApplication,
        cancelledTasks,
      };
    });

    return NextResponse.json({
      ok: true,
      application: result.updatedApplication,
      cancelledTasks: result.cancelledTasks,
    });
  } catch (error) {
    console.error("Failed to update application", error);

    return NextResponse.json(
      { error: "Failed to update application." },
      { status: 500 },
    );
  }
}
