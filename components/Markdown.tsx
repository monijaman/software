import type { Element, ElementContent } from "hast";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import Mermaid from "./Mermaid";
import ZoomableImage from "./ZoomableImage";

function textOf(node: ElementContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(textOf).join("");
  return "";
}

function mermaidSource(pre: Element | undefined): string | null {
  const code = pre?.children.find((c): c is Element => c.type === "element" && c.tagName === "code");
  const classes = code?.properties?.className;
  if (!code || !Array.isArray(classes) || !classes.includes("language-mermaid")) return null;
  return code.children.map(textOf).join("").trim();
}

export default function MarkdownContent({ source }: { source: string }) {
  return (
    <div className="prose">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSlug, [rehypeHighlight, { plainText: ["mermaid", "text", "txt"] }]]}
        components={{
          pre({ node, children, ...props }) {
            const chart = mermaidSource(node);
            if (chart) return <Mermaid chart={chart} />;
            return <pre {...props}>{children}</pre>;
          },
          // A <figure> may not sit inside the <p> Markdown wraps images in, so use spans.
          img({ src, alt }) {
            if (typeof src !== "string") return null;
            return (
              <span className="figure">
                <ZoomableImage src={src} alt={alt ?? ""} />
                {alt ? <span className="figcaption">{alt}</span> : null}
              </span>
            );
          },
          table({ children }) {
            return (
              <div className="table-wrap">
                <table>{children}</table>
              </div>
            );
          },
          a({ href, children }) {
            const external = href?.startsWith("http");
            return (
              <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {children}
              </a>
            );
          },
        }}
      >
        {source}
      </Markdown>
    </div>
  );
}
