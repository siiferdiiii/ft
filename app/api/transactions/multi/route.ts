import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { multiTransactionSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";

const STOPWORDS = new Set([
  "beli", "bayar", "untuk", "buat", "dan", "dari", "ke", "di", "ini", "itu",
  "ada", "dapat", "terima", "rp", "rupiah", "ribu", "rb", "juta", "jt", "k",
  "saya", "kamu", "aku", "pada", "adalah", "lagi", "mau"
]);

// Helper keyword learning untuk setiap item produk
async function recordItemCategoryKeywords(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  userId: string,
  categoryId: string,
  text: string
): Promise<void> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && isNaN(Number(w)));

  const uniqueWords = Array.from(new Set(words));

  // Parallel upsert — jauh lebih cepat dari sequential
  await Promise.allSettled(
    uniqueWords.map((keyword) =>
      tx.categoryKeyword.upsert({
        where: { userId_keyword_categoryId: { userId, keyword, categoryId } },
        update: { frequency: { increment: 1 } },
        create: { userId, keyword, categoryId, frequency: 1 },
      })
    )
  );
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const body = await req.json();
    const parsed = multiTransactionSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Data multi-transaksi tidak valid",
        400
      );
    }

    const { walletId, merchant, note, receiptImageUrl, transactionDate, items } = parsed.data;

    // Verifikasi dompet milik pengguna
    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, userId: user.id },
    });

    if (!wallet) {
      return apiError("NOT_FOUND", "Dompet tidak ditemukan atau bukan milik Anda", 404);
    }

    // Hitung total pengeluaran dari seluruh item
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const parsedDate = transactionDate ? new Date(transactionDate) : new Date();

    // Jalankan seluruh operasi dalam prisma.$transaction atomik
    // Timeout dinaikkan ke 15 detik untuk resi dengan banyak item
    const keywordQueue: { categoryId: string; note: string }[] = [];

    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Potong saldo dompet sebesar total belanja
        const updatedWallet = await tx.wallet.update({
          where: { id: walletId },
          data: {
            balance: { decrement: totalAmount },
          },
        });

        // 2. Buat grup transaksi belanja
        const group = await tx.transactionGroup.create({
          data: {
            userId: user.id,
            walletId,
            totalAmount,
            merchant: merchant || null,
            note: note || (merchant ? `Belanja di ${merchant}` : "Belanja Multi-Item"),
            receiptImageUrl: receiptImageUrl || null,
            transactionDate: parsedDate,
          },
        });

        // 3. Buat semua item sekaligus dengan createMany (1 round-trip DB, jauh lebih cepat)
        await tx.transaction.createMany({
          data: items.map((item) => {
            // Kumpulkan keyword untuk diproses setelah transaksi
            if (item.categoryId) {
              keywordQueue.push({ categoryId: item.categoryId, note: item.note });
            }
            return {
              userId: user.id,
              walletId,
              categoryId: item.categoryId || null,
              groupId: group.id,
              type: "EXPENSE" as const,
              amount: item.amount,
              note: item.note,
              source: "RECEIPT_SCAN",
              rawInput: merchant ? `${merchant} - ${item.note}` : item.note,
              receiptImageUrl: receiptImageUrl || null,
              transactionDate: parsedDate,
            };
          }),
        });

        return {
          group,
          newBalance: Number(updatedWallet.balance),
        };
      },
      { timeout: 10000 } // 10 detik cukup karena sudah pakai createMany
    );

    // Keyword learning: fire-and-forget — tidak memblokir response
    Promise.allSettled(
      keywordQueue.map(({ categoryId, note: itemNote }) =>
        recordItemCategoryKeywords(prisma, user.id, categoryId, itemNote)
      )
    ).catch(() => {/* abaikan */});

    return apiSuccess({
      message: `Berhasil mencatat ${items.length} item transaksi belanja ke grup.`,
      group: {
        id: result.group.id,
        merchant: result.group.merchant,
        totalAmount,
        transactionDate: result.group.transactionDate.toISOString(),
        itemsCount: items.length,
      },
      newBalance: result.newBalance,
    });
  } catch (error) {
    console.error("POST /api/transactions/multi error:", error);
    return apiError("INTERNAL_ERROR", "Gagal menyimpan multi-transaksi", 500);
  }
}
