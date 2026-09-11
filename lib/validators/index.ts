import { z } from "zod";

export const authSchema = z.object({
  email: z.string().email("Format email tidak valid").trim().toLowerCase(),
  password: z.string().min(8, "Password minimal 8 karakter"),
  name: z.string().min(1).max(50).optional(),
});

export const walletSchema = z.object({
  name: z.string().min(1, "Nama dompet wajib diisi").max(30, "Nama maksimal 30 karakter").trim(),
  type: z.enum(["CASH", "EWALLET", "BANK", "OTHER"], {
    errorMap: () => ({ message: "Tipe dompet tidak valid" }),
  }),
  color: z.string().optional(),
  icon: z.string().optional(),
  initialBalance: z.number().min(0, "Saldo awal tidak boleh negatif").optional().default(0),
});

export const updateWalletSchema = z.object({
  name: z.string().min(1).max(30).trim().optional(),
  type: z.enum(["CASH", "EWALLET", "BANK", "OTHER"]).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isArchived: z.boolean().optional(),
});

export const categorySchema = z.object({
  name: z.string().min(1, "Nama kategori wajib diisi").max(30, "Nama maksimal 30 karakter").trim(),
  type: z.enum(["INCOME", "EXPENSE"], {
    errorMap: () => ({ message: "Tipe kategori harus INCOME atau EXPENSE" }),
  }),
  icon: z.string().optional(),
  budgetLimit: z.number().positive("Budget harus lebih dari 0").max(100000000000, "Nilai melebihi batas").nullable().optional(),
  budgetPeriod: z.enum(["WEEKLY", "MONTHLY"]).optional().default("MONTHLY"),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(30).trim().optional(),
  budgetLimit: z.number().positive().max(100000000000).nullable().optional(),
  budgetPeriod: z.enum(["WEEKLY", "MONTHLY"]).optional(),
  icon: z.string().optional(),
});

export const transactionSchema = z.object({
  walletId: z.string().min(1, "Dompet wajib dipilih"),
  categoryId: z.string().nullable().optional(),
  type: z.enum(["INCOME", "EXPENSE"], {
    errorMap: () => ({ message: "Tipe harus INCOME atau EXPENSE" }),
  }),
  amount: z
    .number({ invalid_type_error: "Jumlah harus berupa angka" })
    .positive("Jumlah harus lebih dari 0")
    .max(1000000000000, "Nominal transaksi melebihi batas wajar"),
  note: z.string().max(255, "Catatan maksimal 255 karakter").nullable().optional(),
  source: z.enum(["VOICE", "MANUAL", "RECEIPT_SCAN"]).default("MANUAL"),
  rawInput: z.string().max(1000).nullable().optional(),
  receiptImageUrl: z.string().url("URL resi tidak valid").nullable().optional(),
  transactionDate: z.string().datetime().optional().or(z.date().optional()),
});

export const updateTransactionSchema = z.object({
  walletId: z.string().min(1).optional(),
  categoryId: z.string().nullable().optional(),
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  amount: z.number().positive().max(1000000000000).optional(),
  note: z.string().max(255).nullable().optional(),
  transactionDate: z.string().datetime().optional().or(z.date().optional()),
});

export const transferSchema = z.object({
  fromWalletId: z.string().min(1, "Dompet asal wajib dipilih"),
  toWalletId: z.string().min(1, "Dompet tujuan wajib dipilih"),
  amount: z
    .number({ invalid_type_error: "Jumlah harus berupa angka" })
    .positive("Jumlah transfer harus lebih dari 0")
    .max(1000000000000, "Nominal transfer melebihi batas"),
  note: z.string().max(255).nullable().optional(),
  transferDate: z.string().datetime().optional().or(z.date().optional()),
}).refine((data) => data.fromWalletId !== data.toWalletId, {
  message: "Dompet tujuan tidak boleh sama dengan dompet asal",
  path: ["toWalletId"],
});

export const suggestCategorySchema = z.object({
  rawInput: z.string().min(1, "Teks input suara wajib ada"),
});
