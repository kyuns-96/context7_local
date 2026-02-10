import type { Database } from "bun:sqlite";
import {
  searchLibraries,
  queryDocumentation,
  type LibrarySearchResult,
} from "../db/queries";

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

export function handleQueryDocs(input: QueryDocsInput, db: Database): ToolResponse {
  const parts = input.libraryId.split("/").filter((p) => p);
  let libraryId: string;
  let version: string;

  if (parts.length === 3) {
    libraryId = `/${parts[0]}/${parts[1]}`;
    version = parts[2];
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

  const results = queryDocumentation(input.query, libraryId, version, db);

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
