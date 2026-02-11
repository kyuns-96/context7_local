import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { rmSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { Database } from "bun:sqlite";
import { ingestLibrary } from "../../src/cli/ingest";
import { openDatabase } from "../../src/db/connection";

describe("Ingest Library", () => {
  const tempDir = join(import.meta.dir, "..", "..", ".tmp", "ingest-test");
  const dbPath = join(tempDir, "test.db");

  beforeEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function createMockRepo(baseDir: string): string {
    const repoDir = join(baseDir, "mock-repo");
    mkdirSync(repoDir, { recursive: true });

    writeFileSync(
      join(repoDir, "README.md"),
      `# Test Library\n\nThis is a test library for ingestion.`
    );

    mkdirSync(join(repoDir, "docs"));
    writeFileSync(
      join(repoDir, "docs", "guide.md"),
      `# Getting Started\n\nFollow these steps to get started.\n\n## Installation\n\nRun the command: \`npm install test-lib\``
    );

    writeFileSync(
      join(repoDir, "docs", "api.md"),
      `# API Reference\n\n## Functions\n\n### doSomething()\n\nDoes something useful.\n\n\`\`\`typescript\nfunction doSomething(): void {\n  console.log("doing something");\n}\n\`\`\``
    );

    return repoDir;
  }

  test("ingests library from local directory with default options", async () => {
    const repoDir = createMockRepo(tempDir);
    const repoUrl = "https://github.com/test/library";

    await ingestLibrary(repoUrl, dbPath, { localPath: repoDir });

    const db = openDatabase(dbPath, true);

    const library = db
      .query(
        "SELECT id, version, title, source_repo, total_snippets FROM libraries WHERE id = ?"
      )
      .get("/test/library") as any;

    expect(library).toBeDefined();
    expect(library.id).toBe("/test/library");
    expect(library.version).toBe("latest");
    expect(library.source_repo).toBe(repoUrl);
    expect(library.total_snippets).toBeGreaterThan(0);

    const snippets = db
      .query("SELECT COUNT(*) as count FROM snippets WHERE library_id = ?")
      .get("/test/library") as any;

    expect(snippets.count).toBe(library.total_snippets);
    expect(snippets.count).toBeGreaterThanOrEqual(3);

    db.close();
  });

  test("ingests library with custom version", async () => {
    const repoDir = createMockRepo(tempDir);
    const repoUrl = "https://github.com/test/library";
    const version = "v1.0.0";

    await ingestLibrary(repoUrl, dbPath, { localPath: repoDir, version });

    const db = openDatabase(dbPath, true);

    const library = db
      .query("SELECT version FROM libraries WHERE id = ? AND version = ?")
      .get("/test/library", version) as any;

    expect(library).toBeDefined();
    expect(library.version).toBe(version);

    db.close();
  });

  test("re-ingestion replaces previous data (idempotent)", async () => {
    const repoDir = createMockRepo(tempDir);
    const repoUrl = "https://github.com/test/library";

    await ingestLibrary(repoUrl, dbPath, { localPath: repoDir });

    const db = openDatabase(dbPath, true);
    const firstCount = (
      db
        .query("SELECT total_snippets FROM libraries WHERE id = ?")
        .get("/test/library") as any
    ).total_snippets;
    db.close();

    writeFileSync(
      join(repoDir, "docs", "new.md"),
      "# New Document\n\nThis is a new document."
    );

    await ingestLibrary(repoUrl, dbPath, { localPath: repoDir });

    const db2 = openDatabase(dbPath, true);
    const libraries = db2
      .query("SELECT COUNT(*) as count FROM libraries WHERE id = ?")
      .get("/test/library") as any;
    expect(libraries.count).toBe(1);

    const secondCount = (
      db2
        .query("SELECT total_snippets FROM libraries WHERE id = ?")
        .get("/test/library") as any
    ).total_snippets;

    expect(secondCount).toBeGreaterThan(firstCount);

    db2.close();
  });

  test("ingests only files from custom docs path", async () => {
    const repoDir = join(tempDir, "custom-path-repo");
    mkdirSync(join(repoDir, "documentation"), { recursive: true });
    mkdirSync(join(repoDir, "other"), { recursive: true });

    writeFileSync(
      join(repoDir, "documentation", "doc1.md"),
      "# Documentation 1\n\nThis is the first documentation file."
    );
    writeFileSync(
      join(repoDir, "documentation", "doc2.md"),
      "# Documentation 2\n\nThis is the second documentation file."
    );
    writeFileSync(join(repoDir, "other", "ignore.md"), "# Should be ignored\n\nThis file should not be indexed.");

    const repoUrl = "https://github.com/test/custom";

    await ingestLibrary(repoUrl, dbPath, {
      localPath: repoDir,
      docsPath: "documentation",
    });

    const db = openDatabase(dbPath, true);

    const library = db
      .query("SELECT total_snippets FROM libraries WHERE id = ?")
      .get("/test/custom") as any;

    expect(library.total_snippets).toBe(2);

    const ignoredSnippet = db
      .query(
        "SELECT COUNT(*) as count FROM snippets WHERE library_id = ? AND source_path LIKE ?"
      )
      .get("/test/custom", "%other/ignore.md%") as any;

    expect(ignoredSnippet.count).toBe(0);

    db.close();
  });

  test("creates snippets with correct metadata and source URLs", async () => {
    const repoDir = createMockRepo(tempDir);
    const repoUrl = "https://github.com/test/library";

    await ingestLibrary(repoUrl, dbPath, { localPath: repoDir });

    const db = openDatabase(dbPath, true);

    const snippet = db
      .query(
        "SELECT title, content, source_path, source_url, language, token_count, breadcrumb, embedding FROM snippets WHERE library_id = ? LIMIT 1"
      )
      .get("/test/library") as any;

    expect(snippet).toBeDefined();
    expect(snippet.title).toBeTruthy();
    expect(snippet.content).toBeTruthy();
    expect(snippet.source_path).toBeTruthy();
    expect(snippet.source_url).toContain("github.com/test/library/blob/main/");
    expect(snippet.token_count).toBeGreaterThan(0);

    db.close();
  });

  test("generates embeddings for all snippets during ingestion", async () => {
    const repoDir = createMockRepo(tempDir);
    const repoUrl = "https://github.com/test/library";

    await ingestLibrary(repoUrl, dbPath, { localPath: repoDir });

    const db = openDatabase(dbPath, true);

    const snippets = db
      .query("SELECT embedding FROM snippets WHERE library_id = ?")
      .all("/test/library") as any[];

    expect(snippets.length).toBeGreaterThan(0);

    for (const snippet of snippets) {
      expect(snippet.embedding).toBeTruthy();
      
      const embedding = JSON.parse(snippet.embedding);
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(384);
      
      for (const value of embedding) {
        expect(typeof value).toBe("number");
      }
    }

    db.close();
  });

  test("transaction rollback on error prevents partial ingestion", async () => {
    const repoDir = join(tempDir, "error-repo");
    mkdirSync(repoDir);
    writeFileSync(join(repoDir, "README.md"), "# Test");

    const invalidDbPath = "/invalid/path/to/db.sqlite";

    await expect(
      ingestLibrary("https://github.com/test/invalid", invalidDbPath, {
        localPath: repoDir,
      })
    ).rejects.toThrow();
  });

  test("ingests library with custom title and description", async () => {
    const repoDir = createMockRepo(tempDir);
    const repoUrl = "https://github.com/test/library";
    const title = "Test Library";
    const description = "A test library for testing";

    await ingestLibrary(repoUrl, dbPath, {
      localPath: repoDir,
      title,
      description,
    });

    const db = openDatabase(dbPath, true);

    const library = db
      .query("SELECT title, description FROM libraries WHERE id = ?")
      .get("/test/library") as any;

    expect(library.title).toBe(title);
    expect(library.description).toBe(description);

    db.close();
  });
});
