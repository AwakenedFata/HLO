import styled from "styled-components"
import Image from "next/image"

// Styled Components
const CardContainer = styled.div`
  position: relative;
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
  font-size: 16px;
`

const ImageWrapper = styled.div`
  width: 100%;
  height: auto;
  display: block;
  filter: drop-shadow(rgba(0, 0, 0, 0.5) 0px 10px 10px);
  
  img {
    width: 100% !important;
    height: auto !important;
  }
`

// About Us Card Component
const AboutUsCardComponent = () => {
  return (
    <CardContainer>
      <ImageWrapper>
        <Image 
          src="/assets/aboutus/aboutus.avif" 
          alt="About Us Card Background"
          width={500}
          height={500}
          style={{ width: '100%', height: 'auto' }}
        />
      </ImageWrapper>
    </CardContainer>
  )
}

export default AboutUsCardComponent