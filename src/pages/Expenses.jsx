import { useState, useEffect, useMemo } from 'react';
import { useRole } from '../hooks/useRole';
import { supabase } from '../lib/supabase';
import { Receipt, Plus, Edit, Trash2, ShieldAlert, Filter, Search, Calendar } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { formatCurrency, APP_CONFIG } from '../config/appConfig';

export default function Expenses() {
  const { role, activeShopId } = useRole();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL'); // ALL, THIS_MONTH, LAST_MONTH
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const getLocalDateString = () => {
    const d = new Date();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    category: 'other',
    amount: '',
    expense_date: getLocalDateString(),
    notes: ''
  });

  const categories = [
    { id: 'rent', label: 'Rent' },
    { id: 'electricity', label: 'Electricity' },
    { id: 'salaries', label: 'Salaries' },
    { id: 'transport', label: 'Transport' },
    { id: 'other', label: 'Other' }
  ];

  
  const fetchExpenses = async () => {
    if (!activeShopId || role !== 'shop_owner') {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('shop_id', activeShopId)
        .neq('status', 'cancelled')
        .order('expense_date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (err) {
      console.error(err);
      alert('Failed to fetch expenses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [activeShopId, role]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (formData.expense_date && formData.expense_date.trim() !== '') {
        const selectedExpDate = new Date(formData.expense_date);
        const liveTodayLimit = new Date();
        liveTodayLimit.setHours(23, 59, 59, 999); // Allow absolute full today timestamp margin
        if (selectedExpDate > liveTodayLimit) {
          alert("Error: Future dates cannot be selected. Please select a valid date.");
          return;
        }
      }

      const parsedAmount = parseFloat(formData.amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        alert("🚨 ERROR: Amount must be greater than zero.");
        return;
      }

      const payload = {
        shop_id: activeShopId,
        category: formData.category,
        amount: parseFloat(formData.amount),
        expense_date: formData.expense_date,
        notes: formData.notes
      };

      if (editingId) {
        const { error } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', editingId)
          .eq('shop_id', activeShopId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert([payload]);
        if (error) throw error;
      }

      await fetchExpenses();
      setShowModal(false);
      setEditingId(null);
    } catch (err) {
      alert('Failed to save expense.');
    }
  };

  const handleEdit = (expense) => {
    setEditingId(expense.id);
    setFormData({
      category: expense.category || 'other',
      amount: expense.amount || '',
      expense_date: expense.expense_date || getLocalDateString(),
      notes: expense.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to securely archive (soft-delete) this expense? / کیا آپ واقعی اس خرچے کو آرکائیو کرنا چاہتے ہیں؟")) {
      try {
        const { error } = await supabase.from('expenses').update({ status: 'cancelled' }).eq('id', id).eq('shop_id', activeShopId);
        if (error) throw error;
        setExpenses(expenses.filter(e => e.id !== id));
      } catch (err) {
        alert("Failed to soft-delete.");
      }
    }
  };

  // Filtering Logic
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      // Category filter
      if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return false;
      
      // Date filter
      if (dateFilter !== 'ALL') {
        const expDate = new Date(e.expense_date);
        const now = new Date();
        if (dateFilter === 'THIS_MONTH') {
          if (expDate.getMonth() !== now.getMonth() || expDate.getFullYear() !== now.getFullYear()) return false;
        } else if (dateFilter === 'LAST_MONTH') {
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          if (expDate.getMonth() !== lastMonth.getMonth() || expDate.getFullYear() !== lastMonth.getFullYear()) return false;
        }
      }

      // Search Filter
      if (searchTerm && (!e.notes || !e.notes.toLowerCase().includes(searchTerm.toLowerCase()))) {
        return false;
      }

      return true;
    });
  }, [expenses, categoryFilter, dateFilter, searchTerm]);

  const currentMonthTotal = useMemo(() => {
    const now = new Date();
    return expenses
      .filter(e => {
        const d = new Date(e.expense_date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses]);

  // Access Denied View
  if (role !== 'shop_owner') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-rose-500/10 p-6 rounded-full mb-6 border border-rose-500/20 shadow-2xl shadow-rose-500/20">
          <ShieldAlert className="w-16 h-16 text-rose-500" />
        </div>
        <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Access Denied</h1>
        <h2 className="text-2xl font-bold text-rose-400 mb-6 font-urdu">رسائی ممنوع ہے</h2>
        <p className="text-slate-400 max-w-md mx-auto text-lg">
          This module contains secure financial records. Only the Shop Owner has permission to view or manage operational expenses.
        </p>
      </div>
    );
  }

  if (loading && expenses.length === 0) return <LoadingSpinner />;

  return (
    <div className="animate-in fade-in duration-500">
      
      {/* Header & Monthly Total */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Operational Expenses</h1>
          <p className="text-slate-400">Track and manage your shop's daily operational costs.</p>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/50 p-4 rounded-2xl shadow-xl">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Current Month Total <span className="text-[10px] text-slate-500 ml-1">اس ماہ کا کل خرچ</span></p>
            <p className="text-2xl font-black text-rose-400 font-mono">{formatCurrency(currentMonthTotal)}</p>
          </div>
          
          <button 
            onClick={() => {
              setEditingId(null);
              setFormData({ category: 'other', amount: '', expense_date: getLocalDateString(), notes: '' });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20"
          >
            <Plus className="w-5 h-5" />
            Log Expense
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search notes..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <select 
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Time</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="LAST_MONTH">Last Month</option>
          </select>
        </div>
      </div>

      {expenses.length === 0 ? (
        <EmptyState 
          icon={Receipt}
          title="No Expenses Logged"
          description="Keep your accounts clean by recording your daily shop expenses."
          buttonText="Log Expenses"
          onAction={() => setShowModal(true)}
        />
      ) : (
        <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 border-b border-slate-700 text-sm uppercase tracking-wider text-slate-400">
                  <th className="p-5 font-medium text-left rtl:text-right">Date</th>
                  <th className="p-5 font-medium text-left rtl:text-right">Category</th>
                  <th className="p-5 font-medium text-left rtl:text-right">Amount ({APP_CONFIG.defaultCurrency})</th>
                  <th className="p-5 font-medium text-left rtl:text-right">Notes</th>
                  <th className="p-5 font-medium text-right rtl:text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredExpenses.map(e => (
                  <tr key={e.id} className="hover:bg-slate-700/30 transition-colors text-slate-200">
                    <td className="p-5 text-sm text-left rtl:text-right">{new Date(e.expense_date).toLocaleDateString()}</td>
                    <td className="p-5 font-medium text-left rtl:text-right capitalize">
                      <span className="px-2 py-1 bg-slate-700/50 border border-slate-600 rounded text-xs">
                        {e.category}
                      </span>
                    </td>
                    <td className="p-5 font-bold font-mono text-rose-400 text-left rtl:text-right">{formatCurrency(e.amount)}</td>
                    <td className="p-5 text-sm text-slate-400 max-w-[200px] truncate text-left rtl:text-right">{e.notes || '-'}</td>
                    <td className="p-5">
                      <div className="flex justify-end gap-2 rtl:justify-start min-w-max">
                        <button 
                          onClick={() => handleEdit(e)}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(e.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredExpenses.length === 0 && (
              <div className="p-8 text-center text-slate-400">No expenses found matching the current filters.</div>
            )}
          </div>
        </div>
      )}

      {/* Modal Overlay */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-800/90 border border-slate-700 shadow-2xl rounded-3xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
              <h3 className="text-xl font-bold text-white">{editingId ? 'Edit Expense' : 'Log Expense'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors">
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-5 text-left rtl:text-right">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Category</label>
                <select 
                  required
                  value={formData.category} 
                  onChange={e => setFormData({...formData, category: e.target.value})} 
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer text-left rtl:text-right"
                >
                  {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Amount ({APP_CONFIG.defaultCurrency}) *</label>
                <input 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  required 
                  value={formData.amount} 
                  onChange={e => setFormData({...formData, amount: e.target.value})} 
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white font-mono text-left rtl:text-right" 
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Expense Date *</label>
                <input 
                  type="date" 
                  required
                  value={formData.expense_date} 
                  onChange={e => setFormData({...formData, expense_date: e.target.value})} 
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-left rtl:text-right" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes (Optional)</label>
                <input 
                  type="text" 
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})} 
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-left rtl:text-right" 
                  placeholder="Bill # or description..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-colors">Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
