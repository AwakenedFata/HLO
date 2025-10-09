export async function GET(request) {
  const url = new URL(request.url)
  const qs = url.search
  const target = new URL(`/api/verification-pdf${qs || ""}`, url.origin)
  return Response.redirect(target.href, 307)
}
