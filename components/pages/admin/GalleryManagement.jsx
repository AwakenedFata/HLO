"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  convertToPixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  Row,
  Col,
  Card,
  Button,
  Form,
  Table,
  Badge,
  Alert,
  Tabs,
  Tab,
  Modal,
  Spinner,
  InputGroup,
  Dropdown,
  DropdownButton,
  Pagination,
  OverlayTrigger,
  Tooltip,
  Toast,
  ToastContainer,
  Image,
} from "react-bootstrap";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  FaPlus,
  FaSync,
  FaTrash,
  FaEdit,
  FaFilter,
  FaSearch,
  FaExclamationTriangle,
  FaEye,
  FaCheckCircle,
  FaTimesCircle,
  FaImage,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaTag,
  FaCrop,
  FaUpload,
  FaInfoCircle,
  FaTimes,
  FaLink,
  FaExpand,
  FaSearchPlus,
} from "react-icons/fa";

// API instance
// ---- Cache buster helper to avoid stale image URLs ----
const withBuster = (url) => {
  if (!url) return url;
  try {
    const lower = url.toLowerCase();
    const isSigned =
      lower.includes("x-amz-") ||
      lower.includes("x-amz-signature") ||
      lower.includes("x-amz-expires") ||
      lower.includes("signature=") ||
      lower.includes("x-goog-signature") ||
      lower.includes("policy=") ||
      lower.includes("expires=");
    if (isSigned) return url; // don't append anything for signed URLs to avoid 403
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}t=${Date.now()}`;
  } catch {
    return url;
  }
};

const api = axios.create({
  timeout: 30000,
});

function GalleryManagement() {
  const { status } = useSession();
  const router = useRouter();
  const fileInputRef = useRef(null);
  const bannerFileInputRef = useRef(null);
  const isMountedRef = useRef(false);

  // Basic state
  const [isClient, setIsClient] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [galleries, setGalleries] = useState([]);
  const [filteredGalleries, setFilteredGalleries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [error, setError] = useState("");

  // Toast notifications
  const [toasts, setToasts] = useState([]);

  // Form state
  const [activeTab, setActiveTab] = useState("add");
  const [formData, setFormData] = useState({
    title: "",
    label: "",
    location: "",
    mapLink: "",
    uploadDate: new Date().toISOString().split("T")[0],
    imageUrl: "",
    imageKey: "",
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Banner management state
  const [bannerData, setBannerData] = useState({
    imageUrl: "",
    imageKey: "",
  });
  const [currentBanner, setCurrentBanner] = useState(null);
  const [bannerPreviewImage, setBannerPreviewImage] = useState(null);
  const [selectedBannerFile, setSelectedBannerFile] = useState(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerSubmitting, setBannerSubmitting] = useState(false);

  // Edit state
  const [editingGallery, setEditingGallery] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const editFileInputRef = useRef(null);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    thisMonth: 0,
  });

  // Selection and modals
  const [selectedGalleries, setSelectedGalleries] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [galleryToDelete, setGalleryToDelete] = useState(null);
  const [showDeleteMultipleModal, setShowDeleteMultipleModal] = useState(false);
  const [deletingMultiple, setDeletingMultiple] = useState(false);

  // Filtering and search
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);

  const [previewImage, setPreviewImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  const [imgRef, setImgRef] = useState();

  // Image viewer modal states
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState("");
  const [selectedImageTitle, setSelectedImageTitle] = useState("");

  const [bannerToDelete, setBannerToDelete] = useState(null);
  const [showBannerDeleteModal, setShowBannerDeleteModal] = useState(false);
  const [bannerDeleting, setBannerDeleting] = useState(false);
  const [showBannerCropModal, setShowBannerCropModal] = useState(false);
  const [bannerCrop, setBannerCrop] = useState();
  const [bannerCompletedCrop, setBannerCompletedCrop] = useState();
  const [bannerCropImage, setBannerCropImage] = useState(null);
  const [bannerImgRef, setBannerImgRef] = useState();

  const [bannerAspectRatio, setBannerAspectRatio] = useState(16 / 5);

  // Frame management state
  const [frames, setFrames] = useState([]);
  const [frameStats, setFrameStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    thisMonth: 0,
  });
  const [frameFormData, setFrameFormData] = useState({
    relatedGallery: "",
    imageUrl: "",
    imageKey: "",
    originalName: "",
    fileSize: 0,
    mimeType: "",
  });
  const [frameUploading, setFrameUploading] = useState(false);
  const [frameSubmitting, setFrameSubmitting] = useState(false);
  const [framePreviewImage, setFramePreviewImage] = useState(null);
  const [selectedFrameFile, setSelectedFrameFile] = useState(null);
  const frameFileInputRef = useRef(null);
  const [showFrameDeleteModal, setShowFrameDeleteModal] = useState(false);
  const [frameToDelete, setFrameToDelete] = useState(null);
  const [frameDeleting, setFrameDeleting] = useState(false);

  const [noCrop, setNoCrop] = useState(false);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState("16-9");

  // Toast helper
  const addToast = useCallback((message, type = "success", duration = 5000) => {
    const id = Date.now();
    const toast = {
      id,
      message,
      type,
      duration,
    };
    setToasts((prev) => [...prev, toast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const checkAuth = useCallback(() => {
    if (status !== "authenticated") {
      console.log("Waiting for authentication..., current status:", status);
      return null;
    }
    return true;
  }, [status]);

  // Fetch galleries
  const fetchGalleries = useCallback(
    async (page = 1, limit = 20) => {
      if (!isMountedRef.current) return;

      if (status !== "authenticated") {
        console.log(
          "⏳ Waiting for authentication before fetching galleries...",
        );
        return;
      }

      setLoading(true);
      setError("");

      try {
        const params = {
          page,
          limit,
          search: searchTerm,
          status: filterStatus,
        };

        const response = await api.get("/api/admin/galeri", {
          params,
        });

        if (isMountedRef.current) {
          setGalleries(response.data.galleries);
          setFilteredGalleries(response.data.galleries);
          setStats(response.data.stats);
          setCurrentPage(response.data.pagination.current);
          setTotalPages(response.data.pagination.total);
          setTotalItems(response.data.pagination.totalItems);
          setDataLoaded(true);
        }
      } catch (error) {
        if (!isMountedRef.current) return;

        if (error.response?.status === 401) {
          setAuthError(true);
          router.push("/admin/login");
        } else {
          setError(
            "Gagal mengambil data gallery: " +
              (error.response?.data?.error || error.message),
          );
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [status, searchTerm, filterStatus, router],
  );

  // Fetch current banner
  const fetchCurrentBanner = useCallback(async () => {
    if (status !== "authenticated") {
      console.log("Waiting for authentication before fetching banner...");
      return null;
    }

    try {
      const response = await api.get("/api/admin/banner/current", {
        params: { _t: Date.now() },
        headers: { "Cache-Control": "no-cache" },
      });

      if (response.data.success && response.data.banner) {
        const banner = {
          ...response.data.banner,
          // gunakan URL asli (signed URL) tanpa menambah query agar tidak invalid
          imageUrl: response.data.banner.imageUrl,
        };
        setCurrentBanner(banner);
        return banner;
      } else {
        setCurrentBanner(null);
        return null;
      }
    } catch (error) {
      console.log("No current banner found or error fetching banner:", error);
      setCurrentBanner(null);
      return null;
    }
  }, [status]);

  const handleBannerDelete = async () => {
    if (!bannerToDelete) return;

    setBannerDeleting(true);
    try {
      const token = checkAuth();
      if (!token) return;

      const response = await api.delete(
        `/api/admin/banner/${bannerToDelete._id}`,
      );

      if (response.data.success) {
        setCurrentBanner(null);
        await fetchCurrentBanner();
        addToast("Banner berhasil dihapus!", "success");
        setShowBannerDeleteModal(false);
        setBannerToDelete(null);
      }
    } catch (error) {
      console.error("Error deleting banner:", error);
      addToast("Gagal menghapus banner. Silakan coba lagi.", "error");
    } finally {
      setBannerDeleting(false);
    }
  };

  const handleBannerFileSelect = (file) => {
    if (file) {
      setBannerPreviewImage(null);
      setBannerData({
        imageUrl: "",
        imageKey: "",
      });

      setSelectedBannerFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setBannerCropImage(reader.result);
        setShowBannerCropModal(true);
      };
      reader.onerror = (error) => {
        console.error("Error reading file:", error);
        addToast("Gagal membaca file gambar", "error");
      };
      reader.readAsDataURL(file);
    }
  };

  const onImageLoad = useCallback(
    (e) => {
      if (aspectRatio) {
        const { width, height } = e.currentTarget;
        setCrop(
          centerCrop(
            makeAspectCrop(
              {
                unit: "%",
                width: 90,
              },
              aspectRatio,
              width,
              height,
            ),
            width,
            height,
          ),
        );
      }
      setImgRef(e.currentTarget);
    },
    [aspectRatio],
  );

  const onBannerImageLoad = useCallback(
    (e) => {
      const { width, height } = e.currentTarget;
      setBannerCrop(
        centerCrop(
          makeAspectCrop(
            {
              unit: "%",
              width: 90,
            },
            bannerAspectRatio,
            width,
            height,
          ),
          width,
          height,
        ),
      );
      setBannerImgRef(e.currentTarget);
    },
    [bannerAspectRatio],
  );

  const createBannerCroppedImage = useCallback(async () => {
    try {
      if (!bannerImgRef || !bannerCompletedCrop) return null;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("No 2d context");
      }

      const pixelRatio = window.devicePixelRatio;
      const pixelCrop = convertToPixelCrop(
        bannerCompletedCrop,
        bannerImgRef.naturalWidth,
        bannerImgRef.naturalHeight,
      );

      const scaleX = bannerImgRef.naturalWidth / bannerImgRef.width;
      const scaleY = bannerImgRef.naturalHeight / bannerImgRef.height;

      canvas.width = Math.floor(pixelCrop.width * scaleX * pixelRatio);
      canvas.height = Math.floor(pixelCrop.height * scaleY * pixelRatio);

      ctx.scale(pixelRatio, pixelRatio);
      ctx.imageSmoothingQuality = "high";

      const cropX = pixelCrop.x * scaleX;
      const cropY = pixelCrop.y * scaleY;

      ctx.drawImage(
        bannerImgRef,
        cropX,
        cropY,
        pixelCrop.width * scaleX,
        pixelCrop.height * scaleY,
        0,
        0,
        pixelCrop.width * scaleX,
        pixelCrop.height * scaleY,
      );

      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const croppedFile = new File([blob], selectedBannerFile.name, {
                type: selectedBannerFile.type,
                lastModified: Date.now(),
              });
              resolve(croppedFile);
            } else {
              reject(new Error("Failed to create blob from canvas"));
            }
          },
          selectedBannerFile.type,
          0.95,
        );
      });
    } catch (error) {
      console.error("Error creating cropped image:", error);
      return null;
    }
  }, [bannerImgRef, bannerCompletedCrop, selectedBannerFile]);

  const handleBannerCropSave = async () => {
    try {
      const croppedFile = await createBannerCroppedImage();
      if (croppedFile) {
        setSelectedBannerFile(croppedFile);

        const previewUrl = URL.createObjectURL(croppedFile);
        setBannerPreviewImage(previewUrl);

        setShowBannerCropModal(false);
        setBannerCropImage(null);
        setBannerCrop(undefined);

        await handleBannerUpload(croppedFile);
      }
    } catch (error) {
      console.error("Error saving cropped banner:", error);
      addToast("Gagal memproses gambar. Silakan coba lagi.", "error");
    }
  };

  const handleBannerUpload = useCallback(
    async (fileToUpload = null) => {
      const file = fileToUpload || selectedBannerFile;

      if (!file) {
        addToast("Pilih file gambar banner terlebih dahulu", "error");
        return;
      }

      setBannerUploading(true);

      try {
        const token = checkAuth();
        if (!token) return;

        const formData = new FormData();
        formData.append("file", file);

        const uploadResponse = await api.post(
          "/api/admin/banner/upload",
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          },
        );

        if (uploadResponse.data.success) {
          const imageUrl = uploadResponse.data.imageUrl;

          setBannerData({
            imageUrl: imageUrl,
            imageKey: uploadResponse.data.imageKey,
          });

          const currentPreview = bannerPreviewImage;
          setBannerPreviewImage(imageUrl);

          if (currentPreview && currentPreview.startsWith("blob:")) {
            setTimeout(() => {
              URL.revokeObjectURL(currentPreview);
            }, 1000);
          }

          addToast("Banner berhasil diupload", "success");
        }
      } catch (error) {
        console.error("Banner upload error:", error);
        addToast(
          "Gagal mengupload banner: " +
            (error.response?.data?.error || error.message),
          "error",
        );
      } finally {
        setBannerUploading(false);
      }
    },
    [selectedBannerFile, checkAuth, addToast, bannerPreviewImage],
  );

  const handleBannerSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      if (!bannerData.imageUrl) {
        addToast("Upload gambar banner terlebih dahulu", "error");
        return;
      }

      setBannerSubmitting(true);

      try {
        const token = checkAuth();
        if (!token) return;

        const response = await api.post("/api/admin/banner", bannerData, {
          headers: {
            "Content-Type": "application/json",
          },
        });

        // CHANGE: after saving banner, keep the raw imageUrl to avoid invalidating signed URL
        if (response.data.success) {
          addToast("Banner berhasil disimpan", "success");

          setCurrentBanner({
            ...response.data.banner,
            // imageUrl: withBuster(bannerData.imageUrl),
            // CHANGE: use the original URL (server already returns fresh value)
            imageUrl: bannerData.imageUrl,
            updatedAt: new Date().toISOString(),
          });

          setBannerData({
            imageUrl: "",
            imageKey: "",
          });
          setSelectedBannerFile(null);
          if (bannerFileInputRef.current) {
            bannerFileInputRef.current.value = "";
          }

          const currentPreview = bannerPreviewImage;
          setTimeout(() => {
            try {
              if (currentPreview && currentPreview.startsWith("blob:")) {
                URL.revokeObjectURL(currentPreview);
              }
            } catch {}
          }, 1000);
          setTimeout(() => setBannerPreviewImage(null), 1200);

          setTimeout(async () => {
            await fetchCurrentBanner();
          }, 500);
        }
      } catch (error) {
        console.error("Banner submit error:", error);
        addToast(
          "Gagal menyimpan banner: " +
            (error.response?.data?.error || error.message),
          "error",
        );
      } finally {
        setBannerSubmitting(false);
      }
    },
    [bannerData, checkAuth, addToast, fetchCurrentBanner, bannerPreviewImage],
  );

  const handleFileSelect = useCallback(
    (file) => {
      if (!file) return;

      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/avif",
        "image/webp",
      ];
      const allowedExts = [".jpg", ".jpeg", ".png", ".avif", ".webp"];

      const isValidType = allowedTypes.includes(file.type);
      const isValidExt = allowedExts.some((ext) =>
        file.name?.toLowerCase().endsWith(ext),
      );

      if (!isValidType && !isValidExt) {
        addToast("Format file harus JPG, PNG, avif atau WebP", "error");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        addToast("Ukuran file maksimal 10MB", "error");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImage(e.target.result);
        setSelectedFile(file);
        setShowCropModal(true);
      };
      reader.readAsDataURL(file);
    },
    [addToast],
  );

  const handlePreviewClick = useCallback(() => {
    if (selectedFile && previewImage) {
      setShowCropModal(true);
    } else {
      addToast("Silakan pilih gambar terlebih dahulu", "warning");
    }
  }, [selectedFile, previewImage, addToast]);

  const handleImageView = useCallback((imageUrl, title) => {
    if (imageUrl && typeof imageUrl === "string") {
      setSelectedImageUrl(imageUrl);
      setSelectedImageTitle(title);
      setShowImageModal(true);
    } else {
      console.warn(
        "Attempted to open image viewer with invalid URL:",
        imageUrl,
      );
      addToast("URL gambar tidak valid.", "error");
    }
  }, []);

  const handleFileUpload = useCallback(
    async (file) => {
      if (!file) return;

      setUploading(true);

      try {
        const token = checkAuth();
        if (!token) return;

        const formData = new FormData();
        formData.append("file", file);

        const response = await api.post("/api/admin/galeri/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        if (
          response.data.imageUrl &&
          typeof response.data.imageUrl === "string"
        ) {
          setFormData((prev) => ({
            ...prev,
            imageUrl: response.data.imageUrl,
            imageKey: response.data.imageKey,
          }));
          addToast("Gambar berhasil diupload", "success");
        } else {
          throw new Error("Invalid image URL received from server.");
        }

        setPreviewImage(null);
        setSelectedFile(null);
        setShowCropModal(false);
        setCrop(undefined);
        setCompletedCrop(undefined);
        setImgRef(undefined);

        setNoCrop(false);
        setAspectRatio(16 / 9);
      } catch (error) {
        console.error("Image upload error:", error);
        addToast(
          "Gagal upload gambar: " +
            (error.response?.data?.error || error.message),
          "error",
        );
        setFormData((prev) => ({ ...prev, imageUrl: "", imageKey: "" }));
      } finally {
        setUploading(false);
      }
    },
    [checkAuth, addToast],
  );

  const handleEditUpload = useCallback(
    async (file) => {
      if (!file) return;

      setUploading(true);

      try {
        const token = checkAuth();
        if (!token) return;

        const formData = new FormData();
        formData.append("file", file);

        const response = await api.post("/api/admin/galeri/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        if (
          response.data.imageUrl &&
          typeof response.data.imageUrl === "string"
        ) {
          setEditingGallery((prev) => ({
            ...prev,
            imageUrl: response.data.imageUrl,
            imageKey: response.data.imageKey,
          }));
          addToast("Gambar berhasil diupdate", "success");
        } else {
          throw new Error("Invalid image URL received from server.");
        }

        setPreviewImage(null);
        setSelectedFile(null);
        setShowCropModal(false);
        setCrop(undefined);
        setCompletedCrop(undefined);
        setImgRef(undefined);
        setIsEditingImage(false);

        setNoCrop(false);
        setAspectRatio(16 / 9);
      } catch (error) {
        console.error("Image upload error:", error);
        addToast(
          "Gagal upload gambar: " +
            (error.response?.data?.error || error.message),
          "error",
        );
      } finally {
        setUploading(false);
      }
    },
    [checkAuth, addToast],
  );

  const handleDirectUpload = useCallback(
    async (fileParam) => {
      const file = fileParam || selectedFile;
      if (!file) {
        addToast("Pilih file gambar terlebih dahulu", "error");
        return;
      }

      try {
        setUploading(true);
        if (isEditingImage) {
          await handleEditUpload(file);
        } else {
          await handleFileUpload(file);
        }
      } catch (error) {
        console.error("Error uploading image directly:", error);
        addToast("Gagal mengupload gambar", "error");
      } finally {
        setUploading(false);
      }
    },
    [selectedFile, handleFileUpload, addToast],
  );

  const getCroppedImg = useCallback((image, completedCrop) => {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("No 2d context");
        }

        const pixelRatio = window.devicePixelRatio;
        const pixelCrop = convertToPixelCrop(
          completedCrop,
          image.naturalWidth,
          image.naturalHeight,
        );

        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;

        canvas.width = Math.floor(pixelCrop.width * scaleX * pixelRatio);
        canvas.height = Math.floor(pixelCrop.height * scaleY * pixelRatio);

        ctx.scale(pixelRatio, pixelRatio);
        ctx.imageSmoothingQuality = "high";

        const cropX = pixelCrop.x * scaleX;
        const cropY = pixelCrop.y * scaleY;

        ctx.drawImage(
          image,
          cropX,
          cropY,
          pixelCrop.width * scaleX,
          pixelCrop.height * scaleY,
          0,
          0,
          pixelCrop.width * scaleX,
          pixelCrop.height * scaleY,
        );

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Canvas is empty"));
            }
          },
          "image/jpeg",
          0.95,
        );
      } catch (error) {
        reject(error);
      }
    });
  }, []);

  const handleCropAndUpload = useCallback(async () => {
    if (!selectedFile || !previewImage || !completedCrop || !imgRef) return;

    try {
      setUploading(true);

      const croppedBlob = await getCroppedImg(imgRef, completedCrop);
      const croppedFile = new File([croppedBlob], selectedFile.name, {
        type: selectedFile.type,
      });

      if (isEditingImage) {
        await handleEditUpload(croppedFile);
      } else {
        await handleFileUpload(croppedFile);
      }
    } catch (error) {
      console.error("Error cropping image:", error);
      addToast("Gagal memproses gambar", "error");
      setUploading(false);
    }
  }, [
    selectedFile,
    previewImage,
    completedCrop,
    imgRef,
    getCroppedImg,
    handleFileUpload,
    addToast,
  ]);

  const getPreviewHeight = () => {
    if (selectedAspectRatio === "no-crop") {
      return "auto";
    }

    const aspectRatios = {
      "16-9": "225px",
      "4-3": "300px",
      "1-1": "400px",
      "3-4": "533px",
      free: "250px",
    };

    return aspectRatios[selectedAspectRatio] || "200px";
  };

  const resetImageUpload = useCallback(() => {
    setSelectedFile(null);
    setPreviewImage(null);
    setShowCropModal(false);
    setCompletedCrop(null);
    setCrop(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setFormData((prev) => ({
      ...prev,
      imageUrl: "",
      imageKey: "",
    }));
  }, []);

  const handleReplaceImage = useCallback(() => {
    resetImageUpload();
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }, 100);
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      if (
        !formData.title ||
        !formData.label ||
        !formData.location ||
        !formData.imageUrl
      ) {
        addToast("Semua field wajib diisi", "error");
        return;
      }

      setSubmitting(true);

      try {
        const token = checkAuth();
        if (!token) return;

        await api.post("/api/admin/galeri", formData);

        addToast("Gallery item berhasil ditambahkan", "success");
        setFormData({
          title: "",
          label: "",
          location: "",
          mapLink: "",
          uploadDate: new Date().toISOString().split("T")[0],
          imageUrl: "",
          imageKey: "",
        });

        resetImageUpload();

        await fetchGalleries(1, itemsPerPage);
      } catch (error) {
        addToast(
          "Gagal menambahkan gallery item: " +
            (error.response?.data?.error || error.message),
          "error",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      formData,
      checkAuth,
      addToast,
      fetchGalleries,
      itemsPerPage,
      resetImageUpload,
    ],
  );

  const handleEditSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      if (!editingGallery) return;

      const editFormData = new FormData(e.target);
      const updateData = {
        title: editFormData.get("title"),
        label: editFormData.get("label"),
        location: editFormData.get("location"),
        mapLink: editFormData.get("mapLink"),
        uploadDate: editFormData.get("uploadDate"),
        imageUrl: editingGallery.imageUrl,
        imageKey: editingGallery.imageKey,
      };

      if (!updateData.title || !updateData.label || !updateData.location) {
        addToast("Semua field wajib diisi", "error");
        return;
      }

      setSubmitting(true);

      try {
        const token = checkAuth();
        if (!token) return;

        await api.put(`/api/admin/galeri/${editingGallery._id}`, updateData);

        addToast("Gallery item berhasil ditambahkan", "success");
        setShowEditModal(false);
        setEditingGallery(null);
        await fetchGalleries(currentPage, itemsPerPage);
      } catch (error) {
        addToast(
          "Gagal mengupdate gallery item: " +
            (error.response?.data?.error || error.message),
          "error",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      editingGallery,
      checkAuth,
      addToast,
      fetchGalleries,
      currentPage,
      itemsPerPage,
    ],
  );

  const handleDelete = useCallback(async () => {
    if (!galleryToDelete) return;

    try {
      const token = checkAuth();
      if (!token) return;

      await api.delete(`/api/admin/galeri/${galleryToDelete._id}`);

      addToast("Gallery item berhasil dihapus", "success");
      setShowDeleteModal(false);
      setGalleryToDelete(null);
      await fetchGalleries(currentPage, itemsPerPage);
    } catch (error) {
      addToast(
        "Gagal menghapus gallery item: " +
          (error.response?.data?.error || error.message),
        "error",
      );
    }
  }, [
    galleryToDelete,
    checkAuth,
    addToast,
    fetchGalleries,
    currentPage,
    itemsPerPage,
  ]);

  const handleSelectAll = useCallback(
    (checked) => {
      setSelectAll(checked);
      if (checked) {
        setSelectedGalleries(filteredGalleries.map((g) => g._id));
      } else {
        setSelectedGalleries([]);
      }
    },
    [filteredGalleries],
  );

  const handleSelectGallery = useCallback((id, checked) => {
    if (checked) {
      setSelectedGalleries((prev) => [...prev, id]);
    } else {
      setSelectedGalleries((prev) => prev.filter((gId) => gId !== id));
      setSelectAll(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    fetchGalleries(currentPage, itemsPerPage);
  }, [fetchGalleries, currentPage, itemsPerPage]);

  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedGalleries.length === 0) return;

    try {
      setDeletingMultiple(true);
      const token = checkAuth();
      if (!token) return;

      const response = await api.post("/api/admin/galeri/bulk-delete", {
        ids: selectedGalleries,
      });

      addToast(
        `${response.data.deletedCount} gallery items berhasil dihapus`,
        "success",
      );
      setShowDeleteMultipleModal(false);
      setSelectedGalleries([]);
      setSelectAll(false);
      await fetchGalleries(currentPage, itemsPerPage);
    } catch (error) {
      console.error("Bulk delete error:", error);
      addToast(
        "Gagal menghapus gallery items: " +
          (error.response?.data?.error || error.message),
        "error",
      );
    } finally {
      setDeletingMultiple(false);
    }
  }, [
    selectedGalleries,
    checkAuth,
    addToast,
    fetchGalleries,
    currentPage,
    itemsPerPage,
  ]);

  const fetchFrames = useCallback(async () => {
    if (!isMountedRef.current) return;

    if (status !== "authenticated") {
      console.log("⏳ Waiting for authentication before fetching frames...");
      return;
    }

    try {
      const response = await api.get("/api/admin/bingkai");

      if (isMountedRef.current) {
        setFrames(response.data.frames);
        setFrameStats(response.data.stats);
      }
    } catch (error) {
      if (!isMountedRef.current) return;

      if (error.response?.status === 401) {
        setAuthError(true);
        router.push("/admin/login");
      } else {
        console.error("Error fetching frames:", error);
      }
    }
  }, [status, router]);

  const handleFrameUpload = useCallback(
    async (fileToUpload = null) => {
      const file = fileToUpload || selectedFrameFile;

      if (!file) {
        addToast("Pilih file gambar frame terlebih dahulu", "error");
        return;
      }

      setFrameUploading(true);

      try {
        const token = checkAuth();
        if (!token) return;

        const formData = new FormData();
        formData.append("file", file);

        const uploadResponse = await api.post(
          "/api/admin/bingkai/upload",
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          },
        );

        if (uploadResponse.data.success) {
          setFrameFormData((prev) => ({
            ...prev,
            imageUrl: uploadResponse.data.imageUrl,
            imageKey: uploadResponse.data.imageKey,
            originalName: uploadResponse.data.originalName,
            fileSize: uploadResponse.data.fileSize,
            mimeType: uploadResponse.data.mimeType,
          }));

          addToast("Frame berhasil diupload", "success");
        }
      } catch (error) {
        console.error("Frame upload error:", error);
        addToast(
          "Gagal mengupload frame: " +
            (error.response?.data?.error || error.message),
          "error",
        );
      } finally {
        setFrameUploading(false);
      }
    },
    [selectedFrameFile, checkAuth, addToast],
  );

  const handleFrameFileSelect = useCallback(
    (file) => {
      if (!file) return;

      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/avif",
        "image/png",
        "image/webp",
      ];
      const allowedExts = [".jpg", ".jpeg", ".avif", ".png", ".webp"];

      const isValidType = allowedTypes.includes(file.type);
      const isValidExt = allowedExts.some((ext) =>
        file.name?.toLowerCase().endsWith(ext),
      );

      if (!isValidType && !isValidExt) {
        addToast("Format file harus JPG, PNG, AVIF, atau WebP", "error");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        addToast("Ukuran file maksimal 10MB", "error");
        return;
      }

      setFramePreviewImage(null); // Clear previous preview
      setFrameFormData((prev) => ({
        // Reset frame upload data
        ...prev,
        imageUrl: "",
        imageKey: "",
        originalName: "",
        fileSize: 0,
        mimeType: "",
      }));

      setSelectedFrameFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setFramePreviewImage(e.target.result);
      };
      reader.readAsDataURL(file);

      handleFrameUpload(file);
    },
    [addToast, handleFrameUpload],
  );

  const handleFrameSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      if (!frameFormData.relatedGallery) {
        addToast("Pilih gallery terkait terlebih dahulu", "error");
        return;
      }

      if (!frameFormData.imageUrl) {
        addToast("Upload gambar frame terlebih dahulu", "error");
        return;
      }

      setFrameSubmitting(true);

      try {
        const token = checkAuth();
        if (!token) return;

        const response = await api.post("/api/admin/bingkai", frameFormData, {
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.data.success) {
          addToast("Frame berhasil ditambahkan", "success");

          setFrameFormData({
            relatedGallery: "",
            imageUrl: "",
            imageKey: "",
            originalName: "",
            fileSize: 0,
            mimeType: "",
          });
          setFramePreviewImage(null);
          setSelectedFrameFile(null);

          if (frameFileInputRef.current) {
            frameFileInputRef.current.value = "";
          }

          await fetchFrames();
        }
      } catch (error) {
        console.error("Frame submit error:", error);
        addToast(
          "Gagal menambahkan frame: " +
            (error.response?.data?.error || error.message),
          "error",
        );
      } finally {
        setFrameSubmitting(false);
      }
    },
    [frameFormData, checkAuth, addToast, fetchFrames],
  );

  const handleFrameDelete = useCallback(async () => {
    if (!frameToDelete) return;

    setFrameDeleting(true);
    try {
      const token = checkAuth();
      if (!token) return;

      const response = await api.delete(
        `/api/admin/bingkai/${frameToDelete._id}`,
      );

      if (response.data.success) {
        addToast("Frame berhasil dihapus", "success");
        setShowFrameDeleteModal(false);
        setFrameToDelete(null);
        await fetchFrames();
      }
    } catch (error) {
      console.error("Error deleting frame:", error);
      addToast(
        "Gagal menghapus frame: " +
          (error.response?.data?.error || error.message),
        "error",
      );
    } finally {
      setFrameDeleting(false);
    }
  }, [frameToDelete, checkAuth, addToast, fetchFrames]);

  useEffect(() => {
    setIsClient(true);
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      try {
        if (bannerPreviewImage && bannerPreviewImage.startsWith("blob:")) {
          URL.revokeObjectURL(bannerPreviewImage);
        }
        if (previewImage && previewImage.startsWith("blob:")) {
          URL.revokeObjectURL(previewImage);
        }
        if (framePreviewImage && framePreviewImage.startsWith("blob:")) {
          URL.revokeObjectURL(framePreviewImage);
        }
      } catch (error) {
        console.warn("Error revoking blob URL on unmount:", error);
      }
    };
  }, [bannerPreviewImage, previewImage, framePreviewImage]);

  useEffect(() => {
    if (isClient && !authError && status === "authenticated") {
      fetchGalleries(1, itemsPerPage);
      fetchCurrentBanner();
      fetchFrames();
    }
  }, [
    isClient,
    authError,
    status,
    fetchGalleries,
    itemsPerPage,
    fetchCurrentBanner,
    fetchFrames,
  ]);

  const statsCards = [
    {
      title: "Total Gallery",
      value: stats.total,
      icon: FaImage,
      variant: "primary",
    },
    {
      title: "Aktif",
      value: stats.active,
      icon: FaCheckCircle,
      variant: "success",
    },
    {
      title: "Tidak Aktif",
      value: stats.inactive,
      icon: FaTimesCircle,
      variant: "danger",
    },
    {
      title: "Bulan Ini",
      value: stats.thisMonth,
      icon: FaCalendarAlt,
      variant: "info",
    },
  ];

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const items = [];
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    return (
      <div className="d-flex justify-content-center mt-4">
        <Pagination>
          <Pagination.First
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          />
          <Pagination.Prev
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
          />

          {startPage > 1 && (
            <>
              <Pagination.Item onClick={() => setCurrentPage(1)}>
                1
              </Pagination.Item>
              {startPage > 2 && <Pagination.Ellipsis />}
            </>
          )}

          {Array.from(
            {
              length: endPage - startPage + 1,
            },
            (_, i) => startPage + i,
          ).map((page) => (
            <Pagination.Item
              key={page}
              active={page === currentPage}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </Pagination.Item>
          ))}

          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <Pagination.Ellipsis />}
              <Pagination.Item onClick={() => setCurrentPage(totalPages)}>
                {totalPages}
              </Pagination.Item>
            </>
          )}

          <Pagination.Next
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          />
          <Pagination.Last
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          />
        </Pagination>
      </div>
    );
  };

  if (status === "loading") {
    return (
      <div className="gallery-management-page">
        <div
          className="d-flex justify-content-center align-items-center"
          style={{ minHeight: "400px" }}
        >
          <div className="text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3 text-muted">Memuat sesi...</p>
          </div>
        </div>
      </div>
    );
  }

  const handleEditFileSelect = useCallback(
    (file) => {
      if (!file) return;
      setIsEditingImage(true);
      handleFileSelect(file);
    },
    [handleFileSelect],
  );

  if (!isClient) {
    return (
      <div className="gallery-management-page">
        <div
          className="d-flex justify-content-center align-items-center"
          style={{ minHeight: "400px" }}
        >
          <div className="text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3 text-muted">Memuat aplikasi...</p>
          </div>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="gallery-management-page">
        <div className="container mt-5">
          <Alert variant="danger" className="text-center">
            <FaExclamationTriangle size={48} className="mb-3" />
            <h4>Sesi Login Berakhir</h4>
            <p>Anda akan dialihkan ke halaman login...</p>
          </Alert>
        </div>
      </div>
    );
  }

  if (!dataLoaded) {
    return (
      <div className="gallery-management-page">
        <h1 className="mb-4">Manajemen Gallery</h1>
        <div
          className="d-flex justify-content-center align-items-center"
          style={{ minHeight: "400px" }}
        >
          <div className="text-center">
            <Spinner animation="border" variant="primary" size="lg" />
            <p className="mt-3">Memuat data gallery...</p>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => fetchGalleries(1, itemsPerPage)}
              disabled={loading || status !== "authenticated"}
            >
              {loading ? "Memuat ulang..." : "Muat Ulang Data"}
            </Button>
            {error && (
              <Alert variant="danger" className="mt-3">
                <FaExclamationTriangle className="me-2" />
                {error}
              </Alert>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Removed duplicate getPreviewHeight function here.

  return (
    <div className="gallery-management-page">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Manajemen Gallery</h1>
        <Button
          variant="outline-primary"
          size="sm"
          onClick={handleRefresh}
          disabled={loading || status !== "authenticated"}
        >
          <FaSync className={`me-1 ${loading ? "fa-spin" : ""}`} />
          {loading ? "Memuat..." : "Refresh"}
        </Button>
      </div>
      {error && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setError("")}
          className="mb-4"
        >
          <FaExclamationTriangle className="me-2" />
          {error}
        </Alert>
      )}
      <Row className="mb-4">
        {statsCards.map((stat, index) => (
          <Col md={3} key={index}>
            <Card className={`text-center h-100 border-${stat.variant}`}>
              <Card.Body>
                <div className="d-flex justify-content-center align-items-center mb-2">
                  <stat.icon
                    className={`text-${stat.variant} me-2`}
                    size={24}
                  />
                  <h3 className="mb-0">{stat.value.toLocaleString("id-ID")}</h3>
                </div>
                <p className="mb-0 text-muted">{stat.title}</p>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
      <Card className="mb-4 shadow-sm">
        <Card.Header>
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k)}
            className="border-0"
            fill
          >
            <Tab
              eventKey="add"
              title={
                <>
                  <FaPlus className="me-2" />
                  Tambah Gallery
                </>
              }
            >
              <div className="p-3">
                <Form onSubmit={handleSubmit}>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          <FaTag className="me-2" />
                          Judul
                        </Form.Label>
                        <Form.Control
                          as="textarea"
                          value={formData.title}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              title: e.target.value,
                            }))
                          }
                          placeholder="Masukkan judul gallery"
                          required
                          disabled={status !== "authenticated"}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          <FaTag className="me-2" />
                          Label
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.label}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              label: e.target.value,
                            }))
                          }
                          placeholder="Masukkan label gallery"
                          required
                          disabled={status !== "authenticated"}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          <FaMapMarkerAlt className="me-2" />
                          Lokasi
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.location}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              location: e.target.value,
                            }))
                          }
                          placeholder="Masukkan lokasi"
                          required
                          disabled={status !== "authenticated"}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          <FaCalendarAlt className="me-2" />
                          Tanggal Upload
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={formData.uploadDate}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              uploadDate: e.target.value,
                            }))
                          }
                          required
                          disabled={status !== "authenticated"}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Form.Group className="mb-3">
                    <Form.Label>
                      <FaLink className="me-2" />
                      Link Lokasi Google Map (Opsional)
                    </Form.Label>
                    <Form.Control
                      type="url"
                      value={formData.mapLink}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          mapLink: e.target.value,
                        }))
                      }
                      placeholder="Masukkan link Google Maps (contoh: https://maps.google.com/...)"
                      disabled={status !== "authenticated"}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>
                      <FaImage className="me-2" />
                      Upload Gambar
                    </Form.Label>
                    <div className="d-flex gap-2 mb-2">
                      <Form.Control
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          if (!file.type.startsWith("image/")) {
                            addToast("File harus berupa gambar", "error");
                            return;
                          }

                          if (file.size > 10 * 1024 * 1024) {
                            addToast("Ukuran file maksimal 10MB", "error");
                            return;
                          }

                          setSelectedFile(file);

                          if (noCrop) {
                            setSelectedAspectRatio("no-crop");
                            setAspectRatio(undefined);
                            setShowCropModal(false);
                            handleDirectUpload(file);
                            return;
                          }

                          const reader = new FileReader();
                          reader.onload = () => {
                            setPreviewImage(reader.result);
                            setShowCropModal(true);
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="form-control-lg"
                        required={!formData.imageUrl}
                        disabled={status !== "authenticated"}
                        style={{
                          display: formData.imageUrl ? "none" : "block",
                        }}
                      />

                      {formData.imageUrl && (
                        <div className="uploaded-image-container">
                          <div className="d-flex justify-content-between align-items-center mb-2 gap-2">
                            <small className="text-success">
                              <FaCheckCircle className="me-1" />
                              Gambar berhasil diupload
                            </small>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={handleReplaceImage}
                              disabled={uploading || status !== "authenticated"}
                            >
                              <FaExpand className="me-1" />
                              Ganti Gambar
                            </Button>
                          </div>
                        </div>
                      )}

                      {(selectedFile || previewImage) && !noCrop && (
                        <Button
                          variant="outline-info"
                          onClick={handlePreviewClick}
                          disabled={uploading || status !== "authenticated"}
                          title="Preview & Crop Gambar"
                        >
                          <FaSearchPlus className="me-1" />
                          Preview
                        </Button>
                      )}
                    </div>
                    <Form.Text muted>
                      Format yang didukung: JPEG, PNG, WebP. Maksimal ukuran:
                      10MB
                    </Form.Text>
                    {uploading && (
                      <div className="mt-2">
                        <Spinner
                          animation="border"
                          size="sm"
                          className="me-2"
                        />
                        Mengupload gambar...
                      </div>
                    )}
                    {formData.imageUrl && (
                      <div className="mt-3">
                        <div
                          className="preview-container"
                          style={{
                            maxWidth: "250px",
                            margin: "0 auto",
                            border: "1px solid #dee2e6",
                            borderRadius: "8px",
                            overflow: "hidden",
                            backgroundColor: "#f8f9fa",
                            position: "relative",
                          }}
                        >
                          <Image
                            src={formData.imageUrl || "/placeholder.svg"}
                            alt="Preview"
                            style={{
                              width: "100%",
                              height: "auto",
                              maxHeight: "200px",
                              objectFit: "contain",
                              display: "block",
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              handleImageView(
                                formData.imageUrl,
                                "Preview Gambar",
                              )
                            }
                            onError={(e) => {
                              console.error("Image load error:", e);
                              e.target.src = `data:image/svg+xml;base64,${btoa(`
                                <svg width="250" height="150" xmlns="http://www.w3.org/2000/svg">
                                  <rect width="250" height="150" fill="#f8f9fa"/>
                                  <text x="125" y="75" textAnchor="middle" dy="0.3em" fontFamily="Arial" fontSize="14" fill="#6c757d">
                                    Image Not Found
                                  </text>
                                </svg>
                              `)}`;
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              top: "8px",
                              right: "8px",
                              backgroundColor: "rgba(0,0,0,0.7)",
                              color: "white",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "12px",
                              pointerEvents: "none",
                            }}
                          >
                            {selectedAspectRatio === "no-crop"
                              ? "Original"
                              : selectedAspectRatio === "free"
                                ? "Custom"
                                : selectedAspectRatio.replace("-", ":")}
                          </div>
                        </div>
                        <small className="text-muted d-block mt-2 text-center">
                          <FaLink className="me-1" />
                          URL:{" "}
                          {formData.imageUrl.length > 50
                            ? formData.imageUrl.substring(0, 50) + "..."
                            : formData.imageUrl}
                        </small>
                        <small className="text-info d-block text-center mt-1">
                          {selectedAspectRatio === "no-crop"
                            ? "Gambar akan ditampilkan dalam ukuran original"
                            : `Preview dengan aspect ratio ${
                                selectedAspectRatio === "free"
                                  ? "custom"
                                  : selectedAspectRatio.replace("-", ":")
                              }`}
                        </small>
                      </div>
                    )}
                  </Form.Group>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={
                      submitting || uploading || status !== "authenticated"
                    }
                  >
                    {submitting ? (
                      <>
                        <Spinner
                          animation="border"
                          size="sm"
                          className="me-2"
                        />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <FaPlus className="me-2" />
                        Tambah Gallery
                      </>
                    )}
                  </Button>
                </Form>
              </div>
            </Tab>

            <Tab
              eventKey="banner"
              title={
                <>
                  <FaImage className="me-2" />
                  Kelola Banner
                </>
              }
            >
              <div className="p-3">
                <h5 className="mb-3">
                  <FaImage className="me-2 text-primary" />
                  Upload Banner Gallery
                </h5>

                <Form onSubmit={handleBannerSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label>
                      <FaImage className="me-2" />
                      Upload Gambar Banner
                    </Form.Label>
                    <div className="d-flex gap-2 mb-2">
                      <Form.Control
                        type="file"
                        accept="image/*"
                        ref={bannerFileInputRef}
                        onChange={(e) =>
                          handleBannerFileSelect(e.target.files[0])
                        }
                        className="form-control-lg"
                        disabled={status !== "authenticated"}
                      />
                    </div>
                    <Form.Text muted>
                      Format yang didukung: JPEG, PNG, WebP. Maksimal ukuran:
                      10MB. Rekomendasi ukuran: 1920x600px untuk hasil terbaik.
                    </Form.Text>

                    {bannerUploading && (
                      <div className="mt-2">
                        <Spinner
                          animation="border"
                          size="sm"
                          className="me-2"
                        />
                        Mengupload banner...
                      </div>
                    )}
                  </Form.Group>

                  {bannerPreviewImage && (
                    <div className="mt-3">
                      <div
                        style={{
                          maxWidth: "400px",
                          margin: "0 auto",
                          border: "1px solid #dee2e6",
                          borderRadius: "8px",
                          overflow: "hidden",
                          backgroundColor: "#f8f9fa",
                        }}
                      >
                        <Image
                          src={bannerPreviewImage || "/placeholder.svg"}
                          alt="Banner Preview"
                          style={{
                            width: "100%",
                            maxWidth: "400px",
                            height: "auto",
                            maxHeight: "150px",
                            objectFit: "contain",
                            display: "block",
                            cursor: "pointer",
                          }}
                          onClick={() =>
                            handleImageView(
                              bannerPreviewImage,
                              "Banner Preview",
                            )
                          }
                          onError={(e) => {
                            console.warn(
                              "Banner preview load failed:",
                              e.target.src,
                            );
                            setTimeout(() => {
                              if (
                                e.target.complete &&
                                e.target.naturalHeight === 0
                              ) {
                                e.target.src = `data:image/svg+xml;base64,${btoa(`
                                  <svg width="400" height="120" xmlns="http://www.w3.org/2000/svg">
                                    <rect width="400" height="120" fill="#f8f9fa"/>
                                    <text x="200" y="60" textAnchor="middle" dy="0.3em" fontFamily="Arial" fontSize="14" fill="#6c757d">
                                      Loading Preview...
                                    </text>
                                  </svg>
                                `)}`;
                              }
                            }, 500);
                          }}
                          onLoad={() => {
                            console.log("Banner preview loaded successfully");
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {bannerData.imageUrl && (
                    <div className="mb-3">
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <FaCheckCircle className="text-success" />
                        <small className="text-success">
                          Banner berhasil diupload dan siap disimpan
                        </small>
                      </div>
                    </div>
                  )}

                  <div className="d-flex gap-2">
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={
                        bannerSubmitting ||
                        !bannerData.imageUrl ||
                        status !== "authenticated"
                      }
                    >
                      {bannerSubmitting ? (
                        <>
                          <Spinner
                            animation="border"
                            size="sm"
                            className="me-2"
                          />
                          Menyimpan...
                        </>
                      ) : (
                        <>
                          <FaCheckCircle className="me-2" />
                          Simpan Banner
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline-secondary"
                      onClick={() => {
                        setBannerData({ imageUrl: "", imageKey: "" });
                        const currentPreview = bannerPreviewImage;
                        setBannerPreviewImage(null);
                        setSelectedBannerFile(null);
                        if (
                          currentPreview &&
                          currentPreview.startsWith("blob:")
                        ) {
                          try {
                            URL.revokeObjectURL(currentPreview);
                          } catch (error) {
                            console.warn("Error revoking blob URL:", error);
                          }
                        }
                        if (bannerFileInputRef.current) {
                          bannerFileInputRef.current.value = "";
                        }
                      }}
                      disabled={bannerSubmitting || status !== "authenticated"}
                    >
                      <FaTimes className="me-2" />
                      Reset
                    </Button>

                    {currentBanner && (
                      <Button
                        type="button"
                        variant="outline-danger"
                        onClick={() => {
                          setBannerToDelete(currentBanner);
                          setShowBannerDeleteModal(true);
                        }}
                        disabled={
                          bannerSubmitting || status !== "authenticated"
                        }
                      >
                        <FaTrash className="me-2" />
                        Hapus Banner
                      </Button>
                    )}
                  </div>
                </Form>

                <hr className="my-4" />

                <h5 className="mb-3">
                  <FaEye className="me-2 text-info" />
                  Banner Saat Ini
                </h5>

                {currentBanner ? (
                  <div className="text-center">
                    <div
                      className="current-banner-container d-inline-block position-relative"
                      style={{
                        maxWidth: "100%",
                        border: "2px solid #0d6efd",
                        borderRadius: "8px",
                        overflow: "hidden",
                        backgroundColor: "#f8f9fa",
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        handleImageView(
                          currentBanner.imageUrl,
                          "Current Banner",
                        )
                      }
                    >
                      {/* CHANGE: force re-render image when banner updates, prevents stale render */}
                      <Image
                        key={`${currentBanner._id || "cb"}-${
                          currentBanner.updatedAt || ""
                        }`}
                        src={currentBanner.imageUrl || "/placeholder.svg"}
                        alt="Current Banner"
                        style={{
                          width: "100%",
                          maxWidth: "800px",
                          height: "250px",
                          objectFit: "cover",
                          display: "block",
                        }}
                        onError={(e) => {
                          console.warn(
                            "Current banner load failed:",
                            e.target.src,
                          );
                          setTimeout(() => {
                            if (
                              e.target.complete &&
                              e.target.naturalHeight === 0
                            ) {
                              e.target.src = `data:image/svg+xml;base64,${btoa(`
                                <svg width="800" height="250" xmlns="http://www.w3.org/2000/svg">
                                  <rect width="800" height="250" fill="#f8f9fa"/>
                                  <text x="400" y="125" textAnchor="middle" dy="0.3em" fontFamily="Arial" fontSize="16" fill="#6c757d">
                                    Banner Not Available
                                  </text>
                                </svg>
                              `)}`;
                            }
                          }, 500);
                        }}
                        onLoad={() => {
                          console.log("Current banner loaded successfully");
                        }}
                      />
                      <div
                        className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-75 text-white opacity-0"
                        style={{
                          transition: "opacity 0.2s",
                          fontSize: "14px",
                          position: "absolute",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = "1";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = "0";
                        }}
                      >
                        <div className="text-center">
                          <FaExpand size={24} />
                          <div className="mt-2">
                            Klik untuk melihat full screen
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="mb-2">
                        <small className="text-muted">
                          <FaCalendarAlt className="me-1" />
                          Diupdate:{" "}
                          {new Date(currentBanner.updatedAt).toLocaleString(
                            "id-ID",
                          )}
                        </small>
                      </div>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => {
                          setBannerToDelete(currentBanner);
                          setShowBannerDeleteModal(true);
                        }}
                        disabled={status !== "authenticated"}
                      >
                        <FaTrash className="me-1" />
                        Hapus Banner
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="text-muted mb-3">
                      <FaImage size={48} className="opacity-50" />
                    </div>
                    <p className="text-muted">
                      Belum ada banner yang diupload. Upload banner pertama Anda
                      di atas.
                    </p>
                  </div>
                )}
              </div>
            </Tab>

            <Tab
              eventKey="manage"
              title={
                <>
                  <FaEdit className="me-2" />
                  Kelola Gallery
                </>
              }
            >
              <Card className="shadow-sm">
                <Card.Header className="bg-light">
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-bold">Daftar Gallery</span>
                    <div className="d-flex gap-2">
                      {selectedGalleries.length > 0 && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setShowDeleteMultipleModal(true)}
                          disabled={
                            deletingMultiple || status !== "authenticated"
                          }
                        >
                          <FaTrash className="me-1" />
                          {deletingMultiple
                            ? "Menghapus..."
                            : `Hapus (${selectedGalleries.length})`}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card.Header>
                <Card.Body>
                  <Row className="mb-3">
                    <Col md={8}>
                      <InputGroup>
                        <InputGroup.Text>
                          <FaSearch />
                        </InputGroup.Text>
                        <Form.Control
                          placeholder="Cari judul, label, atau lokasi..."
                          value={searchTerm}
                          onChange={(e) => handleSearchChange(e.target.value)}
                          disabled={status !== "authenticated"}
                        />
                        {searchTerm && (
                          <Button
                            variant="outline-secondary"
                            onClick={() => handleSearchChange("")}
                            disabled={status !== "authenticated"}
                          >
                            &times;
                          </Button>
                        )}
                      </InputGroup>
                    </Col>
                    <Col md={4} className="d-flex justify-content-end">
                      <DropdownButton
                        title={
                          <>
                            <FaFilter className="me-1" />
                            {filterStatus === "all" && "Semua Status"}
                            {filterStatus === "active" && "Aktif"}
                            {filterStatus === "inactive" && "Tidak Aktif"}
                          </>
                        }
                        variant="outline-secondary"
                        disabled={status !== "authenticated"}
                      >
                        <Dropdown.Item
                          active={filterStatus === "all"}
                          onClick={() => setFilterStatus("all")}
                        >
                          <FaEye className="me-2" />
                          Semua Status
                        </Dropdown.Item>
                        <Dropdown.Item
                          active={filterStatus === "active"}
                          onClick={() => setFilterStatus("active")}
                        >
                          <FaCheckCircle className="me-2 text-success" />
                          Aktif
                        </Dropdown.Item>
                        <Dropdown.Item
                          active={filterStatus === "inactive"}
                          onClick={() => setFilterStatus("inactive")}
                        >
                          <FaTimesCircle className="me-2 text-danger" />
                          Tidak Aktif
                        </Dropdown.Item>
                      </DropdownButton>
                    </Col>
                  </Row>

                  <div
                    className="table-responsive"
                    style={{ maxHeight: "500px", overflowY: "auto" }}
                  >
                    <Table striped bordered hover responsive className="mb-0">
                      <thead className="table-dark sticky-top">
                        <tr>
                          <th style={{ width: "50px" }}>
                            <Form.Check
                              type="checkbox"
                              checked={selectAll}
                              onChange={(e) =>
                                handleSelectAll(e.target.checked)
                              }
                              disabled={
                                loading ||
                                filteredGalleries.length === 0 ||
                                status !== "authenticated"
                              }
                            />
                          </th>
                          <th>Gambar</th>
                          <th>Judul</th>
                          <th>Label</th>
                          <th>Lokasi</th>
                          <th>Tanggal Upload</th>
                          <th>Status</th>
                          <th style={{ width: "140px" }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading && filteredGalleries.length === 0 ? (
                          <tr>
                            <td colSpan="8" className="text-center py-4">
                              <Spinner
                                animation="border"
                                size="sm"
                                className="me-2"
                              />
                              Loading...
                            </td>
                          </tr>
                        ) : filteredGalleries.length === 0 ? (
                          <tr>
                            <td
                              colSpan="8"
                              className="text-center py-4 text-muted"
                            >
                              {searchTerm
                                ? "Tidak ada gallery yang sesuai dengan pencarian"
                                : "Belum ada gallery yang dibuat"}
                            </td>
                          </tr>
                        ) : (
                          filteredGalleries.map((gallery) => (
                            <tr key={gallery._id}>
                              <td>
                                <Form.Check
                                  type="checkbox"
                                  checked={selectedGalleries.includes(
                                    gallery._id,
                                  )}
                                  onChange={(e) =>
                                    handleSelectGallery(
                                      gallery._id,
                                      e.target.checked,
                                    )
                                  }
                                  disabled={status !== "authenticated"}
                                />
                              </td>
                              <td>
                                <div
                                  className="position-relative"
                                  style={{ cursor: "pointer" }}
                                  onClick={() =>
                                    handleImageView(
                                      gallery.imageUrl,
                                      gallery.title,
                                    )
                                  }
                                >
                                  <Image
                                    src={gallery.imageUrl || "/placeholder.svg"}
                                    alt={gallery.title}
                                    thumbnail
                                    style={{
                                      width: "80px",
                                      height: "60px",
                                      objectFit: "cover",
                                      backgroundColor: "#f8f9fa",
                                    }}
                                    onError={(e) => {
                                      e.target.src = `data:image/svg+xml;base64,${btoa(`
                                        <svg width="80" height="60" xmlns="http://www.w3.org/2000/svg">
                                          <rect width="80" height="60" fill="#f8f9fa"/>
                                          <text x="40" y="30" textAnchor="middle" dy="0.3em" fontFamily="Arial" fontSize="10" fill="#6c757d">
                                            No Image
                                          </text>
                                        </svg>
                                      `)}`;
                                    }}
                                  />
                                  <div
                                    className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-75 text-white opacity-0"
                                    style={{
                                      fontSize: "12px",
                                      transition: "opacity 0.2s",
                                      position: "absolute",
                                    }}
                                    title="Klik untuk melihat gambar full screen"
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.opacity = "1";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.opacity = "0";
                                    }}
                                  >
                                    <FaExpand />
                                  </div>
                                </div>
                              </td>
                              <td>{gallery.title}</td>
                              <td>
                                <Badge
                                  style={{
                                    backgroundColor: "#f5ab1d",
                                    color: "#fff",
                                  }}
                                >
                                  {gallery.label}
                                </Badge>
                              </td>
                              <td>
                                <FaMapMarkerAlt className="me-1 text-muted" />
                                {gallery.location}
                              </td>
                              <td>
                                {new Date(
                                  gallery.uploadDate,
                                ).toLocaleDateString("id-ID")}
                              </td>
                              <td>
                                {gallery.isActive ? (
                                  <Badge
                                    bg="success"
                                    className="d-flex align-items-center"
                                  >
                                    <FaCheckCircle className="me-1" />
                                    Aktif
                                  </Badge>
                                ) : (
                                  <Badge
                                    bg="danger"
                                    className="d-flex align-items-center"
                                  >
                                    <FaTimesCircle className="me-1" />
                                    Tidak Aktif
                                  </Badge>
                                )}
                              </td>
                              <td>
                                <div className="d-flex gap-1">
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={<Tooltip>Lihat Gambar</Tooltip>}
                                  >
                                    <Button
                                      variant="outline-info"
                                      size="sm"
                                      onClick={() =>
                                        handleImageView(
                                          gallery.imageUrl,
                                          gallery.title,
                                        )
                                      }
                                    >
                                      <FaEye />
                                    </Button>
                                  </OverlayTrigger>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={<Tooltip>Edit Gallery</Tooltip>}
                                  >
                                    <Button
                                      variant="outline-primary"
                                      size="sm"
                                      onClick={() => {
                                        setEditingGallery(gallery);
                                        setShowEditModal(true);
                                      }}
                                      disabled={status !== "authenticated"}
                                    >
                                      <FaEdit />
                                    </Button>
                                  </OverlayTrigger>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={<Tooltip>Hapus Gallery</Tooltip>}
                                  >
                                    <Button
                                      variant="outline-danger"
                                      size="sm"
                                      onClick={() => {
                                        setGalleryToDelete(gallery);
                                        setShowDeleteModal(true);
                                      }}
                                      disabled={status !== "authenticated"}
                                    >
                                      <FaTrash />
                                    </Button>
                                  </OverlayTrigger>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </Table>
                  </div>

                  <div className="mt-3 d-flex justify-content-between align-items-center">
                    <div className="text-muted">
                      Menampilkan{" "}
                      {filteredGalleries.length.toLocaleString("id-ID")} dari{" "}
                      {totalItems.toLocaleString("id-ID")} gallery
                    </div>
                  </div>

                  {renderPagination()}
                </Card.Body>
              </Card>
            </Tab>

            <Tab
              eventKey="frames"
              title={
                <>
                  <FaImage className="me-2" />
                  Upload Frame
                </>
              }
            >
              <div className="p-3">
                <h5 className="mb-3">
                  <FaImage className="me-2 text-primary" />
                  Upload Frame untuk Gallery
                </h5>

                <Form onSubmit={handleFrameSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label>
                      <FaTag className="me-2" />
                      Gallery Terkait <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Select
                      value={frameFormData.relatedGallery}
                      onChange={(e) =>
                        setFrameFormData((prev) => ({
                          ...prev,
                          relatedGallery: e.target.value,
                        }))
                      }
                      style={{ backgroundColor: "white", color: "black" }}
                      required
                      disabled={status !== "authenticated"}
                    >
                      <option value="">Pilih Gallery...</option>
                      {galleries.map((gallery) => (
                        <option key={gallery._id} value={gallery._id}>
                          {gallery.title} - {gallery.label}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Text muted>
                      Pilih gallery mana yang akan menggunakan frame ini
                    </Form.Text>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>
                      <FaImage className="me-2" />
                      Upload Gambar Frame <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      type="file"
                      accept="image/jpeg,image/jpg,image/avif,image/png,image/webp"
                      ref={frameFileInputRef}
                      onChange={(e) => handleFrameFileSelect(e.target.files[0])}
                      className="form-control-lg"
                      required={!frameFormData.imageUrl}
                      disabled={status !== "authenticated"}
                    />
                    <Form.Text muted>
                      Format yang didukung: JPEG, PNG, AVIF, WebP. Maksimal
                      ukuran: 10MB. Gambar akan diupload dalam ukuran asli tanpa
                      cropping.
                    </Form.Text>

                    {frameUploading && (
                      <div className="mt-2">
                        <Spinner
                          animation="border"
                          size="sm"
                          className="me-2"
                        />
                        Mengupload frame...
                      </div>
                    )}
                  </Form.Group>

                  {framePreviewImage && (
                    <div className="mt-3">
                      <div
                        style={{
                          maxWidth: "250px",
                          margin: "0 auto",
                          border: "1px solid #dee2e6",
                          borderRadius: "8px",
                          overflow: "hidden",
                          backgroundColor: "#f8f9fa",
                        }}
                      >
                        <Image
                          src={framePreviewImage || "/placeholder.svg"}
                          alt="Frame Preview"
                          style={{
                            width: "100%",
                            maxWidth: "250px",
                            height: "auto",
                            maxHeight: "200px",
                            objectFit: "contain",
                            display: "block",
                            cursor: "pointer",
                          }}
                          onClick={() =>
                            handleImageView(framePreviewImage, "Frame Preview")
                          }
                          onError={(e) => {
                            console.warn(
                              "Frame preview load failed:",
                              e.target.src,
                            );
                            e.target.src = `data:image/svg+xml;base64,${btoa(`
                              <svg width="250" height="200" xmlns="http://www.w3.org/2000/svg">
                                <rect width="250" height="200" fill="#f8f9fa"/>
                                <text x="125" y="100" textAnchor="middle" dy="0.3em" fontFamily="Arial" fontSize="14" fill="#6c757d">
                                  Frame Not Found
                                </text>
                              </svg>
                            `)}`;
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {frameFormData.imageUrl && (
                    <div className="mb-3">
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <FaCheckCircle className="text-success" />
                        <small className="text-success">
                          Frame berhasil diupload dan siap disimpan
                        </small>
                      </div>
                      {frameFormData.originalName && (
                        <small className="text-muted d-block">
                          File: {frameFormData.originalName}
                          {frameFormData.fileSize > 0 && (
                            <>
                              {" "}
                              ({Math.round(frameFormData.fileSize / 1024)} KB)
                            </>
                          )}
                        </small>
                      )}
                    </div>
                  )}

                  <div className="d-flex gap-2">
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={
                        frameSubmitting ||
                        !frameFormData.imageUrl ||
                        !frameFormData.relatedGallery ||
                        status !== "authenticated"
                      }
                    >
                      {frameSubmitting ? (
                        <>
                          <Spinner
                            animation="border"
                            size="sm"
                            className="me-2"
                          />
                          Menyimpan...
                        </>
                      ) : (
                        <>
                          <FaPlus className="me-2" />
                          Tambah Frame
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline-secondary"
                      onClick={() => {
                        setFrameFormData({
                          relatedGallery: "",
                          imageUrl: "",
                          imageKey: "",
                          originalName: "",
                          fileSize: 0,
                          mimeType: "",
                        });
                        setFramePreviewImage(null);
                        setSelectedFrameFile(null);

                        if (frameFileInputRef.current) {
                          frameFileInputRef.current.value = "";
                        }
                      }}
                      disabled={frameSubmitting || status !== "authenticated"}
                    >
                      <FaTimes className="me-2" />
                      Reset
                    </Button>
                  </div>
                </Form>

                <hr className="my-4" />

                <h5 className="mb-3">
                  <FaEdit className="me-2 text-info" />
                  Kelola Frame
                </h5>

                <Row className="mb-3">
                  <Col md={3}>
                    <Card className="text-center h-100 border-primary">
                      <Card.Body>
                        <div className="d-flex justify-content-center align-items-center mb-2">
                          <FaImage className="text-primary me-2" size={20} />
                          <h5 className="mb-0" style={{ color: "white" }}>
                            {frameStats.total.toLocaleString("id-ID")}
                          </h5>
                        </div>
                        <p className="mb-0 text-muted small">Total Frame</p>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={3}>
                    <Card className="text-center h-100 border-success">
                      <Card.Body>
                        <div className="d-flex justify-content-center align-items-center mb-2">
                          <FaCheckCircle
                            className="text-success me-2"
                            size={20}
                          />
                          <h5 className="mb-0" style={{ color: "white" }}>
                            {frameStats.active.toLocaleString("id-ID")}
                          </h5>
                        </div>
                        <p className="mb-0 text-muted small">Aktif</p>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={3}>
                    <Card className="text-center h-100 border-danger">
                      <Card.Body>
                        <div className="d-flex justify-content-center align-items-center mb-2">
                          <FaTimesCircle
                            className="text-danger me-2"
                            size={20}
                          />
                          <h5 className="mb-0" style={{ color: "white" }}>
                            {frameStats.inactive.toLocaleString("id-ID")}
                          </h5>
                        </div>
                        <p className="mb-0 text-muted small">Tidak Aktif</p>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={3}>
                    <Card className="text-center h-100 border-info">
                      <Card.Body>
                        <div className="d-flex justify-content-center align-items-center mb-2">
                          <FaCalendarAlt className="text-info me-2" size={20} />
                          <h5 className="mb-0" style={{ color: "white" }}>
                            {frameStats.thisMonth.toLocaleString("id-ID")}
                          </h5>
                        </div>
                        <p className="mb-0 text-muted small">Bulan Ini</p>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                <Card className="shadow-sm">
                  <Card.Header className="bg-light">
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="fw-bold">Daftar Frame</span>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={fetchFrames}
                        disabled={loading || status !== "authenticated"}
                      >
                        <FaSync
                          className={`me-1 ${loading ? "fa-spin" : ""}`}
                        />
                        Refresh
                      </Button>
                    </div>
                  </Card.Header>
                  <Card.Body>
                    <div
                      className="table-responsive"
                      style={{ maxHeight: "400px", overflowY: "auto" }}
                    >
                      <Table striped bordered hover responsive className="mb-0">
                        <thead className="table-dark sticky-top">
                          <tr>
                            <th>Preview</th>
                            <th>Gallery Terkait</th>
                            <th>Nama File</th>
                            <th>Ukuran</th>
                            <th>Tanggal Upload</th>
                            <th>Status</th>
                            <th style={{ width: "120px" }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {frames.length === 0 ? (
                            <tr>
                              <td
                                colSpan="7"
                                className="text-center py-4 text-muted"
                              >
                                Belum ada frame yang diupload
                              </td>
                            </tr>
                          ) : (
                            frames.map((frame) => (
                              <tr key={frame._id}>
                                <td>
                                  <div
                                    className="position-relative"
                                    style={{ cursor: "pointer" }}
                                    onClick={() =>
                                      handleImageView(
                                        withBuster(frame.imageUrl),
                                        `Frame - ${
                                          frame.originalName || "Unknown"
                                        }`,
                                      )
                                    }
                                  >
                                    <Image
                                      src={
                                        withBuster(frame.imageUrl) ||
                                        "/placeholder.svg"
                                      }
                                      alt={frame.originalName || "Frame"}
                                      thumbnail
                                      loading="lazy"
                                      decoding="async"
                                      style={{
                                        width: "60px",
                                        height: "60px",
                                        objectFit: "cover",
                                        backgroundColor: "#f8f9fa",
                                      }}
                                      onError={(e) => {
                                        e.target.src = `data:image/svg+xml;base64,${btoa(`
                                          <svg width="60" height="60" xmlns="http://www.w3.org/2000/svg">
                                            <rect width="60" height="60" fill="#f8f9fa"/>
                                            <text x="30" y="30" textAnchor="middle" dy="0.3em" fontFamily="Arial" fontSize="8" fill="#6c757d">
                                              No Image
                                            </text>
                                          </svg>
                                        `)}`;
                                      }}
                                    />
                                    <div
                                      className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-75 text-white opacity-0"
                                      style={{
                                        fontSize: "10px",
                                        transition: "opacity 0.2s",
                                        position: "absolute",
                                      }}
                                      title="Klik untuk melihat frame full screen"
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.opacity = "1";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.opacity = "0";
                                      }}
                                    >
                                      <FaExpand />
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div>
                                    <strong>
                                      {frame.relatedGallery?.title ||
                                        "Gallery Tidak Ditemukan"}
                                    </strong>
                                    {frame.relatedGallery?.label && (
                                      <div>
                                        <Badge
                                          style={{
                                            backgroundColor: "#f5ab1d",
                                            color: "#fff",
                                            fontSize: "10px",
                                          }}
                                        >
                                          {frame.relatedGallery.label}
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <small>
                                    {frame.originalName || "Unknown"}
                                  </small>
                                </td>
                                <td>
                                  <small>
                                    {frame.fileSize
                                      ? `${Math.round(
                                          frame.fileSize / 1024,
                                        )} KB`
                                      : "Unknown"}
                                  </small>
                                </td>
                                <td>
                                  <small>
                                    {new Date(
                                      frame.createdAt,
                                    ).toLocaleDateString("id-ID")}
                                  </small>
                                </td>
                                <td>
                                  {frame.isActive ? (
                                    <Badge
                                      bg="success"
                                      className="d-flex align-items-center"
                                    >
                                      <FaCheckCircle className="me-1" />
                                      Aktif
                                    </Badge>
                                  ) : (
                                    <Badge
                                      bg="danger"
                                      className="d-flex align-items-center"
                                    >
                                      <FaTimesCircle className="me-1" />
                                      Tidak Aktif
                                    </Badge>
                                  )}
                                </td>
                                <td>
                                  <div className="d-flex gap-1">
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip>Lihat Full Screen</Tooltip>
                                      }
                                    >
                                      <Button
                                        variant="outline-info"
                                        size="sm"
                                        onClick={() =>
                                          handleImageView(
                                            withBuster(frame.imageUrl),
                                            `Frame - ${
                                              frame.originalName || "Unknown"
                                            }`,
                                          )
                                        }
                                      >
                                        <FaExpand />
                                      </Button>
                                    </OverlayTrigger>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={<Tooltip>Hapus Frame</Tooltip>}
                                    >
                                      <Button
                                        variant="outline-danger"
                                        size="sm"
                                        onClick={() => {
                                          setFrameToDelete(frame);
                                          setShowFrameDeleteModal(true);
                                        }}
                                        disabled={status !== "authenticated"}
                                      >
                                        <FaTrash />
                                      </Button>
                                    </OverlayTrigger>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </Table>
                    </div>

                    {frames.length > 0 && (
                      <div className="mt-3 d-flex justify-content-between align-items-center">
                        <div className="text-muted">
                          Menampilkan {frames.length.toLocaleString("id-ID")}{" "}
                          frame
                        </div>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </div>
            </Tab>
          </Tabs>
        </Card.Header>
      </Card>

      <ToastContainer position="top-end" className="p-3">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            bg={toast.type === "error" ? "danger" : toast.type}
            show={true}
            onClose={() =>
              setToasts((prev) => prev.filter((t) => t.id !== toast.id))
            }
            duration={toast.duration}
            autohide
          >
            <Toast.Header>
              <strong className="me-auto">
                {toast.type === "success" && <FaCheckCircle className="me-2" />}
                {toast.type === "error" && <FaTimesCircle className="me-2" />}
                {toast.type === "warning" && (
                  <FaExclamationTriangle className="me-2" />
                )}
                {toast.type === "info" && <FaEye className="me-2" />}
                Notifikasi
              </strong>
            </Toast.Header>
            <Toast.Body className={toast.type === "error" ? "text-white" : ""}>
              {toast.message}
            </Toast.Body>
          </Toast>
        ))}
      </ToastContainer>

      <Modal
        show={showImageModal}
        onHide={() => setShowImageModal(false)}
        centered
        size="xl"
      >
        <Modal.Header closeButton className="bg-dark text-white">
          <Modal.Title>
            <FaImage className="me-2" />
            {selectedImageTitle}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body
          className="p-0 bg-dark d-flex justify-content-center align-items-center"
          style={{ minHeight: "60vh" }}
        >
          <Image
            src={selectedImageUrl || "/placeholder.svg"}
            alt={selectedImageTitle}
            style={{
              maxWidth: "100%",
              maxHeight: "80vh",
              objectFit: "contain",
            }}
            onError={(e) => {
              e.target.src = `data:image/svg+xml;base64,${btoa(`
                <svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
                  <rect width="600" height="400" fill="#333"/>
                  <text x="300" y="200" textAnchor="middle" dy="0.3em" fontFamily="Arial" fontSize="16" fill="#ffffff">
                    Image Not Found
                  </text>
                </svg>
              `)}`;
            }}
          />
        </Modal.Body>
        <Modal.Footer className="bg-dark text-white">
          <small className="text-muted flex-grow-1">
            <FaLink className="me-1" />
            {selectedImageUrl}
          </small>
          <Button
            variant="outline-light"
            onClick={() => setShowImageModal(false)}
          >
            <FaTimes className="me-1" />
            Tutup
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showEditModal}
        onHide={() => setShowEditModal(false)}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaEdit className="me-2 text-primary" /> Edit Gallery
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleEditSubmit}>
          <Modal.Body>
            {editingGallery && (
              <>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <FaTag className="me-2" />
                        Judul
                      </Form.Label>
                      <Form.Control
                        as="textarea"
                        name="title"
                        defaultValue={editingGallery.title}
                        placeholder="Masukkan judul gallery"
                        required
                        disabled={status !== "authenticated"}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.stopPropagation()}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <FaTag className="me-2" />
                        Label
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="label"
                        defaultValue={editingGallery.label}
                        placeholder="Masukkan label gallery"
                        required
                        disabled={status !== "authenticated"}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.stopPropagation()}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <FaMapMarkerAlt className="me-2" />
                        Lokasi
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="location"
                        defaultValue={editingGallery.location}
                        placeholder="Masukkan lokasi"
                        required
                        disabled={status !== "authenticated"}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.stopPropagation()}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <FaCalendarAlt className="me-2" />
                        Tanggal Upload
                      </Form.Label>
                      <Form.Control
                        type="date"
                        name="uploadDate"
                        defaultValue={
                          new Date(editingGallery.uploadDate)
                            .toISOString()
                            .split("T")[0]
                        }
                        required
                        disabled={status !== "authenticated"}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.stopPropagation()}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FaMapMarkerAlt className="me-2" />
                    Link Lokasi Google Map
                  </Form.Label>
                  <Form.Control
                    type="url"
                    name="mapLink"
                    defaultValue={editingGallery.mapLink}
                    placeholder="Masukkan link Lokasi (Google Map)"
                    disabled={status !== "authenticated"}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => e.stopPropagation()}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FaImage className="me-2" />
                    Gambar Saat Ini
                  </Form.Label>

                  <div className="text-center">
                    <div
                      className="preview-container d-inline-block position-relative mb-2"
                      style={{
                        maxWidth: "200px",
                        border: "1px solid #dee2e6",
                        borderRadius: "8px",
                        overflow: "hidden",
                        backgroundColor: "#f8f9fa",
                        cursor: "pointer",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        // handleImageView(editingGallery.imageUrl, editingGallery.title);
                        // Removed click to view to avoid confusion with edit
                      }}
                    >
                      <Image
                        src={editingGallery.imageUrl || "/placeholder.svg"}
                        alt={editingGallery.title}
                        style={{
                          width: "100%",
                          height: "auto",
                          maxHeight: "150px",
                          objectFit: "contain",
                          display: "block",
                        }}
                      />
                    </div>
                    <div>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => editFileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        <FaEdit className="me-1" /> Ganti Gambar
                      </Button>
                      <input
                        type="file"
                        className="d-none"
                        ref={editFileInputRef}
                        accept="image/jpeg,image/jpg,image/png,image/avif,image/webp"
                        onChange={(e) =>
                          handleEditFileSelect(e.target.files[0])
                        }
                      />
                    </div>
                    {uploading && (
                      <div className="mt-2">
                        <small className="text-muted">
                          Mengupload gambar baru...
                        </small>
                      </div>
                    )}
                  </div>
                </Form.Group>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                setShowEditModal(false);
                setShowEditModal(false);
                setEditingGallery(null);
                setIsEditingImage(false);
              }}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || status !== "authenticated"}
              onClick={(e) => e.stopPropagation()}
            >
              {submitting ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <FaEdit className="me-2" />
                  Update Gallery
                </>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaTrash className="me-2 text-danger" /> Konfirmasi Hapus
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Apakah Anda yakin ingin menghapus gallery{" "}
            <strong className="text-danger">{galleryToDelete?.title}</strong>?
          </p>
          <Alert variant="warning" className="mb-0">
            <FaExclamationTriangle className="me-2" />
            Tindakan ini tidak dapat dibatalkan dan akan menghapus gambar dari
            server.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Batal
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={status !== "authenticated"}
          >
            <FaTrash className="me-2" />
            Hapus
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showDeleteMultipleModal}
        onHide={() => setShowDeleteMultipleModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaTrash className="me-2 text-danger" /> Konfirmasi Hapus Multiple
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Apakah Anda yakin ingin menghapus{" "}
            <strong>{selectedGalleries.length}</strong> gallery items yang
            dipilih?
          </p>
          <p className="text-muted small">
            Tindakan ini tidak dapat dibatalkan.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowDeleteMultipleModal(false)}
            disabled={deletingMultiple}
          >
            Batal
          </Button>
          <Button
            variant="danger"
            onClick={handleBulkDelete}
            disabled={deletingMultiple}
          >
            {deletingMultiple ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Menghapus...
              </>
            ) : (
              <>
                <FaTrash className="me-1" />
                Hapus {selectedGalleries.length} Items
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showCropModal}
        onHide={() => {
          return false;
        }}
        centered
        size="lg"
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header>
          <Modal.Title>
            <FaCrop className="me-2 text-primary" />
            Crop Gambar
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <label className="form-label fw-bold">Aspect Ratio:</label>
            <div className="d-flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={noCrop ? "success" : "outline-success"}
                onClick={() => {
                  setNoCrop(true);
                  setAspectRatio(undefined);
                  setCrop(undefined);
                  setCompletedCrop(undefined);
                  setSelectedAspectRatio("no-crop");
                }}
              >
                <FaUpload className="me-1" />
                No Crop
              </Button>
              <Button
                size="sm"
                variant={
                  aspectRatio === 16 / 9 && !noCrop
                    ? "primary"
                    : "outline-primary"
                }
                onClick={() => {
                  setNoCrop(false);
                  setAspectRatio(16 / 9);
                  setCrop(undefined);
                  setCompletedCrop(undefined);
                  setSelectedAspectRatio("16-9");
                  setTimeout(() => {
                    if (imgRef) {
                      const { width, height } = imgRef;
                      const aspectRatio = 16 / 9;
                      let cropWidth, cropHeight;

                      if (width / height > aspectRatio) {
                        cropHeight = height * 0.8;
                        cropWidth = cropHeight * aspectRatio;
                      } else {
                        cropWidth = width * 0.8;
                        cropHeight = cropWidth / aspectRatio;
                      }

                      const newCrop = {
                        unit: "%",
                        x: (100 - (cropWidth / width) * 100) / 2,
                        y: (100 - (cropHeight / height) * 100) / 2,
                        width: (cropWidth / width) * 100,
                        height: (cropHeight / height) * 100,
                      };
                      setCrop(newCrop);
                    }
                  }, 100);
                }}
              >
                16:9
              </Button>
              <Button
                size="sm"
                variant={
                  aspectRatio === 4 / 3 && !noCrop
                    ? "primary"
                    : "outline-primary"
                }
                onClick={() => {
                  setNoCrop(false);
                  setAspectRatio(4 / 3);
                  setCrop(undefined);
                  setCompletedCrop(undefined);
                  setSelectedAspectRatio("4-3");
                  setTimeout(() => {
                    if (imgRef) {
                      const { width, height } = imgRef;
                      const aspectRatio = 4 / 3;
                      let cropWidth, cropHeight;

                      if (width / height > aspectRatio) {
                        cropHeight = height * 0.8;
                        cropWidth = cropHeight * aspectRatio;
                      } else {
                        cropWidth = width * 0.8;
                        cropHeight = cropWidth / aspectRatio;
                      }

                      const newCrop = {
                        unit: "%",
                        x: (100 - (cropWidth / width) * 100) / 2,
                        y: (100 - (cropHeight / height) * 100) / 2,
                        width: (cropWidth / width) * 100,
                        height: (cropHeight / height) * 100,
                      };
                      setCrop(newCrop);
                    }
                  }, 100);
                }}
              >
                4:3
              </Button>
              <Button
                size="sm"
                variant={
                  aspectRatio === 1 && !noCrop ? "primary" : "outline-primary"
                }
                onClick={() => {
                  setNoCrop(false);
                  setAspectRatio(1);
                  setCrop(undefined);
                  setCompletedCrop(undefined);
                  setSelectedAspectRatio("1-1");
                  setTimeout(() => {
                    if (imgRef) {
                      const { width, height } = imgRef;
                      const size = Math.min(width, height) * 0.8;

                      const newCrop = {
                        unit: "%",
                        x: (100 - (size / width) * 100) / 2,
                        y: (100 - (size / height) * 100) / 2,
                        width: (size / width) * 100,
                        height: (size / height) * 100,
                      };
                      setCrop(newCrop);
                    }
                  }, 100);
                }}
              >
                1:1
              </Button>
              <Button
                size="sm"
                variant={
                  aspectRatio === 3 / 4 && !noCrop
                    ? "primary"
                    : "outline-primary"
                }
                onClick={() => {
                  setNoCrop(false);
                  setAspectRatio(3 / 4);
                  setCrop(undefined);
                  setCompletedCrop(undefined);
                  setSelectedAspectRatio("3-4");
                  setTimeout(() => {
                    if (imgRef) {
                      const { width, height } = imgRef;
                      const aspectRatio = 3 / 4;
                      let cropWidth, cropHeight;

                      if (width / height > aspectRatio) {
                        cropHeight = height * 0.8;
                        cropWidth = cropHeight * aspectRatio;
                      } else {
                        cropWidth = width * 0.8;
                        cropHeight = cropWidth / aspectRatio;
                      }

                      const newCrop = {
                        unit: "%",
                        x: (100 - (cropWidth / width) * 100) / 2,
                        y: (100 - (cropHeight / height) * 100) / 2,
                        width: (cropWidth / width) * 100,
                        height: (cropHeight / height) * 100,
                      };
                      setCrop(newCrop);
                    }
                  }, 100);
                }}
              >
                3:4
              </Button>
              <Button
                size="sm"
                variant={
                  !aspectRatio && !noCrop ? "primary" : "outline-primary"
                }
                onClick={() => {
                  setNoCrop(false);
                  setAspectRatio(undefined);
                  setCrop(undefined);
                  setCompletedCrop(undefined);
                  setSelectedAspectRatio("free");
                  setTimeout(() => {
                    if (imgRef) {
                      const { width, height } = imgRef;
                      const newCrop = {
                        unit: "%",
                        x: 10,
                        y: 10,
                        width: 80,
                        height: 80,
                      };
                      setCrop(newCrop);
                    }
                  }, 100);
                }}
              >
                Free
              </Button>
            </div>
            {noCrop && (
              <Alert variant="info" className="mt-2">
                <FaInfoCircle className="me-2" />
                Mode "No Crop": Gambar akan diupload dalam ukuran original. Card
                gallery akan otomatis menyesuaikan tampilan menggunakan CSS.
              </Alert>
            )}
          </div>

          {previewImage && (
            <>
              {!noCrop && (
                <div className="mb-3">
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={aspectRatio}
                    minWidth={50}
                    minHeight={50}
                    keepSelection
                    style={{
                      maxWidth: "100%",
                      maxHeight: "400px",
                    }}
                  >
                    <img
                      ref={setImgRef}
                      alt="Crop me"
                      src={previewImage || "/placeholder.svg"}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "400px",
                        display: "block",
                      }}
                      onLoad={onImageLoad}
                    />
                  </ReactCrop>
                </div>
              )}

              {noCrop && (
                <div className="mb-3 text-center">
                  <img
                    alt="Original image preview"
                    src={previewImage || "/placeholder.svg"}
                    style={{
                      maxWidth: "300px",
                      maxHeight: "250px",
                      height: "auto",
                      display: "block",
                      margin: "0 auto",
                      border: "2px solid #dee2e6",
                      borderRadius: "8px",
                      objectFit: "contain",
                    }}
                  />
                  <small className="text-muted mt-2 d-block">
                    Preview gambar original - akan diupload tanpa cropping
                  </small>
                </div>
              )}
            </>
          )}

          {!noCrop && (
            <Alert variant="info" className="mt-3">
              <FaInfoCircle className="me-2" />
              Drag sudut atau sisi sisi crop area untuk mengubah ukuran. Drag
              bagian tengah untuk memindahkan posisi.
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowCropModal(false);
              setPreviewImage(null);
              setSelectedFile(null);
              setCrop(undefined);
              setCompletedCrop(undefined);
              setNoCrop(false);
              setSelectedAspectRatio("16-9");
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
              if (editFileInputRef.current) {
                editFileInputRef.current.value = "";
              }
              setIsEditingImage(false);
            }}
            disabled={uploading}
          >
            <FaTimes className="me-2" />
            Batal
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (noCrop) {
                handleDirectUpload();
              } else {
                handleCropAndUpload();
              }
            }}
            disabled={uploading || (!completedCrop && !noCrop)}
          >
            {uploading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Mengupload...
              </>
            ) : (
              <>
                <FaUpload className="me-2" />
                {noCrop ? "Upload Gambar" : "Crop & Upload"}
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showBannerDeleteModal}
        onHide={() => setShowBannerDeleteModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaTrash className="me-2 text-danger" />
            Konfirmasi Hapus Banner
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="text-center">
            <div className="mb-3">
              <FaExclamationTriangle size={48} className="text-warning" />
            </div>
            <p>Apakah Anda yakin ingin menghapus banner ini?</p>
            <p className="text-muted small">
              Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowBannerDeleteModal(false)}
            disabled={bannerDeleting}
          >
            Batal
          </Button>
          <Button
            variant="danger"
            onClick={handleBannerDelete}
            disabled={bannerDeleting}
          >
            {bannerDeleting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Menghapus...
              </>
            ) : (
              <>
                <FaTrash className="me-2" />
                Hapus Banner
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showBannerCropModal}
        onHide={() => {
          return false;
        }}
        size="lg"
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header>
          <Modal.Title>
            <FaCrop className="me-2" />
            Crop Banner Image
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <label className="form-label fw-bold">Aspect Ratio:</label>
            <div className="d-flex gap-2 flex-wrap">
              <Button
                variant={
                  bannerAspectRatio === 16 / 5 ? "primary" : "outline-primary"
                }
                size="sm"
                onClick={() => setBannerAspectRatio(16 / 5)}
              >
                Banner (16:5)
              </Button>
              <Button
                variant={
                  bannerAspectRatio === 16 / 9 ? "primary" : "outline-primary"
                }
                size="sm"
                onClick={() => setBannerAspectRatio(16 / 9)}
              >
                16:9
              </Button>
              <Button
                variant={
                  bannerAspectRatio === 4 / 3 ? "primary" : "outline-primary"
                }
                size="sm"
                onClick={() => setBannerAspectRatio(4 / 3)}
              >
                4:3
              </Button>
              <Button
                variant={
                  bannerAspectRatio === 1 ? "primary" : "outline-primary"
                }
                size="sm"
                onClick={() => setBannerAspectRatio(1)}
              >
                1:1
              </Button>
              <Button
                variant={
                  bannerAspectRatio === 3 / 4 ? "primary" : "outline-primary"
                }
                size="sm"
                onClick={() => setBannerAspectRatio(3 / 4)}
              >
                3:4
              </Button>
              <Button
                variant={
                  bannerAspectRatio === undefined
                    ? "primary"
                    : "outline-primary"
                }
                size="sm"
                onClick={() => setBannerAspectRatio(undefined)}
              >
                Free
              </Button>
            </div>
          </div>

          {bannerCropImage && (
            <div className="mb-3">
              <ReactCrop
                crop={bannerCrop}
                onChange={(_, percentCrop) => setBannerCrop(percentCrop)}
                onComplete={(c) => setBannerCompletedCrop(c)}
                aspect={bannerAspectRatio}
                minWidth={100}
                minHeight={20}
                keepSelection
                style={{
                  maxWidth: "100%",
                  maxHeight: "400px",
                }}
              >
                <img
                  ref={setBannerImgRef}
                  alt="Crop banner"
                  src={bannerCropImage || "/placeholder.svg"}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "400px",
                    display: "block",
                  }}
                  onLoad={onBannerImageLoad}
                />
              </ReactCrop>
            </div>
          )}

          <Alert variant="info">
            <FaInfoCircle className="me-2" />
            Drag sudut untuk mengubah ukuran crop area secara proporsional. Drag
            sisi untuk mengubah ukuran pada satu dimensi. Drag bagian tengah
            untuk memindahkan posisi banner. Pilih aspect ratio di atas atau
            gunakan "Free" untuk cropping bebas.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowBannerCropModal(false)}
          >
            Batal
          </Button>
          <Button
            variant="primary"
            onClick={handleBannerCropSave}
            disabled={!bannerCompletedCrop}
          >
            <FaCheckCircle className="me-2" />
            Gunakan Gambar Ini
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showFrameDeleteModal}
        onHide={() => setShowFrameDeleteModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaTrash className="me-2 text-danger" />
            Konfirmasi Hapus Frame
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="text-center">
            <div className="mb-3">
              <FaExclamationTriangle size={48} className="text-warning" />
            </div>
            <p>Apakah Anda yakin ingin menghapus frame ini?</p>
            <p className="text-muted small">
              Tindakan ini tidak dapat dibatalkan dan akan menghapus gambar
              frame dari server.
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowFrameDeleteModal(false)}
            disabled={frameDeleting}
          >
            Batal
          </Button>
          <Button
            variant="danger"
            onClick={handleFrameDelete}
            disabled={frameDeleting}
          >
            {frameDeleting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Menghapus...
              </>
            ) : (
              <>
                <FaTrash className="me-2" />
                Hapus Frame
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default GalleryManagement;
