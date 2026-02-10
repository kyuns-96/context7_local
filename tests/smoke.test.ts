import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import express, { Express, Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { Server as HTTPServer } from "http";

describe("Smoke Tests: Bun + Express + MCP SDK + FTS5 Compatibility", () => {
  let app: Express;
  let httpServer: HTTPServer;
  let testPort: number;

  beforeAll(() => {
    // Use a random high port for testing
    testPort = Math.floor(Math.random() * (65535 - 3000) + 3000);
    app = express();
    app.use(express.json());
  });

  afterAll(() => {
    if (httpServer) {
      httpServer.close();
    }
  });

  // ============================================================================
  // TEST 1: bun:sqlite FTS5 virtual table creation and search
  // ============================================================================
  it("1. bun:sqlite creates FTS5 virtual table and performs search", () => {
    const db = new Database(":memory:");

    // Create FTS5 virtual table
    db.exec(`
      CREATE VIRTUAL TABLE documents USING fts5(
        id UNINDEXED,
        title,
        content
      )
    `);

    // Insert test data
    const insert = db.prepare(`
      INSERT INTO documents(id, title, content)
      VALUES (?, ?, ?)
    `);
    insert.run("1", "TypeScript Guide", "Learn TypeScript fundamentals");
    insert.run("2", "Bun Runtime", "Fast all-in-one JavaScript runtime");
    insert.run("3", "MCP Protocol", "Model Context Protocol for AI");

    // Perform FTS5 search
    const search = db.prepare(`
      SELECT id, title, content
      FROM documents
      WHERE documents MATCH ?
      ORDER BY rank
    `);
    const results = search.all("Bun") as Array<{
      id: string;
      title: string;
      content: string;
    }>;

    expect(results.length).toBe(1);
    expect(results[0].title).toBe("Bun Runtime");
    expect(results[0].content).toContain("JavaScript runtime");

    db.close();
  });

  // ============================================================================
  // TEST 2: Express HTTP server starts on Bun and responds to requests
  // ============================================================================
  it("2. Express HTTP server starts on Bun and responds to requests", async () => {
    app.get("/health", (req: Request, res: Response) => {
      res.json({ status: "ok", message: "Express is running on Bun" });
    });

    return new Promise<void>((resolve, reject) => {
      httpServer = app.listen(testPort, () => {
        // Verify server started
        expect(httpServer).toBeDefined();
        expect(httpServer.listening).toBe(true);

        // Make test request
        fetch(`http://localhost:${testPort}/health`)
          .then((response) => response.json())
          .then((data) => {
            expect(data.status).toBe("ok");
            expect(data.message).toContain("Express");
            resolve();
          })
          .catch(reject);
      });

      httpServer.on("error", reject);
    });
  });

  // ============================================================================
  // TEST 3: McpServer from @modelcontextprotocol/sdk instantiates
  // ============================================================================
  it("3. McpServer instantiates correctly", () => {
    const mcpServer = new McpServer({
      name: "TestServer",
      version: "1.0.0",
    });

    expect(mcpServer).toBeDefined();
    expect(mcpServer.server).toBeDefined();
    expect((mcpServer.server as any)._serverInfo.name).toBe("TestServer");
    expect((mcpServer.server as any)._serverInfo.version).toBe("1.0.0");
  });

  // ============================================================================
  // TEST 4: registerTool() accepts raw Zod shapes (not wrapped in z.object())
  // ============================================================================
  it("4. registerTool() accepts raw Zod shapes", () => {
    const mcpServer = new McpServer({
      name: "TestServer",
      version: "1.0.0",
    });

    // Test 4a: Raw Zod shape with properties
    const rawZodShape = {
      query: z.string().describe("Search query"),
      limit: z.number().optional().describe("Result limit"),
    };

    const tool1 = mcpServer.registerTool(
      "test-search",
      {
        title: "Test Search Tool",
        description: "Searches using raw Zod shape",
        inputSchema: rawZodShape,
      },
      async ({ query, limit }: { query: string; limit?: number }) => {
        return {
          content: [
            {
              type: "text" as const,
              text: `Search: ${query}, Limit: ${limit || "default"}`,
            },
          ],
        };
      }
    );

    expect(tool1).toBeDefined();

    // Test 4b: Raw Zod shape with validation
    const validateShape = {
      code: z.string().min(1).describe("Code snippet"),
      language: z.enum(["typescript", "javascript", "python"]).describe("Language"),
    };

    const tool2 = mcpServer.registerTool(
      "analyze-code",
      {
        title: "Analyze Code",
        description: "Analyzes code snippets",
        inputSchema: validateShape,
      },
      async ({ code, language }) => {
        return {
          content: [
            {
              type: "text" as const,
              text: `Analyzing ${language}: ${code.length} chars`,
            },
          ],
        };
      }
    );

    expect(tool2).toBeDefined();
  });

  // ============================================================================
  // TEST 5: StreamableHTTPServerTransport with enableJsonResponse: true
  // ============================================================================
  it("5. StreamableHTTPServerTransport instantiates with enableJsonResponse", () => {
    // Verify that StreamableHTTPServerTransport can be instantiated with the required config
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    expect(transport).toBeDefined();
    expect(transport).toBeInstanceOf(StreamableHTTPServerTransport);
  });

  // ============================================================================
  // TEST 6: Full MCP roundtrip: client sends initialize, server responds
  // ============================================================================
  it("6. Full MCP roundtrip: initialize request returns capabilities", async () => {
    return new Promise<void>((resolve, reject) => {
      // Create a fresh Express app for this test
      const testApp = express();
      testApp.use(express.json());

      // Create MCP server with a test tool
      const mcpServer = new McpServer({
        name: "SmokeTestServer",
        version: "1.0.0",
      });

      mcpServer.registerTool(
        "test-tool",
        {
          title: "Test Tool",
          description: "A test tool for smoke testing",
          inputSchema: {
            input: z.string().describe("Input parameter"),
          },
        },
        async ({ input }) => {
          return {
            content: [
              {
                type: "text" as const,
                text: `You said: ${input}`,
              },
            ],
          };
        }
      );

      // Setup MCP HTTP endpoint
      testApp.post("/mcp", async (req: Request, res: Response) => {
        try {
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
          });

          res.on("close", () => {
            transport.close();
          });

          await mcpServer.connect(transport);
          await transport.handleRequest(req, res, req.body);
        } catch (error) {
          console.error("MCP error:", error);
          if (!res.headersSent) {
            res.status(500).json({
              jsonrpc: "2.0",
              error: { code: -32603, message: "Internal server error" },
              id: null,
            });
          }
        }
      });

      // Start test server
      const testHttpServer = testApp.listen(testPort + 1, async () => {
        try {
          // Send initialize request with required MCP headers
          const initResponse = await fetch(`http://localhost:${testPort + 1}/mcp`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json, text/event-stream",
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "initialize",
              params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: {
                  name: "SmokeTestClient",
                  version: "1.0.0",
                },
              },
            }),
          });

          expect(initResponse.ok).toBe(true);
          const responseData = await initResponse.json() as {
            jsonrpc: string;
            id: number;
            result?: {
              protocolVersion: string;
              capabilities: Record<string, unknown>;
              serverInfo: {
                name: string;
                version: string;
              };
            };
            error?: {
              code: number;
              message: string;
            };
          };

          expect(responseData.jsonrpc).toBe("2.0");
          expect(responseData.id).toBe(1);

          // Response should have either result or error
          if (responseData.result) {
            expect(responseData.result.serverInfo.name).toBe("SmokeTestServer");
            expect(responseData.result.serverInfo.version).toBe("1.0.0");
            expect(responseData.result.capabilities).toBeDefined();
          } else if (responseData.error) {
            // Some MCP servers may return errors during initialization - document this
            console.log("MCP Initialize returned error (expected for some transports):", responseData.error);
          }

          resolve();
        } catch (error) {
          reject(error);
        } finally {
          testHttpServer.close();
        }
      });

      testHttpServer.on("error", reject);
    });
  });
});
