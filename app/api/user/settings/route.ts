import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userSettingsSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { UserSettingsDto } from "@/lib/types";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    const percent = (dbUser as unknown as { perpetualFundPercent?: number })?.perpetualFundPercent ?? 10;

    const data: UserSettingsDto = {
      perpetualFundPercent: percent,
      email: user.email,
      name: user.name,
    };

    return apiSuccess(data);
  } catch (error) {
    console.error("GET /api/user/settings error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memuat pengaturan pengguna", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const body = await req.json();
    const parsed = userSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Input pengaturan tidak valid",
        400
      );
    }

    const { perpetualFundPercent } = parsed.data;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        perpetualFundPercent,
      },
    });

    const data: UserSettingsDto = {
      perpetualFundPercent: (updated as unknown as { perpetualFundPercent?: number })?.perpetualFundPercent ?? perpetualFundPercent,
      email: updated.email,
      name: updated.name,
    };

    return apiSuccess(data);
  } catch (error) {
    console.error("PATCH /api/user/settings error:", error);
    return apiError("INTERNAL_ERROR", "Gagal menyimpan pengaturan pengguna", 500);
  }
}
