import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateCategorySchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const { id } = await params;
    const body = await req.json();
    const parsed = updateCategorySchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Input pembaruan kategori tidak valid",
        400
      );
    }

    const existing = await prisma.category.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return apiError("NOT_FOUND", "Kategori tidak ditemukan", 404);
    }

    const updated = await prisma.category.update({
      where: { id },
      data: parsed.data,
    });

    return apiSuccess({
      id: updated.id,
      name: updated.name,
      icon: updated.icon,
      type: updated.type,
      budgetLimit: updated.budgetLimit ? Number(updated.budgetLimit) : null,
      budgetPeriod: updated.budgetPeriod,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("PATCH /api/categories/[id] error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memperbarui kategori", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const { id } = await params;
    const existing = await prisma.category.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return apiError("NOT_FOUND", "Kategori tidak ditemukan", 404);
    }

    // Lepaskan referensi categoryId pada transaksi yang ada sebelum delete
    await prisma.transaction.updateMany({
      where: { categoryId: id },
      data: { categoryId: null },
    });

    await prisma.category.delete({
      where: { id },
    });

    return apiSuccess({ message: "Kategori berhasil dihapus" });
  } catch (error) {
    console.error("DELETE /api/categories/[id] error:", error);
    return apiError("INTERNAL_ERROR", "Gagal menghapus kategori", 500);
  }
}
