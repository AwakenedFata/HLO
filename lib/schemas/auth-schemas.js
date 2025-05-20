import {z} from "zod"
export const loginSchema = z.object({
  username: z
    .string()
    .min(1, "Username harus diisi")
    .max(50, "Username maksimal 50 karakter")
    .regex(/^[A-Za-z0-9_]+$/, "Username hanya boleh berisi huruf, angka, dan underscore"),
  password: z.string().min(1, "Password harus diisi").max(100, "Password terlalu panjang"),
})
// Logout Schema
export const logoutSchema = z.object({
  token: z.string().min(1, "Token harus diisi").optional(),
});

// Forgot Password Schema
export const forgotPasswordSchema = z.object({
  email: z.string().email("Format email tidak valid").max(100, "Email terlalu panjang"),
})

// Reset Password Schema
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token harus diisi"),
    password: z
      .string()
      .min(8, "Password minimal 8 karakter")
      .max(100, "Password terlalu panjang")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        "Password harus mengandung huruf besar, huruf kecil, angka, dan karakter khusus",
      ),
    confirmPassword: z.string().min(1, "Konfirmasi password harus diisi"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok dengan password baru",
    path: ["confirmPassword"],
  })

// Refresh Token Schema
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token harus diisi"),
});

// Verify Token Schema
export const verifyTokenSchema = z.object({
  token: z.string().min(1, "Token harus diisi"),
});
