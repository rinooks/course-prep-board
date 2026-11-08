import type { NextConfig } from "next";

// 구글 로그인 처리 페이지(/__/auth/...)를 Firebase 기본 도메인에서 가져와 우리 도메인으로 보여준다.
// lib/firebase/client.ts의 운영 authDomain 변경과 세트다.
const FIREBASE_AUTH_ORIGIN = "https://edu-project-f1d12.firebaseapp.com";

// 모든 화면에 붙이는 기본 보안 헤더
const baselineHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // 마이크는 2단계(앱 안 녹음)에서 쓸 수 있어 우리 사이트에만 열어 둔다
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()" },
];

// /__/ 로그인 처리 페이지 전용: 구글·Firebase 인증 스크립트, 창(iframe), 통신을 허용한다
const firebaseAuthCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://www.google.com https://accounts.google.com",
  "frame-src 'self' https://accounts.google.com https://apis.google.com https://www.google.com " +
    FIREBASE_AUTH_ORIGIN,
  "connect-src 'self' https://*.googleapis.com https://apis.google.com https://accounts.google.com https://www.google.com " +
    FIREBASE_AUTH_ORIGIN,
  "img-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  async rewrites() {
    return {
      // 다른 어떤 경로보다 먼저 처리한다
      beforeFiles: [
        {
          source: "/__/:path*",
          destination: `${FIREBASE_AUTH_ORIGIN}/__/:path*`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: baselineHeaders,
      },
      // 같은 헤더 이름이 여러 규칙에 걸리면 뒤에 적은 값이 이긴다 (Next 16 문서).
      // 그래서 /__/ 규칙을 반드시 전역 규칙 뒤에 둔다 → X-Frame-Options가 SAMEORIGIN이 된다.
      {
        source: "/__/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: firebaseAuthCsp },
        ],
      },
    ];
  },
};

export default nextConfig;
