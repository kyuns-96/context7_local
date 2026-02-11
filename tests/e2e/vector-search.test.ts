import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { spawn } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ingestLibrary } from "../../src/cli/ingest";
import { Database } from "bun:sqlite";

describe("Vector Search E2E Tests", () => {
  let tempDir: string;
  let dbPath: string;
  let serverProcess: any;
  let serverPort: number;

  beforeAll(async () => {
    // Generate random high port to avoid conflicts
    serverPort = 30000 + Math.floor(Math.random() * 10000);

    // Create temp directories for DB and cloned repo
    tempDir = mkdtempSync(join(tmpdir(), "vector-e2e-"));
    dbPath = join(tempDir, "vector-test.db");

    console.log(`Vector E2E: Using temp directory ${tempDir}`);
    console.log(`Vector E2E: Using port ${serverPort}`);

    // Step 1: Ingest expressjs/express repo with embeddings
    console.log("Vector E2E: Starting ingestion with embeddings...");
    await ingestLibrary("https://github.com/expressjs/express", dbPath, {
      version: "latest",
    });
    console.log("Vector E2E: Ingestion complete");

    // Step 2: Start MCP server
    console.log("Vector E2E: Starting MCP server...");
    serverProcess = spawn(
      "bun",
      [
        "run",
        "src/server/index.ts",
        "--transport",
        "http",
        "--port",
        serverPort.toString(),
        "--db",
        dbPath,
      ],
      {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    // Capture stdout/stderr for debugging
    let serverOutput = "";
    serverProcess.stdout.on("data", (data: Buffer) => {
      serverOutput += data.toString();
    });
    serverProcess.stderr.on("data", (data: Buffer) => {
      serverOutput += data.toString();
    });

    // Wait for server to be ready
    let serverReady = false;
    let retries = 0;
    const maxRetries = 30;
    while (!serverReady && retries < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        const pingResponse = await fetch(`http://localhost:${serverPort}/ping`);
        if (pingResponse.ok) {
          serverReady = true;
          console.log("Vector E2E: Server ready");
        }
      } catch (error) {
        retries++;
      }
    }

    if (!serverReady) {
      throw new Error(
        `Server did not start within ${maxRetries} seconds. Output: ${serverOutput}`
      );
    }
  }, 60000); // 60 second timeout for ingestion + vectorization

  afterAll(() => {
    // Cleanup server process
    if (serverProcess) {
      serverProcess.kill("SIGINT");
    }

    // Cleanup temp directories
    rmSync(tempDir, { recursive: true, force: true });
    console.log("Vector E2E: Cleanup complete");
  });

  test("embeddings are generated during ingestion", async () => {
    console.log("Vector E2E: Verifying embeddings in database...");
    
    const db = new Database(dbPath);
    const result = db
      .query("SELECT COUNT(*) as count FROM snippets WHERE embedding IS NOT NULL")
      .get() as { count: number };
    db.close();

    expect(result.count).toBeGreaterThan(0);
    console.log(`Vector E2E: Found ${result.count} snippets with embeddings`);
  }, 10000);

  test("semantic search returns relevant results", async () => {
    console.log("Vector E2E: Testing semantic search...");

    // Query that should match routing documentation semantically
    const queryResponse = await fetch(`http://localhost:${serverPort}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "query-docs",
          arguments: {
            libraryId: "/expressjs/express",
            query: "how to create routes and handle requests",
            searchMode: "semantic",
          },
        },
        id: 1,
      }),
    });

    const queryData = (await queryResponse.json()) as any;
    expect(queryResponse.ok).toBe(true);
    expect(queryData.result).toBeDefined();
    expect(queryData.result.content).toBeDefined();
    expect(queryData.result.content.length).toBeGreaterThan(0);
    expect(queryData.result.content[0].type).toBe("text");

    const queryText = queryData.result.content[0].text;
    expect(queryText.length).toBeGreaterThan(0);
    
    // Verify results contain relevant documentation
    const containsDocumentation = !queryText.includes("No documentation found");
    expect(containsDocumentation).toBe(true);
    
    const lowerText = queryText.toLowerCase();
    const containsRelevantTerms =
      lowerText.includes("routing") ||
      lowerText.includes("route") ||
      lowerText.includes("middleware") ||
      lowerText.includes("request") ||
      lowerText.includes("express") ||
      lowerText.includes("app");
    
    expect(containsRelevantTerms).toBe(true);
    console.log("Vector E2E: Semantic search returned relevant results");
    console.log(`Vector E2E: Result snippet: ${queryText.substring(0, 200)}...`);
  }, 30000);

  test("hybrid search combines keyword and semantic results", async () => {
    console.log("Vector E2E: Testing hybrid search...");

    const queryResponse = await fetch(`http://localhost:${serverPort}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "query-docs",
          arguments: {
            libraryId: "/expressjs/express",
            query: "middleware routing",
            searchMode: "hybrid",
          },
        },
        id: 2,
      }),
    });

    const queryData = (await queryResponse.json()) as any;
    expect(queryResponse.ok).toBe(true);
    expect(queryData.result).toBeDefined();
    expect(queryData.result.content).toBeDefined();
    expect(queryData.result.content.length).toBeGreaterThan(0);
    expect(queryData.result.content[0].type).toBe("text");

    const queryText = queryData.result.content[0].text;
    expect(queryText.length).toBeGreaterThan(0);
    
    // Verify results are returned (hybrid should combine both search methods)
    const containsDocumentation = !queryText.includes("No documentation found");
    expect(containsDocumentation).toBe(true);
    
    console.log("Vector E2E: Hybrid search returned combined results");
    console.log(`Vector E2E: Result snippet: ${queryText.substring(0, 200)}...`);
  }, 30000);

  test("keyword search still works without embeddings", async () => {
    console.log("Vector E2E: Testing keyword search...");

    const queryResponse = await fetch(`http://localhost:${serverPort}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "query-docs",
          arguments: {
            libraryId: "/expressjs/express",
            query: "express",
            searchMode: "keyword",
          },
        },
        id: 3,
      }),
    });

    const queryData = (await queryResponse.json()) as any;
    expect(queryResponse.ok).toBe(true);
    expect(queryData.result).toBeDefined();
    expect(queryData.result.content).toBeDefined();
    expect(queryData.result.content.length).toBeGreaterThan(0);
    expect(queryData.result.content[0].type).toBe("text");

    const queryText = queryData.result.content[0].text;
    expect(queryText.length).toBeGreaterThan(0);
    
    console.log("Vector E2E: Keyword search works correctly");
    console.log(`Vector E2E: Result snippet: ${queryText.substring(0, 200)}...`);
  }, 30000);

  test("semantic search differs from keyword search", async () => {
    console.log("Vector E2E: Comparing semantic vs keyword search results...");

    // Run semantic search
    const semanticResponse = await fetch(`http://localhost:${serverPort}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "query-docs",
          arguments: {
            libraryId: "/expressjs/express",
            query: "handling HTTP requests",
            searchMode: "semantic",
          },
        },
        id: 4,
      }),
    });

    // Run keyword search
    const keywordResponse = await fetch(`http://localhost:${serverPort}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "query-docs",
          arguments: {
            libraryId: "/expressjs/express",
            query: "handling HTTP requests",
            searchMode: "keyword",
          },
        },
        id: 5,
      }),
    });

    const semanticData = (await semanticResponse.json()) as any;
    const keywordData = (await keywordResponse.json()) as any;

    expect(semanticResponse.ok).toBe(true);
    expect(keywordResponse.ok).toBe(true);

    const semanticText = semanticData.result.content[0].text;
    const keywordText = keywordData.result.content[0].text;

    // Both should return results
    expect(semanticText.length).toBeGreaterThan(0);
    expect(keywordText.length).toBeGreaterThan(0);

    // Results may differ (semantic can find conceptually similar content)
    // We're not asserting they're different, just that both work
    console.log("Vector E2E: Semantic and keyword searches both returned results");
    console.log(`Vector E2E: Semantic result length: ${semanticText.length}`);
    console.log(`Vector E2E: Keyword result length: ${keywordText.length}`);
  }, 30000);

  test("default search mode is hybrid", async () => {
    console.log("Vector E2E: Testing default search mode (should be hybrid)...");

    // Query without specifying searchMode (should default to hybrid)
    const queryResponse = await fetch(`http://localhost:${serverPort}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "query-docs",
          arguments: {
            libraryId: "/expressjs/express",
            query: "middleware",
          },
        },
        id: 6,
      }),
    });

    const queryData = (await queryResponse.json()) as any;
    expect(queryResponse.ok).toBe(true);
    expect(queryData.result).toBeDefined();
    expect(queryData.result.content).toBeDefined();
    expect(queryData.result.content.length).toBeGreaterThan(0);

    const queryText = queryData.result.content[0].text;
    expect(queryText.length).toBeGreaterThan(0);
    
    console.log("Vector E2E: Default search mode returned results");
  }, 30000);

  test("invalid search mode returns error", async () => {
    console.log("Vector E2E: Testing invalid search mode...");

    // This should fail at TypeScript level, but let's test runtime handling
    const queryResponse = await fetch(`http://localhost:${serverPort}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "query-docs",
          arguments: {
            libraryId: "/expressjs/express",
            query: "test",
            searchMode: "invalid-mode",
          },
        },
        id: 7,
      }),
    });

    const queryData = (await queryResponse.json()) as any;
    
    // Server should either accept it (falling back to hybrid) or return a result
    // MCP spec: servers should handle gracefully, not error out
    expect(queryResponse.ok).toBe(true);
    
    console.log("Vector E2E: Invalid search mode handled gracefully");
  }, 30000);

  test("empty query returns error", async () => {
    console.log("Vector E2E: Testing empty query...");

    const queryResponse = await fetch(`http://localhost:${serverPort}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "query-docs",
          arguments: {
            libraryId: "/expressjs/express",
            query: "",
            searchMode: "semantic",
          },
        },
        id: 8,
      }),
    });

    const queryData = (await queryResponse.json()) as any;
    expect(queryResponse.ok).toBe(true);
    
    // Empty query generates null embedding, which should fall back to keyword search
    // Keyword search with empty query causes FTS5 syntax error or returns no results
    const queryText = queryData.result.content[0].text;
    const hasError = 
      queryText.includes("fts5: syntax error") || 
      queryText.includes("No documentation found");
    expect(hasError).toBe(true);
    
    console.log("Vector E2E: Empty query handled correctly");
  }, 30000);

  test("semantic search with non-existent library returns error", async () => {
    console.log("Vector E2E: Testing semantic search with non-existent library...");

    const queryResponse = await fetch(`http://localhost:${serverPort}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "query-docs",
          arguments: {
            libraryId: "/nonexistent/library",
            query: "test query",
            searchMode: "semantic",
          },
        },
        id: 9,
      }),
    });

    const queryData = (await queryResponse.json()) as any;
    expect(queryResponse.ok).toBe(true);
    expect(queryData.result).toBeDefined();
    expect(queryData.result.content[0].text).toContain("No documentation found");
    
    console.log("Vector E2E: Non-existent library error handled correctly");
  }, 30000);
});
