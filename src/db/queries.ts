import type { Database } from "bun:sqlite";
import { computeVectorBands } from "./vector-index";

const tableExistenceCache = new WeakMap<Database, Map<string, boolean>>();

function dbHasTable(db: Database, tableName: string): boolean {
  let cache = tableExistenceCache.get(db);
  if (!cache) {
    cache = new Map<string, boolean>();
    tableExistenceCache.set(db, cache);
  }

  const cached = cache.get(tableName);
  if (cached !== undefined) return cached;

  const row = db
    .query("SELECT name FROM sqlite_master WHERE type='table' AND name = ?1")
    .get(tableName) as { name: string } | null;

  const exists = row?.name === tableName;
  cache.set(tableName, exists);
  return exists;
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

function vectorMagnitude(values: number[]): number {
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === undefined) continue;
    sum += v * v;
  }
  return Math.sqrt(sum);
}

function cosineSimilarityVectors(query: number[], queryMag: number, doc: number[]): number | null {
  if (query.length !== doc.length) return null;

  let dot = 0;
  let docSumSq = 0;

  for (let i = 0; i < query.length; i++) {
    const q = query[i];
    const d = doc[i];
    if (q === undefined || d === undefined) return null;
    dot += q * d;
    docSumSq += d * d;
  }

  const denom = queryMag * Math.sqrt(docSumSq);
  if (denom === 0) return null;
  return dot / denom;
}

function fetchSnippetsByIds(ids: number[], db: Database): DocumentationSnippet[] {
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => "?").join(",");
  const stmt = db.query(`
    SELECT
      id,
      library_id,
      library_version,
      title,
      content,
      source_path,
      language,
      token_count,
      breadcrumb
    FROM snippets
    WHERE id IN (${placeholders})
  `);

  return stmt.all(...ids) as DocumentationSnippet[];
}

function queryVectorCandidateIds(
  queryEmbedding: number[],
  libraryId: string,
  version: string,
  db: Database,
  maxCandidates: number
): number[] {
  if (!dbHasTable(db, "snippet_vector_index")) return [];

  const bands = computeVectorBands(queryEmbedding);
  if (!bands) return [];

  const stmt = db.query(`
    SELECT snippet_id
    FROM snippet_vector_index
    WHERE library_id = ?1
      AND library_version = ?2
      AND (
        band1 = ?3 OR band2 = ?4 OR band3 = ?5 OR band4 = ?6
      )
    LIMIT ?7
  `);

  const rows = stmt.all(
    libraryId,
    version,
    bands.band1,
    bands.band2,
    bands.band3,
    bands.band4,
    maxCandidates
  ) as Array<{ snippet_id: number }>;

  return rows.map((r) => r.snippet_id);
}

export interface LibrarySearchResult {
  id: string;
  version: string;
  title: string;
  description: string;
  totalSnippets: number;
  trustScore: number;
  benchmarkScore: number;
}

export interface DocumentationSnippet {
  id: number;
  library_id: string;
  library_version: string;
  title: string;
  content: string;
  source_path: string | null;
  language: string;
  token_count: number;
  breadcrumb: string;
}

export function searchLibraries(
  query: string,
  libraryName: string,
  db: Database
): LibrarySearchResult[] {
  const searchPattern = `%${libraryName}%`;

  const stmt = db.query(`
    SELECT 
      id,
      version,
      title,
      description,
      total_snippets as totalSnippets,
      trust_score as trustScore,
      benchmark_score as benchmarkScore
    FROM libraries
    WHERE id LIKE ?1 OR title LIKE ?1
    ORDER BY trust_score DESC, total_snippets DESC
  `);

  return stmt.all(searchPattern) as LibrarySearchResult[];
}

export function queryDocumentation(
  query: string,
  libraryId: string,
  version: string,
  db: Database,
  limit: number = 20
): DocumentationSnippet[] {
  const stmt = db.query(`
    SELECT 
      s.id,
      s.library_id,
      s.library_version,
      s.title,
      s.content,
      s.source_path,
      s.language,
      s.token_count,
      s.breadcrumb,
      fts.rank
    FROM snippets s
    JOIN snippets_fts fts ON s.id = fts.rowid
    WHERE fts.snippets_fts MATCH ?1
      AND s.library_id = ?2
      AND s.library_version = ?3
    ORDER BY fts.rank
    LIMIT ?4
  `);

  return stmt.all(query, libraryId, version, limit) as DocumentationSnippet[];
}

export function queryDocumentationByVector(
  queryEmbedding: number[],
  libraryId: string,
  version: string,
  db: Database,
  limit: number = 20
): DocumentationSnippet[] {
  const queryMag = vectorMagnitude(queryEmbedding);
  if (queryMag === 0) return [];

  const maxCandidates = Math.max(limit * 200, 1000);
  const candidateIds = queryVectorCandidateIds(
    queryEmbedding,
    libraryId,
    version,
    db,
    maxCandidates
  );

  const scored = queryVectorScores(queryEmbedding, queryMag, libraryId, version, db, limit, candidateIds);
  const ids = scored.map((s) => s.id);

  const snippets = fetchSnippetsByIds(ids, db);
  const snippetMap = new Map<number, DocumentationSnippet>(snippets.map((s) => [s.id, s]));

  return scored
    .map((s) => snippetMap.get(s.id))
    .filter((s): s is DocumentationSnippet => s !== undefined);
}

function queryVectorScores(
  queryEmbedding: number[],
  queryMag: number,
  libraryId: string,
  version: string,
  db: Database,
  limit: number,
  candidateIds: number[]
): Array<{ id: number; score: number }> {
  const rows = candidateIds.length > 0
    ? fetchSnippetEmbeddingsByIds(candidateIds, db)
    : fetchSnippetEmbeddingsByLibrary(libraryId, version, db);

  const top: Array<{ id: number; score: number }> = [];

  for (const row of rows) {
    const doc = parseEmbeddingJson(row.embedding);
    if (!doc) continue;

    const score = cosineSimilarityVectors(queryEmbedding, queryMag, doc);
    if (score === null) continue;

    if (top.length < limit) {
      top.push({ id: row.id, score });
      continue;
    }

    let minIndex = 0;
    let minScore = top[0]?.score ?? score;

    for (let i = 1; i < top.length; i++) {
      const s = top[i]?.score;
      if (s !== undefined && s < minScore) {
        minScore = s;
        minIndex = i;
      }
    }

    if (score > minScore) {
      top[minIndex] = { id: row.id, score };
    }
  }

  top.sort((a, b) => b.score - a.score);
  return top;
}

function fetchSnippetEmbeddingsByLibrary(
  libraryId: string,
  version: string,
  db: Database
): Array<{ id: number; embedding: string }> {
  const stmt = db.query(`
    SELECT id, embedding
    FROM snippets
    WHERE library_id = ?1
      AND library_version = ?2
      AND embedding IS NOT NULL
  `);

  return stmt.all(libraryId, version) as Array<{ id: number; embedding: string }>;
}

function fetchSnippetEmbeddingsByIds(
  ids: number[],
  db: Database
): Array<{ id: number; embedding: string }> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const stmt = db.query(`
    SELECT id, embedding
    FROM snippets
    WHERE id IN (${placeholders})
      AND embedding IS NOT NULL
  `);

  return stmt.all(...ids) as Array<{ id: number; embedding: string }>;
}

export function queryDocumentationHybrid(
  query: string,
  queryEmbedding: number[],
  libraryId: string,
  version: string,
  db: Database,
  limit: number = 20
): DocumentationSnippet[] {
  const queryMag = vectorMagnitude(queryEmbedding);
  const candidateLimit = Math.max(limit * 5, 100);

  const ftsStmt = db.query(`
    SELECT
      s.id,
      s.library_id,
      s.library_version,
      s.title,
      s.content,
      s.source_path,
      s.language,
      s.token_count,
      s.breadcrumb,
      fts.rank as fts_score
    FROM snippets s
    JOIN snippets_fts fts ON s.id = fts.rowid
    WHERE fts.snippets_fts MATCH ?1
      AND s.library_id = ?2
      AND s.library_version = ?3
    ORDER BY fts.rank
    LIMIT ?4
  `);

  const ftsResults = ftsStmt.all(query, libraryId, version, candidateLimit) as Array<
    DocumentationSnippet & { fts_score: number }
  >;

  const ftsScores = new Map<number, number>();
  if (ftsResults.length > 0) {
    const scores = ftsResults.map((r) => r.fts_score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min;

    for (const r of ftsResults) {
      const normalized = range > 0 ? 1 - (r.fts_score - min) / range : 1;
      ftsScores.set(r.id, normalized);
    }
  }

  const vectorScores = new Map<number, number>();
  const snippetMap = new Map<number, DocumentationSnippet>();
  for (const s of ftsResults) {
    snippetMap.set(s.id, s);
  }

  if (queryMag !== 0) {
    const maxCandidates = Math.max(candidateLimit * 200, 1000);
    const candidateIds = queryVectorCandidateIds(
      queryEmbedding,
      libraryId,
      version,
      db,
      maxCandidates
    );

    const scored = queryVectorScores(
      queryEmbedding,
      queryMag,
      libraryId,
      version,
      db,
      candidateLimit,
      candidateIds
    );

    const ids = scored.map((s) => s.id);
    const snippets = fetchSnippetsByIds(ids, db);
    for (const s of snippets) {
      snippetMap.set(s.id, s);
    }

    for (const s of scored) {
      const normalized = (s.score + 1) / 2;
      vectorScores.set(s.id, Math.max(0, Math.min(1, normalized)));
    }
  }

  const allIds = new Set<number>([...ftsScores.keys(), ...vectorScores.keys()]);
  const combined = Array.from(allIds)
    .map((id) => {
      const snippet = snippetMap.get(id);
      if (!snippet) return null;
      const fts = ftsScores.get(id) ?? 0;
      const vec = vectorScores.get(id) ?? 0;
      return { id, finalScore: 0.3 * fts + 0.7 * vec };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, limit);

  return combined
    .map((r) => snippetMap.get(r.id))
    .filter((s): s is DocumentationSnippet => s !== undefined);
}
