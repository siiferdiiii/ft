/**
 * Helper untuk membuat kode unik user yang mudah dibaca dan diketik di catatan Lynk.id.
 * Contoh format: FT-84923 atau FT-7X9BK.
 */
export function generateUserCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // hindari 0, O, 1, I
  let code = "FT-";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
