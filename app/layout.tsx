import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "nanphoto — милая генерация",
  description: "Введите запрос, выберите уточнения и получите результат от Gemini",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
