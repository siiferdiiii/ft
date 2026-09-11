import { NextRequest } from "next/server";
import { authSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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

    // 1. Coba registrasi via Supabase Admin jika SERVICE_ROLE_KEY tersedia (Bypass Rate Limit & Auto Confirm)
    const admin = getSupabaseAdmin();
    if (admin) {
      try {
        const { data: adminData, error: adminError } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name: name || "" },
        });

        if (adminData?.user) {
          await ensureUserAndDefaults(adminData.user.id, email, name);
          return apiSuccess({
            user: {
              id: adminData.user.id,
              email: adminData.user.email,
              name,
            },
          });
        }

        if (
          adminError &&
          (adminError.message.toLowerCase().includes("already registered") ||
            adminError.message.toLowerCase().includes("already exists"))
        ) {
          return apiError(
            "EMAIL_EXISTS",
            "Email ini sudah terdaftar. Silakan masuk menggunakan kata sandi Anda.",
            400
          );
        }
      } catch (err) {
        console.warn("Supabase admin registration fallback to standard client:", err);
      }
    }

    // 2. Coba registrasi ke Supabase Auth standar
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
        // Jika user sudah terdaftar di Supabase
        if (
          error.message?.toLowerCase().includes("already registered") ||
          error.message?.toLowerCase().includes("already exists") ||
          error.status === 422
        ) {
          // Coba login otomatis jika password cocok
          const signInRes = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (!signInRes.error && signInRes.data.user) {
            await ensureUserAndDefaults(signInRes.data.user.id, email, name);
            return apiSuccess({
              user: {
                id: signInRes.data.user.id,
                email: signInRes.data.user.email,
                name,
              },
            });
          }

          return apiError(
            "EMAIL_EXISTS",
            "Email ini sudah terdaftar. Silakan masuk dengan kata sandi Anda di halaman login.",
            400
          );
        }

        // Jika terkena batasan rate limit email bawaan Supabase
        if (
          error.message?.toLowerCase().includes("rate limit") ||
          error.message?.toLowerCase().includes("over_email_send_rate_limit") ||
          error.status === 429
        ) {
          console.warn("Supabase email rate limit reached, falling back to direct database sync");
        } else {
          console.error("Supabase signUp error:", error);
          return apiError("AUTH_ERROR", error.message, 400);
        }
      } else if (data?.user) {
        // Cek jika user identitasnya kosong (email sudah ada di Supabase saat confirm email aktif)
        if (data.user.identities && data.user.identities.length === 0) {
          return apiError(
            "EMAIL_EXISTS",
            "Email ini sudah terdaftar. Silakan langsung masuk di halaman Login.",
            400
          );
        }

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
    } catch (supabaseErr) {
      console.warn("Supabase auth offline / error:", supabaseErr);
    }

    // 3. Fallback database registration jika Supabase rate-limited atau offline
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }],
      },
    });

    if (existing) {
      return apiError(
        "EMAIL_EXISTS",
        "Email ini sudah terdaftar. Silakan masuk di halaman Login.",
        400
      );
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
