import { marked } from "marked";

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

export { marked };
