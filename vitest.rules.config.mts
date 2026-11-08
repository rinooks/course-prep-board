import { defineConfig } from "vitest/config";

// Firestore 보안 규칙 테스트. 에뮬레이터 안에서 실행한다: npm run test:rules
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["tests/rules/**/*.test.ts"],
    // 에뮬레이터 하나를 같이 쓰므로 파일을 차례로 돌린다
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
