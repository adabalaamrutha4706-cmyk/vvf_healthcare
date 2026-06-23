import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Venkateswara Vascular Foundation - VVF Healthcare CRM",
  description: "Enterprise hospital management, executive monitoring, and field service tracking platform for Venkateswara Vascular Foundation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased overflow-x-hidden max-w-full`}
      suppressHydrationWarning
    >
      <head>
      </head>
      <body className="min-h-full flex flex-col bg-secondary-bg text-slate-500 overflow-x-hidden max-w-full w-full">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
