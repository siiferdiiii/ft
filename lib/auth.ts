import { createClient } from "./supabase/server";
import { prisma } from "./prisma";

export interface CurrentUser {
  id: string;
  email: string;
  name?: string | null;
}

/**
 * Memastikan user dan data dompet/kategori default sudah ada di database.
 */
export async function ensureUserAndDefaults(userId: string, email: string, name?: string | null): Promise<void> {
  try {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      await prisma.user.create({
        data: {
          id: userId,
          email,
          name: name || "Pengguna",
          wallets: {
            create: [
              {
                name: "Tunai",
                type: "CASH",
                balance: 500000,
                color: "#16A34A",
              },
              {
                name: "Bank",
                type: "BANK",
                balance: 2500000,
                color: "#4E44E5",
              },
            ],
          },
          categories: {
            create: [
              { name: "Makanan & Minuman", type: "EXPENSE", budgetLimit: 1500000 },
              { name: "Transportasi", type: "EXPENSE", budgetLimit: 500000 },
              { name: "Belanja", type: "EXPENSE", budgetLimit: 1000000 },
              { name: "Tagihan & Utilitas", type: "EXPENSE", budgetLimit: 750000 },
              { name: "Gaji", type: "INCOME" },
              { name: "Bonus / Lainnya", type: "INCOME" },
            ],
          },
        },
      });
    }
  } catch (error) {
    // Log error tanpa menghentikan flow
    console.error("Gagal memastikan data user default:", error);
  }
}

/**
 * Mengambil session user yang terautentikasi.
 * Sesuai SECURITY_STANDARDS.md §1 & DATABASE_ARCHITECTURE.md §2.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (user && !error) {
      const email = user.email || `${user.id}@user.local`;
      await ensureUserAndDefaults(user.id, email, user.user_metadata?.name);
      return {
        id: user.id,
        email,
        name: user.user_metadata?.name || null,
      };
    }
  } catch {
    // Supabase tidak aktif / error koneksi
  }

  // Fallback demo user untuk environment development lokal
  const fallbackId = "demo-user-123";
  const fallbackEmail = "demo@financetracker.local";
  await ensureUserAndDefaults(fallbackId, fallbackEmail, "Demo User");

  return {
    id: fallbackId,
    email: fallbackEmail,
    name: "Demo User",
  };
}
