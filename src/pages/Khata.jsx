import { useState, useEffect, useMemo } from 'react';
import { useRole } from '../hooks/useRole';
import { supabase } from '../lib/supabase';
import { Users, Truck, ArrowLeft, Plus, Printer, Calendar, Edit, FileText } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { formatCurrency, APP_CONFIG } from '../config/appConfig';

export default function Khata() {
  const { activeShopId } = useRole();
  const [activeTab, setActiveTab] = useState('CUSTOMERS'); // CUSTOMERS or SUPPLIERS
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [entities, setEntities] = useState([]); // Array of customers or suppliers
  const [transactions, setTransactions] = useState([]); // All transactions to derive balances
  
  // Navigation State
  const [selectedEntity, setSelectedEntity] = useState(null); // null means list view, object means profile view

  // Modal State for Add Transaction
  const [showTxModal, setShowTxModal] = useState(false);
  const [newTx, setNewTx] = useState({
    type: 'sale',
    amount: '',
    due_date: '',
    notes: ''
  });

  // Modal State for Edit Due Date
  const [editTxId, setEditTxId] = useState(null);
  const [editDueDate, setEditDueDate] = useState('');

  
  const fetchKhataData = async () => {
    if (!activeShopId) return;
    try {
      setLoading(true);
      
      const tableName = activeTab === 'CUSTOMERS' ? 'customers' : 'suppliers';
      
      // Fetch Entities (Customers or Suppliers)
      const { data: entityData, error: eError } = await supabase
        .from(tableName)
        .select('*')
        .eq('shop_id', activeShopId);
        
      if (eError) throw eError;

      // Fetch all transactions for the shop to compute balances
      // entity_type: 'CUSTOMER' or 'SUPPLIER'
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('shop_id', activeShopId)
        .eq('entity_type', activeTab)
        .order('created_at', { ascending: false });

      if (txError) throw txError;

      setEntities(entityData || []);
      setTransactions(txData || []);

    } catch (err) {
      console.error(err);
      console.warn('Ledger data initialized or currently empty for this shop context.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKhataData();
    setSelectedEntity(null);
  }, [activeShopId, activeTab]);

  // Derive latest balance map
  const balancesMap = useMemo(() => {
    const map = {};
    entities.forEach(e => { map[e.id] = 0; });
    const seen = new Set();
    transactions.forEach(tx => {
      if (!seen.has(tx.entity_id)) {
        map[tx.entity_id] = tx.remaining_balance || 0;
        seen.add(tx.entity_id);
      }
    });
    return map;
  }, [transactions, entities]);

  // Filter transactions for selected entity
  const entityTransactions = useMemo(() => {
    if (!selectedEntity) return [];
    return transactions.filter(tx => tx.entity_id === selectedEntity.id);
  }, [selectedEntity, transactions]);

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    if (!selectedEntity) return;

    const amount = parseFloat(newTx.amount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    try {
      // Get the current latest balance for this entity
      const currentBalance = balancesMap[selectedEntity.id] || 0;
      let newBalance = currentBalance;

      if (activeTab === 'CUSTOMERS') {
        if (newTx.type === 'sale') newBalance += amount;
        else if (newTx.type === 'payment_in') newBalance -= amount;
      } else {
        if (newTx.type === 'purchase') newBalance += amount;
        else if (newTx.type === 'payment_out') newBalance -= amount;
      }

      const payload = {
        shop_id: activeShopId,
        entity_id: selectedEntity.id,
        entity_type: activeTab,
        transaction_type: newTx.type,
        amount: amount,
        remaining_balance: newBalance,
        due_date: newTx.due_date || null,
        notes: newTx.notes || null
      };

      const { data, error } = await supabase
        .from('transactions')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      // Update local state without refetching all to be extremely fast
      setTransactions([data, ...transactions]);
      
      setShowTxModal(false);
      setNewTx({ type: activeTab === 'CUSTOMERS' ? 'sale' : 'purchase', amount: '', due_date: '', notes: '' });

    } catch (err) {
      console.error(err);
      alert('Failed to save transaction.');
    }
  };

  const handleSaveEditDueDate = async (e) => {
    e.preventDefault();
    if (!editTxId) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .update({ due_date: editDueDate || null })
        .eq('id', editTxId)
        .eq('shop_id', activeShopId);

      if (error) throw error;

      setTransactions(transactions.map(tx => 
        tx.id === editTxId ? { ...tx, due_date: editDueDate } : tx
      ));
      
      setEditTxId(null);
    } catch (err) {
      alert('Failed to update due date.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!activeShopId) {
    return (
      <div className="p-8 text-center text-white animate-in fade-in">
        <h2 className="text-2xl font-bold mb-4">No Shop Selected</h2>
        <p className="text-slate-400">Please select a workspace to view your Ledger.</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      
      {/* CSS @media print template block embedded inline */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-ledger, #printable-ledger * {
            visibility: visible;
          }
          #printable-ledger {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
            color: black;
            background: white;
          }
          .no-print {
            display: none !important;
          }
          .print-text-black {
            color: #000 !important;
          }
          .print-border {
            border: 1px solid #ddd !important;
          }
          .print-bg-transparent {
            background: transparent !important;
          }
        }
      `}} />

      {/* Main Container */}
      {!selectedEntity ? (
        // MATRIX DIRECTORY VIEW
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Khata / کھاتہ</h1>
              <p className="text-slate-400">Manage digital ledgers, balances, and payments.</p>
            </div>
            
            <div className="flex bg-slate-800 p-1 rounded-xl shadow-lg border border-slate-700">
              <button
                onClick={() => setActiveTab('CUSTOMERS')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === 'CUSTOMERS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                Customers / گاہک
              </button>
              <button
                onClick={() => setActiveTab('SUPPLIERS')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === 'SUPPLIERS' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Truck className="w-4 h-4" />
                Suppliers / سپلائرز
              </button>
            </div>
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : entities.length === 0 ? (
            <EmptyState 
              icon={activeTab === 'CUSTOMERS' ? Users : Truck}
              title={`No ${activeTab === 'CUSTOMERS' ? 'Customers' : 'Suppliers'} Found`}
              description="Add entries through the dedicated module to start tracking ledgers."
              buttonText="Understood"
            />
          ) : (
            <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800 border-b border-slate-700 text-sm uppercase tracking-wider text-slate-400">
                      <th className="p-5 font-medium text-left rtl:text-right">Name</th>
                      <th className="p-5 font-medium text-left rtl:text-right">Phone Number</th>
                      <th className="p-5 font-medium text-left rtl:text-right">Outstanding Balance</th>
                      <th className="p-5 font-medium text-right rtl:text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {entities.map(e => {
                      const balance = balancesMap[e.id] || 0;
                      return (
                        <tr key={e.id} className="hover:bg-slate-700/30 transition-colors text-slate-200">
                          <td className="p-5 font-medium text-left rtl:text-right">{e.supplier_name || e.name || 'Unnamed Supplier'}</td>
                          <td className="p-5 font-mono text-sm text-left rtl:text-right">{e.phone || e.mobile || '-'}</td>
                          <td className="p-5 text-left rtl:text-right">
                            <span className={`font-bold font-mono ${balance > 0 ? 'text-rose-400' : balance < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                              {formatCurrency(Math.abs(balance))} {balance > 0 ? '(Due)' : balance < 0 ? '(Advance)' : ''}
                            </span>
                          </td>
                          <td className="p-5 text-right rtl:text-left">
                            <button 
                              onClick={() => setSelectedEntity(e)}
                              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors border border-slate-600"
                            >
                              View Ledger
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        // EXPANDED LEDGER PROFILE VIEW (Printable)
        <div id="printable-ledger" className="print-bg-transparent print-text-black">
          
          <div className="no-print mb-6">
            <button 
              onClick={() => setSelectedEntity(null)}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Directory
            </button>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-8 border-b border-slate-700/50 print-border">
            <div>
              <h2 className="text-3xl font-bold text-white print-text-black mb-1">{selectedEntity.name}</h2>
              <p className="text-slate-400 print-text-black font-mono">{selectedEntity.phone || selectedEntity.mobile}</p>
              <p className="text-sm font-medium mt-2 text-indigo-400 print-text-black uppercase tracking-widest">{activeTab} LEDGER</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm text-slate-400 print-text-black uppercase mb-1">Net Balance</p>
              <p className={`text-4xl font-black font-mono ${
                  (balancesMap[selectedEntity.id] || 0) > 0 ? 'text-rose-500 print-text-black' : 
                  (balancesMap[selectedEntity.id] || 0) < 0 ? 'text-emerald-500 print-text-black' : 'text-slate-200 print-text-black'
                }`}>
                {formatCurrency(Math.abs(balancesMap[selectedEntity.id] || 0))}
              </p>
              <p className="text-sm font-bold text-slate-300 print-text-black mt-1">
                {(balancesMap[selectedEntity.id] || 0) > 0 ? 'Amount Receivable' : 
                 (balancesMap[selectedEntity.id] || 0) < 0 ? 'Amount Payable' : 'Settled'}
              </p>
            </div>
          </div>

          <div className="no-print flex gap-3 mb-6">
            <button 
              onClick={() => {
                setNewTx({ type: activeTab === 'CUSTOMERS' ? 'sale' : 'purchase', amount: '', due_date: '', notes: '' });
                setShowTxModal(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20"
            >
              <Plus className="w-5 h-5" />
              Add Transaction
            </button>
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors border border-slate-600"
            >
              <Printer className="w-5 h-5" />
              Print Statement / رپورٹ پرنٹ کریں
            </button>
          </div>

          {entityTransactions.length === 0 ? (
            <div className="p-8 text-center bg-slate-800/30 rounded-2xl border border-slate-700/50 print-border no-print">
              <FileText className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-lg text-slate-300 font-medium">No transactions recorded yet.</p>
            </div>
          ) : (
            <div className="bg-slate-800/80 print-bg-transparent backdrop-blur-md border border-slate-700 print-border rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800 print-bg-transparent border-b border-slate-700 print-border text-xs sm:text-sm uppercase tracking-wider text-slate-400 print-text-black">
                      <th className="p-4 font-medium text-left rtl:text-right">Date</th>
                      <th className="p-4 font-medium text-left rtl:text-right">Type</th>
                      <th className="p-4 font-medium text-left rtl:text-right">Notes</th>
                      <th className="p-4 font-medium text-left rtl:text-right">Amount</th>
                      <th className="p-4 font-medium text-left rtl:text-right">Running Bal.</th>
                      <th className="p-4 font-medium text-left rtl:text-right">Due Date</th>
                      <th className="p-4 font-medium text-right rtl:text-left no-print">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50 print-border">
                    {entityTransactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-700/30 transition-colors text-slate-200 print-text-black">
                        <td className="p-4 text-sm whitespace-nowrap text-left rtl:text-right">{new Date(tx.created_at).toLocaleDateString()}</td>
                        <td className="p-4 text-left rtl:text-right">
                          <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider border print-border ${
                            ['sale', 'payment_out'].includes(tx.transaction_type) 
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 print-text-black' 
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 print-text-black'
                          }`}>
                            {tx.transaction_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-slate-400 print-text-black max-w-[150px] truncate text-left rtl:text-right">{tx.notes || '-'}</td>
                        <td className="p-4 font-mono font-bold text-left rtl:text-right">{formatCurrency(tx.amount)}</td>
                        <td className="p-4 font-mono font-medium text-slate-300 print-text-black text-left rtl:text-right">{formatCurrency(tx.remaining_balance)}</td>
                        <td className="p-4 text-sm text-slate-400 print-text-black text-left rtl:text-right">
                          {tx.due_date ? new Date(tx.due_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="p-4 text-right no-print">
                          <button 
                            onClick={() => { setEditTxId(tx.id); setEditDueDate(tx.due_date ? tx.due_date.split('T')[0] : ''); }}
                            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                            title="Edit Due Date"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Transaction Modal */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 no-print">
          <div className="bg-slate-800/90 border border-slate-700 shadow-2xl rounded-3xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
              <h3 className="text-xl font-bold text-white">Log Transaction</h3>
              <button onClick={() => setShowTxModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveTransaction} className="p-6 space-y-5 text-left rtl:text-right">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Transaction Type</label>
                <select 
                  value={newTx.type} 
                  onChange={e => setNewTx({...newTx, type: e.target.value})} 
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white cursor-pointer text-left rtl:text-right"
                >
                  {activeTab === 'CUSTOMERS' ? (
                    <>
                      <option value="sale">Sale (Credit Given)</option>
                      <option value="payment_in">Payment Received</option>
                    </>
                  ) : (
                    <>
                      <option value="purchase">Purchase (Credit Taken)</option>
                      <option value="payment_out">Payment Given</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Amount ({APP_CONFIG.defaultCurrency}) *</label>
                <input 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  required 
                  value={newTx.amount} 
                  onChange={e => setNewTx({...newTx, amount: e.target.value})} 
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white font-mono text-left rtl:text-right" 
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Due Date (Optional)</label>
                <input 
                  type="date" 
                  value={newTx.due_date} 
                  onChange={e => setNewTx({...newTx, due_date: e.target.value})} 
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-left rtl:text-right" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Notes / Comments</label>
                <input 
                  type="text" 
                  value={newTx.notes} 
                  onChange={e => setNewTx({...newTx, notes: e.target.value})} 
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-left rtl:text-right" 
                  placeholder="Invoice # or details..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowTxModal(false)} className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-colors">Save Transaction</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Due Date Modal */}
      {editTxId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 no-print">
          <div className="bg-slate-800/90 border border-slate-700 shadow-2xl rounded-3xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
              <h3 className="text-xl font-bold text-white">Edit Due Date</h3>
              <button onClick={() => setEditTxId(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEditDueDate} className="p-6 space-y-5 text-left rtl:text-right">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">New Due Date</label>
                <input 
                  type="date" 
                  value={editDueDate} 
                  onChange={e => setEditDueDate(e.target.value)} 
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-left rtl:text-right" 
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setEditTxId(null)} className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors">Update</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
