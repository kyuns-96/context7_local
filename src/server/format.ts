export type SourceReputation = "High" | "Medium" | "Low" | "Unknown";

export interface SearchResult {
  title: string;
  id: string;
  description: string;
  totalSnippets?: number;
  trustScore?: number;
  benchmarkScore?: number;
  versions?: string[];
}

export interface SearchResponse {
  results: SearchResult[] | null;
}

export interface DocumentationSnippet {
  title: string;
  content: string;
  breadcrumb: string;
  language: string | null;
  tokenCount: number;
}

export interface McpResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
}

export function getSourceReputationLabel(score?: number): SourceReputation {
  if (score === undefined || score < 0) return "Unknown";
  if (score >= 7) return "High";
  if (score >= 4) return "Medium";
  return "Low";
}

export function formatSearchResult(result: SearchResult): string {
  const lines: string[] = [
    `- Title: ${result.title}`,
    `- Context7-compatible library ID: ${result.id}`,
    `- Description: ${result.description}`,
  ];

  if (result.totalSnippets !== -1 && result.totalSnippets !== undefined) {
    lines.push(`- Code Snippets: ${result.totalSnippets}`);
  }

  const reputationLabel = getSourceReputationLabel(result.trustScore);
  lines.push(`- Source Reputation: ${reputationLabel}`);

  if (result.benchmarkScore !== undefined && result.benchmarkScore > 0) {
    lines.push(`- Benchmark Score: ${result.benchmarkScore}`);
  }

  if (result.versions !== undefined && result.versions.length > 0) {
    lines.push(`- Versions: ${result.versions.join(", ")}`);
  }

  return lines.join("\n");
}

export function formatSearchResults(searchResponse: SearchResponse): string {
  if (!searchResponse.results || searchResponse.results.length === 0) {
    return "No documentation libraries found matching your query.";
  }

  const formattedResults = searchResponse.results.map(formatSearchResult);
  return formattedResults.join("\n----------\n");
}

export function formatDocumentation(snippets: DocumentationSnippet[]): string {
  if (snippets.length === 0) {
    return "";
  }

  const formatted = snippets.map((snippet) => {
    const lines: string[] = [];

    if (snippet.title) {
      lines.push(`## ${snippet.title}`);
    }

    if (snippet.breadcrumb) {
      lines.push(`**Path:** ${snippet.breadcrumb}`);
    }

    if (snippet.content) {
      lines.push(snippet.content);
    }

    return lines.join("\n");
  });

  return formatted.join("\n----------\n");
}

export function wrapResponse(text: string): McpResponse {
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
  };
}
