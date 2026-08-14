import base from "../../eslint.config.base.mjs";

export default [
  ...base,
  {
    rules: {
      // Nest relies on decorator metadata and constructor-parameter DI,
      // which the plain TS rules don't need to know about.
      "@typescript-eslint/no-extraneous-class": "off",
    },
  },
];
