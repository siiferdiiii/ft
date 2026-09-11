import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (user && !error) {
      redirect("/dashboard");
    }
  } catch {
    // Jika tidak ada session atau koneksi belum ada, arahkan ke registrasi
  }

  // Pengguna baru / pertama kali buka aplikasi langsung masuk ke halaman registrasi
  redirect("/register");
}
