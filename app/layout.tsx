import type { Metadata, Viewport } from "next";
import { Lexend, Literata } from "next/font/google";
import "./globals.css";
import "./candidato.css";

// Literata para lo que se lee con atencion (enunciados, titulos) y Lexend para la interfaz (pensada para leer con fluidez).
// Se sirven desde el propio dominio (next/font), asi que no hace falta ampliar la CSP.
const lectura = Literata({ subsets: ["latin", "latin-ext"], variable: "--font-lectura", display: "swap" });
const interfaz = Lexend({ subsets: ["latin", "latin-ext"], variable: "--font-ui", display: "swap" });

export const metadata: Metadata = {
  title: { default: "PsicoPlataforma", template: "%s · PsicoPlataforma" },
  description: "Evaluaciones psicométricas para procesos de selección.",
  // Los enlaces de evaluación son personales: que no los indexe ningún buscador
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#17594E" };

import { Suspense } from "react";
import { connection } from 'next/server'
import { modoCsp } from '@/lib/server/csp'


// Con nonce (CSP_MODO distinto de 'vigente') los scripts de Next llevan uno distinto por visita y las paginas se renderizan en cada pedido
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (modoCsp() !== 'vigente') await connection()
  return (
    <html
      lang="es"
      className={`h-full antialiased ${lectura.variable} ${interfaz.variable}`}
    >
      <body className="min-h-full flex flex-col">
        <Suspense fallback={<div className="pp"><div className="pp-centro"><p className="pp-muted">Cargando…</p></div></div>}>
          {children}
        </Suspense>
      </body>
    </html>
  );
}
