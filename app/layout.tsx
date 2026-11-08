import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { NoticesProvider } from "@/components/notices/NoticesProvider";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

// 가변 글꼴이라 굵기를 따로 적지 않는다. 한글 글자는 필요한 조각만 그때그때 내려받는다.
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "강의 준비 보드",
  description: "강의 준비 과정을 한곳에서 관리하는 보드",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          {/* 알림 구독을 여기서 한 번만 열어, 화면을 옮겨 다녀도 끊기지 않게 한다 */}
          <NoticesProvider>
            <ToastProvider>{children}</ToastProvider>
          </NoticesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
