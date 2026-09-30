"use client";

import { useState } from "react";
import Lightbox from "./Lightbox";

export default function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="zoomable" onClick={() => setOpen(true)} aria-label={`Enlarge image${alt ? `: ${alt}` : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" />
      </button>
      {open ? (
        <Lightbox label={alt || "Image"} caption={alt} onClose={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lightbox-image" src={src} alt={alt} />
        </Lightbox>
      ) : null}
    </>
  );
}
