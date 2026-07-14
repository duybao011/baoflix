import { Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import PwaRegister from "@/components/PwaRegister";
import CustomMoviesCloudSync from "@/components/CustomMoviesCloudSync";
import MobileBackButton from "@/components/MobileBackButton";
import MobileBottomNav from "@/components/MobileBottomNav";
import TvModeFloatingButton from "@/components/TvModeFloatingButton";
import TvRemoteKeyBridge from "@/components/TvRemoteKeyBridge";
import TvPlayerCommandBridge from "@/components/TvPlayerCommandBridge";
import TvRemoteNavigator from "@/components/TvRemoteNavigator";
import TvAutoFocus from "@/components/TvAutoFocus";
import TvModeToggleButton from "@/components/TvModeToggleButton";
import ReloadAppButton from "@/components/ReloadAppButton";
import TvFocusMemory from "@/components/TvFocusMemory";
import TvLaunchController from "@/components/TvLaunchController";

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
    <html lang="vi" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <PwaRegister />
        <CustomMoviesCloudSync />
        <TvLaunchController />
        <TvRemoteKeyBridge />
        <TvPlayerCommandBridge />
        <TvRemoteNavigator />
        <TvAutoFocus />
        <TvFocusMemory />
        <Suspense
          fallback={
            <div className="h-[73px] border-b border-white/10 bg-[#070b14]" />
          }
        >
          <Header />
        </Suspense>

        <MobileBackButton />
        <MobileBottomNav />
        <TvModeFloatingButton />
        <TvModeToggleButton />
        <ReloadAppButton />

        <main className="mx-auto min-h-screen max-w-[1600px] px-4 pb-28 pt-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
