import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateAssetSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { AssetDto } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const { id } = await params;
    const body = await req.json();
    const parsed = updateAssetSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Data perubahan aset tidak valid",
        400
      );
    }

    const existing = await prisma.asset.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return apiError("NOT_FOUND", "Aset tidak ditemukan", 404);
    }

    const updateData: {
      name?: string;
      category?: string;
      value?: number;
      liquidityTier?: "INSTANT" | "T3" | "ILLIQUID";
      lastValuationAt?: Date;
      isArchived?: boolean;
    } = {};

    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.category !== undefined) updateData.category = parsed.data.category;
    if (parsed.data.liquidityTier !== undefined) updateData.liquidityTier = parsed.data.liquidityTier;
    if (parsed.data.isArchived !== undefined) updateData.isArchived = parsed.data.isArchived;

    if (parsed.data.value !== undefined) {
      updateData.value = parsed.data.value;
      // Perbarui lastValuationAt saat nilai diubah (PRD_ASET_UTANG §2.2)
      updateData.lastValuationAt = new Date();
    }

    const updated = await prisma.asset.update({
      where: { id },
      data: updateData,
    });

    const dto: AssetDto = {
      id: updated.id,
      name: updated.name,
      category: updated.category,
      value: Number(updated.value),
      liquidityTier: updated.liquidityTier,
      lastValuationAt: updated.lastValuationAt.toISOString(),
      isArchived: updated.isArchived,
      createdAt: updated.createdAt.toISOString(),
    };

    return apiSuccess(dto);
  } catch (error) {
    console.error("PATCH /api/assets/[id] error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memperbarui aset", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const { id } = await params;

    const existing = await prisma.asset.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return apiError("NOT_FOUND", "Aset tidak ditemukan", 404);
    }

    // Soft delete / archive (PRD_ASET_UTANG §2.2)
    await prisma.asset.update({
      where: { id },
      data: { isArchived: true },
    });

    return apiSuccess({ message: "Aset berhasil diarsipkan" });
  } catch (error) {
    console.error("DELETE /api/assets/[id] error:", error);
    return apiError("INTERNAL_ERROR", "Gagal menghapus aset", 500);
  }
}
