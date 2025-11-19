import PdfPage from "@/components/pages/PdfPage";

export const dynamic = "force-dynamic";

// Metadata untuk preload assets
export const metadata = {
  other: {
    'Cache-Control': 'public, max-age=31536000, immutable',
  },
};

export default function PdfRenderPage({ searchParams }) {
  const sp = searchParams || {};

  const code = String(sp?.code || "").toUpperCase();

  const product = {
    name: sp?.name ? decodeURIComponent(sp.name) : "-",
    batch: sp?.batch ? decodeURIComponent(sp.batch) : "-",
    productionDate: sp?.productionDate ? decodeURIComponent(sp.productionDate) : "-",
    warrantyUntil: sp?.warrantyUntil ? decodeURIComponent(sp.warrantyUntil) : "-",
  };

  const issuedOn = sp?.issuedOn ? decodeURIComponent(sp.issuedOn) : "";

  return (
    <>
      {/* Preload critical assets */}
      <link
        rel="preload"
        href="/fonts/BAHNSCHRIFT.TTF"
        as="font"
        type="font/ttf"
        crossOrigin="anonymous"
      />
      <link
        rel="preload"
        href="/fonts/CORRUPTED FILE.TTF"
        as="font"
        type="font/ttf"
        crossOrigin="anonymous"
      />
      <link
        rel="preload"
        href="/assets/serialnumber/Surat Originalitas background.png"
        as="image"
      />
      <link
        rel="preload"
        href="/assets/serialnumber/HLO ID 2.avif"
        as="image"
      />
      <link
        rel="preload"
        href="/assets/serialnumber/logo hok.avif"
        as="image"
      />
      <link
        rel="preload"
        href="/assets/serialnumber/ttd.avif"
        as="image"
      />
      <link
        rel="preload"
        href="/assets/serialnumber/stamp.avif"
        as="image"
      />

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
        <PdfPage serialNumber={code} issuedOn={issuedOn} product={product} />
      </div>
    </>
  );
}