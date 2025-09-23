import GalleryPage from "@/components/pages/GalleryPage";
import connectToDatabase from "@/lib/db";
import Gallery from "@/lib/models/galleryItems";
import Banner from "@/lib/models/banner";

export default async function GalleryGridPage() {
  await connectToDatabase();

  const banner = await Banner.findOne({ isActive: true }).sort({ createdAt: -1 });
  const galleries = await Gallery.find({ isActive: true }).sort({ uploadDate: -1 });

  return (
    <div className="gallery-page w-100 min-vh-100">
      <GalleryPage 
        banner={banner ? JSON.parse(JSON.stringify(banner)) : null} 
        galleries={JSON.parse(JSON.stringify(galleries))} 
      />
    </div>
  );
}
