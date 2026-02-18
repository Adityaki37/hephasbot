import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RobotProvider } from "@/components/robot-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hephasbot - Robotics for Everyone",
  description: "Web-based robot control interface",
};


import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { Providers } from "@/components/providers";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("hephas_session")?.value;
  const user = sessionToken ? await getSession(sessionToken) : null;

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers user={user}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
