import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import MarkdownRenderer from '../components/MarkdownRenderer';
import {
  Send, Sparkles, MessageSquare, Bot, User, Trash2,
  Database, RefreshCw, BarChart3, BrainCircuit, ArrowRight
} from 'lucide-react';

const SUGGESTED_QUERIES = [
  "How should I handle class imbalance in my dataset?",
  "What is the difference between Random Forest and Gradient Boosting?",
  "Which evaluation metric is best for customer churn prediction?",
  "How do I choose between standard scaling and robust scaling?",
  "Explain feature importance scores and how to interpret them."
];

export default function ChatInterface() {
  const {
    activeDataset, chatMessages, addChatMessage, clearChatMessages,
    settings, setActiveTab
  } = useChatStore();

  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, loading]);

  const handleSend = async (textToSend) => {
    const prompt = textToSend || inputPrompt;
    if (!prompt.trim()) return;

    // Add user message
    addChatMessage({
      role: 'user',
      content: prompt
    });

    setInputPrompt('');
    setLoading(true);

    try {
      // Formulate dataset context if active
      let datasetContext = "";
      if (activeDataset) {
        datasetContext = `ACTIVE DATASET CONTEXT:
Name: ${activeDataset.name}
Rows: ${activeDataset.row_count}, Columns: ${activeDataset.column_count}
Columns: ${Object.keys(activeDataset.column_metadata || {}).join(', ')}`;
      }

      const systemPrompt = `You are a Principal Data Scientist and AI Assistant for PRAJNA (Predictive Research & Analytics for Judgement, Navigation & Action), an end-to-end data analysis and machine learning platform.
Help the user analyze their datasets, understand statistical patterns, choose optimal ML algorithms, interpret evaluation metrics, and optimize data science workflows.
${datasetContext}`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${settings.groq_api_key || ""}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: settings.model || "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            ...chatMessages.slice(-4).map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 1500
        })
      });

      if (response.ok) {
        const data = await response.json();
        const assistantText = data.choices[0]?.message?.content || "I am ready to help with your data analysis.";
        addChatMessage({
          role: 'assistant',
          content: assistantText
        });
      } else {
        // Fallback local response
        addChatMessage({
          role: 'assistant',
          content: `### Data Science Assistant Response\n\nRegarding **"${prompt}"**:\n\n1. **Data Preparation**: Ensure features are preprocessed with suitable imputation and scaling.\n2. **Model Selection**: For tabular data, **Random Forest** or **Gradient Boosting** generally provide robust predictive performance.\n3. **Evaluation**: Always inspect cross-validated F1-score or RMSE rather than raw training accuracy.`
        });
      }
    } catch (err) {
      addChatMessage({
        role: 'assistant',
        content: `### Data Science Guidance\n\nRegarding **"${prompt}"**:\n\nFor tabular datasets like ${activeDataset ? activeDataset.name : 'yours'}, we recommend:\n- **Classification**: Evaluate Precision, Recall, and Confusion Matrix.\n- **Regression**: Optimize for MAE and R² Score.\n- **Clustering**: Measure Silhouette score across distinct clusters.`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto h-[calc(100vh-80px)] flex flex-col justify-between animate-fadeIn text-slate-800 dark:text-slate-200">
      
      {/* ── Chat Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div>
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-violet-500" />
            <h1 className="text-lg font-bold">Data Science AI Assistant</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ask questions about your data, feature engineering, ML algorithms, and metrics.
          </p>
        </div>

        {chatMessages.length > 0 && (
          <button
            onClick={clearChatMessages}
            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Clear Chat History"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Chat Message List ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-2">
        {chatMessages.length === 0 ? (
          <div className="py-12 text-center space-y-4 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-500 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold">How can I help with your data?</h3>
            <p className="text-xs text-slate-400">
              Select a suggested topic or ask any custom question about your active dataset.
            </p>

            <div className="space-y-1.5 text-left pt-2">
              {SUGGESTED_QUERIES.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(q)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-violet-50 dark:hover:bg-violet-950/30 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`p-4 rounded-2xl text-xs max-w-2xl leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-tr-none'
                    : 'bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-tl-none text-slate-800 dark:text-slate-200'
                }`}
              >
                <MarkdownRenderer content={msg.content} />
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-center space-x-2 text-xs text-slate-400 pl-2">
            <RefreshCw className="w-4 h-4 animate-spin text-violet-500" />
            <span>Thinking...</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ── Input Box ───────────────────────────────────────────── */}
      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="pt-3 border-t border-slate-200 dark:border-slate-800 flex gap-2 shrink-0">
        <input
          type="text"
          placeholder={activeDataset ? `Ask about '${activeDataset.name}' or ML best practices...` : "Ask any data science question..."}
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          className="flex-1 text-xs px-4 py-3 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-800 dark:text-slate-200 shadow-sm"
        />
        <button
          type="submit"
          disabled={loading || !inputPrompt.trim()}
          className="px-5 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center space-x-1.5 disabled:opacity-50 transition-all shadow-md shadow-violet-900/20"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span>Send</span>
        </button>
      </form>

    </div>
  );
}
