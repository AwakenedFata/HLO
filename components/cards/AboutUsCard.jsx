import styled from "styled-components"
import AboutUsTextComponent from "@/components/AboutUsTextComponent"

// Styled Components
const CardContainer = styled.div`
  position: relative;
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
  font-size: 16px;

  /* Responsive font-size untuk scale keseluruhan card */
  @media (max-width: 1400px) {
    font-size: 15px;
  }
  @media (max-width: 1200px) {
    font-size: 14px;
  }
  @media (max-width: 992px) {
    font-size: 18px;
  }
  @media (max-width: 768px) {
    font-size: 16px;
  }
  @media (max-width: 576px) {
    font-size: 15px;
  }
  @media (max-width: 480px) {
    font-size: 14px;
  }
  @media (max-width: 400px) {
    font-size: 13px;
  }
  @media (max-width: 380px) {
    font-size: 11px;
  }
`

const CardImage = styled.img`
  width: 100%;
  height: auto;
  display: block;
  filter: drop-shadow(rgba(0, 0, 0, 0.5) 0px 10px 10px);
`

// About Us Card Component
const AboutUsCardComponent = () => {
  return (
    <CardContainer>
      <CardImage src="/assets/aboutus/card.avif" alt="About Us Card Background" />
      <AboutUsTextComponent />
    </CardContainer>
  )
}

export default AboutUsCardComponent