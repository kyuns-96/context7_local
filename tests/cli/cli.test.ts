import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { join } from "path";
import { mkdirSync, rmSync, existsSync } from "fs";
import { openDatabase } from "../../src/db/connection";
import { createSchema } from "../../src/db/schema";
import { executeCommand } from "../../src/cli/index";
import * as ingestModule from "../../src/cli/ingest";

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
    test("ingests all presets when --preset-all is used", async () => {
      const ingestSpy = spyOn(ingestModule, "ingestLibrary").mockResolvedValue();

      try {
        const parsed = {
          command: "ingest",
          db: dbPath,
          presetAll: true,
        };

        await executeCommand(parsed);

        expect(ingestSpy).toHaveBeenCalled();
        expect(ingestSpy.mock.calls.length).toBe(30);
      } finally {
        ingestSpy.mockRestore();
      }
    });

    test("ingests a preset when --preset is used", async () => {
      const ingestSpy = spyOn(ingestModule, "ingestLibrary").mockResolvedValue();

      try {
        const parsed = {
          command: "ingest",
          db: dbPath,
          preset: "react",
        };

        await executeCommand(parsed);

        expect(ingestSpy).toHaveBeenCalledTimes(1);
        const call = ingestSpy.mock.calls[0];
        expect(call?.[0]).toBe("https://github.com/facebook/react");
        expect(call?.[1]).toBe(dbPath);
      } finally {
        ingestSpy.mockRestore();
      }
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

  describe("preset version defaulting", () => {
    test("--preset uses versions[0] when --version not passed", async () => {
      const ingestSpy = spyOn(ingestModule, "ingestLibrary").mockResolvedValue();

      try {
        await executeCommand({
          command: "ingest",
          db: dbPath,
          preset: "react",
        });

        expect(ingestSpy).toHaveBeenCalledTimes(1);
        const options = ingestSpy.mock.calls[0]?.[2];
        expect(options?.version).toBe("v19.2.4");
      } finally {
        ingestSpy.mockRestore();
      }
    });

    test("--preset --version overrides preset version", async () => {
      const ingestSpy = spyOn(ingestModule, "ingestLibrary").mockResolvedValue();

      try {
        await executeCommand({
          command: "ingest",
          db: dbPath,
          preset: "react",
          version: "v18.0.0",
        });

        expect(ingestSpy).toHaveBeenCalledTimes(1);
        const options = ingestSpy.mock.calls[0]?.[2];
        expect(options?.version).toBe("v18.0.0");
      } finally {
        ingestSpy.mockRestore();
      }
    });

    test("--preset without versions field defaults to undefined", async () => {
      const ingestSpy = spyOn(ingestModule, "ingestLibrary").mockResolvedValue();

      try {
        await executeCommand({
          command: "ingest",
          db: dbPath,
          preset: "express",
        });

        expect(ingestSpy).toHaveBeenCalledTimes(1);
        const options = ingestSpy.mock.calls[0]?.[2];
        expect(options?.version).toBeUndefined();
      } finally {
        ingestSpy.mockRestore();
      }
    });

    test("--preset with branch ref works correctly", async () => {
      const ingestSpy = spyOn(ingestModule, "ingestLibrary").mockResolvedValue();

      try {
        await executeCommand({
          command: "ingest",
          db: dbPath,
          preset: "laravel",
        });

        expect(ingestSpy).toHaveBeenCalledTimes(1);
        const options = ingestSpy.mock.calls[0]?.[2];
        expect(options?.version).toBe("12.x");
      } finally {
        ingestSpy.mockRestore();
      }
    });

    test("--preset-all uses per-preset versions[0]", async () => {
      const ingestSpy = spyOn(ingestModule, "ingestLibrary").mockResolvedValue();

      try {
        await executeCommand({
          command: "ingest",
          db: dbPath,
          presetAll: true,
        });

        expect(ingestSpy).toHaveBeenCalled();
        expect(ingestSpy.mock.calls.length).toBe(30);

        // Find the react call (sorted alphabetically, so find by repo URL)
        const reactCall = ingestSpy.mock.calls.find(
          (call) => call[0] === "https://github.com/facebook/react"
        );
        expect(reactCall?.[2]?.version).toBe("v19.2.4");

        // Express has no versions — should be undefined
        const expressCall = ingestSpy.mock.calls.find(
          (call) => call[0] === "https://github.com/expressjs/expressjs.com"
        );
        expect(expressCall?.[2]?.version).toBeUndefined();
      } finally {
        ingestSpy.mockRestore();
      }
    });

    test("--preset-all with --version warns and ignores the flag", async () => {
      const ingestSpy = spyOn(ingestModule, "ingestLibrary").mockResolvedValue();
      const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

      try {
        await executeCommand({
          command: "ingest",
          db: dbPath,
          presetAll: true,
          version: "v1.0.0",
        });

        expect(warnSpy).toHaveBeenCalledWith(
          "Warning: --version is ignored with --preset-all (each preset uses its own version)"
        );

        // Should still use per-preset versions, not the global v1.0.0
        const reactCall = ingestSpy.mock.calls.find(
          (call) => call[0] === "https://github.com/facebook/react"
        );
        expect(reactCall?.[2]?.version).toBe("v19.2.4");
      } finally {
        warnSpy.mockRestore();
        ingestSpy.mockRestore();
      }
    });
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
