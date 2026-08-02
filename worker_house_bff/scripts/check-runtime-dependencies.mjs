import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const requiredRuntimeDependencies = ["@cloudbase/signature-nodejs"];

for (const dependency of requiredRuntimeDependencies) {
  if (!Object.hasOwn(packageJson.dependencies ?? {}, dependency)) {
    throw new Error(`${dependency} must be declared in dependencies`);
  }

  require.resolve(dependency);
}

console.log(
  `[runtime-deps] verified: ${requiredRuntimeDependencies.join(", ")}`,
);
