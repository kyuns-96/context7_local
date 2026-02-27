import { Command } from "commander";
import { existsSync, rmSync } from "fs";
import { join, extname } from "path";
import { openDatabase } from "../db/connection";
import { ingestLibrary, type IngestOptions } from "./ingest";
import {
  cloneRepo,
  listDocFiles,
  buildLibraryId,
} from "../scraper/github";
import { parseMarkdown } from "../scraper/markdown";
import { parseRst } from "../scraper/rst";
import { chunkDocument } from "../scraper/chunker";
import { generateEmbeddings } from "../embeddings/generator";
import { initializeProvider } from "../embeddings/generator";
import { initializeReranker } from "../reranking/manager";
import { loadConfig } from "../config/loader";
import { getPreset, loadPresets } from "./presets";
import { resolveDocsScan, resolveRepoRelativePath } from "./docs";
import { computeVectorBands } from "../db/vector-index";

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
  config?: string;
  embeddingProvider?: 'local' | 'openai';
  embeddingApiKey?: string;
  embeddingModel?: string;
  embeddingApiUrl?: string;
  rerankingProvider?: 'none' | 'local' | 'cohere' | 'jina';
  rerankingApiKey?: string;
  rerankingModel?: string;
  rerankingApiUrl?: string;
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
      .option("--config <path>", "Path to JSON configuration file")
      .option("--version <tag>", "Git tag or branch name to checkout")
      .option(
        "--docs-path <path>",
        "Docs path (directory, file, or glob relative to repo root)"
      )
      .option("--preset <name>", "Use a preset library configuration")
      .option("--preset-all", "Ingest all preset libraries")
      .option("--embedding-provider <provider>", "Embedding provider: 'local' or 'openai'", "local")
      .option("--embedding-api-key <key>", "API key for embedding provider")
      .option("--embedding-model <model>", "Embedding model name")
      .option("--embedding-api-url <url>", "Custom API endpoint URL")
      .option("--reranking-provider <provider>", "Reranking provider (none, local, cohere, or jina)", "none")
      .option("--reranking-api-key <key>", "API key for reranking provider")
      .option("--reranking-model <model>", "Reranking model name")
      .option("--reranking-api-url <url>", "Custom reranking API endpoint URL")
      .action((repoUrl, options) => {
       if (!repoUrl && !options.preset && !options.presetAll) {
         throw new Error("repo-url is required unless --preset or --preset-all is used");
       }

        parsedResult = {
          command: "ingest",
          repoUrl,
          db: options.db,
          config: options.config,
          version: options.version,
          docsPath: options.docsPath,
          preset: options.preset,
          presetAll: options.presetAll,
          embeddingProvider: options.embeddingProvider,
          embeddingApiKey: options.embeddingApiKey,
          embeddingModel: options.embeddingModel,
          embeddingApiUrl: options.embeddingApiUrl,
          rerankingProvider: options.rerankingProvider,
          rerankingApiKey: options.rerankingApiKey,
          rerankingModel: options.rerankingModel,
          rerankingApiUrl: options.rerankingApiUrl,
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
      .option("--config <path>", "Path to JSON configuration file")
      .option("--library-id <id>", "Only vectorize snippets for specific library")
      .option("--version <version>", "Only vectorize snippets for specific version")
      .option("--force", "Regenerate embeddings even if they already exist")
      .option("--embedding-provider <provider>", "Embedding provider: 'local' or 'openai'", "local")
      .option("--embedding-api-key <key>", "API key for embedding provider")
      .option("--embedding-model <model>", "Embedding model name")
      .option("--embedding-api-url <url>", "Custom API endpoint URL")
      .option("--reranking-provider <provider>", "Reranking provider (none, local, cohere, or jina)", "none")
      .option("--reranking-api-key <key>", "API key for reranking provider")
      .option("--reranking-model <model>", "Reranking model name")
      .option("--reranking-api-url <url>", "Custom reranking API endpoint URL")
      .action((options) => {
       parsedResult = {
          command: "vectorize",
          db: options.db,
          config: options.config,
          libraryId: options.libraryId,
          version: options.version,
          force: options.force,
          embeddingProvider: options.embeddingProvider,
          embeddingApiKey: options.embeddingApiKey,
          embeddingModel: options.embeddingModel,
          embeddingApiUrl: options.embeddingApiUrl,
          rerankingProvider: options.rerankingProvider,
          rerankingApiKey: options.rerankingApiKey,
          rerankingModel: options.rerankingModel,
          rerankingApiUrl: options.rerankingApiUrl,
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

  if (parsed.presetAll && parsed.preset) {
    throw new Error("--preset and --preset-all are mutually exclusive");
  }

  // Load configuration file if specified
  let fileConfig = null;
  try {
    fileConfig = parsed.config ? loadConfig(parsed.config) : loadConfig();
  } catch (error: any) {
    console.error(`Failed to load config file: ${error.message}`);
    process.exit(1);
  }

  // Merge with priority: CLI > config file > env vars
  const embeddingConfig = {
    provider: parsed.embeddingProvider || fileConfig?.embedding?.provider as 'local' | 'openai' | undefined,
    apiKey: parsed.embeddingApiKey || fileConfig?.embedding?.apiKey,
    model: parsed.embeddingModel || fileConfig?.embedding?.model,
    apiUrl: parsed.embeddingApiUrl || fileConfig?.embedding?.apiUrl,
  };

  const rerankingConfig = {
    reranker: parsed.rerankingProvider || fileConfig?.reranking?.provider as 'none' | 'local' | 'cohere' | 'jina' | undefined,
    apiKey: parsed.rerankingApiKey || fileConfig?.reranking?.apiKey,
    model: parsed.rerankingModel || fileConfig?.reranking?.model,
    apiUrl: parsed.rerankingApiUrl || fileConfig?.reranking?.apiUrl,
  };

  // Initialize embedding provider with CLI options or env vars
  initializeProvider({
    provider: embeddingConfig.provider,
    apiKey: embeddingConfig.apiKey,
    model: embeddingConfig.model,
    apiUrl: embeddingConfig.apiUrl,
  });

  // Initialize reranking provider with CLI options or env vars
  initializeReranker({
    reranker: rerankingConfig.reranker,
    apiKey: rerankingConfig.apiKey,
    model: rerankingConfig.model,
    apiUrl: rerankingConfig.apiUrl,
  });

  if (parsed.presetAll) {
    if (parsed.version) {
      console.warn("Warning: --version is ignored with --preset-all (each preset uses its own version)");
    }

    const presets = loadPresets();
    const presetEntries = Object.entries(presets).sort(([a], [b]) => a.localeCompare(b));
    const failures: Array<{ name: string; error: string }> = [];

    for (const [name, preset] of presetEntries) {
      const options: IngestOptions = {
        version: preset.versions?.[0],
        docsPath: preset.docsPath,
        title: preset.title,
        description: preset.description,
      };

      try {
        await ingestLibrary(preset.repo, parsed.db, options);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ name, error: message });
        console.error(`[preset-all] Failed to ingest ${name}: ${message}`);
      }
    }

    if (failures.length > 0) {
      const summary = failures
        .map((f) => `- ${f.name}: ${f.error}`)
        .join("\n");
      throw new Error(`Failed to ingest ${failures.length} preset(s):\n${summary}`);
    }

    return;
  }

  let repoUrl = parsed.repoUrl;
  let options: IngestOptions = {
    version: parsed.version,
    docsPath: parsed.docsPath,
  };

  if (parsed.preset) {
    const preset = getPreset(parsed.preset);
    if (!preset) {
      throw new Error(`Unknown preset: ${parsed.preset}`);
    }

    repoUrl = preset.repo;
    options = {
      version: parsed.version ?? preset.versions?.[0],
      docsPath: parsed.docsPath ?? preset.docsPath,
      title: preset.title,
      description: preset.description,
    };
  }

  if (!repoUrl) {
    throw new Error("repo-url is required for ingest command");
  }

  await ingestLibrary(repoUrl, parsed.db, options);
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

  const rows = libraries as Array<{
    id: string;
    version: string;
    total_snippets: number;
    ingested_at: string;
  }>;

  for (const lib of rows) {
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

    const { scanDir, globPattern, repoRelativePrefix } = resolveDocsScan(
      repoDir,
      parsed.docsPath
    );

    console.log("Scanning for documentation files...");
    const docFiles = await listDocFiles(scanDir, globPattern);

    console.log(`Found ${docFiles.length} documentation files.`);
    console.log(`\nParsing and chunking files...`);

    let totalChunks = 0;
    let totalTokens = 0;

    for (const filePath of docFiles) {
      const repoRelativePath = resolveRepoRelativePath(repoRelativePrefix, filePath);
      const fullPath = join(repoDir, repoRelativePath);
      const fileContent = await Bun.file(fullPath).text();

      const ext = extname(repoRelativePath).toLowerCase();
      const sections =
        ext === ".rst" || ext === ".txt" ? parseRst(fileContent) : parseMarkdown(fileContent);
      const chunks = chunkDocument(sections, { maxChunkSize: 1500 });

      totalChunks += chunks.length;
      totalTokens += chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
    }

    const libraryId = buildLibraryId(parsed.repoUrl);

    console.log("\n--- Preview Summary ---");
    console.log(`Library ID: ${libraryId}`);
    console.log(`Files: ${docFiles.length}`);
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

  // Load configuration file if specified
  let fileConfig = null;
  try {
    fileConfig = parsed.config ? loadConfig(parsed.config) : loadConfig();
  } catch (error: any) {
    console.error(`Failed to load config file: ${error.message}`);
    process.exit(1);
  }

  // Merge with priority: CLI > config file > env vars
  const embeddingConfig = {
    provider: parsed.embeddingProvider || fileConfig?.embedding?.provider as 'local' | 'openai' | undefined,
    apiKey: parsed.embeddingApiKey || fileConfig?.embedding?.apiKey,
    model: parsed.embeddingModel || fileConfig?.embedding?.model,
    apiUrl: parsed.embeddingApiUrl || fileConfig?.embedding?.apiUrl,
  };

  const rerankingConfig = {
    reranker: parsed.rerankingProvider || fileConfig?.reranking?.provider as 'none' | 'local' | 'cohere' | 'jina' | undefined,
    apiKey: parsed.rerankingApiKey || fileConfig?.reranking?.apiKey,
    model: parsed.rerankingModel || fileConfig?.reranking?.model,
    apiUrl: parsed.rerankingApiUrl || fileConfig?.reranking?.apiUrl,
  };

  // Initialize embedding provider with CLI options or env vars
  initializeProvider({
    provider: embeddingConfig.provider,
    apiKey: embeddingConfig.apiKey,
    model: embeddingConfig.model,
    apiUrl: embeddingConfig.apiUrl,
  });

  // Initialize reranking provider with CLI options or env vars
  initializeReranker({
    reranker: rerankingConfig.reranker,
    apiKey: rerankingConfig.apiKey,
    model: rerankingConfig.model,
    apiUrl: rerankingConfig.apiUrl,
  });

  const db = openDatabase(parsed.db);

  try {
    // Build query based on filters
    let query = `SELECT id, library_id, library_version, content FROM snippets WHERE 1=1`;
    const params: string[] = [];

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

    const snippets = db.query(query).all(...params) as Array<{
      id: number;
      library_id: string;
      library_version: string;
      content: string;
    }>;

    if (snippets.length === 0) {
      console.log("No snippets found to vectorize.");
    } else {
      console.log(`Found ${snippets.length} snippets to vectorize`);
    }

    // Generate embeddings in batches
    const BATCH_SIZE = 10;
    let updated = 0;

    for (let i = 0; i < snippets.length; i += BATCH_SIZE) {
      const batch = snippets.slice(i, i + BATCH_SIZE);
      const contents = batch.map((s) => s.content);

      try {
        const embeddings = await generateEmbeddings(contents);

        db.exec("BEGIN");
        try {
          for (let j = 0; j < batch.length; j++) {
            const snippet = batch[j];
            if (!snippet) continue;
            const embedding = embeddings[j];
            const embeddingStr = embedding ? JSON.stringify(embedding) : null;
            db.run("UPDATE snippets SET embedding = ? WHERE id = ?", [
              embeddingStr,
              snippet.id,
            ]);

            if (embedding && embeddingStr) {
              const bands = computeVectorBands(embedding);
              if (bands) {
                db.run(
                  `INSERT OR REPLACE INTO snippet_vector_index (
                     snippet_id, library_id, library_version, band1, band2, band3, band4
                   ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [
                    snippet.id,
                    snippet.library_id,
                    snippet.library_version,
                    bands.band1,
                    bands.band2,
                    bands.band3,
                    bands.band4,
                  ]
                );
              }
            }
            updated++;
          }
          db.exec("COMMIT");
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }

        const progress = Math.min(i + BATCH_SIZE, snippets.length);
        console.log(`Vectorized ${progress}/${snippets.length} snippets`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Failed to vectorize batch: ${message}`);
      }
    }

    if (snippets.length > 0) {
      console.log(`\nUpdated ${updated} snippets with embeddings`);
    }

    function parseEmbeddingJson(value: string): number[] | null {
      try {
        const parsed: unknown = JSON.parse(value);
        if (!Array.isArray(parsed)) return null;
        for (const item of parsed) {
          if (typeof item !== "number") return null;
        }
        return parsed as number[];
      } catch {
        return null;
      }
    }

    const INDEX_BATCH_SIZE = 500;
    let indexed = 0;
    let lastId = 0;

    while (true) {
      let indexQuery = `
        SELECT s.id, s.library_id, s.library_version, s.embedding
        FROM snippets s
        LEFT JOIN snippet_vector_index v ON v.snippet_id = s.id
        WHERE s.embedding IS NOT NULL
          AND v.snippet_id IS NULL
          AND s.id > ?
      `;

      const indexParams: Array<number | string> = [lastId];

      if (parsed.libraryId) {
        indexQuery += ` AND s.library_id = ?`;
        indexParams.push(parsed.libraryId);
      }
      if (parsed.version) {
        indexQuery += ` AND s.library_version = ?`;
        indexParams.push(parsed.version);
      }

      indexQuery += ` ORDER BY s.id LIMIT ?`;
      indexParams.push(INDEX_BATCH_SIZE);

      const rows = db.query(indexQuery).all(...indexParams) as Array<{
        id: number;
        library_id: string;
        library_version: string;
        embedding: string;
      }>;

      if (rows.length === 0) break;
      lastId = rows[rows.length - 1]?.id ?? lastId;

      db.exec("BEGIN");
      try {
        for (const row of rows) {
          const vector = parseEmbeddingJson(row.embedding);
          if (!vector) continue;
          const bands = computeVectorBands(vector);
          if (!bands) continue;

          db.run(
            `INSERT OR REPLACE INTO snippet_vector_index (
               snippet_id, library_id, library_version, band1, band2, band3, band4
             ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              row.id,
              row.library_id,
              row.library_version,
              bands.band1,
              bands.band2,
              bands.band3,
              bands.band4,
            ]
          );
          indexed++;
        }
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }

    if (indexed > 0) {
      console.log(`Indexed ${indexed} snippet embedding(s) for faster semantic search`);
    }
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
