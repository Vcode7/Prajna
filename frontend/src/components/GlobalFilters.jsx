import React, { useState } from 'react';
import { Filter, Calendar, Map, Building, Warehouse, Truck, Users } from 'lucide-react';

export default function GlobalFilters({ onApplyFilters = () => { } }) {
  const [filters, setFilters] = useState({
    date_start: '',
    date_end: '',
    region: '',
    department: '',
    warehouse: '',
    supplier: '',
    segment: ''
  });

  const handleChange = (field, val) => {
    const updated = { ...filters, [field]: val };
    setFilters(updated);
    onApplyFilters(updated);
  };

  const handleClear = () => {
    const cleared = {
      date_start: '',
      date_end: '',
      region: '',
      department: '',
      warehouse: '',
      supplier: '',
      segment: ''
    };
    setFilters(cleared);
    onApplyFilters(cleared);
  };

  return (
    <div className="glass-panel p-4 rounded-2xl shadow-sm border border-slate-400 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-400 dark:border-slate-800">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-violet-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Global Dashboard Filters</span>
        </div>
        <button
          onClick={handleClear}
          className="text-[10px] font-semibold text-slate-400 hover:text-violet-400 transition-colors"
        >
          Clear All
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Date Start */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Start Date</label>
          <input
            type="date"
            value={filters.date_start}
            onChange={(e) => handleChange('date_start', e.target.value)}
            className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-250 dark:border-slate-700 px-2 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 text-slate-700 dark:text-slate-350"
          />
        </div>

        {/* Date End */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">End Date</label>
          <input
            type="date"
            value={filters.date_end}
            onChange={(e) => handleChange('date_end', e.target.value)}
            className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-250 dark:border-slate-700 px-2 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 text-slate-700 dark:text-slate-350"
          />
        </div>

        {/* Region */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Region</label>
          <select
            value={filters.region}
            onChange={(e) => handleChange('region', e.target.value)}
            className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-250 dark:border-slate-700 px-2 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 text-slate-750 dark:text-slate-300"
          >
            <option value="">All Regions</option>
            <option value="APAC">APAC</option>
            <option value="AMER">AMER</option>
            <option value="EMEA">EMEA</option>
            <option value="LATAM">LATAM</option>
          </select>
        </div>

        {/* Department */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Department</label>
          <select
            value={filters.department}
            onChange={(e) => handleChange('department', e.target.value)}
            className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-250 dark:border-slate-700 px-2 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 text-slate-755 dark:text-slate-300"
          >
            <option value="">All Depts</option>
            <option value="Sales">Sales</option>
            <option value="Engineering">Engineering</option>
            <option value="Finance">Finance</option>
            <option value="HR">HR</option>
            <option value="Manufacturing">Manufacturing</option>
          </select>
        </div>

        {/* Warehouse */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Warehouse</label>
          <select
            value={filters.warehouse}
            onChange={(e) => handleChange('warehouse', e.target.value)}
            className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-250 dark:border-slate-700 px-2 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 text-slate-755 dark:text-slate-300"
          >
            <option value="">All Warehouses</option>
            <option value="Bengaluru Hub">Bengaluru Hub</option>
            <option value="Mumbai Terminal">Mumbai Terminal</option>
            <option value="Texas Storage">Texas Storage</option>
            <option value="London Depo">London Depo</option>
          </select>
        </div>

        {/* Supplier */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Supplier</label>
          <select
            value={filters.supplier}
            onChange={(e) => handleChange('supplier', e.target.value)}
            className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-250 dark:border-slate-700 px-2 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 text-slate-755 dark:text-slate-300"
          >
            <option value="">All Suppliers</option>
            <option value="Intel Corp">Intel Corp</option>
            <option value="Samsung Electronics">Samsung Electronics</option>
            <option value="Cisco Logistics">Cisco Logistics</option>
            <option value="AWS Reselling">AWS Reselling</option>
          </select>
        </div>

        {/* Customer Segment */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Segment</label>
          <select
            value={filters.segment}
            onChange={(e) => handleChange('segment', e.target.value)}
            className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-250 dark:border-slate-700 px-2 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 text-slate-755 dark:text-slate-300"
          >
            <option value="">All Segments</option>
            <option value="Enterprise">Enterprise</option>
            <option value="Mid-Market">Mid-Market</option>
            <option value="SMB">SMB</option>
          </select>
        </div>
      </div>
    </div>
  );
}
