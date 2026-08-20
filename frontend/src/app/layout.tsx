import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";

// Use standard, high-quality system and web fallback fonts to avoid build-time Google Fonts network requests
const geistSans = {
  variable: "font-sans-fallback",
};

const geistMono = {
  variable: "font-mono-fallback",
};

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
