import { z } from "zod";
import logger from "@/lib/utils/logger-server";

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

// PIN Creation Schema - Updated untuk 16 digit
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

// PIN Validation Schema - Updated untuk 16 digit
export const pinValidationSchema = z.object({
  code: z
    .string()
    .min(16, "Kode PIN harus 16 karakter")
    .max(21, "Kode PIN maksimal 21 karakter (16 digit + prefix 5 karakter)")
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

// PIN Redemption Schema - Updated untuk 16 digit
export const pinRedemptionSchema = z.object({
  pinCode: z
    .string()
    .min(16, "Kode PIN harus 16 karakter")
    .max(21, "Kode PIN maksimal 21 karakter")
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

// Import PIN Schema - Updated untuk 16 digit
export const importPinSchema = z.object({
  pins: z
    .array(
      z.object({
        code: z
          .string()
          .min(16, "Kode PIN harus 16 karakter")
          .max(21, "Kode PIN maksimal 21 karakter")
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
  imageUrl: z
    .string()
    .url("URL gambar tidak valid")
    .optional(),
  imageKey: z.string().optional(),
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
          "image/avif",
          "image/png",
          "image/webp",
        ];
        const validExtensions = [".jpg", ".avif", ".jpeg", ".png", ".webp"];

        const isValidType = fileType && validTypes.includes(fileType);
        const isValidExtension =
          fileName && validExtensions.some((ext) => fileName.endsWith(ext));

        return isValidType || isValidExtension;
      },
      {
        message: "Format file harus JPG, PNG, atau WebP, atau AVIF",
      }
    ),
});

// User Mail Creation Schema
export const userMailCreationSchema = z.object({
  name: z.string().min(1, "Nama harus diisi").max(100, "Nama maksimal 100 karakter").trim(),
  email: z.string().email("Format email tidak valid").max(150, "Email maksimal 150 karakter"),
  subject: z.string().min(1, "Subjek harus diisi").max(200, "Subjek maksimal 200 karakter").trim(),
  message: z.string().min(10, "Pesan minimal 10 karakter").max(5000, "Pesan maksimal 5000 karakter").trim(),
})

// User Mail Query Schema
export const userMailQuerySchema = z.object({
  page: z.string().regex(/^\d+$/, "Page harus berupa angka").optional(),
  limit: z.string().regex(/^\d+$/, "Limit harus berupa angka").optional(),
  search: z.string().optional(),
  status: z.enum(["all", "unread", "read", "archived"]).optional(),
  sortBy: z
    .enum(["createdAt", "name", "email"])
    .nullable()
    .optional()
    .transform((val) => val || "createdAt"),
  sortOrder: z
    .enum(["asc", "desc"])
    .nullable()
    .optional()
    .transform((val) => val || "desc"),
})

// Frame Creation Schema
export const frameCreationSchema = z.object({
  imageUrl: z.string().url("URL gambar tidak valid").min(1, "URL gambar harus diisi"),
  imageKey: z.string().min(1, "Key gambar S3 harus diisi"),
  relatedGallery: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "ID Gallery tidak valid")
    .min(1, "Gallery terkait harus dipilih"),
  originalName: z.string().max(200, "Nama file maksimal 200 karakter").optional(),
  fileSize: z.number().min(0, "Ukuran file tidak valid").optional(),
  mimeType: z.string().optional(),
})

// Frame Query Schema
export const frameQuerySchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/, "Page harus berupa angka")
    .optional(),
  limit: z
    .string()
    .regex(/^\d+$/, "Limit harus berupa angka")
    .optional(),
  relatedGallery: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "ID Gallery tidak valid")
    .optional(),
  sortBy: z
    .enum(["createdAt", "originalName", "fileSize"])
    .nullable()
    .optional()
    .transform((val) => val || "createdAt"),
  sortOrder: z
    .enum(["asc", "desc"])
    .nullable()
    .optional()
    .transform((val) => val || "desc"),
  status: z.enum(["all", "active", "inactive"]).optional(),
})

// Frame Bulk Delete Schema
export const frameBulkDeleteSchema = z.object({
  ids: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/, "ID frame tidak valid"))
    .min(1, "Minimal 1 frame harus dipilih")
    .max(50, "Maksimal 50 frame dapat dihapus sekaligus"),
})

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
  excerpt: z.string().max(300, "Excerpt maksimal 300 karakter").optional().default(""),
  coverImage: z.string().url("URL cover image tidak valid").optional().or(z.literal("")).default(""),
  coverImageKey: z.string().optional().default(""),
  relatedGallery: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "ID Gallery tidak valid")
    .optional()
    .or(z.literal("")),
  tags: z.array(z.string().trim().min(1)).max(10, "Maksimal 10 tags").optional().default([]),
  status: z.enum(["draft", "published", "archived"]).optional().default("draft"),
  // CRITICAL FIX: publishedAt sekarang fully optional tanpa refine yang strict
  publishedAt: z
    .string()
    .optional()
    .nullable()
    .transform((val) => {
      // Transform null/empty string menjadi undefined
      if (!val || val === "" || val === "null") return undefined
      return val
    })
    .refine(
      (date) => {
        if (!date) return true // undefined/null = valid
        return !isNaN(Date.parse(date))
      },
      {
        message: "Format tanggal tidak valid",
      }
    ),
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
  // CRITICAL FIX: publishedAt sama seperti creation schema
  publishedAt: z
    .string()
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val === "" || val === "null") return undefined
      return val
    })
    .refine(
      (date) => {
        if (!date) return true
        return !isNaN(Date.parse(date))
      },
      {
        message: "Format tanggal tidak valid",
      }
    ),
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

export const serialCreationSchema = z.object({
  count: z.number().int().min(1).max(1000).optional().default(1),
  prefix: z
    .string()
    .regex(/^[A-Z0-9]*$/, "Prefix hanya huruf kapital/angka")
    .max(5)
    .optional()
    .default(""),
  // untuk single create
  code: z
    .string()
    .regex(/^[A-Z0-9]{6,20}$/, "Kode 6-20, huruf kapital/angka")
    .optional(),
  product: z.object({
    name: z.string().min(1, "Nama produk harus diisi").max(200),
    productionDate: z.string().max(100).optional().default(""),
  }),
})

export const serialUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  issuedDate: z.string().optional().refine((date) => !date || !isNaN(Date.parse(date)), {
    message: "Format tanggal issued tidak valid",
  }),
  product: z
    .object({
      name: z.string().min(1).max(200).optional(),
      productionDate: z.string().max(100).optional(),
    })
    .optional(),
  productName: z.string().optional(), // fallback untuk backward compatibility
})

export const serialQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  search: z.string().optional(),
  active: z.enum(["true", "false"]).optional(),
})

export const serialVerifySchema = z.object({
  code: z
    .string()
    .min(6, "Kode minimal 6 karakter")
    .max(20, "Kode maksimal 20 karakter")
    .regex(/^[A-Z0-9]+$/, "Hanya huruf kapital dan angka"),
})

export const serialManualCreateSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Kode harus 6 digit angka"),
  productName: z
    .string()
    .max(200, "Nama produk maksimal 200 karakter")
    .optional()
    .or(z.literal(""))
    .transform((v) => v ?? ""),
  issuedDate: z.string().optional().refine((date) => !date || !isNaN(Date.parse(date)), {
    message: "Format tanggal tidak valid",
  }),
  productionDate: z
    .string()
    .optional()
    .refine((date) => !date || !isNaN(Date.parse(date)), {
      message: "Format tanggal tidak valid",
    }),
})

export const serialBatchCreateSchema = z.object({
  count: z.number().int().min(1, "Minimal 1").max(100000, "Maksimal 100000").default(100),
  startFrom: z
    .string()
    .regex(/^\d+$/, "startFrom harus berupa angka")
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v : undefined)),
  digits: z.number().int().min(4).max(12).default(6),
  productName: z
    .string()
    .max(200, "Nama produk maksimal 200 karakter")
    .optional()
    .or(z.literal(""))
    .transform((v) => v ?? ""),
  issuedDate: z.string().optional().refine((date) => !date || !isNaN(Date.parse(date)), {
    message: "Format tanggal tidak valid",
  }),
  productionDate: z
    .string()
    .optional()
    .refine((date) => !date || !isNaN(Date.parse(date)), {
      message: "Format tanggal tidak valid",
    }),
})