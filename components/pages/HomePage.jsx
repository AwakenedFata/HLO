"use client";

import HeroComponent from "@/components/HeroComponent";
import CommunityComponent from "@/components/CommunityComponent";
import SponsorsComponent from "@/components/SponsorsComponent";
import JoinUsComponent from "@/components/JoinUsComponent";
import ContactFormComponent from "@/components/ContactFormComponent";
import GalleryComponent from "@/components/GalleryComponent";

const HomePage = () => {
  return (
    <div className="main-background">
      <h1 className="seo-h1">
        HOK Lampung Official - Komunitas Honor of Kings Lampung
      </h1>
      <HeroComponent />
      <CommunityComponent />
      <GalleryComponent />
      <JoinUsComponent />
      <SponsorsComponent />
      <ContactFormComponent />
    </div>
  );
};

export default HomePage;
