import type { Database } from "bun:sqlite";
import {
  searchLibraries,
  queryDocumentation,
  queryDocumentationByVector,
  queryDocumentationHybrid,
  type LibrarySearchResult,
  type DocumentationSnippet,
} from "../db/queries";
import { generateEmbedding } from "../embeddings/generator";
import { rerank } from "../reranking/manager";

export interface ToolResponse {
  content: Array<{ type: "text"; text: string }>;
}

interface ResolveLibraryIdInput {
  query: string;
  libraryName: string;
}

interface QueryDocsInput {
  query: string;
  libraryId: string;
  searchMode?: "keyword" | "semantic" | "hybrid";
  useReranking?: boolean;
  topK?: number;
}

function getSourceReputationLabel(
  trustScore?: number
): "High" | "Medium" | "Low" | "Unknown" {
  if (trustScore === undefined || trustScore < 0) return "Unknown";
  if (trustScore >= 7) return "High";
  if (trustScore >= 4) return "Medium";
  return "Low";
}

function formatLibraryResult(result: LibrarySearchResult): string {
  const lines = [
    `- Name: ${result.title}`,
    `- Library ID: ${result.id}`,
    `- Description: ${result.description}`,
    `- Code Snippets: ${result.totalSnippets}`,
    `- Source Reputation: ${getSourceReputationLabel(result.trustScore)}`,
    `- Benchmark Score: ${result.benchmarkScore}`,
  ];

  return lines.join("\n");
}

function groupLibrariesByIdWithVersions(
  results: LibrarySearchResult[]
): Map<string, { library: LibrarySearchResult; versions: string[] }> {
  const grouped = new Map<string, { library: LibrarySearchResult; versions: string[] }>();

  for (const result of results) {
    if (!grouped.has(result.id)) {
      grouped.set(result.id, { library: result, versions: [] });
    }
    grouped.get(result.id)!.versions.push(result.version);
  }

  return grouped;
}

export function handleResolveLibraryId(
  input: ResolveLibraryIdInput,
  db: Database
): ToolResponse {
  const results = searchLibraries(input.query, input.libraryName, db);

  if (results.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: "No libraries found matching the provided name.",
        },
      ],
    };
  }

  const grouped = groupLibrariesByIdWithVersions(results);
  const formattedResults: string[] = [];

  for (const [, { library, versions }] of grouped) {
    const formatted = formatLibraryResult(library);
    const versionsLine = `- Versions: ${versions.join(", ")}`;
    formattedResults.push(`${formatted}\n${versionsLine}`);
  }

  const responseText = `Available Libraries:

Each result includes:
- Library ID: Context7-compatible identifier (format: /org/project)
- Name: Library or package name
- Description: Short summary
- Code Snippets: Number of available code examples
- Source Reputation: Authority indicator (High, Medium, Low, or Unknown)
- Benchmark Score: Quality indicator (100 is the highest score)
- Versions: List of versions if available. Use one of those versions if the user provides a version in their query. The format of the version is /org/project/version.

For best results, select libraries based on name match, source reputation, snippet coverage, benchmark score, and relevance to your use case.

----------

${formattedResults.join("\n----------\n")}`;

  return {
    content: [
      {
        type: "text",
        text: responseText,
      },
    ],
  };
}

export async function handleQueryDocs(input: QueryDocsInput, db: Database): Promise<ToolResponse> {
  const { searchMode = "hybrid", useReranking = false, topK = 10 } = input;
  const parts = input.libraryId.split("/").filter((p) => p);
  let libraryId: string;
  let version: string;

  if (parts.length === 3) {
    libraryId = `/${parts[0]}/${parts[1]}`;
    version = parts[2]!;
  } else if (parts.length === 2) {
    libraryId = `/${parts[0]}/${parts[1]}`;
    version = "latest";
  } else {
    return {
      content: [
        {
          type: "text",
          text: `Invalid library ID format. Expected /org/project or /org/project/version, got: ${input.libraryId}`,
        },
      ],
    };
  }

  const candidateLimit = useReranking ? 100 : topK;

  let results: (DocumentationSnippet & { rerankScore?: number })[];

  try {
    if (searchMode === "semantic" || searchMode === "hybrid") {
      console.log(`[MCP] Generating embedding for query: "${input.query.slice(0, 50)}..."`);
      const queryEmbedding = await generateEmbedding(input.query);

      if (queryEmbedding) {
        console.log(`[MCP] Using ${searchMode} search mode (retrieving ${candidateLimit} candidates)`);
        if (searchMode === "semantic") {
          results = queryDocumentationByVector(queryEmbedding, libraryId, version, db, candidateLimit);
        } else {
          results = queryDocumentationHybrid(input.query, queryEmbedding, libraryId, version, db, candidateLimit);
        }
      } else {
        console.warn("[MCP] Failed to generate embedding, falling back to keyword search");
        results = queryDocumentation(input.query, libraryId, version, db, candidateLimit);
      }
    } else {
      console.log(`[MCP] Using keyword search mode (retrieving ${candidateLimit} candidates)`);
      results = queryDocumentation(input.query, libraryId, version, db, candidateLimit);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[MCP] Search error: ${errorMessage}, falling back to keyword search`);
    results = queryDocumentation(input.query, libraryId, version, db, candidateLimit);
  }

  if (results.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: "No documentation found matching your query for this library.",
        },
      ],
    };
  }

  if (useReranking && results.length > 0) {
    console.log(`[MCP] Reranking ${results.length} candidates to top ${topK}`);
    const documents = results.map(r => r.content);
    
    try {
      const rankedResults = await rerank(input.query, documents, topK);
      
      results = rankedResults.map(r => {
        const original = results[r.originalIndex];
        return { 
          ...original,
          rerankScore: r.score
        } as DocumentationSnippet & { rerankScore: number };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MCP] Reranking error: ${errorMessage}, using search results without reranking`);
      results = results.slice(0, topK);
    }
  } else if (!useReranking) {
    results = results.slice(0, topK);
  }

  const snippets = results
    .map((snippet) => {
      const parts = [
        `## ${snippet.title}`,
        snippet.breadcrumb ? `**Breadcrumb:** ${snippet.breadcrumb}` : "",
        snippet.source_path ? `**Source:** ${snippet.source_path}` : "",
        snippet.language ? `**Language:** ${snippet.language}` : "",
        "",
        snippet.content,
      ];
      return parts.filter((p) => p).join("\n");
    })
    .join("\n\n---\n\n");

  return {
    content: [
      {
        type: "text",
        text: snippets,
      },
    ],
  };
}
