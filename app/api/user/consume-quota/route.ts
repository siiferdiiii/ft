import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/user/consume-quota
 * Body: { type: "ocr" | "aiBudget" }
 *
 * Dekrementasi kuota pengguna secara atomik.
 * Jika kuota sudah habis, kembalikan 402 Payment Required.
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: { message: "Silakan login terlebih dahulu" } }, { status: 401 });
    }

    const body = await req.json();
    const type = body?.type as "ocr" | "aiBudget" | undefined;

    if (!type || !["ocr", "aiBudget"].includes(type)) {
      return NextResponse.json(
        { error: { message: "Parameter 'type' harus 'ocr' atau 'aiBudget'" } },
        { status: 400 }
      );
    }

    const field = type === "ocr" ? "ocrQuota" : "aiBudgetQuota";

    // Baca kuota saat ini
    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { ocrQuota: true, aiBudgetQuota: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: { message: "Pengguna tidak ditemukan" } },
        { status: 404 }
      );
    }

    const currentQuota = user[field];

    if (currentQuota <= 0) {
      return NextResponse.json(
        {
          error: {
            message:
              type === "aiBudget"
                ? "Kuota Susun Budget AI habis. Beli paket untuk melanjutkan."
                : "Kuota scan AI habis. Beli paket untuk melanjutkan.",
            code: "QUOTA_EXHAUSTED",
          },
        },
        { status: 402 }
      );
    }

    // Dekrementasi atomik
    const updated = await prisma.user.update({
      where: { id: currentUser.id },
      data: { [field]: { decrement: 1 } },
      select: { ocrQuota: true, aiBudgetQuota: true },
    });

    return NextResponse.json({
      data: {
        ocrQuota: updated.ocrQuota,
        aiBudgetQuota: updated.aiBudgetQuota,
        remaining: updated[field as keyof typeof updated],
      },
    });
  } catch (err) {
    console.error("[consume-quota] Error:", err);
    return NextResponse.json(
      { error: { message: "Terjadi kesalahan server" } },
      { status: 500 }
    );
  }
}
