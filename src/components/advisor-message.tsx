import { useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DoraemonVoice } from "./doraemon-voice";

/** Model output stays text: raw HTML is never evaluated. */
export function AdvisorMessage({ text, doraemonVoice }: { text: string; doraemonVoice?: boolean }) {
  const proseRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <div className="advisor-prose" ref={proseRef}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          skipHtml
          components={{
            a: ({ children, href }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
            table: ({ children }) => (
              <div className="advisor-table">
                <table>{children}</table>
              </div>
            ),
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
      {doraemonVoice && (
        <DoraemonVoice key={text} readReply={() => proseRef.current?.innerText ?? ""} />
      )}
    </>
  );
}
