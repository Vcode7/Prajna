import React, { useState, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { api } from '../api/client';
import {
  Database, Table, Key, Eye, Info, ChevronDown, ChevronRight, Hash, Type,
  ShoppingCart, Package, Truck, Factory, DollarSign, Users, Headphones, Layers
} from 'lucide-react';

const MODULE_DEFINITIONS = [
  {
    key: 'sales',
    title: 'Sales & Revenue',
    icon: ShoppingCart,
    color: 'text-violet-500',
    tables: ['orders', 'order_items', 'customers', 'products', 'categories', 'salespersons', 'regions']
  },
  {
    key: 'inventory',
    title: 'Inventory & Logistics',
    icon: Package,
    color: 'text-sky-500',
    tables: ['warehouses', 'inventory', 'reorder_levels', 'stock_movement']
  },
  {
    key: 'supply_chain',
    title: 'Supply Chain',
    icon: Truck,
    color: 'text-amber-500',
    tables: ['suppliers', 'purchase_orders', 'shipments']
  },
  {
    key: 'manufacturing',
    title: 'Manufacturing & Ops',
    icon: Factory,
    color: 'text-emerald-500',
    tables: ['factories', 'production_lines', 'machines', 'production_orders', 'machine_downtime', 'production_costs']
  },
  {
    key: 'finance',
    title: 'Finance & Budgeting',
    icon: DollarSign,
    color: 'text-indigo-500',
    tables: ['expenses', 'budgets', 'payments']
  },
  {
    key: 'hr',
    title: 'Human Resources',
    icon: Users,
    color: 'text-pink-500',
    tables: ['departments', 'employees', 'attendance', 'performance_reviews']
  },
  {
    key: 'crm',
    title: 'CRM & Support',
    icon: Headphones,
    color: 'text-teal-500',
    tables: ['leads', 'opportunities', 'support_tickets']
  }
];

export default function DatabaseExplorer() {
  const { dbMetadata, setDbMetadata, dbLoading, setDbLoading } = useChatStore();
  const [expandedGroups, setExpandedGroups] = useState({ sales: true, inventory: true });
  const [expandedTables, setExpandedTables] = useState({});
  const [previewTable, setPreviewTable] = useState(null);

  useEffect(() => {
    async function loadSchema() {
      if (dbMetadata) return;
      setDbLoading(true);
      try {
        const schema = await api.getSchema();
        setDbMetadata(schema);
      } catch (err) {
        console.error("Failed to load schema", err);
      } finally {
        setDbLoading(false);
      }
    }
    loadSchema();
  }, [dbMetadata, setDbMetadata, setDbLoading]);

  const toggleGroup = (groupKey) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const toggleTable = (tableName) => {
    setExpandedTables(prev => ({
      ...prev,
      [tableName]: !prev[tableName]
    }));
  };

  if (dbLoading) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center space-x-2 text-violet-400">
          <Database className="w-5 h-5 animate-pulse" />
          <span className="text-sm font-medium animate-pulse">Loading schema explorer...</span>
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-6 w-full bg-slate-400 dark:bg-slate-800 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!dbMetadata || !dbMetadata.tables) {
    return (
      <div className="p-4 text-xs text-slate-400">
        No database schema loaded. Connect a database in settings.
      </div>
    );
  }

  const allDbTables = Object.keys(dbMetadata.tables);

  // Categorize tables into defined modules
  const groupedModules = MODULE_DEFINITIONS.map(mod => {
    const presentTables = mod.tables.filter(t => allDbTables.includes(t));
    return {
      ...mod,
      presentTables
    };
  }).filter(m => m.presentTables.length > 0);

  // Collect any remaining tables not assigned to standard modules
  const assignedTables = new Set(MODULE_DEFINITIONS.flatMap(m => m.tables));
  const otherTables = allDbTables.filter(t => !assignedTables.has(t));
  if (otherTables.length > 0) {
    groupedModules.push({
      key: 'other',
      title: 'General & Other Tables',
      icon: Layers,
      color: 'text-slate-400',
      presentTables: otherTables
    });
  }

  return (
    <div className="flex flex-col h-full text-slate-700 dark:text-slate-300">
      <div className="flex items-center space-x-2 p-3 border-b border-slate-400 dark:border-slate-800">
        <Database className="w-4 h-4 text-violet-500" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Database Explorer</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {groupedModules.map(module => {
          const isGroupExpanded = !!expandedGroups[module.key];
          const IconComp = module.icon;

          return (
            <div key={module.key} className="rounded-xl border border-slate-400/60 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/30 overflow-hidden">
              {/* Group Accordion Header */}
              <div
                onClick={() => toggleGroup(module.key)}
                className="flex items-center justify-between p-2.5 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 cursor-pointer select-none transition-colors"
              >
                <div className="flex items-center space-x-2 min-w-0">
                  {isGroupExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <IconComp className={`w-4 h-4 ${module.color} shrink-0`} />
                  <span className="text-xs font-bold tracking-tight text-slate-800 dark:text-slate-400 truncate">
                    {module.title}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-400/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full shrink-0">
                  {module.presentTables.length} {module.presentTables.length === 1 ? 'table' : 'tables'}
                </span>
              </div>

              {/* Group Tables */}
              {isGroupExpanded && (
                <div className="px-2 pb-2 pt-1 space-y-1 border-t border-slate-400/50 dark:border-slate-800/50">
                  {module.presentTables.map(tableName => {
                    const tableInfo = dbMetadata.tables[tableName];
                    const isTableExpanded = !!expandedTables[tableName];

                    return (
                      <div key={tableName} className="rounded-lg transition-colors overflow-hidden">
                        {/* Table header row */}
                        <div
                          className="flex items-center justify-between p-1.5 hover:bg-slate-400/50 dark:hover:bg-slate-800/60 cursor-pointer rounded-md"
                          onClick={() => toggleTable(tableName)}
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            {isTableExpanded ? (
                              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                            ) : (
                              <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                            )}
                            <Table className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            <span className="text-xs font-medium truncate font-mono">{tableName}</span>
                            <span className="text-[9px] px-1.5 py-0.2 bg-slate-400/60 dark:bg-slate-800/90 text-slate-400 rounded-full font-mono shrink-0">
                              {tableInfo?.row_count ?? 0} rows
                            </span>
                          </div>

                          <button
                            title="Preview sample data"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewTable(tableName);
                            }}
                            className="p-1 text-slate-400 hover:text-violet-400 rounded-md hover:bg-slate-400 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Columns list */}
                        {isTableExpanded && tableInfo?.columns && (
                          <div className="pl-5 pr-2 py-1 space-y-1 border-l border-slate-400 dark:border-slate-800 ml-3 mb-1">
                            <div className="text-[9px] uppercase font-bold text-slate-400 mb-1 flex items-center space-x-1">
                              <Info className="w-2.5 h-2.5 text-slate-400" />
                              <span>Columns ({Object.keys(tableInfo.columns).length})</span>
                            </div>

                            {Object.entries(tableInfo.columns).map(([colName, colProp]) => (
                              <div
                                key={colName}
                                className="group flex flex-col p-1 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 rounded"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-1.5 min-w-0">
                                    {colProp.primary_key ? (
                                      <Key className="w-3 h-3 text-amber-500 shrink-0" />
                                    ) : colProp.type.toLowerCase().includes('int') || colProp.type.toLowerCase().includes('real') ? (
                                      <Hash className="w-3 h-3 text-indigo-400 shrink-0" />
                                    ) : (
                                      <Type className="w-3 h-3 text-emerald-400 shrink-0" />
                                    )}
                                    <span className={`text-[11px] truncate ${colProp.primary_key ? 'font-semibold text-amber-600 dark:text-amber-500' : ''}`}>
                                      {colName}
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-slate-400 font-mono lowercase">
                                    {colProp.type}
                                  </span>
                                </div>

                                <div className="hidden group-hover:flex items-center justify-between text-[9px] text-slate-400 mt-1 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                                  <span>Null: {colProp.null_percentage}%</span>
                                  <span>Uniq: {colProp.unique_values_count}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Display relationships */}
        {dbMetadata.relationships && dbMetadata.relationships.length > 0 && (
          <div className="mt-4 p-2 border-t border-slate-400 dark:border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">Foreign Key Links</span>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {dbMetadata.relationships.map((rel, idx) => (
                <div key={idx} className="text-[10px] bg-slate-100 dark:bg-slate-900 p-2 rounded leading-relaxed">
                  <span className="font-semibold text-violet-400">{rel.from_table}.{rel.from_columns[0]}</span>
                  <span className="text-slate-400 mx-1">→</span>
                  <span className="font-semibold text-emerald-400">{rel.to_table}.{rel.to_columns[0]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sample Row Preview Modal */}
      {previewTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[80vh] flex flex-col bg-white dark:bg-[#121824] border border-slate-400 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden glass-panel-heavy">
            <div className="flex items-center justify-between p-4 border-b border-slate-400 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Table className="w-5 h-5 text-sky-400" />
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  Sample Data preview for <span className="font-mono text-violet-400">{previewTable}</span>
                </h3>
              </div>
              <button
                onClick={() => setPreviewTable(null)}
                className="text-slate-400 hover:text-slate-100 text-sm font-medium px-2.5 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {dbMetadata.tables[previewTable]?.sample_rows?.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-400 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                      {Object.keys(dbMetadata.tables[previewTable].sample_rows[0]).map(col => (
                        <th key={col} className="p-3 text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dbMetadata.tables[previewTable].sample_rows.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                        {Object.values(row).map((val, cellIdx) => (
                          <td key={cellIdx} className="p-3 text-xs font-mono text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={String(val)}>
                            {val === null ? <span className="text-slate-500 italic">null</span> : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-xs text-slate-400 italic">
                  This table contains no rows or sample data could not be fetched.
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-400 dark:border-slate-800 text-right bg-slate-50/50 dark:bg-slate-900/10">
              <span className="text-[10px] text-slate-400 italic">Showing up to 5 sample rows</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
