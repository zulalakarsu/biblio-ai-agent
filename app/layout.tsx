import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Biblio.ai - Reference Extractor",
  description: "Extract bibliographic data from PDFs or DOI lists",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

