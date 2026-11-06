import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Model output stays text: raw HTML is never evaluated. */
export function AdvisorMessage({ text }: { text: string }) {
  return <div className="advisor-prose"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
    a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
    table: ({ children }) => <div className="advisor-table"><table>{children}</table></div>,
  }}>{text}</ReactMarkdown></div>;
}
