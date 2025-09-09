// src/app/layout.tsx
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata = {
  title: "B-Go",
  description: "Transportasi & Layanan Bolsel",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
