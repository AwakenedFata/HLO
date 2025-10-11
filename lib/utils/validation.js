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
          "image/avif",
          "image/png",
          "image/webp",
        ];
        const validExtensions = [".jpg",".avif", ".jpeg", ".png", ".webp"];

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
    .regex(/^\\d+$/, "Page harus berupa angka")
    .optional(),
  limit: z
    .string()
    .regex(/^\\d+$/, "Limit harus berupa angka")
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

// Product Color Schema
const productColorSchema = z.object({
  name: z.string().min(1, "Nama warna harus diisi").max(50, "Nama warna maksimal 50 karakter").trim(),
  hexCode: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Format hex color tidak valid")
    .optional(),
  imageUrl: z.string().url("URL gambar warna tidak valid").optional(),
  imageKey: z.string().optional(),
})

// Product Size Schema
const productSizeSchema = z.object({
  name: z.string().min(1, "Nama ukuran harus diisi").max(10, "Nama ukuran maksimal 10 karakter").trim(),
  dimensions: z
    .object({
      length: z.number().min(0, "Panjang harus positif").optional(),
      width: z.number().min(0, "Lebar harus positif").optional(),
      unit: z.enum(["cm", "inch"]).default("cm"),
    })
    .optional(),
})

// Product Variant Schema
const productVariantSchema = z.object({
  colorName: z.string().min(1, "Nama warna harus diisi"),
  sizeName: z.string().min(1, "Nama ukuran harus diisi"),
  stock: z.number().int().min(0, "Stock tidak boleh negatif").default(0),
  sku: z.string().max(50, "SKU maksimal 50 karakter").optional(),
})

// Product Detail Item Schema
const productDetailItemSchema = z.object({
  label: z.string().min(1, "Label detail harus diisi").max(100, "Label maksimal 100 karakter").trim(),
  value: z.string().min(1, "Value detail harus diisi").max(500, "Value maksimal 500 karakter").trim(),
})

// Marketplace Link Schema
const marketplaceLinkSchema = z.object({
  platform: z.string().min(1, "Nama platform harus diisi").max(50, "Nama platform maksimal 50 karakter").trim(),
  url: z.string().url("Format URL tidak valid"),
  iconUrl: z.string().url("Format URL icon tidak valid").optional(),
  isActive: z.boolean().default(true),
})

// Product Image Schema
const productImageSchema = z.object({
  url: z.string().url("URL gambar tidak valid"),
  key: z.string().min(1, "Key gambar S3 harus diisi"),
  alt: z.string().max(200, "Alt text maksimal 200 karakter").optional(),
  order: z.number().int().min(0).optional(),
})

// Product Creation Schema
export const productCreationSchema = z.object({
  title: z.string().min(1, "Nama produk harus diisi").max(200, "Nama produk maksimal 200 karakter").trim(),
  storeName: z.string().min(1, "Nama toko harus diisi").max(100, "Nama toko maksimal 100 karakter").trim(),
  price: z
    .number()
    .min(0, "Harga tidak boleh negatif")
    .refine((val) => val > 0, {
      message: "Harga harus lebih dari 0",
    }),
  sku: z.string().min(1, "SKU harus diisi").max(50, "SKU maksimal 50 karakter").trim(),
  category: z.string().min(1, "Kategori harus diisi").max(50, "Kategori maksimal 50 karakter").trim(),
  badge: z.string().max(20, "Badge maksimal 20 karakter").optional().or(z.literal("")),
  description: z.string().min(10, "Deskripsi minimal 10 karakter").max(2000, "Deskripsi maksimal 2000 karakter").trim(),
  limitedMessage: z.string().max(200, "Limited message maksimal 200 karakter").optional().or(z.literal("")),
  mainImage: productImageSchema,
  thumbnails: z
    .array(productImageSchema)
    .min(1, "Minimal 1 thumbnail harus diupload")
    .max(10, "Maksimal 10 thumbnails"),
  colors: z.array(productColorSchema).min(1, "Minimal 1 warna harus ditambahkan").max(20, "Maksimal 20 warna"),
  sizes: z.array(productSizeSchema).min(1, "Minimal 1 ukuran harus ditambahkan").max(20, "Maksimal 20 ukuran"),
  variants: z.array(productVariantSchema).min(1, "Minimal 1 varian harus ditambahkan"),
  details: z.array(productDetailItemSchema).max(20, "Maksimal 20 detail items").optional().default([]),
  marketplaceLinks: z.array(marketplaceLinkSchema).max(20, "Maksimal 20 marketplace links").optional().default([]),
  has2DView: z.boolean().default(true),
  has3DView: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

// Product Update Schema
export const productUpdateSchema = z.object({
  title: z.string().min(1, "Nama produk harus diisi").max(200, "Nama produk maksimal 200 karakter").trim().optional(),
  storeName: z.string().min(1, "Nama toko harus diisi").max(100, "Nama toko maksimal 100 karakter").trim().optional(),
  price: z
    .number()
    .min(0, "Harga tidak boleh negatif")
    .refine((val) => val > 0, {
      message: "Harga harus lebih dari 0",
    })
    .optional(),
  sku: z.string().min(1, "SKU harus diisi").max(50, "SKU maksimal 50 karakter").trim().optional(),
  category: z.string().min(1, "Kategori harus diisi").max(50, "Kategori maksimal 50 karakter").trim().optional(),
  badge: z.string().max(20, "Badge maksimal 20 karakter").optional().or(z.literal("")),
  description: z
    .string()
    .min(10, "Deskripsi minimal 10 karakter")
    .max(2000, "Deskripsi maksimal 2000 karakter")
    .trim()
    .optional(),
  limitedMessage: z.string().max(200, "Limited message maksimal 200 karakter").optional().or(z.literal("")),
  mainImage: productImageSchema.optional(),
  thumbnails: z
    .array(productImageSchema)
    .min(1, "Minimal 1 thumbnail harus diupload")
    .max(10, "Maksimal 10 thumbnails")
    .optional(),
  colors: z
    .array(productColorSchema)
    .min(1, "Minimal 1 warna harus ditambahkan")
    .max(20, "Maksimal 20 warna")
    .optional(),
  sizes: z
    .array(productSizeSchema)
    .min(1, "Minimal 1 ukuran harus ditambahkan")
    .max(20, "Maksimal 20 ukuran")
    .optional(),
  variants: z.array(productVariantSchema).min(1, "Minimal 1 varian harus ditambahkan").optional(),
  details: z.array(productDetailItemSchema).max(20, "Maksimal 20 detail items").optional(),
  marketplaceLinks: z.array(marketplaceLinkSchema).max(20, "Maksimal 20 marketplace links").optional(),
  has2DView: z.boolean().optional(),
  has3DView: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

// Product Query Schema
export const productQuerySchema = z.object({
  page: z.string().regex(/^\d+$/, "Page harus berupa angka").optional(),
  limit: z.string().regex(/^\d+$/, "Limit harus berupa angka").optional(),
  search: z.string().optional(),
  category: z.string().optional(),
  minPrice: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "Min price harus berupa angka")
    .optional(),
  maxPrice: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "Max price harus berupa angka")
    .optional(),
  badge: z.string().optional(),
  sortBy: z
    .enum(["title", "price", "category", "totalStock", "createdAt", "updatedAt"])
    .nullable()
    .optional()
    .transform((val) => val || "createdAt"),
  sortOrder: z
    .enum(["asc", "desc"])
    .nullable()
    .optional()
    .transform((val) => val || "desc"),
  status: z.enum(["all", "active", "inactive"]).optional(),
  inStock: z.enum(["all", "true", "false"]).optional(),
})

// Product Bulk Delete Schema
export const productBulkDeleteSchema = z.object({
  ids: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/, "ID produk tidak valid"))
    .min(1, "Minimal 1 produk harus dipilih")
    .max(50, "Maksimal 50 produk dapat dihapus sekaligus"),
})

// Product Stock Update Schema
export const productStockUpdateSchema = z.object({
  variantId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "ID varian tidak valid")
    .optional(),
  colorName: z.string().min(1, "Nama warna harus diisi"),
  sizeName: z.string().min(1, "Nama ukuran harus diisi"),
  stock: z.number().int().min(0, "Stock tidak boleh negatif"),
})

// Product Image Upload Schema
export const productImageUploadSchema = z.object({
  file: z
    .any()
    .refine((file) => file !== undefined && file !== null, {
      message: "File gambar harus diupload",
    })
    .refine(
      (file) => {
        const size = file?.size
        return size && size <= 10 * 1024 * 1024 // 10MB
      },
      {
        message: "Ukuran file maksimal 10MB",
      },
    )
    .refine(
      (file) => {
        const fileType = file?.type
        const fileName = file?.name?.toLowerCase()
        const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
        const validExtensions = [".jpg", ".jpeg", ".png", ".webp"]

        const isValidType = fileType && validTypes.includes(fileType)
        const isValidExtension = fileName && validExtensions.some((ext) => fileName.endsWith(ext))

        return isValidType || isValidExtension
      },
      {
        message: "Format file harus JPG, PNG, atau WebP",
      },
    ),
})

// Product Variant Creation Schema (for adding single variant)
export const productVariantCreationSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID produk tidak valid"),
  colorName: z.string().min(1, "Nama warna harus diisi"),
  sizeName: z.string().min(1, "Nama ukuran harus diisi"),
  stock: z.number().int().min(0, "Stock tidak boleh negatif").default(0),
  sku: z.string().max(50, "SKU maksimal 50 karakter").optional(),
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
    batch: z.string().max(100).optional().default(""),
    productionDate: z.string().max(100).optional().default(""),
    warrantyUntil: z.string().max(100).optional().default(""),
  }),
})

export const serialUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  issuedDate: z.string().optional().refine((date) => !date || !isNaN(Date.parse(date)), {
    message: "Format tanggal tidak valid",
  }),
  product: z
    .object({
      name: z.string().min(1).max(200).optional(),
      batch: z.string().max(100).optional(),
      productionDate: z.string().max(100).optional(),
      warrantyUntil: z.string().max(100).optional(),
    })
    .optional(),
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