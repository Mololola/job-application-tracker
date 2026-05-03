import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const USER_COOKIE = "jat_user_id";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get(USER_COOKIE)?.value;
  if (!userId) return null;

  return prisma.user.findUnique({ where: { id: userId } });
}
