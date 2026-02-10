import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { rmSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import {
  cloneRepo,
  listMarkdownFiles,
  buildLibraryId,
  buildSourceUrl,
} from "../../src/scraper/github";

describe("GitHub Scraper", () => {
  describe("buildLibraryId()", () => {
    test("extracts library ID from standard GitHub URL", () => {
      const url = "https://github.com/vercel/next.js";
      expect(buildLibraryId(url)).toBe("/vercel/next.js");
    });

    test("handles GitHub URL with .git suffix", () => {
      const url = "https://github.com/facebook/react.git";
      expect(buildLibraryId(url)).toBe("/facebook/react");
    });

    test("handles GitHub URL with trailing slash", () => {
      const url = "https://github.com/upstash/context7/";
      expect(buildLibraryId(url)).toBe("/upstash/context7");
    });

    test("handles GitHub URL with .git and trailing slash", () => {
      const url = "https://github.com/microsoft/vscode.git/";
      expect(buildLibraryId(url)).toBe("/microsoft/vscode");
    });

    test("handles SSH GitHub URL", () => {
      const url = "git@github.com:vercel/next.js.git";
      expect(buildLibraryId(url)).toBe("/vercel/next.js");
    });
  });

  describe("buildSourceUrl()", () => {
    test("constructs browsable GitHub URL without version", () => {
      const repoUrl = "https://github.com/vercel/next.js";
      const filePath = "docs/api-reference/functions.md";
      const url = buildSourceUrl(repoUrl, filePath);
      expect(url).toBe(
        "https://github.com/vercel/next.js/blob/main/docs/api-reference/functions.md"
      );
    });

    test("constructs browsable GitHub URL with version tag", () => {
      const repoUrl = "https://github.com/vercel/next.js";
      const filePath = "docs/routing.md";
      const version = "v14.3.0";
      const url = buildSourceUrl(repoUrl, filePath, version);
      expect(url).toBe(
        "https://github.com/vercel/next.js/blob/v14.3.0/docs/routing.md"
      );
    });

    test("handles file path with leading slash", () => {
      const repoUrl = "https://github.com/facebook/react";
      const filePath = "/packages/react/README.md";
      const url = buildSourceUrl(repoUrl, filePath);
      expect(url).toBe(
        "https://github.com/facebook/react/blob/main/packages/react/README.md"
      );
    });

    test("normalizes GitHub URL with .git suffix", () => {
      const repoUrl = "https://github.com/facebook/react.git";
      const filePath = "README.md";
      const url = buildSourceUrl(repoUrl, filePath);
      expect(url).toBe("https://github.com/facebook/react/blob/main/README.md");
    });
  });

  describe("listMarkdownFiles()", () => {
    const tempDir = join(import.meta.dir, "..", "..", ".tmp", "github-test");

    beforeEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
      mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    test("lists all markdown files in directory", async () => {
      writeFileSync(join(tempDir, "README.md"), "# Test");
      mkdirSync(join(tempDir, "docs"));
      writeFileSync(join(tempDir, "docs", "guide.md"), "# Guide");
      writeFileSync(join(tempDir, "docs", "api.md"), "# API");
      writeFileSync(join(tempDir, "ignore.txt"), "ignore");

      const files = await listMarkdownFiles(tempDir);

      expect(files).toHaveLength(3);
      expect(files).toContain("README.md");
      expect(files).toContain("docs/guide.md");
      expect(files).toContain("docs/api.md");
    });

    test("returns empty array for directory with no markdown files", async () => {
      writeFileSync(join(tempDir, "file.txt"), "text");

      const files = await listMarkdownFiles(tempDir);

      expect(files).toHaveLength(0);
    });

    test("uses custom glob pattern to filter files", async () => {
      mkdirSync(join(tempDir, "docs"));
      mkdirSync(join(tempDir, "blog"));
      writeFileSync(join(tempDir, "README.md"), "# Root");
      writeFileSync(join(tempDir, "docs", "api.md"), "# API");
      writeFileSync(join(tempDir, "blog", "post.md"), "# Post");

      const files = await listMarkdownFiles(tempDir, "docs/**/*.md");

      expect(files).toHaveLength(1);
      expect(files).toContain("docs/api.md");
    });

    test("handles nested directory structures", async () => {
      mkdirSync(join(tempDir, "a", "b", "c"), { recursive: true });
      writeFileSync(join(tempDir, "a", "1.md"), "1");
      writeFileSync(join(tempDir, "a", "b", "2.md"), "2");
      writeFileSync(join(tempDir, "a", "b", "c", "3.md"), "3");

      const files = await listMarkdownFiles(tempDir);

      expect(files).toHaveLength(3);
      expect(files).toContain("a/1.md");
      expect(files).toContain("a/b/2.md");
      expect(files).toContain("a/b/c/3.md");
    });
  });

  describe("cloneRepo()", () => {
    const tempDir = join(import.meta.dir, "..", "..", ".tmp", "clone-test");

    beforeEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    test("clones a public GitHub repository with shallow depth", async () => {
      const url = "https://github.com/upstash/context7";
      const targetDir = join(tempDir, "context7");

      await cloneRepo(url, targetDir);

      const gitDir = join(targetDir, ".git");
      expect(existsSync(gitDir)).toBe(true);

      const packageJson = join(targetDir, "package.json");
      expect(existsSync(packageJson)).toBe(true);
    });

    test("clones with specific version tag", async () => {
      const url = "https://github.com/upstash/context7";
      const targetDir = join(tempDir, "context7-tagged");
      const version = "@upstash/context7-mcp@2.0.0";

      await cloneRepo(url, targetDir, { version });

      const gitDir = join(targetDir, ".git");
      expect(existsSync(gitDir)).toBe(true);
    }, 10000);

    test("throws error for invalid repository URL", async () => {
      const url = "https://github.com/invalid/nonexistent-repo-xyz123";
      const targetDir = join(tempDir, "invalid");

      await expect(cloneRepo(url, targetDir)).rejects.toThrow();
    });
  });
});
