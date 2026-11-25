import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "BRAVO — Seu estilo. Sua assinatura.",
  description:
    "Uma nova forma de cuidar do seu estilo. Conheça a BRAVO Barbearia e agende seu corte ou barba em poucos passos. Projeto demonstrativo de portfólio.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "BRAVO Barbearia",
    description: "Seu estilo. Sua assinatura.",
    locale: "pt_BR",
    type: "website",
  },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
