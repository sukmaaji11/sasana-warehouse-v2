function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Environment variable ${name} belum diisi. Lihat apps/web/.env.example`);
  return value;
}

// Harus ditulis literal agar Next.js meng-inline nilainya ke bundle browser.
export const env = {
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseKey: required(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
};
