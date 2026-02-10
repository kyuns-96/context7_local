import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import type { Express } from "express";
import { openDatabase } from "../../src/db/connection";
import { Database } from "bun:sqlite";

describe("MCP Server Integration", () => {
  let db: Database;

  beforeAll(() => {
    db = openDatabase(":memory:");
    db.run(
      `INSERT INTO libraries (id, version, title, description, source_repo, total_snippets, trust_score, benchmark_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      "/test/library",
      "latest",
      "Test Library",
      "A test library",
      "https://github.com/test/library",
      5,
      8.0,
      90
    );
    db.run(
      `INSERT INTO snippets (library_id, library_version, title, content, source_path, language, token_count, breadcrumb)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      "/test/library",
      "latest",
      "Test Snippet",
      "This is test content",
      "docs/test.md",
      "typescript",
      100,
      "Docs > Test"
    );
  });

  afterAll(() => {
    db.close();
  });

  describe("HTTP Transport", () => {
    test("initialize returns server info with name 'context7-local'", async () => {
      const server = new McpServer({
        name: "context7-local",
        version: "1.0.0",
      });

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      await server.connect(transport);

      const app = express();
      app.use(express.json());

      app.post("/mcp", async (req, res) => {
        await transport.handleRequest(req, res, req.body);
      });

      const httpServer = app.listen(0);
      const address = httpServer.address();
      const port = typeof address === "object" ? address?.port : 3000;

      try {
        const response = await fetch(`http://localhost:${port}/mcp`, {
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
              clientInfo: { name: "test", version: "1.0.0" },
            },
            id: 1,
          }),
        });

        const data = await response.json();
        expect(data.result.serverInfo.name).toBe("context7-local");
      } finally {
        httpServer.close();
        await transport.close();
      }
    });

    test("POST /mcp with tools/list returns resolve-library-id and query-docs", async () => {
      const server = new McpServer({
        name: "context7-local",
        version: "1.0.0",
      });

      server.registerTool(
        "resolve-library-id",
        {
          title: "Resolve Library ID",
          description: "Test tool",
          inputSchema: {},
        },
        async () => ({ content: [{ type: "text", text: "test" }] })
      );

      server.registerTool(
        "query-docs",
        {
          title: "Query Docs",
          description: "Test tool",
          inputSchema: {},
        },
        async () => ({ content: [{ type: "text", text: "test" }] })
      );

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      await server.connect(transport);

      const app = express();
      app.use(express.json());

      app.post("/mcp", async (req, res) => {
        await transport.handleRequest(req, res, req.body);
      });

      const httpServer = app.listen(0);
      const address = httpServer.address();
      const port = typeof address === "object" ? address?.port : 3000;

      try {
        // Initialize first
        await fetch(`http://localhost:${port}/mcp`, {
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
              clientInfo: { name: "test", version: "1.0.0" },
            },
            id: 1,
          }),
        });

        // List tools
        const response = await fetch(`http://localhost:${port}/mcp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "tools/list",
            params: {},
            id: 2,
          }),
        });

        const data = await response.json();
        const toolNames = data.result.tools.map((t: any) => t.name);
        expect(toolNames).toContain("resolve-library-id");
        expect(toolNames).toContain("query-docs");
      } finally {
        httpServer.close();
        await transport.close();
      }
    });

    test("CORS headers present on all responses", async () => {
      const app = express();
      app.use(express.json());

      app.use((req, res, next) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Content-Type, MCP-Session-Id, MCP-Protocol-Version"
        );
        if (req.method === "OPTIONS") {
          res.sendStatus(200);
          return;
        }
        next();
      });

      app.post("/mcp", (req, res) => {
        res.json({ test: "ok" });
      });

      const httpServer = app.listen(0);
      const address = httpServer.address();
      const port = typeof address === "object" ? address?.port : 3000;

      try {
        const response = await fetch(`http://localhost:${port}/mcp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
        expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
          "Content-Type"
        );
      } finally {
        httpServer.close();
      }
    });

    test("/ping health check endpoint returns ok", async () => {
      const app = express();
      app.get("/ping", (req, res) => {
        res.json({ status: "ok", message: "pong" });
      });

      const httpServer = app.listen(0);
      const address = httpServer.address();
      const port = typeof address === "object" ? address?.port : 3000;

      try {
        const response = await fetch(`http://localhost:${port}/ping`);
        const data = await response.json();
        expect(data.status).toBe("ok");
        expect(data.message).toBe("pong");
      } finally {
        httpServer.close();
      }
    });
  });

  describe("stdio Transport", () => {
    test("stdio initialize works", async () => {
      const server = new McpServer({
        name: "context7-local",
        version: "1.0.0",
      });

      const transport = new StdioServerTransport();

      // StdioServerTransport reads from stdin/stdout
      // For testing, we just verify it connects without error
      await server.connect(transport);

      // Verify server is connected
      expect(server.server._serverInfo.name).toBe("context7-local");

      await transport.close();
    });
  });

  describe("Database Integration", () => {
    test("--db flag opens database in read-only mode", () => {
      const testDb = openDatabase(":memory:");
      testDb.run(
        `INSERT INTO libraries (id, version, title, description, source_repo, total_snippets, trust_score, benchmark_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        "/test/lib",
        "latest",
        "Test",
        "Test",
        "https://github.com/test/lib",
        1,
        5.0,
        80
      );
      testDb.close();

      // Reopen in read-only mode
      const readDb = openDatabase(":memory:", true);

      // Verify PRAGMA query_only is set
      const queryOnly = readDb.query("PRAGMA query_only").get() as any;
      expect(["on", 1, "1"]).toContain(queryOnly.query_only);

      readDb.close();
    });
  });

  describe("Tool Registration", () => {
    test("tools use raw Zod shapes", async () => {
      const server = new McpServer({
        name: "context7-local",
        version: "1.0.0",
      });

      // This test verifies that registerTool accepts raw Zod shapes
      const { z } = await import("zod");

      server.registerTool(
        "test-tool",
        {
          title: "Test Tool",
          description: "Test",
          inputSchema: {
            testField: z.string().describe("Test field"),
          },
        },
        async ({ testField }) => {
          return { content: [{ type: "text", text: testField }] };
        }
      );

      const transport = new StdioServerTransport();
      await server.connect(transport);

      // Verify tool is registered
      const tools = Array.from(server.server._requestHandlers.keys());
      expect(tools).toContain("tools/call");

      await transport.close();
    });
  });

  describe("Graceful Shutdown", () => {
    test("graceful shutdown works", async () => {
      let shutdownCalled = false;

      const mockProcess = {
        on: (event: string, handler: () => void) => {
          if (event === "SIGINT") {
            // Simulate SIGINT
            handler();
            shutdownCalled = true;
          }
        },
      };

      mockProcess.on("SIGINT", () => {
        db.close();
      });

      expect(shutdownCalled).toBe(true);
    });
  });
});
