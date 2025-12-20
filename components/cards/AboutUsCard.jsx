import styled from "styled-components"

// Styled Components
const CardContainer = styled.div`
  position: relative;
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
  font-size: 16px;
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
      <CardImage src="/assets/aboutus/aboutus.avif" alt="About Us Card Background" />
    </CardContainer>
  )
}

export default AboutUsCardComponent