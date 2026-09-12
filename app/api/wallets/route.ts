import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { walletSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { WalletDto } from "@/lib/types";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const wallets = await prisma.wallet.findMany({
      where: {
        userId: user.id,
        isArchived: false,
      },
      orderBy: { createdAt: "asc" },
    });

    const result: WalletDto[] = wallets.map((w) => ({
      id: w.id,
      name: w.name,
      type: w.type,
      icon: w.icon,
      color: w.color,
      balance: Number(w.balance),
      isArchived: w.isArchived,
      isPerpetualFund: Boolean(w.isPerpetualFund),
      createdAt: w.createdAt.toISOString(),
    }));

    // Dompet Dana Abadi default selalu di ujung kanan (akhir list) agar dari segi UX tidak mudah terpakai
    result.sort((a, b) => {
      if (Boolean(a.isPerpetualFund) === Boolean(b.isPerpetualFund)) return 0;
      return a.isPerpetualFund ? 1 : -1;
    });

    return apiSuccess(result);
  } catch (error) {
    console.error("GET /api/wallets error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memuat daftar dompet", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const body = await req.json();
    const parsed = walletSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Input dompet tidak valid",
        400
      );
    }

    const { name, type, color, icon, initialBalance, isPerpetualFund } = parsed.data;

    const wallet = await prisma.wallet.create({
      data: {
        userId: user.id,
        name,
        type,
        color: color || null,
        icon: icon || null,
        balance: initialBalance || 0,
        isPerpetualFund: Boolean(isPerpetualFund),
      },
    });

    const result: WalletDto = {
      id: wallet.id,
      name: wallet.name,
      type: wallet.type,
      icon: wallet.icon,
      color: wallet.color,
      balance: Number(wallet.balance),
      isArchived: wallet.isArchived,
      isPerpetualFund: Boolean(wallet.isPerpetualFund),
      createdAt: wallet.createdAt.toISOString(),
    };

    return apiSuccess(result, 201);
  } catch (error) {
    console.error("POST /api/wallets error:", error);
    return apiError("INTERNAL_ERROR", "Gagal membuat dompet baru", 500);
  }
}
