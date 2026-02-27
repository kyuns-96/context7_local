import { join, extname } from "path";
import { readFileSync, rmSync } from "fs";
import { openDatabase } from "../db/connection";
import {
  cloneRepo,
  listDocFiles,
  buildLibraryId,
  buildSourceUrl,
} from "../scraper/github";
import { parseMarkdown } from "../scraper/markdown";
import { parseRst } from "../scraper/rst";
import { chunkDocument } from "../scraper/chunker";
import { generateEmbeddings } from "../embeddings/generator";
import { resolveDocsScan, resolveRepoRelativePath } from "./docs";
import { computeVectorBands, type VectorBands } from "../db/vector-index";

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
    const { scanDir, globPattern, repoRelativePrefix } = resolveDocsScan(repoDir, docsPath);

    console.log("Scanning for documentation files...");
    const docFiles = await listDocFiles(scanDir, globPattern);

    console.log(`Parsing ${docFiles.length} files...`);

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

      // First pass: collect all chunks with metadata
      interface ChunkWithMetadata {
        chunk: any;
        filePath: string;
        sourceUrl: string;
      }
      const allChunks: ChunkWithMetadata[] = [];

      for (const filePath of docFiles) {
        const repoRelativePath = resolveRepoRelativePath(repoRelativePrefix, filePath);
        const fullPath = join(repoDir, repoRelativePath);
        const content = readFileSync(fullPath, "utf-8");

        const ext = extname(repoRelativePath).toLowerCase();
        const sections =
          ext === ".rst" || ext === ".txt" ? parseRst(content) : parseMarkdown(content);
        const chunks = chunkDocument(sections, { maxChunkSize: 1500 });

        for (const chunk of chunks) {
          const sourceUrl = buildSourceUrl(
            repoUrl,
            repoRelativePath,
            version !== "latest" ? version : "main"
          );

          allChunks.push({ chunk, filePath: repoRelativePath, sourceUrl });
        }
      }

      // Second pass: generate embeddings in batches
      const BATCH_SIZE = 10;
      const chunksWithEmbeddings: Array<
        ChunkWithMetadata & { embedding: string | null; bands: VectorBands | null }
      > = [];

      console.log(`Generating embeddings for ${allChunks.length} snippets...`);

      for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
        const batch = allChunks.slice(i, i + BATCH_SIZE);
        const texts = batch.map(item => item.chunk.content);

        try {
          const embeddings = await generateEmbeddings(texts);
          for (let j = 0; j < batch.length; j++) {
            const item = batch[j];
            if (item) {
              const embeddingVector = embeddings[j] ?? null;
              chunksWithEmbeddings.push({
                chunk: item.chunk,
                filePath: item.filePath,
                sourceUrl: item.sourceUrl,
                embedding: embeddingVector ? JSON.stringify(embeddingVector) : null,
                bands: embeddingVector ? computeVectorBands(embeddingVector) : null,
              });
            }
          }
        } catch (error: any) {
          console.warn(`[Ingest] Failed to generate embeddings for batch: ${error.message}`);
          // Add chunks without embeddings
          for (const item of batch) {
            chunksWithEmbeddings.push({ ...item, embedding: null, bands: null });
          }
        }

        const progress = Math.min(i + batch.length, allChunks.length);
        console.log(`[Ingest] Generated embeddings for ${progress}/${allChunks.length} snippets`);
      }

      // Third pass: insert chunks with embeddings into database
      for (const item of chunksWithEmbeddings) {
        const insertResult = db.run(
          `INSERT INTO snippets (library_id, library_version, title, content, source_path, source_url, language, token_count, breadcrumb, embedding)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            libraryId,
            version,
            item.chunk.title,
            item.chunk.content,
            item.filePath,
            item.sourceUrl,
            item.chunk.language || "",
            item.chunk.tokenCount,
            item.chunk.breadcrumb,
            item.embedding,
          ]
        );

        const rawRowid = (insertResult as { lastInsertRowid?: number | bigint }).lastInsertRowid;
        const snippetId = rawRowid === undefined ? null : Number(rawRowid);

        if (snippetId !== null && item.embedding && item.bands) {
          db.run(
            `INSERT OR REPLACE INTO snippet_vector_index (
               snippet_id, library_id, library_version, band1, band2, band3, band4
             ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              snippetId,
              libraryId,
              version,
              item.bands.band1,
              item.bands.band2,
              item.bands.band3,
              item.bands.band4,
            ]
          );
        }

        totalSnippets++;
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
