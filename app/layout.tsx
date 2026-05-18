import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import PwaRegister from "@/components/PwaRegister";
import MobileBackButton from "@/components/MobileBackButton";
import MobileBottomNav from "@/components/MobileBottomNav";

export const metadata: Metadata = {
  title: "BảoFlix",
  description: "App xem phim cá nhân dùng KKPhim API",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "BảoFlix",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>
	<PwaRegister />
        <Header />
  	<MobileBackButton />
  	<MobileBottomNav />

        <main className="mx-auto min-h-screen max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}