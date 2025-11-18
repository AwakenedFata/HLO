import styled from "styled-components"

// Global Styles with Font Face
const GlobalFonts = styled.div`
  @font-face {
    font-family: "Overpass-Bold";
    src: url("/fonts/Overpass_Bold.ttf") format("truetype");
  }
  @font-face {
    font-family: "Poppins-Reguler";
    src: url("/fonts/poppinsregular.ttf") format("truetype");
  }
  @font-face {
    font-family: "Poppins-MediumItalic";
    src: url("/fonts/Poppins-MediumItalic.ttf") format("truetype");
  }
  @font-face {
    font-family: "HastricoDT-Bold";
    src: url("/fonts/Fontspring-DEMO-hastricodt-bold.otf") format("opentype");
  }
`

const TextOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 8% 10% 10% 10%;
  box-sizing: border-box;
`

const HeaderSection = styled.div`
  text-align: center;
  margin-bottom: 5%;
`

const AboutUsLabel = styled.h3`
  font-family: "Overpass-Bold", "Arial", sans-serif;
  color: #ffffff;
  margin: 0 0 2% 0;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  font-size: 1.1em;
`

const MainTitle = styled.h2`
  font-family: "HastricoDT-Bold", "Arial", sans-serif;
  color: #000000;
  line-height: 1.5;
  margin: 0;
  font-size: 1.5em;
  text-align: center;
`

const ContentSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
`

const Paragraph = styled.p`
  font-family: "Poppins-Reguler", "Arial", sans-serif;
  color: #ffffff;
  line-height: 1.3;
  text-align: justify;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  margin-bottom: 1em;
  font-size: 1em;
  text-justify: inter-word;

  &:last-child {
    margin-bottom: 0;
  }
`

const FooterSection = styled.div`
  text-align: center;
  margin-top: 5%;
`

const Hashtag = styled.h4`
  font-family: "Poppins-MediumItalic", "Arial", sans-serif;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  margin: 0;
  letter-spacing: 0.05em;
  font-size: 1.3em;
`

// About Us Text Component (hanya konten teks)
const AboutUsTextComponent = () => {
  return (
    <GlobalFonts>
      <TextOverlay>
        <HeaderSection>
          <AboutUsLabel>ABOUT US</AboutUsLabel>
          <MainTitle>
            Community Honor Of Kings
            <br />
            Lampung Official
          </MainTitle>
        </HeaderSection>

        <ContentSection>
          <Paragraph>
            Komunitas Honor of Kings Lampung Official berdiri pada Februari 2024 sebagai komunitas pertama yang hadir
            di Domisili Lampung. Komunitas ini bertujuan menjadi wadah bagi para pemain game, khususnya Honor of
            Kings, agar memiliki teman mabar yang berasal dari daerah yang sama. Harapannya, komunitas ini dapat terus
            berkembang di Lampung, meluas ke luar domisili, hingga dikenal di tingkat nasional maupun internasional
          </Paragraph>

          <Paragraph>
            Tidak hanya sebagai komunitas offline yang fokus di Domisili Lampung, Honor of Kings Lampung Official juga
            hadir sebagai komunitas online terbuka untuk semua pemain dari berbagai daerah, bahkan luar negeri. Dengan
            konsep inklusif ini, komunitas ini menjadi ruang bagi para player untuk terhubung, berinteraksi, serta
            mengikuti berbagai kegiatan baik online maupun offline secara aktif dan menyenangkan
          </Paragraph>
        </ContentSection>

        <FooterSection>
          <Hashtag>#OURALLCOMMUNITY</Hashtag>
        </FooterSection>
      </TextOverlay>
    </GlobalFonts>
  )
}

export default AboutUsTextComponent