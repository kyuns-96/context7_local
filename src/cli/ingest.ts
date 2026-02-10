import { join } from "path";
import { readFileSync, rmSync } from "fs";
import type { Database } from "bun:sqlite";
import { openDatabase } from "../db/connection";
import {
  cloneRepo,
  listMarkdownFiles,
  buildLibraryId,
  buildSourceUrl,
} from "../scraper/github";
import { parseMarkdown } from "../scraper/markdown";
import { chunkDocument } from "../scraper/chunker";

export interface IngestOptions {
  version?: string;
  docsPath?: string;
  localPath?: string;
  title?: string;
  description?: string;
}

export async function ingestLibrary(
  repoUrl: string,
  dbPath: string,
  options: IngestOptions = {}
): Promise<void> {
  const {
    version = "latest",
    docsPath = "",
    localPath,
    title,
    description = "",
  } = options;

  const libraryId = buildLibraryId(repoUrl);
  let repoDir: string;
  let shouldCleanup = false;

  if (localPath) {
    repoDir = localPath;
  } else {
    repoDir = join(process.cwd(), ".tmp", `clone-${Date.now()}`);
    console.log(`Cloning ${repoUrl}...`);
    await cloneRepo(repoUrl, repoDir, { version: version !== "latest" ? version : undefined });
    shouldCleanup = true;
  }

  try {
    const scanDir = docsPath ? join(repoDir, docsPath) : repoDir;
    const globPattern = docsPath ? "**/*.md" : "**/*.md";

    console.log("Scanning for markdown files...");
    const markdownFiles = await listMarkdownFiles(scanDir, globPattern);

    console.log(`Parsing ${markdownFiles.length} files...`);

    const db = openDatabase(dbPath);

    db.exec("BEGIN");

    try {
      const libraryTitle = title || libraryId.split("/").pop() || libraryId;

      db.run(
        `INSERT OR REPLACE INTO libraries (id, version, title, description, source_repo, total_snippets)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [libraryId, version, libraryTitle, description, repoUrl]
      );

      db.run(
        "DELETE FROM snippets WHERE library_id = ? AND library_version = ?",
        [libraryId, version]
      );

      let totalSnippets = 0;

      for (const filePath of markdownFiles) {
        const fullPath = join(scanDir, filePath);
        const content = readFileSync(fullPath, "utf-8");

        const sections = parseMarkdown(content);
        const chunks = chunkDocument(sections, { maxChunkSize: 1500 });

        for (const chunk of chunks) {
          const sourceUrl = buildSourceUrl(
            repoUrl,
            docsPath ? join(docsPath, filePath) : filePath,
            version !== "latest" ? version : "main"
          );

          db.run(
            `INSERT INTO snippets (library_id, library_version, title, content, source_path, source_url, language, token_count, breadcrumb)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              libraryId,
              version,
              chunk.title,
              chunk.content,
              filePath,
              sourceUrl,
              chunk.language || "",
              chunk.tokenCount,
              chunk.breadcrumb,
            ]
          );

          totalSnippets++;
        }
      }

      db.run(
        "UPDATE libraries SET total_snippets = ? WHERE id = ? AND version = ?",
        [totalSnippets, libraryId, version]
      );

      db.exec("COMMIT");

      console.log(`Indexed ${totalSnippets} snippets for ${libraryId}@${version}`);
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    } finally {
      db.close();
    }
  } finally {
    if (shouldCleanup) {
      rmSync(repoDir, { recursive: true, force: true });
    }
  }
}
