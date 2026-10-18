import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://rheferia.vercel.app"),
  title: {
    default: `Rheferia — Where ideas find their sources.`,
    template: "%s · Rheferia",
  },
  description:
    "Rheferia helps researchers find relevant research and available full texts, build reference lists, and work with documents.",
  applicationName: "Rheferia",
  openGraph: {
    type: "website",
    url: "https://rheferia.vercel.app",
    siteName: "Rheferia",
    title: `Rheferia — Where ideas find their sources.`,
    description:
      "Search scholarly sources, build reference lists in six citation styles, and use free in-browser PDF tools. Your files never leave your device.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: `Rheferia — Where ideas find their sources.`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `Rheferia — Where ideas find their sources.`,
    description:
      "Search scholarly sources, build reference lists in six citation styles, and use free in-browser PDF tools.",
    images: ["/og-image.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F6F2" },
    { media: "(prefers-color-scheme: dark)", color: "#10181C" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Follow the OS color scheme before user preference wiring exists */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('rheferia-theme')==='dark'||(!localStorage.getItem('rheferia-theme')&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        {/* A11y skip link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}