import React, { useState } from 'react';
import { Calendar, AlertCircle, RefreshCw, Download, FileSpreadsheet, Search } from 'lucide-react';

interface ReportFilterPanelProps {
  onGenerate: (startDate: string, endDate: string) => void;
  onReset: () => void;
  isLoading: boolean;
  totalRecords?: number;
  activeStartDate?: string;
  activeEndDate?: string;
  onDownloadPDF?: () => void;
  onDownloadExcel?: () => void;
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
}

export function ReportFilterPanel({
  onGenerate,
  onReset,
  isLoading,
  totalRecords,
  activeStartDate,
  activeEndDate,
  onDownloadPDF,
  onDownloadExcel,
  showSearch = false,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...'
}: ReportFilterPanelProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleGenerate = () => {
    setValidationError('');
    if (!startDate || !endDate) {
      setValidationError('Please select both Start Date and End Date.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setValidationError('Start Date cannot be greater than End Date.');
      return;
    }
    onGenerate(startDate, endDate);
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setValidationError('');
    onReset();
  };

  const formatDateString = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  return (
    <div className="bg-white border border-border-gray p-4 rounded-xl space-y-3 shadow-sm no-print">
      {/* Date Pickers & Generate Button */}
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        {showSearch && (
          <div className="flex-1 relative">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-500 placeholder-slate-400 outline-none transition-all"
              />
            </div>
          </div>
        )}
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${showSearch ? 'w-full md:w-96' : 'flex-1'}`}>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setValidationError('');
              }}
              className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2.5 px-3 text-xs text-slate-500 outline-none cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setValidationError('');
              }}
              className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2.5 px-3 text-xs text-slate-500 outline-none cursor-pointer"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
            ) : (
              <Calendar className="h-4 w-4" />
            )}
            Generate Report
          </button>
          
          <button
            onClick={handleReset}
            className="px-4 py-2.5 border border-border-gray hover:bg-secondary-bg text-xs text-slate-500 rounded-xl transition-all cursor-pointer font-semibold"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Validation Message */}
      {validationError && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-alert-text bg-alert-bg border border-alert-border p-2.5 rounded-xl animate-fade-in">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Output Stats and Downloads */}
      {activeStartDate && activeEndDate && !validationError && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 bg-very-light-green border border-light-green/45 p-3 rounded-xl animate-fade-in">
          <span>
            Showing <strong className="text-slate-500">{totalRecords ?? 0}</strong> record{totalRecords === 1 ? '' : 's'} between{' '}
            <strong className="text-slate-500">{formatDateString(activeStartDate)}</strong> and{' '}
            <strong className="text-slate-500">{formatDateString(activeEndDate)}</strong>
          </span>
          
          <div className="flex gap-2 shrink-0">
            {onDownloadPDF && (
              <button
                onClick={onDownloadPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-white bg-primary-green hover:bg-primary-green-hover rounded-lg transition-all cursor-pointer shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </button>
            )}
            {onDownloadExcel && (
              <button
                onClick={onDownloadExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-primary-green bg-white border border-light-green/40 hover:bg-very-light-green rounded-lg transition-all cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Download Excel (.xlsx)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
