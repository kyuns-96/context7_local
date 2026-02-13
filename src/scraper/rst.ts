export interface RstSection {
  heading: string | null;
  depth: number;
  content: string;
  codeBlocks: Array<{ language: string | null; value: string }>;
}

export function parseRst(rst: string): RstSection[] {
  const lines = rst.split("\n");
  const sections: RstSection[] = [];
  let currentSection: RstSection | null = null;
  let i = 0;

  const headerChars = ["=", "-", "~", "^", '"', "#", "*", "+"];
  
  function ensureSection(): RstSection {
    if (!currentSection) {
      currentSection = {
        heading: null,
        depth: 0,
        content: "",
        codeBlocks: [],
      };
    }
    return currentSection;
  }

  function appendContent(text: string) {
    const section = ensureSection();
    section.content = section.content ? `${section.content}\n\n${text}` : text;
  }

  function cleanInlineMarkup(text: string): string {
    return text
      .replace(/:doc:`([^`<]+)<[^>]+>`/g, "$1")
      .replace(/:doc:`([^`]+)`/g, "$1")
      .replace(/:ref:`([^`<]+)<[^>]+>`/g, "$1")
      .replace(/:ref:`([^`]+)`/g, "$1")
      .replace(/:term:`([^`<]+)<[^>]+>`/g, "$1")
      .replace(/:term:`([^`]+)`/g, "$1")
      .replace(/:file:`([^`]+)`/g, "$1")
      .replace(/:djadmin:`([^`]+)`/g, "$1")
      .replace(/:func:`([^~`]+)`/g, "$1")
      .replace(/:func:`~([^`]+)`/g, (_, name) => name.split(".").pop() || name)
      .replace(/``([^`]+)``/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\|([^|]+)\|/g, "$1");
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line?.trim() ?? "";

    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const nextTrimmed = nextLine?.trim() ?? "";
      
      if (nextTrimmed.length > 0 && 
          headerChars.includes(nextTrimmed[0] ?? "") && 
          nextTrimmed.split("").every(c => c === nextTrimmed[0])) {
        
        if (currentSection) {
          sections.push(currentSection);
        }

        const depth = headerChars.indexOf(nextTrimmed[0] ?? "") + 1;
        currentSection = {
          heading: cleanInlineMarkup(trimmedLine),
          depth,
          content: "",
          codeBlocks: [],
        };
        
        i += 2;
        continue;
      }
    }

    if (trimmedLine.startsWith(".. code-block::") || 
        trimmedLine.startsWith(".. console::") ||
        trimmedLine.startsWith(".. parsed-literal::")) {
      
      const language = trimmedLine.includes("code-block::") 
        ? trimmedLine.split("::")[1]?.trim() || null
        : trimmedLine.includes("console::") ? "bash" : "text";
      
      i++;
      
      while (i < lines.length && (lines[i]?.trim() === "" || lines[i]?.startsWith(" "))) {
        if (lines[i]?.trim() !== "") break;
        i++;
      }
      
      const codeLines: string[] = [];
      const baseIndent = lines[i]?.match(/^(\s*)/)?.[1]?.length ?? 0;
      
      while (i < lines.length) {
        const codeLine = lines[i];
        if (codeLine === undefined) break;
        
        const currentIndent = codeLine.match(/^(\s*)/)?.[1]?.length ?? 0;
        
        if (codeLine.trim() === "") {
          codeLines.push("");
          i++;
          continue;
        }
        
        if (currentIndent < baseIndent && codeLine.trim() !== "") {
          break;
        }
        
        codeLines.push(codeLine.substring(baseIndent));
        i++;
      }
      
      const section = ensureSection();
      section.codeBlocks.push({
        language,
        value: codeLines.join("\n").trimEnd(),
      });
      
      continue;
    }

    if (trimmedLine.startsWith(".. note::") || 
        trimmedLine.startsWith(".. admonition::") ||
        trimmedLine.startsWith(".. warning::")) {
      
      i++;
      
      while (i < lines.length && lines[i]?.trim() === "") {
        i++;
      }
      
      const contentLines: string[] = [];
      const baseIndent = lines[i]?.match(/^(\s*)/)?.[1]?.length ?? 0;
      
      while (i < lines.length) {
        const contentLine = lines[i];
        if (contentLine === undefined) break;
        
        const currentIndent = contentLine.match(/^(\s*)/)?.[1]?.length ?? 0;
        
        if (contentLine.trim() === "") {
          contentLines.push("");
          i++;
          continue;
        }
        
        if (currentIndent < baseIndent && contentLine.trim() !== "") {
          break;
        }
        
        contentLines.push(contentLine.substring(baseIndent));
        i++;
      }
      
      const text = contentLines.join("\n").trim();
      if (text) {
        appendContent(cleanInlineMarkup(text));
      }
      
      continue;
    }

    if (trimmedLine && !trimmedLine.startsWith("..")) {
      const paragraphLines: string[] = [line ?? ""];
      i++;
      
      while (i < lines.length) {
        const nextLine = lines[i];
        const nextTrimmed = nextLine?.trim() ?? "";
        
        if (nextTrimmed === "") {
          break;
        }
        
        if (nextTrimmed.startsWith("..") || 
            (i + 1 < lines.length && 
             lines[i + 1]?.trim() !== "" &&
             headerChars.includes(lines[i + 1]?.[0] ?? "") &&
             (lines[i + 1]?.trim().split("").every(c => c === lines[i + 1]?.[0]) ?? false))) {
          break;
        }
        
        paragraphLines.push(nextLine ?? "");
        i++;
      }
      
      const text = paragraphLines.join(" ").trim();
      if (text) {
        appendContent(cleanInlineMarkup(text));
      }
      
      continue;
    }

    i++;
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}
