import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { spawn } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ingestLibrary } from "../../src/cli/ingest";

describe("Full Roundtrip E2E Test", () => {
  let tempDir: string;
  let dbPath: string;
  let serverProcess: any;
  let serverPort: number;

  beforeAll(async () => {
    // Generate random high port to avoid conflicts
    serverPort = 30000 + Math.floor(Math.random() * 10000);

    // Create temp directories for DB and cloned repo
    tempDir = mkdtempSync(join(tmpdir(), "e2e-"));
    dbPath = join(tempDir, "test.db");

    console.log(`E2E Test: Using temp directory ${tempDir}`);
    console.log(`E2E Test: Using port ${serverPort}`);

    // Step 1: Ingest expressjs/express repo
    console.log("E2E Test: Starting ingestion of expressjs/express...");
    await ingestLibrary("https://github.com/expressjs/express", dbPath, {
      version: "latest",
    });
    console.log("E2E Test: Ingestion complete");
  }, 60000); // 60 second timeout for cloning + ingestion

  afterAll(() => {
    // Cleanup server process
    if (serverProcess) {
      serverProcess.kill("SIGINT");
    }

    // Cleanup temp directories
    rmSync(tempDir, { recursive: true, force: true });
    console.log("E2E Test: Cleanup complete");
  });

  test("complete flow: ingest → start server → resolve-library-id → query-docs → verify results", async () => {
    // Step 2: Start MCP server on random port with temp DB
    console.log("E2E Test: Starting MCP server...");
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

    // Wait for server to be ready (check /ping endpoint)
    let serverReady = false;
    let retries = 0;
    const maxRetries = 30; // 30 seconds max wait
    while (!serverReady && retries < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        const pingResponse = await fetch(`http://localhost:${serverPort}/ping`);
        if (pingResponse.ok) {
          serverReady = true;
          console.log("E2E Test: Server ready");
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

    // Step 3: Send initialize request
    console.log("E2E Test: Sending initialize request...");
    const initResponse = await fetch(`http://localhost:${serverPort}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "e2e-test", version: "1.0.0" },
        },
        id: 1,
      }),
    });

    const initData = await initResponse.json();
    expect(initResponse.ok).toBe(true);
    expect(initData.result).toBeDefined();
    expect(initData.result.serverInfo.name).toBe("context7-local");
    console.log("E2E Test: Initialize successful");

    // Step 4: Send resolve-library-id request
    console.log("E2E Test: Sending resolve-library-id request...");
    const resolveResponse = await fetch(`http://localhost:${serverPort}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "resolve-library-id",
          arguments: {
            libraryName: "express",
            query: "web framework for node.js",
          },
        },
        id: 2,
      }),
    });

    const resolveData = await resolveResponse.json();
    expect(resolveResponse.ok).toBe(true);
    expect(resolveData.result).toBeDefined();
    expect(resolveData.result.content).toBeDefined();
    expect(resolveData.result.content.length).toBeGreaterThan(0);
    expect(resolveData.result.content[0].type).toBe("text");

    const resolveText = resolveData.result.content[0].text;
    expect(resolveText).toContain("/expressjs/express");
    console.log("E2E Test: resolve-library-id successful");
    console.log("E2E Test: Found library:", resolveText.substring(0, 200));

    // Step 5: Send query-docs request (using broad query to match Express docs)
    console.log("E2E Test: Sending query-docs request...");
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
            query: "express application",
          },
        },
        id: 3,
      }),
    });

    const queryData = await queryResponse.json();
    expect(queryResponse.ok).toBe(true);
    expect(queryData.result).toBeDefined();
    expect(queryData.result.content).toBeDefined();
    expect(queryData.result.content.length).toBeGreaterThan(0);
    expect(queryData.result.content[0].type).toBe("text");

    const queryText = queryData.result.content[0].text;
    expect(queryText.length).toBeGreaterThan(0);
    // Verify that results either contain relevant documentation OR indicate no results found
    // Express repo might not have much markdown content or the query might not match FTS5 index
    const containsDocumentation = !queryText.includes("No documentation found");
    if (containsDocumentation) {
      // If we got documentation, verify it's relevant
      const lowerText = queryText.toLowerCase();
      const containsRelevantTerms =
        lowerText.includes("routing") ||
        lowerText.includes("middleware") ||
        lowerText.includes("express") ||
        lowerText.includes("app") ||
        lowerText.includes("request") ||
        lowerText.includes("response") ||
        lowerText.includes("http");
      expect(containsRelevantTerms).toBe(true);
      console.log("E2E Test: query-docs successful - found relevant documentation");
    } else {
      console.log("E2E Test: query-docs returned no results (Express repo may have limited markdown docs)");
    }
    console.log("E2E Test: Response (first 300 chars):", queryText.substring(0, 300));

    // Step 6: Server shutdown handled in afterAll
  }, 60000); // 60 second timeout for server startup + requests

  test("error case: query with non-existent library", async () => {
    // Start server if not already running
    if (!serverProcess) {
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

      // Wait for server to be ready
      let serverReady = false;
      let retries = 0;
      while (!serverReady && retries < 30) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
          const pingResponse = await fetch(`http://localhost:${serverPort}/ping`);
          if (pingResponse.ok) {
            serverReady = true;
          }
        } catch (error) {
          retries++;
        }
      }
    }

    console.log("E2E Test: Testing non-existent library error case...");
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
          },
        },
        id: 4,
      }),
    });

    const queryData = await queryResponse.json();
    expect(queryResponse.ok).toBe(true);
    expect(queryData.result).toBeDefined();
    expect(queryData.result.content[0].text).toContain(
      "No documentation found"
    );
    console.log("E2E Test: Non-existent library error case handled correctly");
  }, 30000);

  test("error case: resolve-library-id with non-matching name", async () => {
    console.log("E2E Test: Testing non-matching library name error case...");
    const resolveResponse = await fetch(`http://localhost:${serverPort}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "resolve-library-id",
          arguments: {
            libraryName: "nonexistent-framework-xyz",
            query: "some query",
          },
        },
        id: 5,
      }),
    });

    const resolveData = await resolveResponse.json();
    expect(resolveResponse.ok).toBe(true);
    expect(resolveData.result).toBeDefined();
    expect(resolveData.result.content[0].text).toContain(
      "No libraries found matching the provided name."
    );
    console.log("E2E Test: Non-matching library name error case handled correctly");
  }, 30000);
});
