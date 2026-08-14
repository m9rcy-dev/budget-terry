/**
 * Separate from the unit-test Jest config in package.json: these tests
 * spin up a real Postgres via Testcontainers, so they're slower and need
 * Docker — kept out of the fast `pnpm test` loop, run via `pnpm test:integration`.
 */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "..",
  testRegex: ".*\\.integration-spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  testEnvironment: "node",
  testTimeout: 60000,
};
