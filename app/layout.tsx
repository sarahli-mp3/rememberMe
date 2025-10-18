import type { Metadata } from "next";
import {
  Inter,
  Gochi_Hand,
  Architects_Daughter,
  Amatic_SC,
  Shadows_Into_Light,
  Kalam,
} from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const gochiHand = Gochi_Hand({ subsets: ["latin"], weight: ["400"] });
const architectsDaughter = Architects_Daughter({
  subsets: ["latin"],
  weight: ["400"],
});
const amaticSC = Amatic_SC({ subsets: ["latin"], weight: ["400", "700"] });
const shadowsIntoLight = Shadows_Into_Light({
  subsets: ["latin"],
  weight: ["400"],
});
const kalam = Kalam({ subsets: ["latin"], weight: ["300", "400", "700"] });

export const metadata: Metadata = {
  title: "Remember Me",
  description: "A modern React application built with Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
