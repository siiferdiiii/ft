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

  for (const keyword of uniqueWords) {
    try {
      await tx.categoryKeyword.upsert({
        where: {
          userId_keyword_categoryId: {
            userId,
            keyword,
            categoryId,
          },
        },
        update: {
          frequency: { increment: 1 },
        },
        create: {
          userId,
          keyword,
          categoryId,
          frequency: 1,
        },
      });
    } catch {
      // Abaikan kendala upsert
    }
  }
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

        // 3. Buat setiap item sebagai transaksi individual yang terhubung ke grup
        const createdTransactions = [];
        for (const item of items) {
          const createdTx = await tx.transaction.create({
            data: {
              userId: user.id,
              walletId,
              categoryId: item.categoryId || null,
              groupId: group.id,
              type: "EXPENSE",
              amount: item.amount,
              note: item.note,
              source: "RECEIPT_SCAN",
              rawInput: merchant ? `${merchant} - ${item.note}` : item.note,
              receiptImageUrl: receiptImageUrl || null,
              transactionDate: parsedDate,
            },
          });

          createdTransactions.push(createdTx);

          // Kumpulkan data keyword untuk diproses di luar transaksi
          if (item.categoryId) {
            keywordQueue.push({ categoryId: item.categoryId, note: item.note });
          }
        }

        return {
          group,
          transactions: createdTransactions,
          newBalance: Number(updatedWallet.balance),
        };
      },
      { timeout: 15000 } // 15 detik — untuk resi dengan banyak item
    );

    // Keyword learning dijalankan di luar transaksi (non-kritis, tidak perlu atomic)
    for (const { categoryId, note: itemNote } of keywordQueue) {
      await recordItemCategoryKeywords(prisma, user.id, categoryId, itemNote).catch(() => {
        // Abaikan error keyword — tidak boleh gagalkan transaksi utama
      });
    }

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
