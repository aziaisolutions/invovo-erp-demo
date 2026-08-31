// src/components/UXPolishSuite.jsx
import React from 'react';
import { formatCurrency, APP_CONFIG } from '../config/appConfig';

// =========================================================================
// 1. GLOBAL MICRO-DETAIL FORMATTERS & FRIENDLY ERRORS
// =========================================================================
export function formatCurrency(value) {
  const num = Number(value);
  if (isNaN(num)) return "${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} 0";
  return "${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} " + num.toLocaleString('en-PK', { maximumFractionDigits: 2 });
}

export function formatNumber(value) {
  const num = Number(value);
  if (isNaN(num)) return "0";
  return num.toLocaleString('en-PK');
}

export function formatDateStandard(dateString) {
  if (!dateString) return "--/--/----";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "--/--/----";
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function getFriendlyError(err, isUrdu = false) {
  console.error("Core Engine Error Log:", err);
  return "Something went wrong. Please refresh the page.";
}

export function showSuccessToast(isUrdu = false) {
  alert("Saved successfully!");
}

// =========================================================================
// 2. STRUCTURAL CONTENT SKELETON SHIMMER (Loading States)
// =========================================================================
export function SkeletonLoader({ rows = 3 }) {
  return (
    <div className="w-full space-y-4 p-4 rounded-xl border border-slate-800 bg-slate-900/20 animate-pulse">
      <div className="h-5 bg-slate-800 rounded w-1/4 mb-4"></div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex justify-between items-center py-2 border-b border-slate-800/40 last:border-0">
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-slate-800 rounded w-1/2"></div>
            <div className="h-3 bg-slate-800/50 rounded w-1/3"></div>
          </div>
          <div className="h-6 bg-slate-800 rounded w-16"></div>
        </div>
      ))}
    </div>
  );
}
// =========================================================================
// 3. UNIVERSAL PREMIUM EMPTY STATE WRAPPER
// =========================================================================
export function EmptyState({ 
  featureName = "Data", 
  actionLabel = "Add", 
  onActionTrigger, 
  isUrdu = false 
}) {
  const messageEn = `${featureName} is empty — Please click below to add.`;
  const messageUr = `No data available in ${featureName} — Please click the button below to add.`;

  return (
    <div className="w-full flex flex-col items-center justify-center p-6 sm:p-12 text-center rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/30 my-4 backdrop-blur-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-4 animate-pulse">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      </div>

      <p className="text-slate-300 text-base font-medium max-w-sm mb-6 leading-relaxed">
        {isUrdu ? messageUr : messageEn}
      </p>

      {onActionTrigger && (
        <button
          onClick={onActionTrigger}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg transition-all active:scale-95 border border-indigo-400/20"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
}
