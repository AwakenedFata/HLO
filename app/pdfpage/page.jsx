import PdfPage from "@/components/pages/PdfPage"

export const dynamic = "force-dynamic"

export default async function PdfRenderPage({ searchParams }) {
  const sp = await searchParams

  const code = String(sp?.code || "").toUpperCase()
  const product = {
    name: sp?.name ? decodeURIComponent(sp.name) : "-",
    batch: sp?.batch ? decodeURIComponent(sp.batch) : "-",
    productionDate: sp?.productionDate ? decodeURIComponent(sp.productionDate) : "-",
    warrantyUntil: sp?.warrantyUntil ? decodeURIComponent(sp.warrantyUntil) : "-",
  }
  const issuedOn = sp?.issuedOn ? decodeURIComponent(sp.issuedOn) : ""

  return (
    <div
      className="pdf-page w-100 min-vh-100"
      style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 0, margin: 0 }}
    >
      <PdfPage serialNumber={code} issuedOn={issuedOn} product={product} />
    </div>
  )
}
