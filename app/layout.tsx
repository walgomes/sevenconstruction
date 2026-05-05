import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "SevenConstruction — SaaS para lojas de material de construção",
  description:
    "Prospecção de bairro, crédito no checkout, FIDC, seguros, certidões e fidelização — num único SaaS para lojas de cimento, areia, brita, blocos, ferragens.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
