import PdfPage from "@/components/pages/PdfPage"

export const dynamic = "force-dynamic"

export const metadata = {
  other: {
    "Cache-Control": "public, max-age=31536000, immutable",
  },
}

export default async function PdfRenderPage({ searchParams }) {
  const sp = await searchParams

  const code = String(sp?.code || "").toUpperCase()
  const issuedOn = sp?.issuedOn ? decodeURIComponent(sp.issuedOn) : ""
  const location = sp?.location ? decodeURIComponent(sp.location) : ""

  return (
    <>
        <link rel="preload" href="/fonts/BAHNSCHRIFT.TTF" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/CORRUPTED FILE.TTF" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/assets/serialnumber/Surat Originalitas ver 2.png" as="image" />
        <style dangerouslySetInnerHTML={{__html: `
          @font-face {
            font-family: "Corrupted File";
            src: url("/fonts/CORRUPTED FILE.TTF") format("truetype");
            font-weight: normal;
            font-style: normal;
            font-display: block;
          }
          
          @font-face {
            font-family: "Bahnschrift";
            src: url("/fonts/BAHNSCHRIFT.TTF") format("truetype");
            font-weight: normal;
            font-style: normal;
            font-display: block;
          }

          * {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }

          body {
            margin: 0;
            padding: 0;
            font-family: "Bahnschrift", sans-serif;
          }
        `}} />

      <div
        className="pdf-page w-100 min-vh-100"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: 0,
          margin: 0,
          background: "#f5f5f5",
        }}
      >
        <PdfPage serialNumber={code} issuedOn={issuedOn} location={location} />
      </div>
    </>
  )
}