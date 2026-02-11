import type { Database } from "bun:sqlite";
import { cosineSimilarity } from "./schema";

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
  // Convert embedding to JSON string for comparison
  const queryEmbeddingStr = JSON.stringify(queryEmbedding);
  
  // Fetch all snippets with embeddings
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
      breadcrumb,
      embedding
    FROM snippets
    WHERE library_id = ?1 
      AND library_version = ?2 
      AND embedding IS NOT NULL
  `);
  
  const snippets = stmt.all(libraryId, version) as (DocumentationSnippet & { embedding: string })[];
  
  // Compute similarities in-memory
  const results = snippets
    .map(snippet => ({
      ...snippet,
      similarity: cosineSimilarity(queryEmbeddingStr, snippet.embedding)
    }))
    .filter(r => r.similarity !== null)
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
    .slice(0, limit);
  
  // Return as DocumentationSnippet[] (excluding embedding field)
  return results.map(r => ({
    id: r.id,
    library_id: r.library_id,
    library_version: r.library_version,
    title: r.title,
    content: r.content,
    source_path: r.source_path,
    language: r.language,
    token_count: r.token_count,
    breadcrumb: r.breadcrumb
  }));
}

export function queryDocumentationHybrid(
  query: string,
  queryEmbedding: number[],
  libraryId: string,
  version: string,
  db: Database,
  limit: number = 20
): DocumentationSnippet[] {
  // 1. Run FTS5 search with more candidates if reranking is possible
  const candidateLimit = Math.max(limit * 5, 100); // Get 5x the limit or at least 100
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
    LIMIT ?4
  `);
   
   const ftsResults = ftsStmt.all(query, libraryId, version, candidateLimit) as (DocumentationSnippet & { fts_score: number })[];
  
  // 2. Run vector search
  const queryEmbeddingStr = JSON.stringify(queryEmbedding);
  
  const vectorStmt = db.query(`
    SELECT 
      id,
      library_id,
      library_version,
      title,
      content,
      source_path,
      language,
      token_count,
      breadcrumb,
      embedding
    FROM snippets
    WHERE library_id = ?1 
      AND library_version = ?2 
      AND embedding IS NOT NULL
  `);
  
  const vectorSnippets = vectorStmt.all(libraryId, version) as (DocumentationSnippet & { embedding: string })[];
  
  const vectorResults = vectorSnippets
    .map(snippet => ({
      ...snippet,
      vector_score: cosineSimilarity(queryEmbeddingStr, snippet.embedding) ?? 0
    }))
    .filter(r => r.vector_score > 0);
  
  // 3. Normalize scores to 0-1 range
  const ftsMin = Math.min(...ftsResults.map(r => r.fts_score));
  const ftsMax = Math.max(...ftsResults.map(r => r.fts_score));
  const ftsRange = ftsMax - ftsMin;
  
  const vectorMax = Math.max(...vectorResults.map(r => r.vector_score), 1);
  
  // 4. Create score maps
  const ftsScoreMap = new Map<number, number>();
  ftsResults.forEach(r => {
    const normalized = ftsRange > 0 ? (r.fts_score - ftsMin) / ftsRange : 1;
    ftsScoreMap.set(r.id, normalized);
  });
  
  const vectorScoreMap = new Map<number, number>();
  vectorResults.forEach(r => {
    const normalized = r.vector_score / vectorMax;
    vectorScoreMap.set(r.id, normalized);
  });
  
  // 5. Combine results: 0.3 * FTS + 0.7 * Vector
  const allIds = new Set([...ftsScoreMap.keys(), ...vectorScoreMap.keys()]);
  const snippetMap = new Map<number, DocumentationSnippet>();
  
  ftsResults.forEach(s => snippetMap.set(s.id, s));
  vectorResults.forEach(s => snippetMap.set(s.id, s));
  
  const combinedResults = Array.from(allIds)
    .map(id => {
      const snippet = snippetMap.get(id);
      if (!snippet) return null;
      
      const ftsScore = ftsScoreMap.get(id) ?? 0;
      const vectorScore = vectorScoreMap.get(id) ?? 0;
      const finalScore = 0.3 * ftsScore + 0.7 * vectorScore;
      
      return {
        ...snippet,
        finalScore
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, limit);
  
  // 6. Return as DocumentationSnippet[] (excluding scores and embedding)
  return combinedResults.map(r => ({
    id: r.id,
    library_id: r.library_id,
    library_version: r.library_version,
    title: r.title,
    content: r.content,
    source_path: r.source_path,
    language: r.language,
    token_count: r.token_count,
    breadcrumb: r.breadcrumb
  }));
}
