import { Glob } from "bun";
import { join } from "path";

export interface CloneOptions {
  version?: string;
}

export async function cloneRepo(
  url: string,
  targetDir: string,
  options: CloneOptions = {}
): Promise<void> {
  const { version } = options;

  const args = ["clone", "--depth", "1"];

  if (version) {
    args.push("--branch", version);
  }

  args.push(url, targetDir);

  const proc = Bun.spawn(["git", ...args], {
    stdout: "ignore",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to clone repository: ${stderr.trim()}`);
  }
}

export async function listDocFiles(
  dir: string,
  globPattern: string = "**/*.{md,txt}"
): Promise<string[]> {
  const glob = new Glob(globPattern);
  const files: string[] = [];

  for await (const file of glob.scan(dir)) {
    files.push(file);
  }

  return files;
}

export async function listMarkdownFiles(
  dir: string,
  globPattern: string = "**/*.md"
): Promise<string[]> {
  return listDocFiles(dir, globPattern);
}

export function buildLibraryId(repoUrl: string): string {
  let normalized = repoUrl;

  if (normalized.startsWith("git@github.com:")) {
    normalized = normalized.replace("git@github.com:", "https://github.com/");
  }

  normalized = normalized.replace(/\.git\/?$/, "");
  normalized = normalized.replace(/\/$/, "");

  const match = normalized.match(/github\.com\/([^/]+\/[^/]+)/);

  if (!match) {
    throw new Error(`Invalid GitHub URL: ${repoUrl}`);
  }

  return `/${match[1]}`;
}

export function buildSourceUrl(
  repoUrl: string,
  filePath: string,
  version: string = "main"
): string {
  const libraryId = buildLibraryId(repoUrl);
  const normalizedPath = filePath.startsWith("/")
    ? filePath.substring(1)
    : filePath;

  return `https://github.com${libraryId}/blob/${version}/${normalizedPath}`;
}
