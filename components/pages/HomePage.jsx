"use client"

import HeroComponent from "@/components/HeroComponent"
import CommunityComponent from "@/components/CommunityComponent"
import SponsorsComponent from "@/components/SponsorsComponent"
import JoinUsComponent from "@/components/JoinUsComponent"
import ContactFormComponent from "@/components/ContactFormComponent"
import GalleryComponent from "@/components/GalleryComponent"

const HomePage = () => {
  return (
    <div className="main-background">
      <HeroComponent />
      <CommunityComponent id="aboutus" class="aboutus" />
      <GalleryComponent />
      <JoinUsComponent />
      <SponsorsComponent />
      <ContactFormComponent />
    </div>
  )
}

export default HomePage
