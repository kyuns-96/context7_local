import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdirSync, rmSync, existsSync } from "fs";
import { openDatabase } from "../../src/db/connection";
import { createSchema } from "../../src/db/schema";
import { executeCommand } from "../../src/cli/index";

describe("CLI - Vectorize Command", () => {
  let testDir: string;
  let dbPath: string;

  beforeEach(() => {
    testDir = join(process.cwd(), ".tmp", `vectorize-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    dbPath = join(testDir, "test.db");

    const db = openDatabase(dbPath);
    createSchema(db);
    
    db.run(
      `INSERT INTO libraries (id, version, title, description, source_repo, total_snippets)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["/test/lib", "v1.0.0", "Test Lib", "Test library", "https://github.com/test/lib", 3]
    );
    
    db.run(
      `INSERT INTO snippets (library_id, library_version, title, content, source_path, token_count, embedding)
       VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)`,
      [
        "/test/lib", "v1.0.0", "Snippet 1", "Content 1", "doc1.md", 10, null,
        "/test/lib", "v1.0.0", "Snippet 2", "Content 2", "doc2.md", 20, JSON.stringify(new Array(384).fill(0.5)),
        "/test/lib", "v1.0.0", "Snippet 3", "Content 3", "doc3.md", 30, null,
      ]
    );
    
    db.close();
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("vectorize command", () => {
    test("throws error when db is missing", async () => {
      const parsed = {
        command: "vectorize",
      };

      await expect(executeCommand(parsed)).rejects.toThrow(
        "--db is required for vectorize command"
      );
    });

    test("vectorizes snippets without embeddings", async () => {
      const parsed = {
        command: "vectorize",
        db: dbPath,
      };

      await executeCommand(parsed);

      const db = openDatabase(dbPath, true);
      const snippetsWithEmbeddings = db
        .query("SELECT COUNT(*) as count FROM snippets WHERE embedding IS NOT NULL")
        .get() as any;
      
      expect(snippetsWithEmbeddings.count).toBe(3);
      db.close();
    }, 30000);

    test("skips snippets with existing embeddings by default", async () => {
      const parsed = {
        command: "vectorize",
        db: dbPath,
      };

      await executeCommand(parsed);

      const db = openDatabase(dbPath, true);
      const snippet2 = db
        .query("SELECT embedding FROM snippets WHERE title = ?")
        .get("Snippet 2") as any;
      
      expect(snippet2.embedding).toBe(JSON.stringify(new Array(384).fill(0.5)));
      db.close();
    }, 30000);

    test("regenerates embeddings when --force is specified", async () => {
      const parsed = {
        command: "vectorize",
        db: dbPath,
        force: true,
      };

      await executeCommand(parsed);

      const db = openDatabase(dbPath, true);
      const snippet2 = db
        .query("SELECT embedding FROM snippets WHERE title = ?")
        .get("Snippet 2") as any;
      
      expect(snippet2.embedding).not.toBe(JSON.stringify(new Array(384).fill(0.5)));
      db.close();
    }, 30000);

    test("filters by library-id when specified", async () => {
      const db = openDatabase(dbPath);
      db.run(
        `INSERT INTO libraries (id, version, title, description, source_repo, total_snippets)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ["/other/lib", "v1.0.0", "Other Lib", "Other library", "https://github.com/other/lib", 1]
      );
      db.run(
        `INSERT INTO snippets (library_id, library_version, title, content, source_path, token_count, embedding)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ["/other/lib", "v1.0.0", "Other Snippet", "Other content", "other.md", 15, null]
      );
      db.close();

      const parsed = {
        command: "vectorize",
        db: dbPath,
        libraryId: "/test/lib",
      };

      await executeCommand(parsed);

      const dbCheck = openDatabase(dbPath, true);
      const testLibSnippets = dbCheck
        .query("SELECT COUNT(*) as count FROM snippets WHERE library_id = ? AND embedding IS NOT NULL")
        .get("/test/lib") as any;
      const otherLibSnippets = dbCheck
        .query("SELECT COUNT(*) as count FROM snippets WHERE library_id = ? AND embedding IS NOT NULL")
        .get("/other/lib") as any;
      
      expect(testLibSnippets.count).toBe(3);
      expect(otherLibSnippets.count).toBe(0);
      dbCheck.close();
    }, 30000);

    test("filters by version when specified", async () => {
      const db = openDatabase(dbPath);
      db.run(
        `INSERT INTO libraries (id, version, title, description, source_repo, total_snippets)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ["/test/lib", "v2.0.0", "Test Lib", "Test library", "https://github.com/test/lib", 1]
      );
      db.run(
        `INSERT INTO snippets (library_id, library_version, title, content, source_path, token_count, embedding)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ["/test/lib", "v2.0.0", "V2 Snippet", "V2 content", "v2.md", 25, null]
      );
      db.close();

      const parsed = {
        command: "vectorize",
        db: dbPath,
        version: "v1.0.0",
      };

      await executeCommand(parsed);

      const dbCheck = openDatabase(dbPath, true);
      const v1Snippets = dbCheck
        .query("SELECT COUNT(*) as count FROM snippets WHERE library_version = ? AND embedding IS NOT NULL")
        .get("v1.0.0") as any;
      const v2Snippets = dbCheck
        .query("SELECT COUNT(*) as count FROM snippets WHERE library_version = ? AND embedding IS NOT NULL")
        .get("v2.0.0") as any;
      
      expect(v1Snippets.count).toBe(3);
      expect(v2Snippets.count).toBe(0);
      dbCheck.close();
    }, 30000);

    test("handles empty database gracefully", async () => {
      const emptyDbPath = join(testDir, "empty.db");
      const db = openDatabase(emptyDbPath);
      createSchema(db);
      db.close();

      const parsed = {
        command: "vectorize",
        db: emptyDbPath,
      };

      await executeCommand(parsed);

      const dbCheck = openDatabase(emptyDbPath, true);
      const result = dbCheck
        .query("SELECT COUNT(*) as count FROM snippets")
        .get() as any;
      expect(result.count).toBe(0);
      dbCheck.close();
    });

    test("handles database with all snippets already vectorized", async () => {
      const db = openDatabase(dbPath);
      db.run("UPDATE snippets SET embedding = ? WHERE embedding IS NULL", [
        JSON.stringify(new Array(384).fill(0.5))
      ]);
      db.close();

      const parsed = {
        command: "vectorize",
        db: dbPath,
      };

      await executeCommand(parsed);

      const dbCheck = openDatabase(dbPath, true);
      const result = dbCheck
        .query("SELECT COUNT(*) as count FROM snippets WHERE embedding IS NOT NULL")
        .get() as any;
      expect(result.count).toBe(3);
      dbCheck.close();
    });
  });
});
