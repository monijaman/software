"use client";

import { useEffect, useId, useState } from "react";
import Lightbox from "./Lightbox";

function currentTheme(): "dark" | "default" {
  const forced = document.documentElement.dataset.theme;
  if (forced) return forced === "dark" ? "dark" : "default";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default";
}

export default function Mermaid({ chart }: { chart: string }) {
  const id = "m" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState<string>();
  const [error, setError] = useState<string>();
  const [theme, setTheme] = useState<"dark" | "default">();
  const [open, setOpen] = useState(false);

  // Follow both the OS setting and the header theme toggle.
  useEffect(() => {
    const update = () => setTheme(currentTheme());
    update();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      media.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!theme) return;
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme,
          securityLevel: "strict",
          fontFamily: "inherit",
          flowchart: { curve: "basis", htmlLabels: true },
        });
        const result = await mermaid.render(`${id}-${theme}`, chart);
        if (!cancelled) {
          setSvg(result.svg);
          setError(undefined);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, id, theme]);

  if (error) {
    return (
      <div className="diagram diagram-error">
        <strong>Diagram could not be drawn.</strong>
        <p className="diagram-error-message">{error}</p>
        <pre>{chart}</pre>
      </div>
    );
  }
  if (!svg) return <div className="diagram diagram-loading" aria-busy="true">Drawing diagram…</div>;
  return (
    <>
      <button type="button" className="diagram zoomable" onClick={() => setOpen(true)} aria-label="Enlarge diagram">
        <span role="img" dangerouslySetInnerHTML={{ __html: svg }} />
      </button>
      {open ? (
        <Lightbox label="Diagram" onClose={() => setOpen(false)}>
          <div className="lightbox-diagram" dangerouslySetInnerHTML={{ __html: svg }} />
        </Lightbox>
      ) : null}
    </>
  );
}
