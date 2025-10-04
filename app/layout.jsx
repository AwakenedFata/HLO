import "@/styles/main.css"
import { Providers } from "./providers"
import "bootstrap/dist/css/bootstrap.min.css"
import "animate.css"
import "aos/dist/aos.css"

export const metadata = {
  title: "HOK LAMPUNG OFFICIAL",
  description:
    "Situs Ini merupakan Website Resmi dari Komunitas Honor of Kings Lampung. #OURALLCOMMUNITY #HONOROFKINGS",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/logoheading.png" />
        <link href="https://fonts.googleapis.com/css2?family=Overpass:wght@700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
