import { NextRequest } from "next/server";
import { authSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureUserAndDefaults } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = authSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Data pendaftaran tidak valid",
        400
      );
    }

    const { email, password, name } = parsed.data;

    // 1. Coba registrasi ke Supabase Auth
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: name || "" },
        },
      });

      if (error) {
        return apiError("AUTH_ERROR", error.message, 400);
      }

      if (data.user) {
        // Sinkronkan ke tabel User aplikasi dengan ID yang sama
        await ensureUserAndDefaults(data.user.id, email, name);
        return apiSuccess({
          user: {
            id: data.user.id,
            email: data.user.email,
            name,
          },
        });
      }
    } catch {
      // Fallback jika Supabase auth offline: simpan profil lokal
    }

    // Fallback local registration
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return apiError("EMAIL_EXISTS", "Email sudah terdaftar", 400);
    }

    const crypto = await import("crypto");
    const userId = crypto.randomUUID();
    await ensureUserAndDefaults(userId, email, name);

    return apiSuccess({
      user: {
        id: userId,
        email,
        name,
      },
    });
  } catch (error) {
    console.error("Register API error:", error);
    return apiError("INTERNAL_ERROR", "Terjadi kesalahan pada server", 500);
  }
}
