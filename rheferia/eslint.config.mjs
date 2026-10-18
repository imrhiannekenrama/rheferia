import { FlatCompat } from "@eslint/eslintrc";

const eslintConfig = [
  ...new FlatCompat().config({
    extends: ["next/core-web-vitals", "next/typescript"],
  }),
  {
    rules: {
      // Underscore-prefixed parameters mark intentionally-unused signature slots
      // (e.g. author-date styles ignore the sequence number in the dispatch table).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "playwright-report/**",
      "rheferia/**",
      "public/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
