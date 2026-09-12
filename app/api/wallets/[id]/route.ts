import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateWalletSchema } from "@/lib/validators";
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
    const parsed = updateWalletSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Input pembaruan dompet tidak valid",
        400
      );
    }

    const existing = await prisma.wallet.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return apiError("NOT_FOUND", "Dompet tidak ditemukan", 404);
    }

    const updated = await prisma.wallet.update({
      where: { id },
      data: parsed.data,
    });

    return apiSuccess({
      id: updated.id,
      name: updated.name,
      type: updated.type,
      icon: updated.icon,
      color: updated.color,
      balance: Number(updated.balance),
      isArchived: updated.isArchived,
      isPerpetualFund: Boolean(updated.isPerpetualFund),
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("PATCH /api/wallets/[id] error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memperbarui dompet", 500);
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
    const existing = await prisma.wallet.findFirst({
      where: { id, userId: user.id },
      include: {
        _count: {
          select: {
            transactions: true,
            transfersFrom: true,
            transfersTo: true,
          },
        },
      },
    });

    if (!existing) {
      return apiError("NOT_FOUND", "Dompet tidak ditemukan", 404);
    }

    const hasHistory =
      existing._count.transactions > 0 ||
      existing._count.transfersFrom > 0 ||
      existing._count.transfersTo > 0;

    // Per PRD §4.5: Dompet dengan riwayat transaksi tidak boleh di-hard delete, hanya diarsipkan
    if (hasHistory) {
      await prisma.wallet.update({
        where: { id },
        data: { isArchived: true },
      });
      return apiSuccess({ message: "Dompet berhasil diarsipkan karena memiliki riwayat transaksi" });
    } else {
      await prisma.wallet.delete({
        where: { id },
      });
      return apiSuccess({ message: "Dompet berhasil dihapus" });
    }
  } catch (error) {
    console.error("DELETE /api/wallets/[id] error:", error);
    return apiError("INTERNAL_ERROR", "Gagal menghapus dompet", 500);
  }
}
