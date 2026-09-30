import React, { useMemo, useRef, useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { useChatStore } from '../store/chatStore';
import { Copy, Download, Search, Check } from 'lucide-react';

// Import AG Grid styles
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

export default function DataGrid({ columns = [], rows = [] }) {
  const { theme } = useChatStore();
  const gridRef = useRef();
  const [quickFilterText, setQuickFilterText] = useState('');
  const [copied, setCopied] = useState(false);

  // Map database columns to AG Grid column definitions
  const columnDefs = useMemo(() => {
    return columns.map(col => ({
      field: col,
      headerName: col.replace(/_/g, ' ').toUpperCase(),
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: 120,
      flex: 1
    }));
  }, [columns]);

  // Set grid options
  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
  }), []);

  // Export to CSV helper
  const handleExportCSV = () => {
    if (!gridRef.current || rows.length === 0) return;
    gridRef.current.api.exportDataAsCsv({
      fileName: `query_results_${new Date().getTime()}.csv`
    });
  };

  // Export to Excel / CSV manual downloader if API export is unavailable
  const handleExportExcel = () => {
    if (rows.length === 0) return;

    // Create CSV content manually to ensure compatibility across Community edition
    const header = columns.join(',');
    const body = rows.map(row =>
      columns.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        const valStr = String(val).replace(/"/g, '""');
        return valStr.includes(',') || valStr.includes('\n') || valStr.includes('"')
          ? `"${valStr}"`
          : valStr;
      }).join(',')
    ).join('\n');

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(header + '\n' + body);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `query_results_${new Date().getTime()}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy rows to clipboard
  const handleCopyClipboard = () => {
    if (rows.length === 0) return;
    const header = columns.join('\t');
    const body = rows.map(row =>
      columns.map(col => String(row[col] ?? '')).join('\t')
    ).join('\n');

    const fullText = header + '\n' + body;
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#111827] rounded-xl overflow-hidden shadow-inner">
      {/* Grid Toolbar Actions */}
      <div className="flex flex-wrap items-center justify-between p-3 border-b border-slate-400 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 space-y-2 sm:space-y-0">
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search rows..."
            value={quickFilterText}
            onChange={(e) => setQuickFilterText(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-400 dark:border-slate-700/80 rounded-lg text-xs text-slate-800 dark:text-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <button
            onClick={handleCopyClipboard}
            className="flex items-center space-x-1 px-3 py-1.5 border border-slate-400 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-300 font-medium transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1 px-3 py-1.5 border border-slate-400 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-300 font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-1 px-3 py-1.5 border border-slate-400 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-300 font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Grid container */}
      <div className="flex-1 w-full min-h-[300px]">
        <div
          className={`w-full h-full ${theme === 'dark' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'}`}
          style={{ height: '350px', width: '100%' }}
        >
          {rows.length > 0 ? (
            <AgGridReact
              ref={gridRef}
              rowData={rows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              pagination={true}
              paginationPageSize={15}
              paginationPageSizeSelector={[10, 15, 30, 50, 100]}
              quickFilterText={quickFilterText}
              animateRows={true}
              domLayout="normal"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-slate-400 italic">
              No dataset returned to display.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
