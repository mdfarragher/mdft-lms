import { marked } from "marked";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import csharp from "highlight.js/lib/languages/csharp";
import fsharp from "highlight.js/lib/languages/fsharp";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("cs", csharp);
hljs.registerLanguage("fsharp", fsharp);
hljs.registerLanguage("fs", fsharp);

/**
 * Syntax highlighting renderer for fenced code blocks.
 * Supports: bash/sh/shell, csharp/cs, fsharp/fs.
 * Falls back to hljs.highlightAuto() for unrecognised languages.
 */
marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const language = lang && hljs.getLanguage(lang) ? lang : null;
      const highlighted = language
        ? hljs.highlight(text, { language }).value
        : hljs.highlightAuto(text).value;
      const langClass = lang ? ` language-${lang.replace(/"/g, "&quot;")}` : "";
      return `<pre><code class="hljs${langClass}">${highlighted}</code></pre>`;
    },
    table(token: any) {
      const header = token.header.map((cell: any) => {
        const align = cell.align ? ` style="text-align:${cell.align}"` : "";
        return `<th${align}>${cell.text}</th>`;
      }).join("");
      const body = token.rows.map((row: any) => {
        const cells = row.map((cell: any) => {
          const align = cell.align ? ` style="text-align:${cell.align}"` : "";
          return `<td${align}>${cell.text}</td>`;
        }).join("");
        return `<tr>${cells}</tr>`;
      }).join("");
      return `<div class="table-responsive my-3"><table class="table table-bordered table-sm align-middle"><thead class="table-light"><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>\n`;
    },
  },
});

/**
 * Extends marked with support for images with CSS class selectors:
 *   ![alt text](url) { .class1 .class2 }
 * renders as:
 *   <img src="url" alt="alt text" class="class1 class2">
 */
const imageWithClassExtension = {
  name: "imageWithClass",
  level: "inline" as const,
  start(src: string) {
    return src.match(/!\[/)?.index;
  },
  tokenizer(src: string, _tokens: any) {
    const rule = /^!\[(.*?)\]\((.*?)\)\s*\{((?:\s*\.[a-zA-Z0-9_-]+)+)\s*\}/;
    const match = rule.exec(src);
    if (match) {
      // Extract individual class names from e.g. " .img-fluid .mb-4"
      const className = match[3]
        .trim()
        .split(/\s+/)
        .map((c) => c.replace(/^\./, ""))
        .join(" ");
      return {
        type: "imageWithClass",
        raw: match[0],
        text: match[1],
        href: match[2],
        className,
        tokens: [],
      };
    }
  },
  renderer(token: any) {
    return `<img src="${token.href}" alt="${token.text}" class="${token.className}">`;
  },
};

marked.use({ extensions: [imageWithClassExtension] });

/**
 * Block extension for AI prompt callout boxes.
 * Syntax (anywhere in a paragraph on its own line):
 *
 *   "Prompt text here"
 *   {.prompt}
 *
 * Renders as a styled callout div with a megaphone icon.
 */
const promptBlockExtension = {
  name: "promptBlock",
  level: "block" as const,
  start(src: string) {
    return src.match(/^"[^"]*"\n\{\.prompt\}/)?.index;
  },
  tokenizer(src: string, _tokens: any) {
    const rule = /^"([^"]*)"\n\{\s*\.prompt\s*\}\n?/;
    const match = rule.exec(src);
    if (match) {
      return {
        type: "promptBlock",
        raw: match[0],
        text: match[1].trim(),
        tokens: [],
      };
    }
  },
  renderer(token: any) {
    const escaped = token.text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    return `<div class="prompt-callout"><i class="bi bi-megaphone-fill prompt-callout-icon"></i><em>${escaped}</em></div>\n`;
  },
};

marked.use({ extensions: [promptBlockExtension] });

/**
 * Block extension for student tip callout boxes.
 * Syntax — with or without a newline before the annotation:
 *
 *   useful tip for the student
 *   { .tip }
 *
 *   useful tip for the student{ .tip }
 *
 * Renders as a styled callout div with a lightbulb icon.
 */
const tipBlockExtension = {
  name: "tipBlock",
  level: "block" as const,
  start(src: string) {
    return src.match(/^ *[^\n{][^\n]*\n? *\{\s*\.tip\s*\}/)?.index;
  },
  tokenizer(src: string, _tokens: any) {
    const rule = /^ *([^\n{][^\n]*)\n *\{\s*\.tip\s*\}\n?|^ *([^\n{][^\n]*?)\{\s*\.tip\s*\}\n?/;
    const match = rule.exec(src);
    if (match) {
      return {
        type: "tipBlock",
        raw: match[0],
        text: (match[1] ?? match[2]).trim(),
        tokens: [],
      };
    }
  },
  renderer(token: any) {
    const escaped = token.text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    return `<div class="tip-callout"><i class="bi bi-lightbulb-fill tip-callout-icon"></i><em>${escaped}</em></div>\n`;
  },
};

marked.use({ extensions: [tipBlockExtension] });

/**
 * Block extension for homework assignment callout boxes.
 * Syntax — with or without a newline before the annotation:
 *
 *   homework assignment
 *   { .homework }
 *
 *   homework assignment{ .homework }
 *
 * Renders as a styled callout div with a pencil icon.
 */
const homeworkBlockExtension = {
  name: "homeworkBlock",
  level: "block" as const,
  start(src: string) {
    return src.match(/^[^\n{][^\n]*\n?\{\s*\.homework\s*\}/)?.index;
  },
  tokenizer(src: string, _tokens: any) {
    const rule = /^([^\n{][^\n]*?)\n?\{\s*\.homework\s*\}\n?/;
    const match = rule.exec(src);
    if (match) {
      return {
        type: "homeworkBlock",
        raw: match[0],
        text: match[1].trim(),
        tokens: [],
      };
    }
  },
  renderer(token: any) {
    const escaped = token.text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    return `<div class="homework-callout"><i class="bi bi-pencil-fill homework-callout-icon"></i><em>${escaped}</em></div>\n`;
  },
};

marked.use({ extensions: [homeworkBlockExtension] });

export { marked };
