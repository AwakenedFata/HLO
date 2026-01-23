import "@/styles/main.css";
import { Providers } from "./providers";
import "bootstrap/dist/css/bootstrap.min.css";
import "animate.css";
import "aos/dist/aos.css";
import TurnstileGate from "@/components/TurnstileGate";

export const metadata = {
  metadataBase: new URL('https://hoklampung.com'),
  title: "HOK Lampung Official",
  description:
    "HOK Lampung Official adalah website resmi dari komunitas Honor of Kings Lampung. Event, turnamen, dan info komunitas.#OURALLCOMMUNITY #HONOROFKINGS",
  icons: {
    icon: [
      { url: '/logohead.png' },
      { url: '/logohead.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/logohead.png' },
    ],
  },
  openGraph: {
    title: "HOK Lampung Official",
    description: "HOK Lampung Official adalah website resmi dari komunitas Honor of Kings Lampung. Event, turnamen, dan info komunitas.#OURALLCOMMUNITY #HONOROFKINGS",
    url: "https://hoklampung.com",
    siteName: "HOK Lampung Official",
    images: [
      {
        url: '/logohead.png',
        width: 1200,
        height: 630,
        alt: 'HOK Lampung Logo',
      },
    ],
    locale: 'id_ID',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "HOK Lampung Official",
    description: "HOK Lampung Official adalah website resmi dari komunitas Honor of Kings Lampung. Event, turnamen, dan info komunitas.#OURALLCOMMUNITY #HONOROFKINGS",
    images: ['/logohead.png'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="icon" type="image/png" href="/favicon.png" />
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
