import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/apiResponse";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        userCode: true,
        ocrQuota: true,
        aiBudgetQuota: true,
        tier: true,
        perpetualFundPercent: true,
        createdAt: true,
      },
    });

    if (!user) {
      return apiError("NOT_FOUND", "Pengguna tidak ditemukan", 404);
    }

    return apiSuccess(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        userCode: user.userCode || currentUser.userCode || "FT-84920",
        ocrQuota: user.ocrQuota ?? 3,
        aiBudgetQuota: user.aiBudgetQuota ?? 1,
        tier: user.tier || "FREE",
        perpetualFundPercent: user.perpetualFundPercent ?? 10,
        createdAt: user.createdAt.toISOString(),
      },
      200,
      { "Cache-Control": "private, no-cache, stale-while-revalidate=60" }
    );
  } catch (error) {
    console.error("GET /api/user/profile error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memuat profil pengguna", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const body = await req.json();
    const { name, perpetualFundPercent } = body;

    const updated = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(typeof perpetualFundPercent === "number" ? { perpetualFundPercent } : {}),
      },
    });

    return apiSuccess({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      userCode: updated.userCode,
      ocrQuota: updated.ocrQuota,
      aiBudgetQuota: updated.aiBudgetQuota,
      tier: updated.tier,
      perpetualFundPercent: updated.perpetualFundPercent,
    });
  } catch (error) {
    console.error("PATCH /api/user/profile error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memperbarui profil pengguna", 500);
  }
}
