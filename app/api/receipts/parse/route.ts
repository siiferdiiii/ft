import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return apiError("NO_FILE", "File gambar resi wajib dilampirkan", 400);
    }

    // Validasi MIME type dan ukuran file per SECURITY_STANDARDS.md §4
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return apiError(
        "INVALID_FILE_TYPE",
        "Format gambar tidak didukung. Gunakan JPEG, PNG, atau WebP",
        400
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return apiError("FILE_TOO_LARGE", "Ukuran file melebihi batas 5MB", 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedAmount: number | null = null;
    let extractedMerchant: string | null = null;
    let extractedDate: string | null = null;

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(["eng", "ind"], undefined, {
        logger: () => {}, // Jangan log progress berlebihan
      });

      const ret = await worker.recognize(buffer);
      const text = ret.data.text;
      await worker.terminate();

      if (text) {
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

        // Merchant biasanya di 1-2 baris pertama
        if (lines.length > 0) {
          const firstLine = lines[0].replace(/[^\w\s]/g, "").trim();
          if (firstLine.length > 2 && firstLine.length < 40) {
            extractedMerchant = firstLine;
          }
        }

        // Cari pola TOTAL / JUMLAH / RP
        const totalRegex = /(?:total|jumlah|grand total|rp|subtotal)\s*[:.]?\s*([0-9.,]+)/i;
        const numberRegex = /\b(\d{1,3}(?:[.,]\d{3})+|\d{4,})\b/g;

        const totalMatch = text.match(totalRegex);
        if (totalMatch && totalMatch[1]) {
          const clean = totalMatch[1].replace(/[^\d]/g, "");
          const val = parseInt(clean, 10);
          if (val > 0 && val < 1000000000) {
            extractedAmount = val;
          }
        }

        if (!extractedAmount) {
          // Cari angka terbesar yang masuk akal di dalam resi
          const allNumbers: number[] = [];
          let match;
          while ((match = numberRegex.exec(text)) !== null) {
            const clean = match[1].replace(/[^\d]/g, "");
            const val = parseInt(clean, 10);
            if (val >= 1000 && val < 100000000) {
              allNumbers.push(val);
            }
          }
          if (allNumbers.length > 0) {
            extractedAmount = Math.max(...allNumbers);
          }
        }

        // Cari pola tanggal (DD/MM/YYYY atau YYYY-MM-DD)
        const dateRegex = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/;
        const dateMatch = text.match(dateRegex);
        if (dateMatch) {
          const day = dateMatch[1].padStart(2, "0");
          const month = dateMatch[2].padStart(2, "0");
          let year = dateMatch[3];
          if (year.length === 2) year = `20${year}`;
          const parsedDate = new Date(`${year}-${month}-${day}`);
          if (!isNaN(parsedDate.getTime())) {
            extractedDate = parsedDate.toISOString();
          }
        }
      }
    } catch (ocrErr) {
      console.warn("OCR recognition notice:", ocrErr);
      // Jangan blok user jika OCR gagal, form tetap terbuka (PRD §4.4)
    }

    // Convert ke base64 data URI untuk demo/display preview
    const base64Image = `data:${file.type};base64,${buffer.toString("base64")}`;

    return apiSuccess({
      amount: extractedAmount,
      note: extractedMerchant || "Resi Pembelian",
      transactionDate: extractedDate || new Date().toISOString(),
      receiptImageUrl: base64Image,
    });
  } catch (error) {
    console.error("POST /api/receipts/parse error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memproses gambar resi", 500);
  }
}
