import GalleryPage from "@/components/pages/GalleryPage";
import connectToDatabase from "@/lib/db";
import Gallery from "@/lib/models/galleryItems";
import Banner from "@/lib/models/banner";

export const revalidate = 0; 

export const dynamic = 'force-dynamic';

export default async function GalleryGridPage() {
  await connectToDatabase();

  const timestamp = Date.now();
  
  const banner = await Banner.findOne({ isActive: true })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();
    
  const galleries = await Gallery.find({ isActive: true })
    .sort({ uploadDate: -1 })
    .lean();

  const serializedBanner = banner ? {
    ...JSON.parse(JSON.stringify(banner)),
    imageUrl: banner.imageUrl, 
    _timestamp: timestamp 
  } : null;

  const serializedGalleries = JSON.parse(JSON.stringify(galleries));

  return (
    <div className="gallery-page w-100 min-vh-100">
      <GalleryPage 
        banner={serializedBanner} 
        galleries={serializedGalleries} 
      />
    </div>
  );
}