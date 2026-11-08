import { defineConfig } from "vitest/config";

// 단위 테스트 (순수 함수). 보안 규칙 테스트(tests/rules)는 vitest.rules.config.mts로 따로 돈다.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "components/**/*.test.ts"],
    exclude: ["tests/rules/**", "node_modules/**"],
  },
});
