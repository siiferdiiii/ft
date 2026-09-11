import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { transactionSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { TransactionDto } from "@/lib/types";

// Kata-kata umum (stopwords) yang diabaikan saat belajar kategori
const STOPWORDS = new Set([
  "beli", "bayar", "untuk", "buat", "dan", "dari", "ke", "di", "ini", "itu",
  "ada", "dapat", "terima", "rp", "rupiah", "ribu", "rb", "juta", "jt", "k",
  "saya", "kamu", "aku", "pada", "adalah", "lagi", "mau"
]);

/**
 * Helper untuk memperbarui frekuensi keyword pada CategoryKeyword
 */
async function recordCategoryKeywords(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
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
      // Abaikan jika terjadi constraint conflict
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const walletId = searchParams.get("walletId");
    const categoryId = searchParams.get("categoryId");
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const whereClause: Prisma.TransactionWhereInput = {
      userId: user.id,
    };

    if (walletId) whereClause.walletId = walletId;
    if (categoryId) whereClause.categoryId = categoryId;
    if (type === "INCOME" || type === "EXPENSE") whereClause.type = type;

    // Filter pencarian berdasarkan catatan atau nominal
    if (search) {
      const searchNum = parseInt(search.replace(/[^\d]/g, ""), 10);
      whereClause.OR = [
        { note: { contains: search, mode: "insensitive" } },
        ...(searchNum && !isNaN(searchNum) ? [{ amount: searchNum }] : []),
      ];
    }

    // Filter rentang tanggal
    if (dateFrom || dateTo) {
      whereClause.transactionDate = {};
      if (dateFrom) (whereClause.transactionDate as Record<string, Date>).gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        (whereClause.transactionDate as Record<string, Date>).lte = endDate;
      }
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      include: {
        wallet: { select: { name: true } },
        category: { select: { name: true } },
      },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      take: Math.min(limit, 200),
      skip: offset,
    });

    const result: TransactionDto[] = transactions.map((t) => ({
      id: t.id,
      walletId: t.walletId,
      walletName: t.wallet?.name,
      categoryId: t.categoryId,
      categoryName: t.category?.name || null,
      type: t.type,
      amount: Number(t.amount),
      note: t.note,
      source: t.source,
      rawInput: t.rawInput,
      receiptImageUrl: t.receiptImageUrl,
      transactionDate: t.transactionDate.toISOString(),
      createdAt: t.createdAt.toISOString(),
    }));

    return apiSuccess(result);
  } catch (error) {
    console.error("GET /api/transactions error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memuat riwayat transaksi", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const body = await req.json();
    const parsed = transactionSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Data transaksi tidak valid",
        400
      );
    }

    const {
      walletId,
      categoryId,
      type,
      amount,
      note,
      source,
      rawInput,
      receiptImageUrl,
      transactionDate,
    } = parsed.data;

    // Verifikasi kepemilikan dompet
    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, userId: user.id },
    });

    if (!wallet) {
      return apiError("NOT_FOUND", "Dompet tidak ditemukan atau bukan milik Anda", 404);
    }

    // Verifikasi kategori jika diberikan
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, userId: user.id },
      });
      if (!category) {
        return apiError("NOT_FOUND", "Kategori tidak ditemukan", 404);
      }
    }

    // Eksekusi atomik dengan prisma.$transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Buat transaksi
      const txRecord = await tx.transaction.create({
        data: {
          userId: user.id,
          walletId,
          categoryId: categoryId || null,
          type,
          amount,
          note: note || null,
          source,
          rawInput: rawInput || null,
          receiptImageUrl: receiptImageUrl || null,
          transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
        },
        include: {
          wallet: { select: { name: true } },
          category: { select: { name: true } },
        },
      });

      // 2. Update saldo dompet (INCOME tambah, EXPENSE kurang)
      const balanceChange = type === "INCOME" ? amount : -amount;
      await tx.wallet.update({
        where: { id: walletId },
        data: {
          balance: { increment: balanceChange },
        },
      });

      // 3. Category Learning: simpan kata kunci jika kategori ditentukan
      if (categoryId && (note || rawInput)) {
        const textToLearn = `${note || ""} ${rawInput || ""}`.trim();
        await recordCategoryKeywords(tx, user.id, categoryId, textToLearn);
      }

      return txRecord;
    });

    const dto: TransactionDto = {
      id: result.id,
      walletId: result.walletId,
      walletName: result.wallet?.name,
      categoryId: result.categoryId,
      categoryName: result.category?.name || null,
      type: result.type,
      amount: Number(result.amount),
      note: result.note,
      source: result.source,
      rawInput: result.rawInput,
      receiptImageUrl: result.receiptImageUrl,
      transactionDate: result.transactionDate.toISOString(),
      createdAt: result.createdAt.toISOString(),
    };

    return apiSuccess(dto, 201);
  } catch (error) {
    console.error("POST /api/transactions error:", error);
    return apiError("INTERNAL_ERROR", "Gagal menyimpan transaksi", 500);
  }
}
