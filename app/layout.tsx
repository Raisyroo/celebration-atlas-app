import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050812",
};

export const metadata: Metadata = {
  title: "Celebration Atlas",
  applicationName: "Celebration Atlas",
  description: "A guide to celebration events and places.",
  appleWebApp: {
    capable: true,
    title: "Celebration Atlas",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      style={
        {
          "--font-geist-sans": "Arial, Helvetica, sans-serif",
          "--font-geist-mono": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace",
        } as React.CSSProperties
      }
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
