"use client";

import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

// Marginal is told to embed a visualization as a raw <iframe> when a tool
// result carries one, so raw HTML has to survive rehype-raw. Sanitize after
// it, with iframe added to the allow-list -- everything else stays on
// rehype-sanitize's default (GitHub-flavoured) schema.
const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "iframe"],
  attributes: {
    ...defaultSchema.attributes,
    iframe: ["src", "width", "height", "allow", "title", "loading"],
  },
};

export default function MarginalAnswer({ text }: { text: string }) {
  return (
    <div className="lw-md">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
      >
        {text}
      </Markdown>
    </div>
  );
}
