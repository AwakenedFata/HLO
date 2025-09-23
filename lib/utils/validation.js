import { z } from "zod";
import logger from "@/lib/utils/logger-server";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  verifyTokenSchema,
  logoutSchema,
} from "@/lib/schemas/auth-schemas";

export {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  verifyTokenSchema,
  logoutSchema,
};

export const sanitizeInput = (input) => {
  if (typeof input === "string") {
    return input
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  } else if (typeof input === "object" && input !== null) {
    const sanitized = Array.isArray(input) ? [] : {};
    for (const key in input) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        sanitized[key] = sanitizeInput(input[key]);
      }
    }
    return sanitized;
  }
  return input;
};

export const validateRequest = async (schema, data) => {
  try {
    const sanitizedData = sanitizeInput(data);

    const validatedData = schema.parse(sanitizedData);
    return { data: validatedData, success: true };
  } catch (error) {
    logger.warn(`Validation failed: ${JSON.stringify(error.errors)}`);
    return {
      success: false,
      error: {
        message: "Validation failed",
        errors: error.errors,
      },
    };
  }
};

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
});

// User Update Schema
export const userUpdateSchema = z.object({
  username: z
    .string()
    .min(4, "Username minimal 4 karakter")
    .max(50, "Username maksimal 50 karakter")
    .regex(
      /^[A-Za-z0-9_]+$/,
      "Username hanya boleh berisi huruf, angka, dan underscore"
    )
    .optional(),
  email: z
    .string()
    .email("Format email tidak valid")
    .max(100, "Email terlalu panjang")
    .optional(),
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
        "Password harus mengandung huruf besar, huruf kecil, angka, dan karakter khusus"
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
    .regex(
      /^[A-Z0-9-]+$/,
      "PIN hanya boleh berisi huruf kapital, angka, dan tanda -"
    ),
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
      (file) =>
        ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(
          file?.type
        ),
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
    .regex(
      /^[A-Za-z0-9_]+$/,
      "Username hanya boleh berisi huruf, angka, dan underscore"
    )
    .optional(),
  email: z
    .string()
    .email("Format email tidak valid")
    .max(100, "Email terlalu panjang")
    .optional(),
});

// Dashboard Query Schema
export const dashboardQuerySchema = z.object({
  timeframe: z
    .enum(["today", "week", "month", "year", "all"])
    .optional()
    .default("week"),
});

// Stats Query Schema
export const statsQuerySchema = z.object({
  timeframe: z
    .enum(["today", "week", "month", "year", "all"])
    .optional()
    .default("week"),
  type: z
    .enum(["redemptions", "pins", "users"])
    .optional()
    .default("redemptions"),
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
        "Password harus mengandung huruf besar, huruf kecil, angka, dan karakter khusus"
      ),
    confirmPassword: z.string().min(1, "Konfirmasi password harus diisi"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok dengan password baru",
    path: ["confirmPassword"],
  });

// User Creation Schema
export const userCreationSchema = z.object({
  username: z
    .string()
    .min(4, "Username minimal 4 karakter")
    .max(50, "Username maksimal 50 karakter")
    .regex(
      /^[A-Za-z0-9_]+$/,
      "Username hanya boleh berisi huruf, angka, dan underscore"
    ),
  email: z
    .string()
    .email("Format email tidak valid")
    .max(100, "Email terlalu panjang"),
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .max(100, "Password terlalu panjang")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      "Password harus mengandung huruf besar, huruf kecil, angka, dan karakter khusus"
    ),
  role: z.enum(["admin", "super-admin"]).optional().default("admin"),
});

// PIN Redemption Schema
export const pinRedemptionSchema = z.object({
  pinCode: z
    .string()
    .min(1, "Kode PIN harus diisi")
    .max(20, "Kode PIN terlalu panjang")
    .regex(
      /^[A-Z0-9-]+$/,
      "PIN hanya boleh berisi huruf kapital, angka, dan tanda -"
    ),
  idGame: z
    .string()
    .min(1, "ID Game harus diisi")
    .max(50, "ID Game terlalu panjang")
    .refine((val) => !/[<>]/.test(val), {
      message: "ID Game mengandung karakter yang tidak diperbolehkan",
    }),
  nama: z.string().min(1, "Nama harus diisi").max(100, "Nama terlalu panjang"),
});

// Delete PIN Schema
export const deletePinSchema = z.object({
  pinIds: z
    .array(z.string())
    .min(1, "Minimal 1 PIN ID harus dipilih")
    .refine((arr) => arr.every((id) => id.length > 0), {
      message: "PIN ID tidak boleh kosong",
    }),
});

// Import PIN Schema
export const importPinSchema = z.object({
  pins: z
    .array(
      z.object({
        code: z
          .string()
          .min(1, "Kode PIN harus diisi")
          .max(20, "Kode PIN terlalu panjang")
          .regex(
            /^[A-Z0-9-]+$/,
            "PIN hanya boleh berisi huruf kapital, angka, dan tanda -"
          ),
      })
    )
    .min(1, "Minimal 1 PIN harus diimport"),
});

// Gallery Creation Schema
export const galleryCreationSchema = z.object({
  title: z
    .string()
    .min(1, "Judul harus diisi")
    .max(200, "Judul maksimal 200 karakter")
    .trim(),
  label: z
    .string()
    .min(1, "Label harus diisi")
    .max(100, "Label maksimal 100 karakter")
    .trim(),
  location: z
    .string()
    .min(1, "Lokasi harus diisi")
    .max(150, "Lokasi maksimal 150 karakter")
    .trim(),
  mapLink: z
    .string()
    .url("Format URL tidak valid")
    .optional()
    .or(z.literal("")), // Allow empty string
  uploadDate: z
    .string()
    .optional()
    .refine((date) => !date || !isNaN(Date.parse(date)), {
      message: "Format tanggal tidak valid",
    }),
  imageUrl: z
    .string()
    .url("URL gambar tidak valid")
    .min(1, "URL gambar harus diisi"),
  imageKey: z.string().min(1, "Key gambar S3 harus diisi"),
});

// Gallery Update Schema
export const galleryUpdateSchema = z.object({
  title: z
    .string()
    .min(1, "Judul harus diisi")
    .max(200, "Judul maksimal 200 karakter")
    .trim()
    .optional(),
  label: z
    .string()
    .min(1, "Label harus diisi")
    .max(100, "Label maksimal 100 karakter")
    .trim()
    .optional(),
  location: z
    .string()
    .min(1, "Lokasi harus diisi")
    .max(150, "Lokasi maksimal 150 karakter")
    .trim()
    .optional(),
  mapLink: z
    .string()
    .url("Format URL tidak valid")
    .optional()
    .or(z.literal("")), // Allow empty string
  uploadDate: z
    .string()
    .optional()
    .refine((date) => !date || !isNaN(Date.parse(date)), {
      message: "Format tanggal tidak valid",
    }),
});

// Gallery Query Schema
export const galleryQuerySchema = z.object({
  page: z.string().regex(/^\d+$/, "Page harus berupa angka").optional(),
  limit: z.string().regex(/^\d+$/, "Limit harus berupa angka").optional(),
  search: z.string().optional(),
  // Make sortBy and sortOrder nullable and provide transforms
  sortBy: z
    .enum(["title", "label", "location", "uploadDate", "createdAt"])
    .nullable()
    .optional()
    .transform((val) => val || "createdAt"),
  sortOrder: z
    .enum(["asc", "desc"])
    .nullable()
    .optional()
    .transform((val) => val || "desc"),
  // Add status field that was missing
  status: z.enum(["all", "active", "inactive"]).optional(),
});

// Image Upload Schema
export const imageUploadSchema = z.object({
  file: z
    .any()
    .refine((file) => file !== undefined && file !== null, {
      message: "File gambar harus diupload",
    })
    .refine(
      (file) => {
        const size = file?.size;
        return size && size <= 10 * 1024 * 1024; // 10MB
      },
      {
        message: "Ukuran file maksimal 10MB",
      }
    )
    .refine(
      (file) => {
        const fileType = file?.type;
        const fileName = file?.name?.toLowerCase();
        const validTypes = [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/webp",
        ];
        const validExtensions = [".jpg", ".jpeg", ".png", ".webp"];

        const isValidType = fileType && validTypes.includes(fileType);
        const isValidExtension =
          fileName && validExtensions.some((ext) => fileName.endsWith(ext));

        return isValidType || isValidExtension;
      },
      {
        message: "Format file harus JPG, PNG, atau WebP",
      }
    ),
});

// Banner Creation Schema
export const bannerCreationSchema = z.object({
  imageUrl: z
    .string()
    .url("URL gambar tidak valid")
    .min(1, "URL gambar harus diisi"),
  imageKey: z.string().min(1, "Key gambar S3 harus diisi"),
});

// Banner Update Schema
export const bannerUpdateSchema = z.object({
  imageUrl: z
    .string()
    .url("URL gambar tidak valid")
    .min(1, "URL gambar harus diisi")
    .optional(),
  imageKey: z.string().min(1, "Key gambar S3 harus diisi").optional(),
});

// Article Creation Schema
export const articleCreationSchema = z.object({
  title: z.string().min(1, "Judul artikel harus diisi").max(200, "Judul artikel maksimal 200 karakter").trim(),
  content: z.string().min(1, "Isi artikel harus diisi").min(50, "Isi artikel minimal 50 karakter"),
  excerpt: z.string().max(300, "Excerpt maksimal 300 karakter").optional(),
  coverImage: z.string().url("URL cover image tidak valid").optional().or(z.literal("")),
  coverImageKey: z.string().optional(),
  relatedGallery: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "ID Gallery tidak valid")
    .optional()
    .or(z.literal("")),
  tags: z.array(z.string().trim().min(1)).max(10, "Maksimal 10 tags").optional().default([]),
  status: z.enum(["draft", "published", "archived"]).optional().default("draft"),
  publishedAt: z
    .string()
    .optional()
    .refine((date) => !date || !isNaN(Date.parse(date)), {
      message: "Format tanggal tidak valid",
    }),
  contentImages: z
    .array(
      z.object({
        url: z.string(),
        key: z.string(),
        originalName: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
})

// Article Update Schema
export const articleUpdateSchema = z.object({
  title: z
    .string()
    .min(1, "Judul artikel harus diisi")
    .max(200, "Judul artikel maksimal 200 karakter")
    .trim()
    .optional(),
  content: z.string().min(1, "Isi artikel harus diisi").min(50, "Isi artikel minimal 50 karakter").optional(),
  excerpt: z.string().max(300, "Excerpt maksimal 300 karakter").optional(),
  coverImage: z.string().url("URL cover image tidak valid").optional().or(z.literal("")),
  coverImageKey: z.string().optional(),
  relatedGallery: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "ID Gallery tidak valid")
    .optional()
    .or(z.literal("")),
  tags: z.array(z.string().trim().min(1)).max(10, "Maksimal 10 tags").optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  publishedAt: z
    .string()
    .optional()
    .refine((date) => !date || !isNaN(Date.parse(date)), {
      message: "Format tanggal tidak valid",
    }),
  contentImages: z
    .array(
      z.object({
        url: z.string(),
        key: z.string(),
        originalName: z.string().optional(),
      }),
    )
    .optional(),
})

// Article Query Schema
export const articleQuerySchema = z.object({
  page: z.string().regex(/^\d+$/, "Page harus berupa angka").optional(),
  limit: z.string().regex(/^\d+$/, "Limit harus berupa angka").optional(),
  search: z.string().optional(),
  sortBy: z
    .enum(["title", "status", "publishedAt", "createdAt", "updatedAt"])
    .nullable()
    .optional()
    .transform((val) => val || "createdAt"),
  sortOrder: z
    .enum(["asc", "desc"])
    .nullable()
    .optional()
    .transform((val) => val || "desc"),
  status: z.enum(["all", "draft", "published", "archived"]).optional(),
  relatedGallery: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "ID Gallery tidak valid")
    .optional(),
})

// Article Bulk Delete Schema
export const articleBulkDeleteSchema = z.object({
  ids: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/, "ID artikel tidak valid"))
    .min(1, "Minimal 1 artikel harus dipilih")
    .max(50, "Maksimal 50 artikel dapat dihapus sekaligus"),
})
