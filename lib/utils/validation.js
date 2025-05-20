import { z } from "zod"
import logger from "@/lib/utils/logger-server"
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  verifyTokenSchema,
  logoutSchema,
} from "@/lib/schemas/auth-schemas"

export { loginSchema, forgotPasswordSchema, resetPasswordSchema, refreshTokenSchema, verifyTokenSchema, logoutSchema }

export const sanitizeInput = (input) => {
  if (typeof input === "string") {
    return input.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;")
  } else if (typeof input === "object" && input !== null) {
    const sanitized = Array.isArray(input) ? [] : {}
    for (const key in input) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        sanitized[key] = sanitizeInput(input[key])
      }
    }
    return sanitized
  }
  return input
}

export const validateRequest = async (schema, data) => {
  try {
    const sanitizedData = sanitizeInput(data)

    const validatedData = schema.parse(sanitizedData)
    return { data: validatedData, success: true }
  } catch (error) {
    logger.warn(`Validation failed: ${JSON.stringify(error.errors)}`)
    return {
      success: false,
      error: {
        message: "Validation failed",
        errors: error.errors,
      },
    }
  }
}

// PIN Creation Schema
export const pinCreationSchema = z.object({
  count: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .default(10)
    .refine((val) => val <= 1000, {
      message: "Jumlah PIN maksimal 1000",
    }),
  prefix: z
    .string()
    .regex(/^[A-Z0-9]*$/, "Prefix hanya boleh berisi huruf kapital dan angka")
    .max(5, "Prefix maksimal 5 karakter")
    .optional()
    .default(""),
})

// User Update Schema
export const userUpdateSchema = z.object({
  username: z
    .string()
    .min(4, "Username minimal 4 karakter")
    .max(50, "Username maksimal 50 karakter")
    .regex(/^[A-Za-z0-9_]+$/, "Username hanya boleh berisi huruf, angka, dan underscore")
    .optional(),
  email: z.string().email("Format email tidak valid").max(100, "Email terlalu panjang").optional(),
  role: z.enum(["admin", "super-admin"]).optional(),
  active: z.boolean().optional(),
});

// Admin Reset Password Schema
export const adminResetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password minimal 8 karakter")
      .max(100, "Password terlalu panjang")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        "Password harus mengandung huruf besar, huruf kecil, angka, dan karakter khusus",
      ),
    passwordConfirm: z.string().min(1, "Konfirmasi password harus diisi"),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Konfirmasi password tidak cocok dengan password",
    path: ["passwordConfirm"],
  });

  // Admin Query Schema
export const adminQuerySchema = z.object({
  page: z.string().regex(/^\d+$/, "Page harus berupa angka").optional(),
  limit: z.string().regex(/^\d+$/, "Limit harus berupa angka").optional(),
  search: z.string().optional(),
  role: z.enum(["admin", "super-admin"]).optional(),
  sortBy: z.enum(["username", "email", "role", "createdAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

// PIN Validation Schema
export const pinValidationSchema = z.object({
  code: z
    .string()
    .min(1, "Kode PIN harus diisi")
    .max(20, "Kode PIN terlalu panjang")
    .regex(/^[A-Z0-9-]+$/, "PIN hanya boleh berisi huruf kapital, angka, dan tanda -"),
});

// Update PIN Schema
export const updatePinSchema = z.object({
  used: z.boolean().optional(),
});

// PIN Query Schema
export const pinQuerySchema = z.object({
  page: z.string().regex(/^\d+$/, "Page harus berupa angka").optional(),
  limit: z.string().regex(/^\d+$/, "Limit harus berupa angka").optional(),
  used: z.enum(["true", "false", "all"]).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["code", "createdAt", "used"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

// Profile Image Upload Schema
export const profileImageUploadSchema = z.object({
  file: z
    .any()
    .refine((file) => file !== undefined, {
      message: "File gambar harus diupload",
    })
    .refine((file) => file?.size <= 5 * 1024 * 1024, {
      message: "Ukuran file maksimal 5MB",
    })
    .refine(
      (file) => ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file?.type),
      {
        message: "Format file harus JPG, PNG, atau WebP",
      }
    ),
});

// Profile Update Schema
export const profileUpdateSchema = z.object({
  username: z
    .string()
    .min(4, "Username minimal 4 karakter")
    .max(50, "Username maksimal 50 karakter")
    .regex(/^[A-Za-z0-9_]+$/, "Username hanya boleh berisi huruf, angka, dan underscore")
    .optional(),
  email: z.string().email("Format email tidak valid").max(100, "Email terlalu panjang").optional(),
});


// Dashboard Query Schema
export const dashboardQuerySchema = z.object({
  timeframe: z.enum(["today", "week", "month", "year", "all"]).optional().default("week"),
});

// Stats Query Schema
export const statsQuerySchema = z.object({
  timeframe: z.enum(["today", "week", "month", "year", "all"]).optional().default("week"),
  type: z.enum(["redemptions", "pins", "users"]).optional().default("redemptions"),
});

// Redemption Query Schema
export const redemptionQuerySchema = z.object({
  page: z.string().regex(/^\d+$/, "Page harus berupa angka").optional(),
  limit: z.string().regex(/^\d+$/, "Limit harus berupa angka").optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(["redeemedAt", "idGame", "nama"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

// File Upload Schema
export const fileUploadSchema = z.object({
  file: z
    .any()
    .refine((file) => file !== undefined, {
      message: "File harus diupload",
    })
    .refine((file) => file?.size <= 5 * 1024 * 1024, {
      message: "Ukuran file maksimal 5MB",
    }),
});

// Image Upload Schema
export const imageUploadSchema = z.object({
  file: z
    .any()
    .refine((file) => file !== undefined, {
      message: "File gambar harus diupload",
    })
    .refine((file) => file?.size <= 5 * 1024 * 1024, {
      message: "Ukuran file maksimal 5MB",
    })
    .refine(
      (file) => ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file?.type),
      {
        message: "Format file harus JPG, PNG, atau WebP",
      }
    ),
});

// CSV Upload Schema
export const csvUploadSchema = z.object({
  file: z
    .any()
    .refine((file) => file !== undefined, {
      message: "File CSV harus diupload",
    })
    .refine((file) => file?.size <= 10 * 1024 * 1024, {
      message: "Ukuran file maksimal 10MB",
    })
    .refine(
      (file) => ["text/csv", "application/vnd.ms-excel"].includes(file?.type),
      {
        message: "Format file harus CSV",
      }
    ),
});

// Password Update Schema
export const passwordUpdateSchema = z
  .object({
    currentPassword: z.string().min(1, "Password saat ini harus diisi"),
    newPassword: z
      .string()
      .min(8, "Password baru minimal 8 karakter")
      .max(100, "Password terlalu panjang")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        "Password harus mengandung huruf besar, huruf kecil, angka, dan karakter khusus",
      ),
    confirmPassword: z.string().min(1, "Konfirmasi password harus diisi"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok dengan password baru",
    path: ["confirmPassword"],
  })

// User Creation Schema
export const userCreationSchema = z.object({
  username: z
    .string()
    .min(4, "Username minimal 4 karakter")
    .max(50, "Username maksimal 50 karakter")
    .regex(/^[A-Za-z0-9_]+$/, "Username hanya boleh berisi huruf, angka, dan underscore"),
  email: z.string().email("Format email tidak valid").max(100, "Email terlalu panjang"),
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .max(100, "Password terlalu panjang")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      "Password harus mengandung huruf besar, huruf kecil, angka, dan karakter khusus",
    ),
  role: z.enum(["admin", "super-admin"]).optional().default("admin"),
})

// PIN Redemption Schema
export const pinRedemptionSchema = z.object({
  pinCode: z
    .string()
    .min(1, "Kode PIN harus diisi")
    .max(20, "Kode PIN terlalu panjang")
    .regex(/^[A-Z0-9-]+$/, "PIN hanya boleh berisi huruf kapital, angka, dan tanda -"),
  idGame: z
    .string()
    .min(1, "ID Game harus diisi")
    .max(50, "ID Game terlalu panjang")
    .refine((val) => !/[<>]/.test(val), {
      message: "ID Game mengandung karakter yang tidak diperbolehkan",
    }),
  nama: z
    .string()
    .min(1, "Nama harus diisi")
    .max(100, "Nama terlalu panjang")
})

// Delete PIN Schema
export const deletePinSchema = z.object({
  pinIds: z
    .array(z.string())
    .min(1, "Minimal 1 PIN ID harus dipilih")
    .refine((arr) => arr.every((id) => id.length > 0), {
  message: "PIN ID tidak boleh kosong",
  }),
})


// Import PIN Schema
export const importPinSchema = z.object({
  pins: z
    .array(
      z.object({
        code: z
          .string()
          .min(1, "Kode PIN harus diisi")
          .max(20, "Kode PIN terlalu panjang")
          .regex(/^[A-Z0-9-]+$/, "PIN hanya boleh berisi huruf kapital, angka, dan tanda -"),
      }),
    )
    .min(1, "Minimal 1 PIN harus diimport"),
})
