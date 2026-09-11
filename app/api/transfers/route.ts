import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { transferSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { TransferDto } from "@/lib/types";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const transfers = await prisma.transfer.findMany({
      where: { userId: user.id },
      include: {
        fromWallet: { select: { name: true } },
        toWallet: { select: { name: true } },
      },
      orderBy: { transferDate: "desc" },
      take: 50,
    });

    const result: TransferDto[] = transfers.map((t) => ({
      id: t.id,
      fromWalletId: t.fromWalletId,
      fromWalletName: t.fromWallet.name,
      toWalletId: t.toWalletId,
      toWalletName: t.toWallet.name,
      amount: Number(t.amount),
      note: t.note,
      transferDate: t.transferDate.toISOString(),
      createdAt: t.createdAt.toISOString(),
    }));

    return apiSuccess(result);
  } catch (error) {
    console.error("GET /api/transfers error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memuat riwayat transfer", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const body = await req.json();
    const parsed = transferSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Data transfer tidak valid",
        400
      );
    }

    const { fromWalletId, toWalletId, amount, note, transferDate } = parsed.data;

    // Verifikasi kedua dompet milik user
    const [fromWallet, toWallet] = await Promise.all([
      prisma.wallet.findFirst({ where: { id: fromWalletId, userId: user.id } }),
      prisma.wallet.findFirst({ where: { id: toWalletId, userId: user.id } }),
    ]);

    if (!fromWallet || !toWallet) {
      return apiError("NOT_FOUND", "Dompet asal atau tujuan tidak ditemukan", 404);
    }

    // Eksekusi transfer atomik
    const record = await prisma.$transaction(async (tx) => {
      // Kurangi dompet asal
      await tx.wallet.update({
        where: { id: fromWalletId },
        data: { balance: { decrement: amount } },
      });

      // Tambah dompet tujuan
      await tx.wallet.update({
        where: { id: toWalletId },
        data: { balance: { increment: amount } },
      });

      // Buat row transfer
      return tx.transfer.create({
        data: {
          userId: user.id,
          fromWalletId,
          toWalletId,
          amount,
          note: note || null,
          transferDate: transferDate ? new Date(transferDate) : new Date(),
        },
        include: {
          fromWallet: { select: { name: true } },
          toWallet: { select: { name: true } },
        },
      });
    });

    const dto: TransferDto = {
      id: record.id,
      fromWalletId: record.fromWalletId,
      fromWalletName: record.fromWallet.name,
      toWalletId: record.toWalletId,
      toWalletName: record.toWallet.name,
      amount: Number(record.amount),
      note: record.note,
      transferDate: record.transferDate.toISOString(),
      createdAt: record.createdAt.toISOString(),
    };

    return apiSuccess(dto, 201);
  } catch (error) {
    console.error("POST /api/transfers error:", error);
    return apiError("INTERNAL_ERROR", "Gagal melakukan transfer saldo", 500);
  }
}
