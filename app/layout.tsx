import type { Metadata } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai"],
  variable: "--font-noto-sans-thai",
});

export const metadata: Metadata = {
  title: "ShiftGen - ระบบจัดตารางปฏิบัติงาน",
  description: "ระบบจัดตารางปฏิบัติงาน",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={cn(
        "h-full antialiased font-sans",
        inter.variable,
        notoSansThai.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="bottom-center" />
      </body>
    </html>
  );
}
