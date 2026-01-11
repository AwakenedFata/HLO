import "@/styles/main.css";
import { Providers } from "./providers";
import "bootstrap/dist/css/bootstrap.min.css";
import "animate.css";
import "aos/dist/aos.css";
import TurnstileGate from "@/components/TurnstileGate";

export const metadata = {
title: "HOK Lampung Official | Komunitas Honor of Kings Lampung",
  description:
    "HOK Lampung Official adalah website resmi dari komunitas Honor of Kings Lampung. Event, turnamen, dan info komunitas.#OURALLCOMMUNITY #HONOROFKINGS",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="icon" type="image/png" href="/logohead.png" />
        <link
          href="https://fonts.googleapis.com/css2?family=Overpass:wght@700&display=swap"
          rel="stylesheet"
        />

        {/* Schema Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "HOK Lampung",
              url: "https://hoklampung.com",
              logo: "https://hoklampung.com/logo.png",
              sameAs: ["https://www.instagram.com/hoklampung.official"],
            }),
          }}
        />
      </head>

      <body>
        <TurnstileGate>
          <Providers>{children}</Providers>
        </TurnstileGate>
      </body>
    </html>
  );
}
