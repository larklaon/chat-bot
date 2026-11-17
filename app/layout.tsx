import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "모아 — 당신의 AI 어시스턴트",
  description: "생각을 정리하고, 새로운 아이디어를 발견하는 나만의 AI 챗봇 모아",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
