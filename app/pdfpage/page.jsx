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
      <link rel="preload" href="/assets/serialnumber/Surat Originalitas.png" as="image" />

      <div
        className="pdf-page w-100 min-vh-100"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: 0,
          margin: 0,
        }}
      >
        <PdfPage serialNumber={code} issuedOn={issuedOn} location={location} />
      </div>
    </>
  )
}
