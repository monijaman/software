"use client";

import { useEffect, useState } from "react";

// Translation is done in the browser by Google's website translator, driven by our own picker.
// The page source stays English; code blocks are marked translate="no" in Markdown.tsx.

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "bn", label: "বাংলা" },
  { code: "hi", label: "हिन्दी" },
  { code: "ur", label: "اردو" },
  { code: "ar", label: "العربية" },
  { code: "zh-CN", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "ru", label: "Русский" },
] as const;

type Lang = (typeof LANGUAGES)[number]["code"];

export const LANG_KEY = "lang";
const SCRIPT_ID = "google-translate-script";

function isLang(value: unknown): value is Lang {
  return LANGUAGES.some((l) => l.code === value);
}

// Match the visitor's browser languages ("bn-BD", "zh-TW", "pt-BR"...) to one we offer.
function detectLanguage(): Lang {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const lower = tag.toLowerCase();
    if (lower.startsWith("zh")) return "zh-CN";
    const base = lower.split("-")[0];
    if (isLang(base)) return base;
  }
  return "en";
}

function savedLanguage(): Lang | null {
  try {
    const value = localStorage.getItem(LANG_KEY);
    return isLang(value) ? value : null;
  } catch {
    return null;
  }
}

// Google's translator reads this cookie on load. It may also set one on the parent domain.
function setTranslateCookie(lang: Lang) {
  const domains = ["", `; domain=${location.hostname}`, `; domain=.${location.hostname}`];
  for (const domain of domains) {
    document.cookie =
      lang === "en"
        ? `googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT${domain}`
        : `googtrans=/en/${lang}; path=/${domain}`;
  }
}

// Google Translate wraps text in <font> tags, which makes React throw when it later
// removes or moves those nodes. Ignore the mismatch instead of crashing the page.
function patchDomForTranslation() {
  const proto = Node.prototype as Node & { __translatePatched?: boolean };
  if (proto.__translatePatched) return;
  proto.__translatePatched = true;

  const removeChild = proto.removeChild;
  proto.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return removeChild.call(this, child) as T;
  };
  const insertBefore = proto.insertBefore;
  proto.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) return node;
    return insertBefore.call(this, node, ref) as T;
  };
}

function loadTranslator() {
  if (document.getElementById(SCRIPT_ID)) return;
  patchDomForTranslation();
  const w = window as unknown as Record<string, unknown>;
  w.googleTranslateElementInit = () => {
    const google = w.google as { translate: { TranslateElement: new (opts: object, id: string) => unknown } };
    new google.translate.TranslateElement(
      { pageLanguage: "en", includedLanguages: LANGUAGES.map((l) => l.code).join(","), autoDisplay: false },
      "google_translate_element",
    );
  };
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  script.async = true;
  document.body.appendChild(script);
}

// Switch without a reload when Google's hidden picker is already on the page.
function switchLoadedTranslator(lang: Lang): boolean {
  const combo = document.querySelector<HTMLSelectElement>(".goog-te-combo");
  if (!combo) return false;
  combo.value = lang;
  combo.dispatchEvent(new Event("change"));
  return true;
}

export default function LanguageSwitcher() {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const initial = savedLanguage() ?? detectLanguage();
    setLang(initial);
    if (initial !== "en") {
      setTranslateCookie(initial);
      loadTranslator();
    }
  }, []);

  function choose(next: Lang) {
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {}
    setLang(next);
    setTranslateCookie(next);

    if (next === "en") {
      // Google's "show original" is unreliable; a reload with the cookie cleared always works.
      if (document.getElementById(SCRIPT_ID)) location.reload();
      return;
    }
    if (!switchLoadedTranslator(next)) loadTranslator();
  }

  return (
    <>
      <label className="lang-switcher" translate="no">
        <span aria-hidden="true">🌐</span>
        <select value={lang} onChange={(e) => choose(e.target.value as Lang)} aria-label="Choose language">
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <div id="google_translate_element" hidden />
    </>
  );
}
