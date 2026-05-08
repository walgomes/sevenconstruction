import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "SevenConstruction · Meu clube",
  description: "Veja seus pontos, resgate cashback e indique amigos.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#f59e0b",
  width: "device-width",
  initialScale: 1,
};

export default function ClienteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* SW registrado uma unica vez no client */}
      <script
        dangerouslySetInnerHTML={{
          __html: `if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js').catch(()=>{}); }`,
        }}
      />
      {children}
    </>
  );
}
