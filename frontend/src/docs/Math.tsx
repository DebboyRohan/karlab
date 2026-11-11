import "katex/dist/katex.min.css";
import katex from "katex";
import { useMemo } from "react";

function render(tex: string, display: boolean): string {
  return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: false });
}

/** Inline maths, e.g. <M>{"z = y_0(1-t)^e"}</M>. */
export function M({ children }: { children: string }) {
  const html = useMemo(() => render(children, false), [children]);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Display maths on its own line, scrolls sideways on narrow screens. */
export function Eq({ children }: { children: string }) {
  const html = useMemo(() => render(children, true), [children]);
  return <div className="doc-eq" dangerouslySetInnerHTML={{ __html: html }} />;
}
