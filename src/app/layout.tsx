import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import "@/app/globals.css";

const inter = localFont({
  src: [
    { path: "./fonts/inter-regular.ttf", weight: "400" },
    { path: "./fonts/inter-medium.ttf", weight: "500" },
    { path: "./fonts/inter-semibold.ttf", weight: "600" },
  ],
  variable: "--font-sans",
  display: "swap",
});
const newsreader = localFont({
  src: [
    { path: "./fonts/newsreader-regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/newsreader-italic.ttf", weight: "400", style: "italic" },
  ],
  variable: "--font-serif",
  display: "swap",
});
export const metadata: Metadata = {
  title: "Make My Marriage",
  description: "Beautiful celebrations, Thoughtfully planned.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable}`}>
      <body>{children}</body>
    </html>
  );
}
