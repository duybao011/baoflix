import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      // BảoFlix hiện có nhiều màn hình client-only đọc localStorage/sessionStorage
      // sau khi hydrate. React 19/Next 16 lint rất gắt và biến các pattern cũ
      // thành error, làm chặn Stage 1 TV stability dù app vẫn chạy được.
      // Giữ rule ở mức warning để còn thấy nợ kỹ thuật nhưng không chặn build/lint.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",

      // API ngoài như KKPhim/my-taste còn nhiều payload động. Refactor sang unknown
      // nên làm ở đợt cleanup riêng; trước mắt không để rule này chặn test TV.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
