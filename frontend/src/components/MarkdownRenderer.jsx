import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownRenderer({ content, className = "" }) {
  if (!content) return null;

  return (
    <div className={`prose dark:prose-invert max-w-none text-sm leading-relaxed text-slate-700 dark:text-slate-200 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 mt-4 mb-2 border-b border-slate-200 dark:border-slate-800 pb-1.5">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-4 mb-2 flex items-center gap-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-3 mb-1.5">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-2 mb-1">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="mb-3 leading-relaxed text-slate-700 dark:text-slate-300">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 mb-3 space-y-1 text-slate-700 dark:text-slate-300">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-3 space-y-1 text-slate-700 dark:text-slate-300">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">
              {children}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-violet-500 bg-violet-50/60 dark:bg-violet-950/30 px-4 py-2.5 my-3 italic rounded-r-xl text-slate-700 dark:text-slate-300 shadow-xs">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 rounded-xl border border-slate-300 dark:border-slate-800 shadow-sm">
              <table className="min-w-full divide-y divide-slate-300 dark:divide-slate-800 text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-100 dark:bg-slate-800/90 font-semibold text-slate-800 dark:text-slate-200">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-slate-900/40">
              {children}
            </tbody>
          ),
          th: ({ children }) => (
            <th className="px-3.5 py-2.5 text-left font-semibold uppercase tracking-wider text-[11px]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3.5 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">
              {children}
            </td>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900 dark:text-slate-100">
              {children}
            </strong>
          ),
          code: ({ inline, className, children, ...props }) => {
            if (inline) {
              return (
                <code className="bg-slate-100 dark:bg-slate-800 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded font-mono text-xs" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <pre className="bg-slate-900 text-slate-100 p-3.5 rounded-xl overflow-x-auto my-3 text-xs font-mono border border-slate-800 shadow-inner">
                <code {...props}>{children}</code>
              </pre>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
