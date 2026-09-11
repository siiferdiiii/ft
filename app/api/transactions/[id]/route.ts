import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateTransactionSchema } from "@/lib/validators";
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
    const parsed = updateTransactionSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Input pembaruan tidak valid",
        400
      );
    }

    const existing = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return apiError("NOT_FOUND", "Transaksi tidak ditemukan", 404);
    }

    const oldType = existing.type;
    const oldAmount = Number(existing.amount);
    const newType = parsed.data.type || oldType;
    const newAmount = parsed.data.amount !== undefined ? parsed.data.amount : oldAmount;
    const newWalletId = parsed.data.walletId || existing.walletId;

    const oldEffect = oldType === "INCOME" ? oldAmount : -oldAmount;
    const newEffect = newType === "INCOME" ? newAmount : -newAmount;

    await prisma.$transaction(async (tx) => {
      // Jika dompet berubah
      if (newWalletId !== existing.walletId) {
        // Revert saldo dompet lama
        await tx.wallet.update({
          where: { id: existing.walletId },
          data: { balance: { decrement: oldEffect } },
        });
        // Terapkan ke dompet baru
        await tx.wallet.update({
          where: { id: newWalletId },
          data: { balance: { increment: newEffect } },
        });
      } else {
        // Dompet sama, hitung selisih
        const diff = newEffect - oldEffect;
        if (diff !== 0) {
          await tx.wallet.update({
            where: { id: existing.walletId },
            data: { balance: { increment: diff } },
          });
        }
      }

      await tx.transaction.update({
        where: { id },
        data: {
          walletId: newWalletId,
          categoryId: parsed.data.categoryId !== undefined ? parsed.data.categoryId : existing.categoryId,
          type: newType,
          amount: newAmount,
          note: parsed.data.note !== undefined ? parsed.data.note : existing.note,
          transactionDate: parsed.data.transactionDate
            ? new Date(parsed.data.transactionDate)
            : existing.transactionDate,
        },
      });
    });

    return apiSuccess({ message: "Transaksi berhasil diperbarui" });
  } catch (error) {
    console.error("PATCH /api/transactions/[id] error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memperbarui transaksi", 500);
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
    const existing = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return apiError("NOT_FOUND", "Transaksi tidak ditemukan", 404);
    }

    const amount = Number(existing.amount);
    // Kembalikan efek saldo ke dompet
    const revertChange = existing.type === "INCOME" ? -amount : amount;

    await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: existing.walletId },
        data: { balance: { increment: revertChange } },
      });

      await tx.transaction.delete({
        where: { id },
      });
    });

    return apiSuccess({ message: "Transaksi berhasil dihapus" });
  } catch (error) {
    console.error("DELETE /api/transactions/[id] error:", error);
    return apiError("INTERNAL_ERROR", "Gagal menghapus transaksi", 500);
  }
}
