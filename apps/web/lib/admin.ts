/** Comma-separated admin emails from VITE_ADMIN_EMAILS (set in Vercel env). */
export function isAdminUser(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = import.meta.env.VITE_ADMIN_EMAILS as string | undefined;
  if (!raw?.trim()) return false;
  const allowed = raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
