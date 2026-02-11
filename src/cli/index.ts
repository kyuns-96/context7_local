import { Command } from "commander";
import { existsSync, rmSync } from "fs";
import { join } from "path";
import { openDatabase } from "../db/connection";
import { ingestLibrary, type IngestOptions } from "./ingest";
import {
  cloneRepo,
  listMarkdownFiles,
  buildLibraryId,
} from "../scraper/github";
import { parseMarkdown } from "../scraper/markdown";
import { chunkDocument } from "../scraper/chunker";
import { generateEmbeddings } from "../embeddings/generator";
import { initializeProvider } from "../embeddings/generator";

export interface ParsedCommand {
  command: string;
  repoUrl?: string;
  db?: string;
  version?: string;
  docsPath?: string;
  preset?: string;
  presetAll?: boolean;
  libraryId?: string;
  force?: boolean;
  embeddingProvider?: 'local' | 'openai';
  embeddingApiKey?: string;
  embeddingModel?: string;
  embeddingApiUrl?: string;
}

export function parseCliCommand(args: string[]): ParsedCommand {
  const program = new Command();

  program.name("local-context7").description("Local Context7 MCP server CLI");

  let parsedResult: ParsedCommand = { command: "" };

  program
    .command("ingest")
    .description("Ingest a library from a GitHub repository")
    .argument("[repo-url]", "GitHub repository URL")
    .requiredOption("--db <path>", "Path to SQLite database file")
    .option("--version <tag>", "Git tag or branch name to checkout")
    .option("--docs-path <glob>", "Path to documentation directory")
    .option("--preset <name>", "Use a preset library configuration")
    .option("--preset-all", "Ingest all preset libraries")
    .option("--embedding-provider <provider>", "Embedding provider: 'local' or 'openai'", "local")
    .option("--embedding-api-key <key>", "API key for embedding provider")
    .option("--embedding-model <model>", "Embedding model name")
    .option("--embedding-api-url <url>", "Custom API endpoint URL")
    .action((repoUrl, options) => {
      if (!options.presetAll && !repoUrl) {
        throw new Error("repo-url is required unless --preset-all is used");
      }

      parsedResult = {
        command: "ingest",
        repoUrl,
        db: options.db,
        version: options.version,
        docsPath: options.docsPath,
        preset: options.preset,
        presetAll: options.presetAll,
        embeddingProvider: options.embeddingProvider,
        embeddingApiKey: options.embeddingApiKey,
        embeddingModel: options.embeddingModel,
        embeddingApiUrl: options.embeddingApiUrl,
      };
    });

  program
    .command("list")
    .description("List all ingested libraries")
    .requiredOption("--db <path>", "Path to SQLite database file")
    .action((options) => {
      parsedResult = {
        command: "list",
        db: options.db,
      };
    });

  program
    .command("remove")
    .description("Remove a library and its snippets")
    .argument("<library-id>", "Library ID (e.g., /org/repo)")
    .requiredOption("--db <path>", "Path to SQLite database file")
    .option("--version <version>", "Specific version to remove")
    .action((libraryId, options) => {
      parsedResult = {
        command: "remove",
        libraryId,
        db: options.db,
        version: options.version,
      };
    });

  program
    .command("preview")
    .description("Preview library chunks without ingestion")
    .argument("<repo-url>", "GitHub repository URL")
    .option("--docs-path <glob>", "Path to documentation directory")
    .action((repoUrl, options) => {
      parsedResult = {
        command: "preview",
        repoUrl,
        docsPath: options.docsPath,
      };
    });

  program
    .command("vectorize")
    .description("Generate embeddings for existing documentation snippets")
    .requiredOption("--db <path>", "Path to SQLite database file")
    .option("--library-id <id>", "Only vectorize snippets for specific library")
    .option("--version <version>", "Only vectorize snippets for specific version")
    .option("--force", "Regenerate embeddings even if they already exist")
    .option("--embedding-provider <provider>", "Embedding provider: 'local' or 'openai'", "local")
    .option("--embedding-api-key <key>", "API key for embedding provider")
    .option("--embedding-model <model>", "Embedding model name")
    .option("--embedding-api-url <url>", "Custom API endpoint URL")
    .action((options) => {
      parsedResult = {
        command: "vectorize",
        db: options.db,
        libraryId: options.libraryId,
        version: options.version,
        force: options.force,
        embeddingProvider: options.embeddingProvider,
        embeddingApiKey: options.embeddingApiKey,
        embeddingModel: options.embeddingModel,
        embeddingApiUrl: options.embeddingApiUrl,
      };
    });

  program.exitOverride((err) => {
    throw new Error(err.message);
  });

  program.parse(args, { from: "user" });

  if (!parsedResult.command) {
    throw new Error("No command specified");
  }

  return parsedResult;
}

export async function executeCommand(parsed: ParsedCommand): Promise<void> {
  switch (parsed.command) {
    case "ingest":
      await handleIngest(parsed);
      break;
    case "list":
      await handleList(parsed);
      break;
    case "remove":
      await handleRemove(parsed);
      break;
    case "preview":
      await handlePreview(parsed);
      break;
    case "vectorize":
      await handleVectorize(parsed);
      break;
    default:
      throw new Error(`Unknown command: ${parsed.command}`);
  }
}

async function handleIngest(parsed: ParsedCommand): Promise<void> {
  if (!parsed.db) {
    throw new Error("--db is required for ingest command");
  }

  if (parsed.presetAll) {
    throw new Error("--preset-all is not yet implemented");
  }

  if (parsed.preset) {
    throw new Error("--preset is not yet implemented");
  }

  if (!parsed.repoUrl) {
    throw new Error("repo-url is required for ingest command");
  }

  // Initialize embedding provider with CLI options or env vars
  initializeProvider({
    provider: parsed.embeddingProvider as 'local' | 'openai' | undefined,
    apiKey: parsed.embeddingApiKey,
    model: parsed.embeddingModel,
    apiUrl: parsed.embeddingApiUrl,
  });

  const options: IngestOptions = {
    version: parsed.version,
    docsPath: parsed.docsPath,
  };

  await ingestLibrary(parsed.repoUrl, parsed.db, options);
}

async function handleList(parsed: ParsedCommand): Promise<void> {
  if (!parsed.db) {
    throw new Error("--db is required for list command");
  }

  const db = openDatabase(parsed.db, true);

  const libraries = db
    .query(
      `SELECT id, version, total_snippets, ingested_at
       FROM libraries
       ORDER BY id, version`
    )
    .all();

  db.close();

  if (libraries.length === 0) {
    console.log("No libraries found.");
    return;
  }

  console.log("\nLibrary ID            | Version    | Snippets | Ingested At");
  console.log(
    "-------------------------------------------------------------------"
  );

  for (const lib of libraries as any[]) {
    const id = lib.id.padEnd(20);
    const version = lib.version.padEnd(10);
    const snippets = String(lib.total_snippets).padEnd(8);
    const date = new Date(lib.ingested_at).toLocaleDateString();

    console.log(`${id} | ${version} | ${snippets} | ${date}`);
  }

  console.log();
}

async function handleRemove(parsed: ParsedCommand): Promise<void> {
  if (!parsed.db) {
    throw new Error("--db is required for remove command");
  }

  if (!parsed.libraryId) {
    throw new Error("library-id is required for remove command");
  }

  const db = openDatabase(parsed.db);

  if (parsed.version) {
    console.log(`Removing ${parsed.libraryId}@${parsed.version}...`);

    const result = db.run(
      "DELETE FROM libraries WHERE id = ? AND version = ?",
      [parsed.libraryId, parsed.version]
    );

    if (result.changes === 0) {
      console.log("Library not found.");
    } else {
      console.log("Library removed successfully.");
    }
  } else {
    console.log(`Removing all versions of ${parsed.libraryId}...`);

    const result = db.run("DELETE FROM libraries WHERE id = ?", [
      parsed.libraryId,
    ]);

    if (result.changes === 0) {
      console.log("Library not found.");
    } else {
      console.log(
        `Removed ${result.changes} version(s) of library successfully.`
      );
    }
  }

  db.close();
}

async function handlePreview(parsed: ParsedCommand): Promise<void> {
  if (!parsed.repoUrl) {
    throw new Error("repo-url is required for preview command");
  }

  const repoDir = join(process.cwd(), ".tmp", `preview-${Date.now()}`);

  try {
    console.log(`Cloning ${parsed.repoUrl}...`);
    await cloneRepo(parsed.repoUrl, repoDir);

    const scanDir = parsed.docsPath
      ? join(repoDir, parsed.docsPath)
      : repoDir;
    const globPattern = "**/*.md";

    console.log("Scanning for markdown files...");
    const markdownFiles = await listMarkdownFiles(scanDir, globPattern);

    console.log(`Found ${markdownFiles.length} markdown files.`);
    console.log(`\nParsing and chunking files...`);

    let totalChunks = 0;
    let totalTokens = 0;

    for (const filePath of markdownFiles) {
      const fullPath = join(scanDir, filePath);
      const content = Bun.file(fullPath).text();
      const fileContent = await content;

      const sections = parseMarkdown(fileContent);
      const chunks = chunkDocument(sections, { maxChunkSize: 1500 });

      totalChunks += chunks.length;
      totalTokens += chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
    }

    const libraryId = buildLibraryId(parsed.repoUrl);

    console.log("\n--- Preview Summary ---");
    console.log(`Library ID: ${libraryId}`);
    console.log(`Files: ${markdownFiles.length}`);
    console.log(`Total Chunks: ${totalChunks}`);
    console.log(`Total Tokens: ${totalTokens}`);
    console.log(`Avg Tokens/Chunk: ${Math.round(totalTokens / totalChunks)}`);
    console.log();
  } finally {
    if (existsSync(repoDir)) {
      rmSync(repoDir, { recursive: true, force: true });
    }
  }
}

async function handleVectorize(parsed: ParsedCommand): Promise<void> {
  if (!parsed.db) {
    throw new Error("--db is required for vectorize command");
  }

  // Initialize embedding provider with CLI options or env vars
  initializeProvider({
    provider: parsed.embeddingProvider as 'local' | 'openai' | undefined,
    apiKey: parsed.embeddingApiKey,
    model: parsed.embeddingModel,
    apiUrl: parsed.embeddingApiUrl,
  });

  const db = openDatabase(parsed.db);

  try {
    // Build query based on filters
    let query = `SELECT id, content FROM snippets WHERE 1=1`;
    const params: any[] = [];

    if (!parsed.force) {
      query += ` AND embedding IS NULL`;
    }
    if (parsed.libraryId) {
      query += ` AND library_id = ?`;
      params.push(parsed.libraryId);
    }
    if (parsed.version) {
      query += ` AND library_version = ?`;
      params.push(parsed.version);
    }

    const snippets = db.query(query).all(...params) as Array<{ id: number; content: string }>;
    
    if (snippets.length === 0) {
      console.log("No snippets found to vectorize.");
      return;
    }

    console.log(`Found ${snippets.length} snippets to vectorize`);

    // Generate embeddings in batches
    const BATCH_SIZE = 10;
    let updated = 0;

    for (let i = 0; i < snippets.length; i += BATCH_SIZE) {
      const batch = snippets.slice(i, i + BATCH_SIZE);
      const contents = batch.map(s => s.content);

      try {
        const embeddings = await generateEmbeddings(contents);

        db.exec("BEGIN");
        try {
          for (let j = 0; j < batch.length; j++) {
            const snippet = batch[j];
            if (!snippet) continue;
            const embedding = embeddings[j];
            const embeddingStr = embedding ? JSON.stringify(embedding) : null;
            db.run("UPDATE snippets SET embedding = ? WHERE id = ?", [embeddingStr, snippet.id]);
            updated++;
          }
          db.exec("COMMIT");
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }

        const progress = Math.min(i + BATCH_SIZE, snippets.length);
        console.log(`Vectorized ${progress}/${snippets.length} snippets`);
      } catch (error: any) {
        console.warn(`Failed to vectorize batch: ${error.message}`);
      }
    }

    console.log(`\nUpdated ${updated} snippets with embeddings`);
  } finally {
    db.close();
  }
}

async function main() {
  const parsed = parseCliCommand(process.argv.slice(2));
  await executeCommand(parsed);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
  });
}
