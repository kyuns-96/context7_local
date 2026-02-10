#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Command } from "commander";
import express from "express";
import { z } from "zod";
import { openDatabase } from "../db/connection";
import { handleResolveLibraryId, handleQueryDocs } from "./tools";
import type { Database } from "bun:sqlite";

const DEFAULT_PORT = 3000;
const SERVER_NAME = "context7-local";

const pkg = {
  version: "1.0.0",
};

const program = new Command()
  .option("--transport <stdio|http>", "transport type", "stdio")
  .option("--port <number>", "port for HTTP transport", DEFAULT_PORT.toString())
  .option("--db <path>", "database path", ":memory:")
  .parse(process.argv);

const options = program.opts<{
  transport: string;
  port: string;
  db: string;
}>();

const TRANSPORT_TYPE = options.transport as "stdio" | "http";
const PORT = parseInt(options.port, 10) || DEFAULT_PORT;
const DB_PATH = options.db;

let db: Database;

function setupDatabase() {
  db = openDatabase(DB_PATH, true);
}

function createServer() {
  const server = new McpServer({
    name: SERVER_NAME,
    version: pkg.version,
  });

  server.registerTool(
    "resolve-library-id",
    {
      title: "Resolve Context7 Library ID",
      description: `Resolves a package/product name to a Context7-compatible library ID and returns matching libraries.

You MUST call this function before 'query-docs' to obtain a valid Context7-compatible library ID UNLESS the user explicitly provides a library ID in the format '/org/project' or '/org/project/version' in their query.

Selection Process:
1. Analyze the query to understand what library/package the user is looking for
2. Return the most relevant match based on:
- Name similarity to the query (exact matches prioritized)
- Description relevance to the query's intent
- Documentation coverage (prioritize libraries with higher Code Snippet counts)
- Source reputation (consider libraries with High or Medium reputation more authoritative)
- Benchmark Score: Quality indicator (100 is the highest score)

Response Format:
- Return the selected library ID in a clearly marked section
- Provide a brief explanation for why this library was chosen
- If multiple good matches exist, acknowledge this but proceed with the most relevant one
- If no good matches exist, clearly state this and suggest query refinements

For ambiguous queries, request clarification before proceeding with a best-guess match.

IMPORTANT: Do not call this tool more than 3 times per question. If you cannot find what you need after 3 calls, use the best result you have.`,
      inputSchema: {
        query: z
          .string()
          .describe(
            "The user's original question or task. This is used to rank library results by relevance to what the user is trying to accomplish. IMPORTANT: Do not include any sensitive or confidential information such as API keys, passwords, credentials, or personal data in your query."
          ),
        libraryName: z
          .string()
          .describe("Library name to search for and retrieve a Context7-compatible library ID."),
      },
    },
    async ({ query, libraryName }) => {
      return handleResolveLibraryId({ query, libraryName }, db);
    }
  );

  server.registerTool(
    "query-docs",
    {
      title: "Query Documentation",
      description: `Retrieves and queries up-to-date documentation and code examples from Context7 for any programming library or framework.

You must call 'resolve-library-id' first to obtain the exact Context7-compatible library ID required to use this tool, UNLESS the user explicitly provides a library ID in the format '/org/project' or '/org/project/version' in their query.

IMPORTANT: Do not call this tool more than 3 times per question. If you cannot find what you need after 3 calls, use the best information you have.`,
      inputSchema: {
        libraryId: z
          .string()
          .describe(
            "Exact Context7-compatible library ID (e.g., '/mongodb/docs', '/vercel/next.js', '/supabase/supabase', '/vercel/next.js/v14.3.0-canary.87') retrieved from 'resolve-library-id' or directly from user query in the format '/org/project' or '/org/project/version'."
          ),
        query: z
          .string()
          .describe(
            "The question or task you need help with. Be specific and include relevant details. Good: 'How to set up authentication with JWT in Express.js' or 'React useEffect cleanup function examples'. Bad: 'auth' or 'hooks'. IMPORTANT: Do not include any sensitive or confidential information such as API keys, passwords, credentials, or personal data in your query."
          ),
      },
    },
    async ({ query, libraryId }) => {
      return handleQueryDocs({ query, libraryId }, db);
    }
  );

  return server;
}

async function startHttpServer() {
  const server = createServer();
  const app = express();

  app.use(express.json());

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS,DELETE");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, MCP-Session-Id, MCP-Protocol-Version"
    );
    res.setHeader("Access-Control-Expose-Headers", "MCP-Session-Id");

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.post("/mcp", async (req, res) => {
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      res.on("close", () => {
        transport.close();
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  app.get("/ping", (req, res) => {
    res.json({ status: "ok", message: "pong" });
  });

  const httpServer = app.listen(PORT, () => {
    console.error(`${SERVER_NAME} v${pkg.version} running on HTTP at http://localhost:${PORT}/mcp`);
  });

  process.on("SIGINT", () => {
    httpServer.close();
    db.close();
    process.exit(0);
  });
}

async function startStdioServer() {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error(`${SERVER_NAME} v${pkg.version} running on stdio`);

  process.on("SIGINT", () => {
    transport.close();
    db.close();
    process.exit(0);
  });
}

async function main() {
  setupDatabase();

  if (TRANSPORT_TYPE === "http") {
    await startHttpServer();
  } else {
    await startStdioServer();
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
