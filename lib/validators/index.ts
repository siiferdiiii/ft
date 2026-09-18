import { z } from "zod";

export const authSchema = z.object({
  email: z.string().email("Format email tidak valid").trim().toLowerCase(),
  password: z.string().min(6, "Password minimal 6 karakter"),
  name: z.string().max(50).optional().nullable().or(z.literal("")),
});

export const walletSchema = z.object({
  name: z.string().min(1, "Nama dompet wajib diisi").max(30, "Nama maksimal 30 karakter").trim(),
  type: z.enum(["CASH", "EWALLET", "BANK", "OTHER"], {
    errorMap: () => ({ message: "Tipe dompet tidak valid" }),
  }),
  color: z.string().optional(),
  icon: z.string().optional(),
  initialBalance: z.number().min(0, "Saldo awal tidak boleh negatif").optional().default(0),
  isPerpetualFund: z.boolean().optional().default(false),
});

export const updateWalletSchema = z.object({
  name: z.string().min(1).max(30).trim().optional(),
  type: z.enum(["CASH", "EWALLET", "BANK", "OTHER"]).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isArchived: z.boolean().optional(),
  isPerpetualFund: z.boolean().optional(),
});

export const userSettingsSchema = z.object({
  perpetualFundPercent: z
    .number({ invalid_type_error: "Persentase harus berupa angka" })
    .int("Harus berupa bilangan bulat")
    .min(1, "Persentase minimal 1%")
    .max(50, "Persentase maksimal 50%"),
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

// Schema untuk validasi pesan percakapan multi-turn ke API AI Budget Interview
export const budgetInterviewSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        content: z.string().min(1).max(2000, "Pesan terlalu panjang"),
      })
    )
    .min(0)
    .max(100, "Terlalu banyak putaran percakapan"), // Dilonggarkan untuk fase uji coba
  monthlyIncomeHint: z.number().positive().optional(), // income yang disebut user di tengah percakapan
});

// Schema untuk konfirmasi akhir — menyimpan hasil interview ke database
export const applyBudgetSchema = z.object({
  budgets: z
    .array(
      z.object({
        categoryId: z.string().min(1),
        budgetLimit: z
          .number()
          .positive("Budget harus lebih dari 0")
          .max(100_000_000_000, "Nilai melebihi batas"),
      })
    )
    .min(1, "Minimal satu kategori harus diatur"),
  perpetualFundPercent: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional(),
  monthlyIncome: z
    .number()
    .positive()
    .max(100_000_000_000)
    .optional(),
});

export const goalSchema = z.object({
  name: z.string().min(1, "Nama tujuan tabungan wajib diisi").max(50, "Nama maksimal 50 karakter").trim(),
  targetAmount: z
    .number({ invalid_type_error: "Target nominal harus berupa angka" })
    .positive("Target nominal harus lebih dari 0")
    .max(100_000_000_000, "Nominal melebihi batas wajar"),
  targetDate: z.string().nullable().optional(),
  allocationPercent: z
    .number({ invalid_type_error: "Persentase harus berupa angka" })
    .int("Harus berupa bilangan bulat")
    .min(1, "Minimal alokasi 1%")
    .max(50, "Maksimal alokasi 50%")
    .default(5),
});

export const updateGoalSchema = z.object({
  name: z.string().min(1).max(50).trim().optional(),
  targetAmount: z.number().positive().max(100_000_000_000).optional(),
  targetDate: z.string().nullable().optional(),
  allocationPercent: z.number().int().min(1).max(50).optional(),
  isCompleted: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export const assetSchema = z.object({
  name: z.string().min(1, "Nama aset wajib diisi").max(60, "Nama aset maksimal 60 karakter").trim(),
  category: z.string().min(1, "Kategori aset wajib diisi").max(40, "Kategori maksimal 40 karakter").trim(),
  value: z
    .number({ invalid_type_error: "Nilai aset harus berupa angka" })
    .min(0, "Nilai aset tidak boleh negatif")
    .max(10_000_000_000_000, "Nilai aset melebihi batas wajar"),
  liquidityTier: z.enum(["INSTANT", "T3", "ILLIQUID"], {
    errorMap: () => ({ message: "Tingkat likuiditas tidak valid" }),
  }),
});

export const updateAssetSchema = z.object({
  name: z.string().min(1).max(60).trim().optional(),
  category: z.string().min(1).max(40).trim().optional(),
  value: z.number().min(0).max(10_000_000_000_000).optional(),
  liquidityTier: z.enum(["INSTANT", "T3", "ILLIQUID"]).optional(),
  isArchived: z.boolean().optional(),
});

export const debtSchema = z.object({
  name: z.string().min(1, "Nama utang wajib diisi").max(60, "Nama utang maksimal 60 karakter").trim(),
  principal: z
    .number({ invalid_type_error: "Total utang awal harus berupa angka" })
    .positive("Total utang awal harus lebih dari 0")
    .max(100_000_000_000, "Nilai utang melebihi batas wajar"),
  remainingBalance: z
    .number({ invalid_type_error: "Sisa utang harus berupa angka" })
    .min(0, "Sisa utang tidak boleh negatif")
    .max(100_000_000_000, "Nilai utang melebihi batas wajar"),
  monthlyPayment: z.number().positive("Nominal cicilan harus lebih dari 0").nullable().optional(),
  dueDayOfMonth: z
    .number()
    .int()
    .min(1, "Tanggal jatuh tempo antara 1 - 31")
    .max(31, "Tanggal jatuh tempo antara 1 - 31")
    .nullable()
    .optional(),
  interestRate: z.number().min(0).max(100).nullable().optional(),
});

export const updateDebtSchema = z.object({
  name: z.string().min(1).max(60).trim().optional(),
  principal: z.number().positive().max(100_000_000_000).optional(),
  remainingBalance: z.number().min(0).max(100_000_000_000).optional(),
  monthlyPayment: z.number().positive().nullable().optional(),
  dueDayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  interestRate: z.number().min(0).max(100).nullable().optional(),
  isPaidOff: z.boolean().optional(),
});

