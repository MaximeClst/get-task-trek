import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Nav from "./components/Nav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Task Trek",
  description: "Generated new To Do List for any business or your lifestyle",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Nav />
        {children}
      </body>
    </html>
  );
}
