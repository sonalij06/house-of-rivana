import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * eslint-config-next 16 ships flat configs, so they are spread in directly —
 * routing them through FlatCompat throws on the plugin's circular references.
 */
const config = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "src/generated/**",
      "prisma/migrations/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default config;
