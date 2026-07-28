import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return {
      shortCircuit: true,
      url: "data:text/javascript,export%20%7B%7D%3B",
    };
  }
  if (specifier.startsWith("@/")) {
    const base = path.resolve(repositoryRoot, specifier.slice(2));
    const candidate = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      path.join(base, "index.ts"),
      path.join(base, "index.tsx"),
    ].find((value) => existsSync(value));
    if (!candidate) {
      throw new Error(`Cannot resolve server runtime alias ${specifier}.`);
    }
    return {
      shortCircuit: true,
      url: pathToFileURL(candidate).href,
    };
  }
  if (
    specifier.startsWith(".") &&
    context.parentURL?.startsWith("file:")
  ) {
    const base = fileURLToPath(new URL(specifier, context.parentURL));
    const candidate = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      path.join(base, "index.ts"),
      path.join(base, "index.tsx"),
    ].find((value) => existsSync(value));
    if (candidate) {
      return {
        shortCircuit: true,
        url: pathToFileURL(candidate).href,
      };
    }
  }
  return nextResolve(specifier, context);
}
