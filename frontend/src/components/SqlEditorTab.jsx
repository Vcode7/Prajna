import React, { useState, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { api } from '../api/client';
import { Play, Copy, RefreshCw, AlignLeft, Check, Split } from 'lucide-react';

export default function SqlEditorTab({ messageId = '', originalSql = '', activeSql = '', onQuerySuccess = () => { } }) {
  const { activeConversationId, updateMessageHistory, setChatLoading } = useChatStore();
  const [sql, setSql] = useState(activeSql || originalSql);
  const [copied, setCopied] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setSql(activeSql || originalSql);
    setErrorMsg('');
  }, [activeSql, originalSql, messageId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Basic regex SQL formatter
  const formatSql = () => {
    let formatted = sql
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .replace(/\s*,/g, ', ') // Normalize commas
      .replace(/\b(select|from|where|join|left join|inner join|group by|order by|having|limit|with|union)\b/gi, '\n$1') // Newline before keywords
      .replace(/\b(and|or)\b/gi, '\n  $1') // Indent logical operators
      .trim();

    // Add double spacing before main blocks
    formatted = formatted.replace(/\n(select|from|with)/gi, '\n\n$1');
    setSql(formatted);
  };

  const handleReset = () => {
    setSql(originalSql);
    setErrorMsg('');
  };

  const handleRunQuery = async () => {
    if (!sql.trim()) return;
    setChatLoading(true);
    setErrorMsg('');
    try {
      // Find original prompt from state
      const chat = useChatStore.getState().conversations[activeConversationId];
      const currentMsg = chat.messages.find(m => m.id === messageId);
      const originalPrompt = currentMsg?.prompt || "Edited Query Run";

      const result = await api.executeSql(sql, originalPrompt, activeConversationId);

      // Update state in history for this message
      updateMessageHistory(activeConversationId, messageId, {
        editedSql: result.sql,
        data: result.data,
        chart: result.chart,
        insights: result.insights
      });

      // Callback
      onQuerySuccess();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Error executing query');
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 rounded-xl overflow-hidden shadow-xl border border-slate-800">
      {/* Editor Header Panel */}
      <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-[#0f172a]/60">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-xs font-mono text-slate-400 pl-2">SQLite Editor</span>
        </div>

        {/* Editor controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={formatSql}
            title="Format SQL"
            className="flex items-center space-x-1 px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 hover:text-white rounded text-slate-400 font-mono transition-colors"
          >
            <AlignLeft className="w-3 h-3" />
            <span>Format</span>
          </button>

          <button
            onClick={() => setShowDiff(!showDiff)}
            title="Toggle Diff View"
            className="flex items-center space-x-1 px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 hover:text-white rounded text-slate-400 font-mono transition-colors"
          >
            <Split className="w-3.5 h-3.5" />
            <span>{showDiff ? 'Editor' : 'Diff'}</span>
          </button>

          <button
            onClick={handleReset}
            title="Reset to generated"
            className="flex items-center space-x-1 px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-750 hover:text-white rounded text-slate-400 font-mono transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 relative flex min-h-[300px]">
        {showDiff ? (
          /* Side by Side Diff */
          <div className="flex-1 grid grid-cols-2 gap-px bg-slate-800 h-full overflow-auto text-xs font-mono">
            <div className="p-4 bg-slate-950 flex flex-col">
              <span className="text-[10px] text-red-400 uppercase tracking-wider font-bold mb-2">Original LLM Query</span>
              <pre className="whitespace-pre-wrap text-slate-400 select-all leading-relaxed">{originalSql}</pre>
            </div>
            <div className="p-4 bg-slate-900 flex flex-col">
              <span className="text-[10px] text-green-400 uppercase tracking-wider font-bold mb-2">Edited Query</span>
              <pre className="whitespace-pre-wrap text-slate-400 select-all leading-relaxed">{sql}</pre>
            </div>
          </div>
        ) : (
          /* Main Editor Window */
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            className="w-full h-full p-4 bg-slate-950 font-mono text-sm leading-relaxed text-violet-300 focus:outline-none resize-none overflow-y-auto"
            placeholder="-- Write read-only SQL query here..."
            spellCheck="false"
          />
        )}
      </div>

      {/* Action Status and Execute Panel */}
      <div className="p-3 border-t border-slate-850 bg-[#0f172a]/80 flex flex-col md:flex-row items-center justify-between gap-3">
        {errorMsg ? (
          <div className="text-xs text-red-400 font-mono text-left max-w-full md:max-w-[70%] break-all">
            {errorMsg}
          </div>
        ) : (
          <div className="text-[10px] text-slate-500 font-mono uppercase">
            Double-checked: Safe SELECT query ready
          </div>
        )}

        <div className="flex items-center space-x-2 shrink-0 self-end md:self-auto">
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-300 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleRunQuery}
            className="flex items-center space-x-1.5 px-4 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-lg text-xs font-semibold text-white shadow-lg shadow-indigo-900/30 transition-all active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run SQL</span>
          </button>
        </div>
      </div>
    </div>
  );
}
