import { createClient } from "./supabase/server";
import { prisma } from "./prisma";
import { cookies } from "next/headers";

export interface CurrentUser {
  id: string;
  email: string;
  name?: string | null;
}

// In-memory cache agar ensureUserAndDefaults tidak membebani database di setiap request
const initializedUsers = new Set<string>();

/**
 * Memastikan user dan data dompet/kategori default sudah ada di database.
 */
export async function ensureUserAndDefaults(userId: string, email: string, name?: string | null): Promise<void> {
  if (initializedUsers.has(userId)) {
    return;
  }

  try {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ id: userId }, { email }],
      },
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

    initializedUsers.add(userId);
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isSupabaseConfigured =
    Boolean(supabaseUrl) &&
    !supabaseUrl?.includes("example.supabase.co") &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.includes("dummy");

  if (isSupabaseConfigured) {
    try {
      const cookieStore = await cookies();
      const allCookies = cookieStore.getAll();
      const hasAuthCookie = allCookies.some(
        (c) => c.name.startsWith("sb-") || c.name.includes("auth-token")
      );

      // Hanya hubungi Supabase jika memang ada session cookie
      if (hasAuthCookie) {
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
      }
    } catch (err) {
      console.warn("Supabase getCurrentUser error, falling back:", err);
    }
  }

  // Fallback demo user instan (0ms) untuk offline/development/unconfigured mode
  const fallbackId = "demo-user-123";
  const fallbackEmail = "demo@financetracker.local";
  await ensureUserAndDefaults(fallbackId, fallbackEmail, "Demo User");

  return {
    id: fallbackId,
    email: fallbackEmail,
    name: "Demo User",
  };
}
