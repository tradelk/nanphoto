import type { Metadata } from "next";
import "./globals.css";
import AuthGuard from "./components/AuthGuard";

export const metadata: Metadata = {
  title: "nanphoto — милая генерация",
  description: "Введите запрос, выберите уточнения и получите результат от Gemini",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
