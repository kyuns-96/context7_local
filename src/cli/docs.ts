import { existsSync, statSync } from "fs";
import { basename, dirname, join } from "path";

export const DEFAULT_DOC_GLOB = "**/*.{md,mdx,markdown,rst,txt}";

export function isGlobPattern(value: string): boolean {
  return /[*?\[\]{}!]/.test(value);
}

export function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

export function resolveDocsScan(repoDir: string, docsPath?: string): {
  scanDir: string;
  globPattern: string;
  repoRelativePrefix: string;
} {
  const normalizedDocsPath = (docsPath ?? "").trim();

  let scanDir = repoDir;
  let globPattern = DEFAULT_DOC_GLOB;
  let repoRelativePrefix = "";

  if (!normalizedDocsPath) {
    return { scanDir, globPattern, repoRelativePrefix };
  }

  if (isGlobPattern(normalizedDocsPath)) {
    return {
      scanDir: repoDir,
      globPattern: normalizedDocsPath,
      repoRelativePrefix: "",
    };
  }

  const fullPath = join(repoDir, normalizedDocsPath);

  if (existsSync(fullPath)) {
    const stats = statSync(fullPath);

    if (stats.isFile()) {
      return {
        scanDir: dirname(fullPath),
        globPattern: basename(fullPath),
        repoRelativePrefix: toPosixPath(dirname(normalizedDocsPath)),
      };
    }

    return {
      scanDir: fullPath,
      globPattern: DEFAULT_DOC_GLOB,
      repoRelativePrefix: toPosixPath(normalizedDocsPath),
    };
  }

  return {
    scanDir: join(repoDir, normalizedDocsPath),
    globPattern: DEFAULT_DOC_GLOB,
    repoRelativePrefix: toPosixPath(normalizedDocsPath),
  };
}

export function resolveRepoRelativePath(prefix: string, filePath: string): string {
  return prefix ? toPosixPath(join(prefix, filePath)) : toPosixPath(filePath);
}
