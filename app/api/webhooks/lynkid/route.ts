import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PRODUCT_PACKAGES } from "@/lib/constants/products";

/**
 * Webhook Handler untuk Lynk.id
 *
 * Menerima callback transaksi sukses dari Lynk.id.
 * 1. Memeriksa token verifikasi webhook (opsional jika LYNK_ID_WEBHOOK_SECRET diset)
 * 2. Memastikan idempotency (mencegah double crediting dari orderId yang sama)
 * 3. Mengekstrak User Code (misal: FT-84920) atau User ID dari catatan pesanan Lynk.id
 * 4. Menambahkan kuota scan OCR AI & kuota susun budget AI, serta mengupgrade status ke PRO
 * 5. Mencatat riwayat pembelian ke tabel PurchaseOrder
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verifikasi secret jika dikonfigurasi di environment variable
    const expectedSecret = process.env.LYNK_ID_WEBHOOK_SECRET;
    if (expectedSecret) {
      const headerSecret =
        req.headers.get("x-lynkid-secret") ||
        req.headers.get("x-webhook-secret") ||
        req.headers.get("authorization");

      if (headerSecret !== expectedSecret && !headerSecret?.includes(expectedSecret)) {
        return NextResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Webhook secret tidak valid" } },
          { status: 401 }
        );
      }
    }

    const payload = await req.json();

    // 2. Ambil ID order/transaksi unik dari Lynk.id
    const orderId =
      payload.order_id ||
      payload.id ||
      payload.transaction_id ||
      payload.invoice_number ||
      payload.data?.id ||
      payload.data?.order_id ||
      `lynkid-${Date.now()}`;

    // Lynk.id status check (hanya proses transaksi yang berhasil/paid/settled)
    const status = String(
      payload.status || payload.payment_status || payload.data?.status || "SUCCESS"
    ).toUpperCase();

    if (
      status !== "SUCCESS" &&
      status !== "PAID" &&
      status !== "COMPLETED" &&
      status !== "SETTLED"
    ) {
      return NextResponse.json({
        data: { message: `Webhook diterima tetapi status bukan paid (${status}), dilewati.` },
      });
    }

    // Cek idempotency: apakah order ini sudah pernah diproses?
    const existingOrder = await prisma.purchaseOrder.findUnique({
      where: { orderId: String(orderId) },
    });

    if (existingOrder) {
      return NextResponse.json({
        data: { message: "Order sudah pernah diproses sebelumnya (Idempotent)." },
      });
    }

    // 3. Ekstrak User Code atau User ID dari catatan pembelian (notes / custom fields)
    const allNoteStrings = [
      payload.notes,
      payload.note,
      payload.customer_note,
      payload.customer_notes,
      payload.custom_field,
      payload.custom_fields,
      payload.description,
      payload.data?.notes,
      payload.data?.note,
      payload.data?.customer_note,
      JSON.stringify(payload.custom_fields || {}),
    ]
      .filter(Boolean)
      .join(" ");

    // Cari pola User Code (misal: FT-84920 atau FT-XXXXX)
    const userCodeMatch = allNoteStrings.match(/FT-[A-Z0-9]{4,10}/i);
    const userCode = userCodeMatch ? userCodeMatch[0].toUpperCase() : null;

    // Cari pola UUID jika user menyalin UUID langsung
    const uuidMatch = allNoteStrings.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    const userIdFromNote = uuidMatch ? uuidMatch[0] : null;

    // Cari user di database berdasarkan userCode atau userId
    let user = null;
    if (userCode) {
      user = await prisma.user.findFirst({
        where: { userCode },
      });
    }

    if (!user && userIdFromNote) {
      user = await prisma.user.findUnique({
        where: { id: userIdFromNote },
      });
    }

    // Fallback: cek jika email customer dikirimkan oleh Lynk.id
    if (!user && (payload.customer_email || payload.email || payload.data?.customer_email)) {
      const email = payload.customer_email || payload.email || payload.data?.customer_email;
      user = await prisma.user.findUnique({
        where: { email },
      });
    }

    if (!user) {
      console.warn(
        `[Lynk.id Webhook] User tidak ditemukan untuk order ${orderId}. Catatan: "${allNoteStrings}"`
      );
      return NextResponse.json(
        {
          error: {
            code: "USER_NOT_FOUND",
            message: `User tidak ditemukan dari catatan "${allNoteStrings}". Harap cantumkan User Code (mis. FT-XXXXX).`,
          },
        },
        { status: 400 }
      );
    }

    // 4. Identifikasi produk yang dibeli
    const productNameRaw = String(
      payload.product_name ||
        payload.item_name ||
        payload.product?.name ||
        payload.data?.product_name ||
        payload.title ||
        ""
    ).toLowerCase();

    const amountPaid = Number(
      payload.amount || payload.total || payload.gross_amount || payload.data?.amount || 0
    );

    // Cocokkan dengan katalog produk
    let matchedPackage = PRODUCT_PACKAGES.find((pkg) =>
      productNameRaw.includes(pkg.id) ||
      productNameRaw.includes(pkg.name.toLowerCase()) ||
      (amountPaid > 0 && Math.abs(pkg.price - amountPaid) < 1000)
    );

    // Fallback ke paket aktif pertama jika tidak cocok spesifik
    if (!matchedPackage) {
      matchedPackage = PRODUCT_PACKAGES.find((p) => !p.comingSoon) || PRODUCT_PACKAGES[0];
    }

    const ocrQuotaToAdd = matchedPackage.ocrQuota;
    const aiBudgetQuotaToAdd = matchedPackage.aiBudgetQuota;

    // 5. Update data user & catat PurchaseOrder dalam prisma.$transaction
    await prisma.$transaction(async (tx) => {
      // Update kuota & tier user
      await tx.user.update({
        where: { id: user.id },
        data: {
          ocrQuota: { increment: ocrQuotaToAdd },
          aiBudgetQuota: { increment: aiBudgetQuotaToAdd },
          tier: "PRO",
        },
      });

      // Catat purchase order
      await tx.purchaseOrder.create({
        data: {
          userId: user.id,
          orderId: String(orderId),
          productName: matchedPackage.name,
          amount: amountPaid || matchedPackage.price,
          ocrQuotaAdded: ocrQuotaToAdd,
          aiBudgetQuotaAdded: aiBudgetQuotaToAdd,
          rawWebhookPayload: JSON.stringify(payload),
        },
      });
    });

    console.log(
      `[Lynk.id Webhook] Berhasil memproses order ${orderId} untuk user ${user.id} (${user.email}). Kuota OCR +${ocrQuotaToAdd}, Kuota Budget +${aiBudgetQuotaToAdd}.`
    );

    return NextResponse.json({
      data: {
        success: true,
        orderId,
        userId: user.id,
        userCode: user.userCode,
        quotaAdded: {
          ocr: ocrQuotaToAdd,
          aiBudget: aiBudgetQuotaToAdd,
        },
        message: "Transaksi berhasil diverifikasi dan kuota telah ditambahkan ke akun user.",
      },
    });
  } catch (error) {
    console.error("Lynk.id webhook handler error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Gagal memproses webhook Lynk.id" } },
      { status: 500 }
    );
  }
}
