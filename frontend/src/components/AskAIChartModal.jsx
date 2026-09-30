import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import {
  Sparkles, Send, RefreshCw, X, Check, ArrowRight,
  Code, ChevronDown, ChevronUp, Bot, User, Trash2, HelpCircle
} from 'lucide-react';

const SUGGESTIONS = [
  'Change monthly sales to yearly sales',
  'Convert this line chart to a bar chart',
  'Show sales by region instead',
  'Use revenue instead of sales',
  'Switch to a Donut chart',
  'Top 10 categories by total',
  'Show average instead of sum'
];

export default function AskAIChartModal({
  isOpen,
  onClose,
  card,
  dashboardId,
  projectId,
  onApply,
  conversationHistory = [],
  onUpdateConversation
}) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSqlPreview, setShowSqlPreview] = useState(false);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [isOpen, conversationHistory]);

  if (!isOpen || !card) return null;

  const handleSubmit = async (textToSend) => {
    const queryText = (textToSend || prompt).trim();
    if (!queryText || loading) return;

    setLoading(true);
    setError(null);

    const userMsg = {
      role: 'user',
      content: queryText,
      timestamp: new Date().toISOString()
    };

    const nextHistory = [...conversationHistory, userMsg];
    if (onUpdateConversation) {
      onUpdateConversation(nextHistory);
    }
    setPrompt('');

    try {
      const res = await api.askAICardModification({
        dashboard_id: dashboardId,
        card_id: card.id,
        user_prompt: queryText,
        project_id: projectId || card.dataset_id,
        current_card: card,
        conversation_history: conversationHistory.map(m => ({
          role: m.role,
          content: m.content
        }))
      });

      const assistantMsg = {
        role: 'assistant',
        content: res.explanation || `Updated chart to ${res.card?.chart_type || card.chart_type}.`,
        chart_type: res.card?.chart_type,
        sql_query: res.card?.sql_query,
        timestamp: new Date().toISOString()
      };

      const finalHistory = [...nextHistory, assistantMsg];
      if (onUpdateConversation) {
        onUpdateConversation(finalHistory);
      }

      // Apply the generated chart configuration and refreshed data
      if (onApply) {
        onApply(res.card, res.data, res.explanation);
      }
    } catch (err) {
      console.error('Ask AI error:', err);
      setError(err.message || 'Failed to modify chart with AI. Please try rephrasing your request.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleClearHistory = () => {
    if (onUpdateConversation) {
      onUpdateConversation([]);
    }
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#0f1422] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-scaleUp">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-violet-50/50 via-indigo-50/30 to-purple-50/50 dark:from-violet-950/20 dark:via-slate-900/40 dark:to-indigo-950/20">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-violet-500/20">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Ask AI — Chart Copilot
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                  Selected Chart
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-md">
                Modifying: <strong className="text-slate-700 dark:text-slate-200">{card.title}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Chart Context Badges Strip */}
        <div className="px-4 py-2 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto text-[11px]">
          <div className="flex items-center space-x-2 shrink-0">
            <span className="px-2 py-0.5 rounded-lg bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300 font-bold">
              {card.chart_type}
            </span>
            {card.x_variable && (
              <span className="px-2 py-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                X: {card.x_variable}
              </span>
            )}
            {card.y_variable && (
              <span className="px-2 py-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                Y: {card.y_variable} ({card.aggregation || 'none'})
              </span>
            )}
            <span className="px-2 py-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              {card.width || card.col_span || 6} cols × {card.height || 360}px
            </span>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            {card.sql_query && (
              <button
                onClick={() => setShowSqlPreview(!showSqlPreview)}
                className="text-[10px] text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-slate-200/50 dark:hover:bg-slate-800"
                title="Toggle SQL preview"
              >
                <Code className="w-3 h-3" />
                <span>SQL</span>
                {showSqlPreview ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
              </button>
            )}
            {conversationHistory.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-[10px] text-slate-400 hover:text-rose-500 flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30"
                title="Clear conversation history for this chart"
              >
                <Trash2 className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Collapsible SQL Preview */}
        {showSqlPreview && card.sql_query && (
          <div className="p-3 bg-slate-900 text-violet-300 text-[11px] font-mono border-b border-slate-800 overflow-x-auto max-h-24">
            {card.sql_query}
          </div>
        )}

        {/* Chat / Messages Flow */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3 min-h-[220px] max-h-[360px]">
          {conversationHistory.length === 0 ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto shadow-inner">
                <Sparkles className="w-6 h-6 text-violet-500" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Tell Prajna how to modify this chart
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Ask to change metrics, dimensions, time groupings, or chart styles in natural language.
                  Your chart’s position and sizing will be preserved.
                </p>
              </div>

              {/* Suggestions Grid */}
              <div className="pt-2 flex flex-wrap gap-1.5 justify-center max-w-lg mx-auto">
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSubmit(s)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-violet-100 dark:bg-slate-800/80 dark:hover:bg-violet-950/70 border border-slate-200/80 dark:border-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:text-violet-700 dark:hover:text-violet-300 transition-all text-left flex items-center space-x-1"
                  >
                    <span>{s}</span>
                    <ArrowRight className="w-2.5 h-2.5 opacity-50" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {conversationHistory.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed space-y-1.5 ${
                      msg.role === 'user'
                        ? 'bg-violet-600 text-white rounded-br-xs shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-xs border border-slate-200/70 dark:border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 opacity-70 text-[10px]">
                      {msg.role === 'user' ? (
                        <>
                          <User className="w-3 h-3" />
                          <span>You</span>
                        </>
                      ) : (
                        <>
                          <Bot className="w-3 h-3 text-violet-500 dark:text-violet-400" />
                          <span className="font-bold text-violet-600 dark:text-violet-400">Prajna Copilot</span>
                        </>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* If assistant returned updated chart info */}
                    {msg.chart_type && (
                      <div className="pt-1 flex items-center space-x-2 text-[10px]">
                        <span className="px-2 py-0.5 rounded bg-violet-200/60 dark:bg-violet-950 text-violet-800 dark:text-violet-300 font-bold">
                          {msg.chart_type}
                        </span>
                        {msg.sql_query && (
                          <span className="text-slate-400 font-mono truncate max-w-[240px]">
                            {msg.sql_query}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>
          )}

          {/* Loading Animation */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-xs p-3 text-xs border border-slate-200/70 dark:border-slate-700/60 flex items-center space-x-2.5">
                <RefreshCw className="w-4 h-4 animate-spin text-violet-600 dark:text-violet-400" />
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  Analyzing schema & regenerating chart configuration...
                </span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
              <p className="font-bold">Modification failed:</p>
              <p className="mt-0.5">{error}</p>
            </div>
          )}
        </div>

        {/* Quick Follow-up Pills (when chat is active) */}
        {conversationHistory.length > 0 && !loading && (
          <div className="px-4 py-1.5 bg-slate-50/60 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800/80 flex items-center space-x-1.5 overflow-x-auto text-[10px]">
            <span className="text-slate-400 shrink-0">Quick suggestions:</span>
            {SUGGESTIONS.slice(0, 4).map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSubmit(s)}
                className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 shrink-0 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f1422]">
          <div className="relative flex items-center">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="e.g. Change monthly sales to yearly sales, convert to bar chart..."
              className="w-full pl-3.5 pr-24 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
            />
            <div className="absolute right-1.5 flex items-center space-x-1">
              <button
                onClick={() => handleSubmit()}
                disabled={!prompt.trim() || loading}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all ${
                  prompt.trim() && !loading
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-xs'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Send</span>
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 px-1">
            <span>Press <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">Enter</kbd> to apply</span>
            <span>Position, size, and layout are preserved</span>
          </div>
        </div>

      </div>
    </div>
  );
}
