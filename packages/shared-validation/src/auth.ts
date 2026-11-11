import { USERNAME_PATTERN, normalizeUsername } from '@sasana/shared-constants';
import { z } from 'zod';

export const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .pipe(
    z
      .string()
      .min(3, 'Username minimal 3 karakter')
      .max(30, 'Username maksimal 30 karakter')
      .regex(USERNAME_PATTERN, 'Hanya huruf kecil, angka, titik, dan garis bawah'),
  );

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, 'Password wajib diisi'),
});

export type LoginInput = z.input<typeof loginSchema>;
export type LoginValues = z.output<typeof loginSchema>;
