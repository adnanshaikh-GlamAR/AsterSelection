import type { Metadata } from "next";
import "./globals.css";
import { appendAssetVersion } from "./asset-version";

const siteUrl = "https://adnanshaikh-glamar.github.io/AsterSelection";
const socialPreviewImage = appendAssetVersion(`${siteUrl}/social/aster-collection-preview.png`);

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Aster Collection Configurator",
  description: "Interactive 3D floor lamp configurator for Aster Selection.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Aster Collection Configurator",
    description: "Configure designer floor lamps in an immersive 3D viewer.",
    images: [
      {
        url: socialPreviewImage,
        width: 2992,
        height: 1502,
        alt: "Aster Selection designer floor lamp 3D configurator preview",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aster Collection Configurator",
    description: "Configure designer floor lamps in an immersive 3D viewer.",
    images: [socialPreviewImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
