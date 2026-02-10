import type { Database } from "bun:sqlite";

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
  db: Database
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
    LIMIT 20
  `);

  return stmt.all(query, libraryId, version) as DocumentationSnippet[];
}
