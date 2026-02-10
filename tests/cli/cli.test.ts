import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdirSync, rmSync, existsSync } from "fs";
import { openDatabase } from "../../src/db/connection";
import { createSchema } from "../../src/db/schema";
import { executeCommand } from "../../src/cli/index";

describe("CLI - Command Execution", () => {
  let testDir: string;
  let dbPath: string;

  beforeEach(() => {
    testDir = join(process.cwd(), ".tmp", `cli-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    dbPath = join(testDir, "test.db");

    const db = openDatabase(dbPath);
    createSchema(db);
    db.close();
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("ingest command", () => {
    test("throws error when preset-all is used", async () => {
      const parsed = {
        command: "ingest",
        db: dbPath,
        presetAll: true,
      };

      await expect(executeCommand(parsed)).rejects.toThrow(
        "--preset-all is not yet implemented"
      );
    });

    test("throws error when preset is used", async () => {
      const parsed = {
        command: "ingest",
        db: dbPath,
        preset: "react",
        repoUrl: "https://github.com/org/repo",
      };

      await expect(executeCommand(parsed)).rejects.toThrow(
        "--preset is not yet implemented"
      );
    });

    test("throws error when repo-url is missing", async () => {
      const parsed = {
        command: "ingest",
        db: dbPath,
      };

      await expect(executeCommand(parsed)).rejects.toThrow(
        "repo-url is required for ingest command"
      );
    });
  });

  describe("list command", () => {
    test("displays empty message when no libraries exist", async () => {
      const parsed = {
        command: "list",
        db: dbPath,
      };

      await executeCommand(parsed);
    });

    test("displays libraries in table format", async () => {
      const db = openDatabase(dbPath);
      db.run(
        `INSERT INTO libraries (id, version, title, description, source_repo, total_snippets)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ["/org/repo", "v1.0.0", "Repo", "Test library", "https://github.com/org/repo", 10]
      );
      db.close();

      const parsed = {
        command: "list",
        db: dbPath,
      };

      await executeCommand(parsed);
    });
  });

  describe("remove command", () => {
    test("removes library with specific version", async () => {
      const db = openDatabase(dbPath);
      db.run(
        `INSERT INTO libraries (id, version, title, description, source_repo, total_snippets)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ["/org/repo", "v1.0.0", "Repo", "Test library", "https://github.com/org/repo", 10]
      );
      db.close();

      const parsed = {
        command: "remove",
        libraryId: "/org/repo",
        version: "v1.0.0",
        db: dbPath,
      };

      await executeCommand(parsed);

      const dbCheck = openDatabase(dbPath, true);
      const result = dbCheck
        .query("SELECT COUNT(*) as count FROM libraries WHERE id = ?")
        .get("/org/repo") as any;
      expect(result.count).toBe(0);
      dbCheck.close();
    });

    test("removes all versions when version not specified", async () => {
      const db = openDatabase(dbPath);
      db.run(
        `INSERT INTO libraries (id, version, title, description, source_repo, total_snippets)
         VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)`,
        [
          "/org/repo", "v1.0.0", "Repo", "Test library", "https://github.com/org/repo", 10,
          "/org/repo", "v2.0.0", "Repo", "Test library", "https://github.com/org/repo", 15,
        ]
      );
      db.close();

      const parsed = {
        command: "remove",
        libraryId: "/org/repo",
        db: dbPath,
      };

      await executeCommand(parsed);

      const dbCheck = openDatabase(dbPath, true);
      const result = dbCheck
        .query("SELECT COUNT(*) as count FROM libraries WHERE id = ?")
        .get("/org/repo") as any;
      expect(result.count).toBe(0);
      dbCheck.close();
    });

    test("handles non-existent library gracefully", async () => {
      const parsed = {
        command: "remove",
        libraryId: "/nonexistent/repo",
        db: dbPath,
      };

      await executeCommand(parsed);
    });
  });

  describe("preview command", () => {
    test("shows summary without database insertion", async () => {
      const parsed = {
        command: "preview",
        repoUrl: "https://github.com/upstash/context7",
        docsPath: "packages/mcp",
      };

      await executeCommand(parsed);

      const db = openDatabase(dbPath, true);
      const result = db
        .query("SELECT COUNT(*) as count FROM libraries")
        .get() as any;
      expect(result.count).toBe(0);
      db.close();
    }, 30000);
  });

  describe("error handling", () => {
    test("throws error for unknown command", async () => {
      const parsed = {
        command: "unknown",
      };

      await expect(executeCommand(parsed)).rejects.toThrow("Unknown command");
    });
  });
});
