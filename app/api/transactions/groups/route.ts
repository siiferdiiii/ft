import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { TransactionGroupDto, TransactionDto } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = { userId: user.id };
    if (dateFrom || dateTo) {
      whereClause.transactionDate = {};
      if (dateFrom) whereClause.transactionDate.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        whereClause.transactionDate.lte = end;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groups = await (prisma as any).transactionGroup.findMany({
      where: whereClause,
      include: {
        wallet: { select: { name: true } },
        transactions: {
          include: {
            category: { select: { name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: TransactionGroupDto[] = groups.map((g: any) => ({
      id: g.id,
      walletId: g.walletId,
      walletName: g.wallet?.name,
      totalAmount: Number(g.totalAmount),
      merchant: g.merchant,
      note: g.note,
      receiptImageUrl: g.receiptImageUrl,
      transactionDate: g.transactionDate.toISOString(),
      createdAt: g.createdAt.toISOString(),
      transactions: g.transactions.map((t: any): TransactionDto => ({
        id: t.id,
        walletId: t.walletId,
        categoryId: t.categoryId,
        categoryName: t.category?.name || null,
        groupId: g.id,
        type: t.type,
        amount: Number(t.amount),
        note: t.note,
        source: t.source,
        rawInput: t.rawInput,
        receiptImageUrl: t.receiptImageUrl,
        transactionDate: t.transactionDate.toISOString(),
        createdAt: t.createdAt.toISOString(),
      })),
    }));

    return apiSuccess(result);
  } catch (error) {
    console.error("GET /api/transactions/groups error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memuat riwayat grup transaksi", 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("id");
    if (!groupId) return apiError("BAD_REQUEST", "ID grup transaksi wajib diisi", 400);

    // Verify ownership before delete
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const group = await (prisma as any).transactionGroup.findUnique({
      where: { id: groupId },
      include: { transactions: { select: { amount: true } } },
    });

    if (!group || group.userId !== user.id) {
      return apiError("NOT_FOUND", "Grup transaksi tidak ditemukan", 404);
    }

    // Kembalikan saldo dompet sebelum menghapus
    await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: group.walletId },
        data: { balance: { increment: Number(group.totalAmount) } },
      });
      // Cascade delete via Prisma (transactions linked to group are deleted automatically)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tx as any).transactionGroup.delete({ where: { id: groupId } });
    });

    return apiSuccess({ message: "Grup transaksi berhasil dihapus dan saldo dikembalikan." });
  } catch (error) {
    console.error("DELETE /api/transactions/groups error:", error);
    return apiError("INTERNAL_ERROR", "Gagal menghapus grup transaksi", 500);
  }
}
