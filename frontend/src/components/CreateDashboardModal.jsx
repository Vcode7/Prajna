import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Sparkles, Database, X, Check,
  ArrowRight, Loader2, FileText, Table
} from 'lucide-react';

export default function CreateDashboardModal({
  isOpen,
  onClose,
  onSubmit,
  projects = [],
  activeProjectId = null,
  initialMode = 'blank' // 'blank' | 'ai'
}) {
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId || '');
  const [title, setTitle] = useState('');
  const [generationType, setGenerationType] = useState(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const proj = projects.find(p => p.id === activeProjectId) || projects[0];
      if (proj) {
        setSelectedProjectId(proj.id);
        setTitle(generationType === 'ai' ? `${proj.name} — AI Dashboard` : `${proj.name} Dashboard`);
      } else {
        setTitle('Executive Dashboard');
      }
      setGenerationType(initialMode);
      setError(null);
      setLoading(false);
    }
  }, [isOpen, activeProjectId, initialMode, projects]);

  const handleProjectSelect = (projId) => {
    setSelectedProjectId(projId);
    const proj = projects.find(p => p.id === projId);
    if (proj) {
      setTitle(generationType === 'ai' ? `${proj.name} — AI Dashboard` : `${proj.name} Dashboard`);
    }
  };

  const handleModeChange = (mode) => {
    setGenerationType(mode);
    const proj = projects.find(p => p.id === selectedProjectId);
    if (proj) {
      setTitle(mode === 'ai' ? `${proj.name} — AI Dashboard` : `${proj.name} Dashboard`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a dashboard title.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onSubmit({
        project_id: selectedProjectId || null,
        title: title.trim(),
        type: generationType
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedProj = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-scaleUp">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`w-8 h-8 rounded-xl ${generationType === 'ai' ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-violet-600 dark:text-violet-400'} flex items-center justify-center shadow-xs`}>
              {generationType === 'ai' ? <Sparkles className="w-4 h-4" /> : <LayoutDashboard className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                {generationType === 'ai' ? 'Generate Dashboard with AI' : 'Create New Dashboard'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Choose data session, configure title and layout method
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Mode Switcher */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
              Dashboard Creation Mode
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleModeChange('blank')}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-1 ${
                  generationType === 'blank'
                    ? 'border-violet-600 bg-violet-50/50 dark:bg-violet-950/30 text-slate-900 dark:text-white ring-1 ring-violet-500'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <LayoutDashboard className="w-4 h-4 text-violet-500" />
                  <span className="text-xs font-bold">Blank Canvas</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Build custom sections and place charts manually.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('ai')}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-1 ${
                  generationType === 'ai'
                    ? 'border-violet-600 bg-violet-50/50 dark:bg-violet-950/30 text-slate-900 dark:text-white ring-1 ring-violet-500'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                  <span className="text-xs font-bold">Generate with AI</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  LLM analyzes schema and generates complete multi-tab layout.
                </p>
              </button>
            </div>
          </div>

          {/* Session / Data Source Selection */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
              Select Session / Data Source
            </label>
            {projects.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No datasets or sessions found. Please upload a dataset first.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {projects.map((proj) => {
                  const isSelected = proj.id === selectedProjectId;
                  return (
                    <div
                      key={proj.id}
                      onClick={() => handleProjectSelect(proj.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-xs ${
                        isSelected
                          ? 'border-violet-500 bg-violet-50/40 dark:bg-violet-950/20 text-slate-900 dark:text-white font-semibold shadow-2xs'
                          : 'border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <Database className={`w-3.5 h-3.5 ${isSelected ? 'text-violet-500' : 'text-slate-400'}`} />
                        <span className="truncate">{proj.name}</span>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0 text-[10px] text-slate-400">
                        <span>{proj.row_count || 0} rows</span>
                        <span>•</span>
                        <span>{proj.column_count || 0} cols</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 ml-1" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dashboard Title Input */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
              Dashboard Heading / Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Executive Performance Dashboard"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:border-violet-500"
              required
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white flex items-center space-x-1.5 shadow-md shadow-violet-500/20 disabled:opacity-50 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  <span>{generationType === 'ai' ? 'AI is Designing Dashboard...' : 'Creating Dashboard...'}</span>
                </>
              ) : (
                <>
                  {generationType === 'ai' ? <Sparkles className="w-3.5 h-3.5" /> : <LayoutDashboard className="w-3.5 h-3.5" />}
                  <span>{generationType === 'ai' ? 'Generate Dashboard' : 'Create Dashboard'}</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
