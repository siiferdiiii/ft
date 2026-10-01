import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { callGeminiWithFailover } from "@/lib/gemini";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB

function isValidImageMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isWebp =
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";
  return isJpeg || isPng || isWebp;
}

export interface ParsedMultiReceiptItem {
  name: string;
  amount: number;
  quantity?: number;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
}

export interface ParsedMultiReceiptResult {
  merchant: string | null;
  transactionDate: string;
  totalAmount: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  serviceFee?: number;
  discountNotes?: string | null;
  items: ParsedMultiReceiptItem[];
  receiptImageUrl: string;
  remainingQuota: number;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    // 1. Cek Kuota Scan AI Multi-Transaksi
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { ocrQuota: true },
    });

    const currentQuota = dbUser?.ocrQuota ?? 0;
    if (currentQuota <= 0) {
      return apiError(
        "QUOTA_EXCEEDED",
        "Kuota Scan Resi AI Multi-Item Anda telah habis. Silakan beli paket kuota tambahan di Halaman Produk untuk melanjutkan.",
        403
      );
    }

    // 2. Rate Limit
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(`ocr-multi:${user.id}:${clientIp}`, 10, 60 * 1000);
    if (!rateLimit.success) {
      return apiError(
        "TOO_MANY_REQUESTS",
        "Terlalu banyak permintaan scan. Silakan tunggu 1 menit.",
        429
      );
    }

    // 3. Validasi Form Data & File
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return apiError("NO_FILE", "File gambar resi wajib dilampirkan", 400);
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return apiError(
        "INVALID_FILE_TYPE",
        "Format gambar tidak didukung. Gunakan format JPEG, PNG, atau WebP.",
        400
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return apiError("FILE_TOO_LARGE", "Ukuran file melebihi batas 8MB", 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!isValidImageMagicBytes(buffer)) {
      return apiError(
        "INVALID_FILE_TYPE",
        "File yang diunggah bukan format gambar valid",
        400
      );
    }

    const base64Data = buffer.toString("base64");
    const mimeType = file.type;

    // 4. Ambil daftar kategori pengeluaran user agar AI bisa auto-suggest kategori
    const userCategories = await prisma.category.findMany({
      where: { userId: user.id, type: "EXPENSE" },
      select: { id: true, name: true },
    });

    const categoryListContext = userCategories.map((c) => ({ id: c.id, name: c.name }));

    // 5. Panggil Google Gemini Vision AI untuk ekstraksi multi-item
    const systemPrompt = `Kamu adalah asisten akuntansi cerdas yang mengekstrak rincian struk belanja/resi multi-transaksi di Indonesia.
Tugasmu:
1. Baca gambar struk belanja dengan teliti.
2. Ekstrak nama toko/merchant (misal: "Indomaret", "Superindo", "Alfamart", "Apotek K-24").
3. Ekstrak tanggal transaksi (format YYYY-MM-DD). Jika tidak ditemukan atau buram, gunakan tanggal hari ini.
4. ATURAN PENTING HARGA ITEM & DISKON:
   - Jika suatu produk mendapatkan diskon langsung (misal ada baris "DISKON FRISIAN FLAG : (1.300)" untuk item "FF LOW FAT VAN 225" seharga 5.200), hitung harga item sebagai HARGA BERSIH SETELAH DISKON: 5.200 - 1.300 = 3.900, dan beri catatan pada nama produk jika perlu.
   - Jika ada kantong plastik/item gratis karena diskon 100% (misal "PLASTIK SDG 1" dengan "DISKON (1)"), JANGAN masukkan ke daftar item belanja.
   - Jika ada pajak (PPN/PB1), biaya layanan, atau ongkir yang tertera di struk, masukkan sebagai item tersendiri (misal: "Pajak PPN 11%", "Biaya Layanan") agar saldo dompet berkurang sesuai total struk.
5. Ekstrak ringkasan biaya:
   - "subtotal": total harga kotor sebelum diskon (misal 35200).
   - "discount": total potongan/diskon jika ada (misal 1300).
   - "tax": total pajak jika ada (0 jika tidak ada).
   - "serviceFee": total biaya layanan/kantong jika ada (0 jika tidak ada).
   - "totalAmount": TOTAL AKHIR BERSIH YANG DIBAYAR OLEH PELANGGAN (angka pada baris "TOTAL : Rp ...", misal 33900).
   - "discountNotes": catatan ringkas diskon atau biaya lainnya (misal: "Hemat Rp 1.300 (Diskon Frisian Flag)").
6. Pastikan: JUMLAH SELURUH HARGA PADA "items" HARUS SAMA PERSIS DENGAN "totalAmount" (total akhir yang dibayar).
7. Cocokkan setiap item produk ke salah satu ID kategori pengguna yang paling relevan dari daftar berikut:
${JSON.stringify(categoryListContext)}
Jika tidak ada kategori yang cocok, set suggestedCategoryId ke null dan suggestedCategoryName sesuai tebakanmu.

Format output HARUS HANYA JSON murni:
{
  "merchant": "Indomaret",
  "transactionDate": "YYYY-MM-DD",
  "subtotal": 35200,
  "discount": 1300,
  "tax": 0,
  "serviceFee": 0,
  "totalAmount": 33900,
  "discountNotes": "Hemat Rp 1.300 (Diskon Frisian Flag)",
  "items": [
    {
      "name": "S/ROTI KRIM KEJU 72G",
      "amount": 18000,
      "quantity": 4,
      "suggestedCategoryId": "...",
      "suggestedCategoryName": "Makanan & Minuman"
    },
    {
      "name": "CIMORY MIX BERRY 225",
      "amount": 8500,
      "quantity": 1,
      "suggestedCategoryId": "...",
      "suggestedCategoryName": "Makanan & Minuman"
    },
    {
      "name": "CAFELA EXPRESO 200ML",
      "amount": 3500,
      "quantity": 1,
      "suggestedCategoryId": "...",
      "suggestedCategoryName": "Makanan & Minuman"
    },
    {
      "name": "FF LOW FAT VAN 225",
      "amount": 3900,
      "quantity": 1,
      "suggestedCategoryId": "...",
      "suggestedCategoryName": "Makanan & Minuman"
    }
  ]
}`;

    const geminiPayload = {
      contents: [
        {
          parts: [
            { text: systemPrompt },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    };

    const aiResult = await callGeminiWithFailover(geminiPayload);

    if (!aiResult.data) {
      console.warn("AI Multi-OCR Failover response:", aiResult.errorDetail);
      return apiError(
        "AI_SERVICE_UNAVAILABLE",
        aiResult.errorDetail || "Gagal memproses struk dengan AI. Coba lagi dalam beberapa saat.",
        503
      );
    }

    // Ekstrak teks respon Gemini (abaikan thought parts jika ada)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawCandidates = (aiResult.data as any)?.candidates;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts = (rawCandidates?.[0]?.content?.parts || []) as any[];
    const textPart = [...parts].reverse().find((p) => p.text && !p.thought) || parts[0];
    const responseText = textPart?.text || "";

    if (!responseText) {
      return apiError("AI_PARSE_EMPTY", "AI tidak dapat membaca teks dari struk ini.", 422);
    }

    // Bersihkan pembungkus markdown JSON jika ada
    const cleanedJsonText = responseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let parsedJson: {
      merchant?: string;
      transactionDate?: string;
      totalAmount?: number;
      subtotal?: number;
      discount?: number;
      tax?: number;
      serviceFee?: number;
      discountNotes?: string;
      items?: Array<{
        name: string;
        amount: number;
        quantity?: number;
        suggestedCategoryId?: string | null;
        suggestedCategoryName?: string | null;
      }>;
    };

    try {
      parsedJson = JSON.parse(cleanedJsonText);
    } catch (parseError) {
      // Jika JSON terpotong di tengah stream (misal karena batas panjang), coba perbaiki strukturnya
      try {
        let fixed = cleanedJsonText;
        const lastValidItemIndex = fixed.lastIndexOf("}");
        if (lastValidItemIndex !== -1 && fixed.includes('"items"')) {
          fixed = fixed.substring(0, lastValidItemIndex + 1);
          fixed = fixed.replace(/,\s*$/, "");
          fixed += "\n  ]\n}";
          parsedJson = JSON.parse(fixed);
          console.warn("[AI Multi-OCR] Berhasil memulihkan JSON yang terpotong:", fixed);
        } else {
          throw parseError;
        }
      } catch {
        console.error("Gagal parse JSON dari output Gemini:", cleanedJsonText, parseError);
        return apiError(
          "AI_PARSE_ERROR",
          "Gagal menguraikan rincian struk belanja. Pastikan foto struk terlihat jelas dan tegak.",
          422
        );
      }
    }

    const items: ParsedMultiReceiptItem[] = (parsedJson.items || [])
      .filter((item) => item.name && typeof item.amount === "number" && item.amount > 0)
      .map((item) => {
        // Validasi apakah suggestedCategoryId valid di kategori user
        const matchedCat = userCategories.find((c) => c.id === item.suggestedCategoryId);
        return {
          name: String(item.name).trim(),
          amount: Math.round(Number(item.amount)),
          quantity: item.quantity ? Math.max(1, Math.round(item.quantity)) : 1,
          suggestedCategoryId: matchedCat ? matchedCat.id : null,
          suggestedCategoryName: matchedCat ? matchedCat.name : item.suggestedCategoryName || null,
        };
      });

    if (items.length === 0) {
      return apiError(
        "NO_ITEMS_FOUND",
        "Tidak ditemukan item produk belanja pada struk ini. Pastikan bagian rincian barang dan harga terlihat jelas.",
        422
      );
    }

    // 6. Sukses: Potong kuota scan user sebanyak 1
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ocrQuota: { decrement: 1 },
      },
      select: { ocrQuota: true },
    });

    const totalSum = items.reduce((sum, item) => sum + item.amount, 0);
    const calculatedTotal =
      typeof parsedJson.totalAmount === "number" && parsedJson.totalAmount > 0
        ? parsedJson.totalAmount
        : totalSum;

    const subtotal =
      typeof parsedJson.subtotal === "number" && parsedJson.subtotal > 0
        ? parsedJson.subtotal
        : totalSum;

    let discount =
      typeof parsedJson.discount === "number" && parsedJson.discount > 0
        ? parsedJson.discount
        : 0;

    let discountNotes = parsedJson.discountNotes || null;

    // Jika total kotor barang lebih besar dari total bayar akhir, deteksi otomatis sebagai diskon
    if (totalSum > calculatedTotal && discount === 0) {
      discount = totalSum - calculatedTotal;
      if (!discountNotes) {
        discountNotes = `Hemat Rp ${discount.toLocaleString("id-ID")} (Diskon / Promo)`;
      }
    }

    // Buat data URI gambar untuk preview
    const previewDataUrl = `data:${mimeType};base64,${base64Data}`;

    const result: ParsedMultiReceiptResult = {
      merchant: parsedJson.merchant || null,
      transactionDate:
        parsedJson.transactionDate && !isNaN(new Date(parsedJson.transactionDate).getTime())
          ? parsedJson.transactionDate
          : new Date().toISOString(),
      totalAmount: calculatedTotal,
      subtotal,
      discount,
      tax: typeof parsedJson.tax === "number" ? parsedJson.tax : 0,
      serviceFee: typeof parsedJson.serviceFee === "number" ? parsedJson.serviceFee : 0,
      discountNotes,
      items,
      receiptImageUrl: previewDataUrl,
      remainingQuota: updatedUser.ocrQuota,
    };

    return apiSuccess(result);
  } catch (error) {
    console.error("POST /api/receipts/parse-multi error:", error);
    return apiError("INTERNAL_ERROR", "Terjadi kesalahan saat memproses struk multi-item", 500);
  }
}
