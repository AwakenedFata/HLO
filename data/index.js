// Mengubah import menjadi path string
const gallery1 = "/assets/Gallery/kiri.png"
const gallery2 = "/assets/Gallery/tengah.png"
const gallery3 = "/assets/Gallery/kanan.png"
const partner1 = "/assets/Sponsor & Partner/ESI.png"
const partner2 = "/assets/Sponsor & Partner/ACE.png"
const partner3 = "/assets/Sponsor & Partner/VNX.png"
const partner4 = "/assets/Sponsor & Partner/HLS.png"
const partner5 = "/assets/Sponsor & Partner/vincent production.png"

const platformWhatsapp = "/assets/platforms/whatsapp-icon.png"
const platformInstagram = "/assets/platforms/instagram-logo.png"
const platformFacebook = "/assets/platforms/facebook-circle-logo.png"
const platformYoutube = "/assets/platforms/youtube.png"
const platformTiktok = "/assets/platforms/tiktok-logo.png"
const platformDiscord = "/assets/platforms/discord-logo.png"
const platformX = "/assets/platforms/logo-x-modern-2023.png"
const platformShopee = "/assets/platforms/logo-shopee.png"
const platformTokopedia = "/assets/platforms/tokopedia.png"
const platformTiktokShop = "/assets/platforms/tiktok-shop-logo.png"


const merchTshirt1 = "/assets/platforms/whatsapp-icon.png"
const merchTshirt2 = "/assets/platforms/whatsapp-icon.png"
const merchHoodie1 = "/assets/platforms/whatsapp-icon.png"
const merchHoodie2 = "/assets/platforms/whatsapp-icon.png"
const merchMousepad1 = "/assets/platforms/whatsapp-icon.png"
const merchMousepad2 = "/assets/platforms/whatsapp-icon.png"
const merchMug1 = "/assets/platforms/whatsapp-icon.png"
const merchMug2 = "/assets/platforms/whatsapp-icon.png"
const merchSticker1 = "/assets/platforms/whatsapp-icon.png"
const merchKeychain1 = "/assets/platforms/whatsapp-icon.png"
const merchCap1 = "/assets/platforms/whatsapp-icon.png"
const merchBag1 = "/assets/platforms/whatsapp-icon.png"

export const navLinks = [
  { id: 1, path: "/", text: "Home" },
  { id: 2, path: "/aboutus", text: "About Us" },
  { id: 3, path: "/gallery", text: "Gallery" },
  { id: 4, path: "/partners", text: "Partners" },
  { id: 5, path: "/platforms", text: "Platforms" },
  { id: 6, path: "/redeem", text: "Redeem" },
  { id: 7, path: "/merchan", text: "Merchandise" },
]

export const galleryItems = [
  {
    image: gallery1,
  },
  {
    image: gallery2,
  },
  {
    image: gallery3,
  },
]

export const partners = [
  { id: 1, image: partner1, name: "ESI", url: "https://www.instagram.com/pbesi_official?igsh=MXdrMndtdzRlcnV2Yw==" },
  { id: 2, image: partner2, name: "ACE", url: "https://www.instagram.com/hok.ace?igsh=Z3pvdXpnZmZkNnlz" },
  { id: 3, image: partner3, name: "VNX", url: "https://www.instagram.com/vnx.esport?igsh=MWRrejd5dWFvZHBmZQ==" },
  {
    id: 4,
    image: partner4,
    name: "HLS",
    url: "https://www.instagram.com/hlostore.official?igsh=eGFqODh1enBwcXUzhttps://www.instagram.com/hlostore.official?igsh=eGFqODh1enBwcXUz",
  },
  {
    id: 5,
    image: partner5,
    name: "Vincent Production",
    url: "https://www.instagram.com/vincent.production?igsh=djVjd3Fya2o1d202",
  },
]

export const platforms = [
  {
    id: 1,
    image: platformWhatsapp,
    url: "https://chat.whatsapp.com/CDyNXvgyxwMG0c7idouoQR",
  },
  {
    id: 2,
    image: platformInstagram,
    url: "https://www.instagram.com/hoklampung.official/",
  },
  {
    id: 3,
    image: platformFacebook,
    url: "https://www.facebook.com/honorofkings.og.id",
  },
  {
    id: 4,
    image: platformDiscord,
    url: "https://discord.com/invite/yM473crPms",
  },
  {
    id: 5,
    image: platformX,
    url: "https://twitter.com/honorofkings",
  },
  {
    id: 6,
    image: platformTiktok,
    url: "https://www.tiktok.com/@honorofkings.og.id",
  },
  {
    id: 7,
    image: platformYoutube,
    url: "https://www.youtube.com/channel/UC37Te9PzSLOpBHKIM85BZeg",
  },
  {
    id: 8,
    image: platformTiktokShop,
    url: "https://shop-id.tokopedia.com/",
  },
  {
    id: 9,
    image: platformShopee,
    url: "https://shopee.co.id/",
  },
  {
    id: 10,
    image: platformTokopedia,
    url: "https://www.tokopedia.com/",
  },
]

export const merchandiseProducts = [
  {
    id: 1,
    name: "HOK T-Shirt Black Edition",
    description:
      "T-shirt premium dengan logo Honor of Kings Lampung, bahan cotton combed 30s yang nyaman untuk gaming session panjang",
    price: 150000,
    originalPrice: 180000,
    image: merchTshirt1,
    category: "clothing",
    stock: 25,
    rating: 4.8,
    reviewCount: 42,
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Black", "Navy"],
    tags: ["gaming", "tshirt", "premium", "cotton"],
    isNew: true,
    isBestseller: false,
    discount: 17,
  },
  {
    id: 2,
    name: "HOK T-Shirt White Edition",
    description:
      "T-shirt putih dengan design eksklusif komunitas, perfect untuk casual gaming atau hangout dengan squad",
    price: 150000,
    originalPrice: 180000,
    image: merchTshirt2,
    category: "clothing",
    stock: 30,
    rating: 4.7,
    reviewCount: 38,
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["White", "Light Gray"],
    tags: ["gaming", "tshirt", "casual", "cotton"],
    isNew: true,
    isBestseller: false,
    discount: 17,
  },
  {
    id: 3,
    name: "HOK Gaming Hoodie Premium",
    description:
      "Hoodie gaming premium dengan material fleece berkualitas tinggi, cocok untuk gaming di ruangan ber-AC atau cuaca dingin",
    price: 350000,
    originalPrice: 420000,
    image: merchHoodie1,
    category: "clothing",
    stock: 15,
    rating: 4.9,
    reviewCount: 67,
    sizes: ["M", "L", "XL", "XXL"],
    colors: ["Black", "Navy", "Dark Gray"],
    tags: ["gaming", "hoodie", "premium", "fleece", "winter"],
    isNew: false,
    isBestseller: true,
    discount: 17,
  },
  {
    id: 4,
    name: "HOK Gaming Mouse Pad XL",
    description:
      "Mouse pad gaming berukuran XL (80x40cm) dengan surface halus untuk precision gaming dan base anti-slip",
    price: 75000,
    originalPrice: 95000,
    image: merchMousepad1,
    category: "accessories",
    stock: 50,
    rating: 4.6,
    reviewCount: 89,
    sizes: ["XL (80x40cm)"],
    colors: ["Black with HOK Logo"],
    tags: ["gaming", "mousepad", "xl", "precision", "anti-slip"],
    isNew: false,
    isBestseller: true,
    discount: 21,
  },
  {
    id: 5,
    name: "HOK Logo Mouse Pad",
    description: "Mouse pad standard dengan logo HOK Lampung, ukuran 25x20cm, cocok untuk setup gaming minimalis",
    price: 45000,
    originalPrice: 60000,
    image: merchMousepad2,
    category: "accessories",
    stock: 75,
    rating: 4.4,
    reviewCount: 56,
    sizes: ["Standard (25x20cm)"],
    colors: ["Black", "Blue"],
    tags: ["gaming", "mousepad", "logo", "minimalis"],
    isNew: false,
    isBestseller: false,
    discount: 25,
  },
  {
    id: 6,
    name: "HOK Ceramic Gaming Mug",
    description:
      "Mug ceramic berkualitas tinggi dengan design HOK Lampung, capacity 350ml, perfect untuk coffee break saat gaming",
    price: 85000,
    originalPrice: 110000,
    image: merchMug1,
    category: "accessories",
    stock: 40,
    rating: 4.5,
    reviewCount: 34,
    sizes: ["350ml"],
    colors: ["White with Black Logo", "Black with White Logo"],
    tags: ["gaming", "mug", "ceramic", "coffee", "350ml"],
    isNew: false,
    isBestseller: false,
    discount: 23,
  },
  {
    id: 7,
    name: "HOK Travel Mug Stainless",
    description:
      "Travel mug stainless steel dengan double wall insulation, capacity 450ml, keep your drink hot/cold longer",
    price: 125000,
    originalPrice: 155000,
    image: merchMug2,
    category: "accessories",
    stock: 25,
    rating: 4.7,
    reviewCount: 28,
    sizes: ["450ml"],
    colors: ["Silver", "Black"],
    tags: ["gaming", "travel-mug", "stainless", "insulation", "450ml"],
    isNew: true,
    isBestseller: false,
    discount: 19,
  },
  {
    id: 8,
    name: "HOK Sticker Pack Limited",
    description:
      "Pack sticker eksklusif berisi 10 design berbeda, waterproof dan fade-resistant, perfect untuk laptop atau gear gaming",
    price: 35000,
    originalPrice: 50000,
    image: merchSticker1,
    category: "accessories",
    stock: 100,
    rating: 4.8,
    reviewCount: 156,
    sizes: ["Pack of 10"],
    colors: ["Mixed Colors"],
    tags: ["gaming", "sticker", "waterproof", "laptop", "limited"],
    isNew: false,
    isBestseller: true,
    discount: 30,
  },
  {
    id: 9,
    name: "HOK Metal Keychain Premium",
    description: "Keychain metal premium dengan logo HOK 3D embossed, dilengkapi dengan ring berkualitas tinggi",
    price: 55000,
    originalPrice: 75000,
    image: merchKeychain1,
    category: "accessories",
    stock: 60,
    rating: 4.6,
    reviewCount: 73,
    sizes: ["Standard"],
    colors: ["Silver", "Gold", "Black"],
    tags: ["gaming", "keychain", "metal", "3d", "premium"],
    isNew: false,
    isBestseller: false,
    discount: 27,
  },
  {
    id: 10,
    name: "HOK Snapback Cap Gaming",
    description: "Snapback cap dengan bordir logo HOK Lampung, adjustable size, material cotton twill yang breathable",
    price: 120000,
    originalPrice: 150000,
    image: merchCap1,
    category: "clothing",
    stock: 35,
    rating: 4.5,
    reviewCount: 41,
    sizes: ["One Size (Adjustable)"],
    colors: ["Black", "Navy", "White"],
    tags: ["gaming", "cap", "snapback", "adjustable", "cotton"],
    isNew: true,
    isBestseller: false,
    discount: 20,
  },
  {
    id: 11,
    name: "HOK Canvas Tote Bag",
    description:
      "Tote bag canvas premium dengan print logo HOK, ukuran 40x35cm, perfect untuk membawa gear gaming atau daily use",
    price: 95000,
    originalPrice: 125000,
    image: merchBag1,
    category: "accessories",
    stock: 45,
    rating: 4.4,
    reviewCount: 29,
    sizes: ["40x35cm"],
    colors: ["Natural", "Black"],
    tags: ["gaming", "totebag", "canvas", "daily", "gear"],
    isNew: false,
    isBestseller: false,
    discount: 24,
  },
]

export const merchandiseCategories = [
  { id: "all", name: "Semua Produk", count: merchandiseProducts.length },
  { id: "clothing", name: "Pakaian", count: merchandiseProducts.filter((p) => p.category === "clothing").length },
  {
    id: "accessories",
    name: "Aksesoris",
    count: merchandiseProducts.filter((p) => p.category === "accessories").length,
  },
]

