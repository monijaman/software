"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

// A full-screen viewer rendered into <body>, because images sit inside the <p> Markdown creates.
export default function Lightbox({
  label,
  caption,
  onClose,
  children,
}: {
  label: string;
  caption?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal(); // traps focus, closes on Escape, blocks the page behind
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return createPortal(
    <dialog
      ref={ref}
      className="lightbox"
      aria-label={label}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // click on the dark backdrop
      }}
    >
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <div className="lightbox-body" onClick={onClose}>
        {children}
      </div>
      {caption ? <p className="lightbox-caption">{caption}</p> : null}
    </dialog>,
    document.body,
  );
}
