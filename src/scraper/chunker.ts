import type { MarkdownSection } from "./markdown";

export interface Chunk {
  title: string;
  content: string;
  breadcrumb: string;
  tokenCount: number;
  language: string | null;
  codeBlocks: Array<{ language: string | null; value: string }>;
}

export interface ChunkOptions {
  maxChunkSize?: number;
}

export function chunkDocument(
  sections: MarkdownSection[],
  options: ChunkOptions = {}
): Chunk[] {
  const { maxChunkSize = 1500 } = options;
  const chunks: Chunk[] = [];
  const breadcrumbStack: Array<{ heading: string; depth: number }> = [];

  for (const section of sections) {
    if (!section.content && section.codeBlocks.length === 0) {
      continue;
    }

    updateBreadcrumbStack(breadcrumbStack, section);
    const breadcrumb = buildBreadcrumb(breadcrumbStack);
    const primaryLanguage =
      section.codeBlocks.length > 0 ? section.codeBlocks[0].language : null;

    if (section.content.length <= maxChunkSize) {
      chunks.push(
        createChunk(
          section.heading || "",
          section.content,
          breadcrumb,
          primaryLanguage,
          section.codeBlocks
        )
      );
    } else {
      const subChunks = splitLargeSection(
        section,
        breadcrumb,
        maxChunkSize,
        primaryLanguage
      );
      chunks.push(...subChunks);
    }
  }

  return chunks;
}

function updateBreadcrumbStack(
  stack: Array<{ heading: string; depth: number }>,
  section: MarkdownSection
): void {
  if (!section.heading) return;

  while (stack.length > 0 && stack[stack.length - 1].depth >= section.depth) {
    stack.pop();
  }

  stack.push({
    heading: section.heading,
    depth: section.depth,
  });
}

function buildBreadcrumb(
  stack: Array<{ heading: string; depth: number }>
): string {
  return stack.map((item) => item.heading).join(" > ");
}

function createChunk(
  title: string,
  content: string,
  breadcrumb: string,
  language: string | null,
  codeBlocks: Array<{ language: string | null; value: string }> = []
): Chunk {
  return {
    title,
    content,
    breadcrumb,
    tokenCount: Math.ceil(content.length / 4),
    language,
    codeBlocks,
  };
}

function splitLargeSection(
  section: MarkdownSection,
  breadcrumb: string,
  maxChunkSize: number,
  language: string | null
): Chunk[] {
  const paragraphs = section.content.split("\n\n");
  const chunks: Chunk[] = [];
  let currentChunk = "";

  function flushCurrentChunk(includeCodeBlocks = false) {
    if (currentChunk) {
      chunks.push(
        createChunk(
          section.heading || "",
          currentChunk,
          breadcrumb,
          language,
          includeCodeBlocks && chunks.length === 0 ? section.codeBlocks : []
        )
      );
      currentChunk = "";
    }
  }

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChunkSize) {
      flushCurrentChunk();
      const truncated = paragraph.substring(0, maxChunkSize);
      chunks.push(
        createChunk(section.heading || "", truncated, breadcrumb, language)
      );
      continue;
    }

    if (currentChunk.length + paragraph.length + 2 <= maxChunkSize) {
      currentChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;
    } else {
      flushCurrentChunk();
      currentChunk = paragraph;
    }
  }

  flushCurrentChunk(true);

  return chunks;
}
