import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateCredentialsSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Endpoint Pengaturan Profil: Ubah Email & Kata Sandi Langsung Tanpa Verifikasi / Kode OTP
 * Sesuai instruksi: "ada pengaturan untuk mengubah sandi dan email (tanpa verifikasi/kode otp)"
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const body = await req.json();
    const parsed = updateCredentialsSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Input email atau kata sandi tidak valid",
        400
      );
    }

    const { email, password } = parsed.data;

    // 1. Jika mengubah email, pastikan belum digunakan akun lain
    if (email && email !== user.email) {
      const existing = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id: user.id },
        },
      });

      if (existing) {
        return apiError("EMAIL_EXISTS", "Email ini sudah digunakan oleh akun lain", 400);
      }
    }

    // 2. Update Supabase Auth langsung menggunakan Admin Service Role (Bypass OTP & Email Confirmation)
    const admin = getSupabaseAdmin();
    if (admin) {
      try {
        const updateAuthPayload: {
          email?: string;
          password?: string;
          email_confirm?: boolean;
        } = {};

        if (email) {
          updateAuthPayload.email = email;
          updateAuthPayload.email_confirm = true; // Langsung dikonfirmasi tanpa OTP
        }
        if (password) {
          updateAuthPayload.password = password; // Langsung diset tanpa perlu sandi lama
        }

        const { error: adminError } = await admin.auth.admin.updateUserById(
          user.id,
          updateAuthPayload
        );

        if (adminError) {
          console.warn("Supabase admin credential update warning:", adminError);
        }
      } catch (err) {
        console.warn("Supabase admin credentials exception:", err);
      }
    }

    // 3. Update data di database Prisma
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(email ? { email } : {}),
      },
    });

    return apiSuccess({
      message: "Data akun berhasil diperbarui secara langsung.",
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
      },
    });
  } catch (error) {
    console.error("PATCH /api/user/credentials error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memperbarui data akun", 500);
  }
}
