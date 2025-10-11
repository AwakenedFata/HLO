import PdfPage from "@/components/pages/PdfPage"

export default function PdfRenderPage({ searchParams }) {
  const code = String(searchParams?.code || "").toUpperCase()
  const product = {
    name: decodeURIComponent(searchParams?.name || "-"),
    batch: decodeURIComponent(searchParams?.batch || "-"),
    productionDate: decodeURIComponent(searchParams?.productionDate || "-"),
    warrantyUntil: decodeURIComponent(searchParams?.warrantyUntil || "-"),
  }
  const issuedOn = searchParams?.issuedOn ? decodeURIComponent(searchParams.issuedOn) : ""

  return (
    <div
      className="pdf-page w-100 min-vh-100"
      style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 0, margin: 0 }}
    >
      <PdfPage serialNumber={code} issuedOn={issuedOn} product={product} />
    </div>
  )
}
