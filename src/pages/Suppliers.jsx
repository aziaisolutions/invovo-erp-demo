import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRole } from '../hooks/useRole';
import { supabase } from '../lib/supabase';
import { dispatchWhatsAppMessage } from '../utils/erpHelpers';
import { UserCheck, Search, Plus, Edit, Trash2, X, ArrowLeft, Printer } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { formatCurrency, APP_CONFIG } from '../config/appConfig';

export default function Suppliers() {
  const { activeShopId } = useRole();
  const [suppliers, setSuppliers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  // Drill-down views states
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [printPaperSize, setPrintPaperSize] = useState('Thermal'); 

  // 🔒 ERP KHATA SESSION STATE SYSTEM
  const [sessionLoading, setSessionLoading] = useState(false);

  const handleToggleLedgerSession = async () => {
    if (!selectedEntity || !activeShopId) return;
    
    const currentStatus = selectedEntity.khata_status === 'closed' ? 'active' : 'closed';
    const confirmMsg = currentStatus === 'closed' 
      ? "🔒 Kya aap is supplier ka maujooda khata session completely close the current session?" 
      : "🔓 Kya aap is khata session ko Re-open this session for new transactions?";
      
    if (!window.confirm(confirmMsg)) return;

    try {
      setSessionLoading(true);
      
      const { error } = await supabase
        .from('suppliers')
        .update({ khata_status: currentStatus })
        .eq('id', selectedEntity.id)
        .eq('shop_id', activeShopId);

      if (error) throw error;

      setSelectedEntity(prev => ({ ...prev, khata_status: currentStatus }));
      
      setSuppliers(prevSuppliers => prevSuppliers.map(s => 
        s.id === selectedEntity.id ? { ...s, khata_status: currentStatus } : s
      ));

      alert(currentStatus === 'closed' ? "Customer session has been locked successfully!" : "Customer session has been re-activated!");
    } catch (err) {
      console.error("Session Toggle Error:", err);
      alert("Database error: Session status change failed.");
    } finally {
      setSessionLoading(false);
    }
  };

  // 🏢 Shop Memory Profile State
  const [activeShopInfo, setActiveShopInfo] = useState({
    name: 'Demo Company',
    phone: '+1-800-INVOVO',
    address: 'Main Bazar',
    invoice_terms: 'Sold goods cannot be returned or exchanged.',
    footer_message: 'Thank you for using Invovo ERP App!'
  });

  // Modals Overlay States
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showEditSupplierModal, setShowEditSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [showTxModal, setShowTxModal] = useState(false);
  const [newTx, setNewTx] = useState({ type: 'purchase', amount: '', due_date: '', notes: '' });

  const [newSupplier, setNewSupplier] = useState({ supplier_name: '', phone: '', address: '' });

  // 🎯 DATA FETCH ENGINE WITH AUTO SESSION SORTING
  const fetchSuppliersData = useCallback(async () => {
    if (!activeShopId) return;
    try {
      setLoading(true);
      const { data: entityData, error: eError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('shop_id', activeShopId)
        .neq('status', 'archived')
        .neq('status', 'hidden') 
        .order('khata_status', { ascending: true }) // Active top sequence par, Closed automatic niche logs mein
        .order('created_at', { ascending: false });
      if (eError) throw eError;

      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('shop_id', activeShopId)
        .order('created_at', { ascending: true }); 
      if (txError) throw txError;

      setSuppliers(entityData || []);
      setTransactions(txData || []);

      const cachedSettings = localStorage.getItem(`invovo_erp_settings_cache_${activeShopId}`);
      if (cachedSettings) {
        const parsed = JSON.parse(cachedSettings);
        setActiveShopInfo({
          name: parsed.shop_name || 'Demo Company',
          phone: parsed.phone || '+1-800-INVOVO',
          address: parsed.address || 'Main Bazar',
          invoice_terms: parsed.invoice_terms || 'Sold goods cannot be returned or exchanged.',
          footer_message: parsed.footer_message || 'Thank you for using Invovo ERP App!'
        });
      }
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeShopId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSuppliersData();
  }, [fetchSuppliersData]);

  
  const filteredSuppliers = suppliers.filter(s => {
    const nameStr = s.supplier_name || s.name || '';
    return nameStr.toLowerCase().includes(searchTerm.toLowerCase()) || String(s.phone || '').includes(searchTerm);
  });

  const suppliersWithBalances = useMemo(() => {
    const txBySupplier = transactions.reduce((acc, tx) => {
      if (tx && String(tx.party_type).toLowerCase() === 'supplier') {
        const id = String(tx.party_id);
        if (!acc[id]) acc[id] = [];
        acc[id].push(tx);
      }
      return acc;
    }, {});

    return filteredSuppliers.map((s) => {
      const supplierTx = txBySupplier[String(s.id)] || [];
      
      const realTimeBalance = supplierTx.reduce((acc, tx) => {
        const tType = String(tx.transaction_type).toLowerCase();
        if (tType === 'purchase') return acc + parseFloat(tx.total_bill || tx.amount || 0) - parseFloat(tx.cash_paid_received || 0);
        else if (tType === 'payment_out' || tType === 'payment') return acc - parseFloat(tx.cash_paid_received || tx.amount || 0);
        else if (tType === 'return') return acc - parseFloat(tx.amount || 0);
        return acc;
      }, 0);

      const latestTx = supplierTx[supplierTx.length - 1];
      const realTimeDueDate = latestTx && latestTx.due_date ? latestTx.due_date.split('-').reverse().join('/') : (s.due_date ? s.due_date.split('-').reverse().join('/') : 'No Due Date');
      const statusTag = realTimeBalance <= 0 ? 'paid' : 'partially_paid';

      let totalBillSum = 0;
      supplierTx.forEach(t => {
        if (String(t.transaction_type).toLowerCase() === 'purchase') totalBillSum += parseFloat(t.total_bill || t.amount || 0);
      });

      return {
        ...s,
        realTimeBalance,
        realTimeDueDate,
        statusTag,
        totalBillSum
      };
    });
  }, [filteredSuppliers, transactions]);

  const entityTransactions = useMemo(() => {
    if (!selectedEntity || !Array.isArray(transactions)) return [];
    return transactions.filter(tx => tx && String(tx.party_id) === String(selectedEntity.id) && tx.party_type && String(tx.party_type).toLowerCase() === 'supplier');
  }, [selectedEntity, transactions]);

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    if (!activeShopId) return;
    const cleanPhone = newSupplier.phone.replace(/\D/g, '');
    if (!newSupplier.supplier_name.trim()) return;

    try {
      const payload = {
        shop_id: activeShopId,
        supplier_name: newSupplier.supplier_name.trim(),
        phone: cleanPhone || null,
        address: newSupplier.address.trim() || null,
        payment_due: 0
      };

      const { data, error } = await supabase.from('suppliers').insert([payload]).select().single();
      if (error) throw error;

      setSuppliers([data, ...suppliers]);
      setShowAddSupplierModal(false);
      setNewSupplier({ supplier_name: '', phone: '', address: '' });
      alert("Supplier profile created successfully!");
    } catch (err) {
      alert(err.message || 'Failed to save supplier.');
    }
  };

  const handleUpdateSupplier = async (e) => {
    e.preventDefault();
    if (!editingSupplier || !editingSupplier.supplier_name.trim()) return;
    const cleanPhone = editingSupplier.phone.replace(/\D/g, '');

    try {
      const { data, error } = await supabase
        .from('suppliers')
        .update({
          supplier_name: editingSupplier.supplier_name.trim(),
          phone: cleanPhone || null,
          address: editingSupplier.address?.trim() || null
        })
        .eq('id', editingSupplier.id)
        .eq('shop_id', activeShopId)
        .select()
        .single();

      if (error) throw error;

      setSuppliers(suppliers.map(sup => sup.id === editingSupplier.id ? data : sup));
      setShowEditSupplierModal(false);
      setEditingSupplier(null);
      alert("Supplier profile updated successfully!");
      fetchSuppliersData();
    } catch (err) {
      alert(err.message || "Issue occurred during update.");
    }
  };

  const handleDeleteSupplier = async (supplierId) => {
    const targetSup = suppliers.find(s => s.id === supplierId);
    if (!targetSup) return;

    const userChoice = window.prompt(
      `Supplier Management Center:\n========================\nChoose Action for: ${targetSup.supplier_name || targetSup.name}\n\n` +
      `Type '1' : Soft Delete / Archive Account Only\n` +
      `Type '2' : Full Ledger Cancellation (Full ERP Reversal with Auto Stock Sync)\n` +
      `Type '3' : Partial Return (Partial/Multi-Item Purchase Return Engine)`
    );

    if (!userChoice) return;

    if (userChoice === '1') {
      if (Math.abs(parseFloat(targetSup.payment_due || targetSup.balance_due || 0)) > 0) {
        alert("🚨 SAFETY LOCK: There is an outstanding balance! Please clear the balance (0) before archiving.");
        return;
      }
      const confirmLog = window.confirm("Are you sure you want to archive this supplier profile? Profile will be removed from the active dashboard.");
      if (!confirmLog) return;
      
      setLoading(true);
      try {
        const { error } = await supabase
          .from('suppliers')
          .update({ status: 'archived' })
          .eq('id', supplierId)
          .eq('shop_id', activeShopId);

        if (error) throw error;
        setSuppliers(suppliers.filter(s => s.id !== supplierId));
        alert("Supplier archived successfully.");
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    else if (userChoice === '2') {
      alert("🚨 SAFETY ALERT: 'Full Ledger Cancellation' system band kar diya gaya hai kyunke yeh fragile data-scraping par mabni tha. \n\n✅ Kripya Option '3' (Partial Return) istemal karein, jo ab directly supplier stock aur ledger ko accurately sync karta hai!");
      return;
    }
    else if (userChoice === '3') {
      setLoading(true);
      try {
        const { data: allProds, error: prodFetchErr } = await supabase
          .from('products')
          .select('id, current_stock, name, purchase_price')
          .eq('shop_id', activeShopId)
          .eq('supplier_id', supplierId)
          .gt('current_stock', 0);

        if (prodFetchErr) throw prodFetchErr;
        if (!allProds || allProds.length === 0) {
          alert("🚨 No active stock products found in the store!");
          setLoading(false);
          return;
        }

        let returnBatchItems = [];
        let totalReturnBillAmount = 0;
        let continueAdding = true;
        setLoading(false);

        while (continueAdding) {
          let itemMenuString = `Select Item for Return [Item #${returnBatchItems.length + 1}]:\n====================================\n`;
          allProds.forEach((prod, index) => {
            itemMenuString += `${index + 1}) ${prod.name} (Stock: ${prod.current_stock || 0} | Rate: Rs.${parseFloat(prod.purchase_price || 0).toFixed(1)})\n`;
          });
          itemMenuString += `\nEnter Option Number:`;

          const userSelectionInput = window.prompt(itemMenuString);
          if (!userSelectionInput || userSelectionInput.trim() === "") break;

          const selectionIndex = parseInt(userSelectionInput) - 1;
          const selectedProduct = allProds[selectionIndex];

          if (!selectedProduct) {
            alert("🚨 Invalid Option! Please try again.");
            continue;
          }

          const currentStockNum = parseFloat(selectedProduct.current_stock || 0);
          const inputQty = window.prompt(`Supplier Return [${selectedProduct.name}]:\n====================================\nAvailable stock: ${currentStockNum}\n\nHow much quantity are you returning to the supplier?`);
          const returnQty = parseFloat(inputQty);

          if (isNaN(returnQty) || returnQty <= 0 || returnQty > currentStockNum) {
            alert("🚨 Invalid Quantity or Stock check failed!");
            continue;
          }

          const defaultRate = parseFloat(selectedProduct.purchase_price || 0);
          const inputRate = window.prompt(`Rate [${selectedProduct.name}]:`, defaultRate);
          const finalRate = parseFloat(inputRate);

          if (isNaN(finalRate) || finalRate <= 0) {
            alert("🚨 Invalid Rate!");
            continue;
          }

          totalReturnBillAmount += (returnQty * finalRate);
          returnBatchItems.push({
            id: selectedProduct.id,
            name: selectedProduct.name,
            qty: returnQty,
            rate: finalRate
          });

          const nextChoice = window.prompt("Type 'YES' to add another item, or press Enter:");
          if (!nextChoice || nextChoice.trim().toUpperCase() !== 'YES') continueAdding = false;
        }

        if (returnBatchItems.length === 0) return;
        setLoading(true);

        for (const item of returnBatchItems) {
          const { data: liveProduct } = await supabase
            .from('products')
            .select('current_stock')
            .eq('id', item.id)
            .single();
            
          if (liveProduct) {
            const updatedStock = parseFloat(liveProduct.current_stock || 0) - item.qty;
            const finalSafeStock = Math.max(0, updatedStock); 
            await supabase.from('products').update({ current_stock: finalSafeStock }).eq('id', item.id).eq('shop_id', activeShopId);
          }
        }

        const currentSupplierDebt = parseFloat(targetSup.payment_due || targetSup.balance_due || 0);
        const newSupplierDebt = Math.max(0, currentSupplierDebt - totalReturnBillAmount);

        await supabase.from('suppliers').update({ payment_due: newSupplierDebt }).eq('id', supplierId).eq('shop_id', activeShopId);

        const itemSummaryNotes = returnBatchItems.map(i => `${i.name} (${i.qty} Qty)`).join(', ');
        await supabase.from('transactions').insert([{
          shop_id: activeShopId,
          party_id: parseInt(supplierId),
          party_type: 'supplier',
          transaction_type: 'return', 
          amount: totalReturnBillAmount,
          cash_paid_received: 0, 
          remaining_balance: newSupplierDebt,
          notes: `Return: Sent [ ${itemSummaryNotes} ] to Supplier.`
        }]);

        alert(`🎉 Return voucher completed successfully!`);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        fetchSuppliersData();
      }
    }
  };

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    if (!selectedEntity) return;

    // 🔒 BARRIER SYSTEM: Closed session mein transaction block karna
    if (selectedEntity?.khata_status === 'closed') {
      alert("🚨 This Session is Closed! You cannot log new bills or payments.");
      return;
    }

    const amount = parseFloat(newTx.amount);
    if (isNaN(amount) || amount <= 0) return;

    try {
      const { data: liveSup, error: liveSupErr } = await supabase.from('suppliers').select('payment_due').eq('id', selectedEntity.id).single();
      if (liveSupErr) throw liveSupErr;
      
      const currentBalance = parseFloat(liveSup?.payment_due || 0);
      let newBalance = currentBalance;
      let totalBill = 0;
      let cashPaidReceived = 0;

      if (newTx.type === 'purchase') {
        newBalance += amount;
        totalBill = amount;
      } else if (newTx.type === 'payment_out') {
        newBalance -= amount;
        cashPaidReceived = amount;
      }

      const payload = {
        shop_id: activeShopId,
        party_id: parseInt(selectedEntity.id),
        party_type: 'supplier',
        transaction_type: newTx.type,
        amount: amount,
        remaining_balance: parseFloat(newBalance),
        due_date: newTx.due_date || null,
        notes: newTx.notes || null,
        total_bill: totalBill,
        cash_paid_received: cashPaidReceived
      };

      const { data, error } = await supabase.from('transactions').insert([payload]).select().single();
      if (error) throw error;

      await supabase.from('suppliers').update({ payment_due: parseFloat(newBalance) }).eq('id', selectedEntity.id);

      setTransactions([...transactions, data]);
      setSelectedEntity({ ...selectedEntity, payment_due: newBalance, due_date: newTx.due_date || null });
      setShowTxModal(false);
      setNewTx({ type: 'purchase', amount: '', due_date: '', notes: '' });
      fetchSuppliersData();
    } catch (err) {
      alert(err.message || 'Failed to save transaction.');
    }
  };

  const handlePrint = () => window.print();

  if (!activeShopId) return null;
  if (loading && suppliers.length === 0) return <LoadingSpinner />;

  const currentOutstandingTotal = selectedEntity ? entityTransactions.reduce((acc, tx) => {
    const tType = String(tx.transaction_type).toLowerCase();
    if (tType === 'purchase') return acc + parseFloat(tx.total_bill || tx.amount || 0) - parseFloat(tx.cash_paid_received || 0);
    else if (tType === 'payment_out' || tType === 'payment') return acc - parseFloat(tx.cash_paid_received || tx.amount || 0);
    else if (tType === 'return') return acc - parseFloat(tx.amount || 0);
    return acc;
  }, 0) : 0;

  return (
    <div className="animate-in fade-in duration-500 text-left">
      
      {/* 📄 OPTIMIZED CSS MEDIA SCRIPT FOR SUPPLIERS WITH MONO PROTECTOR */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { 
           size: ${printPaperSize === 'Thermal' ? '80mm auto' : printPaperSize === 'Legal' ? 'legal portrait' : 'A4 portrait'}; 
            margin: ${printPaperSize === 'Thermal' ? '0mm' : '8mm'};
          }
          html, body, #root, main, .min-h-screen { 
            background: #ffffff !important; color: #000000 !important; font-family: system-ui, sans-serif !important; 
            min-height: 0 !important;
            height: auto !important;
            position: static !important;
            overflow: visible !important;
          }
          .no-print, .no-print *, button, select, nav, aside, header { 
            display: none !important; 
            visibility: hidden !important; 
            opacity: 0 !important; 
            height: 0 !important; 
            padding: 0 !important; 
            margin: 0 !important; 
          }
          #printable-ledger { 
            position: static !important; width: 100% !important; height: auto !important;
            max-width: ${printPaperSize === 'Thermal' ? '76mm' : '100%'} !important;
            padding: ${printPaperSize === 'Thermal' ? '2mm 1mm' : '0px'} !important; 
            margin: ${printPaperSize === 'Thermal' ? '0 auto' : '0'} !important; 
            background: #ffffff !important; box-shadow: none !important; border: none !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; margin-top: 8px !important; border: 1px solid #000000 !important; }
          th, td { 
            padding: ${printPaperSize === 'Thermal' ? '3px 1px' : '6px 5px'} !important; 
            font-size: ${printPaperSize === 'Thermal' ? '7pt' : '9pt'} !important; 
            border: 1px solid #000000 !important; color: #000000 !important; 
          }
          th { background: #f1f5f9 !important; font-weight: 900 !important; border-top: 1.5px solid #000000 !important; border-bottom: 1.5px solid #000000 !important; text-transform: uppercase; }
          .font-mono { font-family: Courier, monospace !important; white-space: nowrap !important; }
        }
      `}} />

      {!selectedEntity ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 p-6 rounded-3xl border border-indigo-500/30 shadow-2xl shadow-indigo-500/10 relative overflow-hidden group text-left bg-[#050b21] no-print">
            <div className="absolute inset-0 opacity-60 pointer-events-none transition-all duration-700 mix-blend-screen" style={{ background: 'linear-gradient(-45deg, #4338ca 0%, #7c3aed 25%, #db2777 50%, #2563eb 75%, #4338ca 100%)', backgroundSize: '300% 300%', animation: 'InvovoERPVibrantWave 5s ease-in-out infinite' }} />
            <style dangerouslySetInnerHTML={{__html: `@keyframes InvovoERPVibrantWave { 0% { background-position: 0% 50% } 50% { background-position: 100% 50% } 100% { background-position: 0% 50% } }`}} />
            <div className="relative flex items-center gap-4 text-left z-10">
              <div className="p-3.5 bg-slate-900/80 border border-indigo-400/50 rounded-2xl text-2xl shadow-xl backdrop-blur-md animate-bounce duration-1000">🏭</div>
              <div>
                <h2 className="text-[11px] font-black tracking-widest text-indigo-300 uppercase font-mono bg-slate-950/40 px-2 py-0.5 rounded w-max border border-indigo-500/20 backdrop-blur-sm">Accounts Payable</h2>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase mt-1.5" style={{ textShadow: '0 2px 20px rgba(219,39,119,0.6), 0 4px 10px rgba(99,102,241,0.6)' }}>
                  Purchase Invoices &amp; Bills
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap no-print z-10 self-end md:self-center w-full sm:w-auto">
              <button type="button" onClick={() => setShowAddSupplierModal(true)} className="flex-1 sm:flex-none px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-md transition-all duration-300 transform active:scale-95 border border-indigo-500/40 cursor-pointer flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Add New Supplier</button>
            </div>
          </div>

          <div className="relative max-w-md mb-6 no-print">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" placeholder="Search suppliers by business title..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-bold focus:outline-none" />
          </div>

          {filteredSuppliers.length === 0 ? (
            <EmptyState icon={UserCheck} title="No Suppliers Found" description="Add entries to start tracking ledgers." buttonText="Understood" />
          ) : (
            <div className="bg-white dark:bg-slate-800/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden animate-in fade-in">
              <div className="overflow-x-auto">
                <div className="overflow-x-auto w-full"><table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-sm uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      <th className="p-5 font-bold text-left whitespace-nowrap">Supplier Code</th>
                      <th className="p-5 font-bold text-left whitespace-nowrap">Supplier Name</th>
                      <th className="p-5 font-bold text-left whitespace-nowrap">Total Bill</th>
                      <th className="p-5 font-bold text-left whitespace-nowrap">Net Balance Due</th>
                      <th className="p-5 font-bold text-left whitespace-nowrap">Status</th>
                      <th className="p-5 font-bold text-left whitespace-nowrap">Date Created</th>
                      <th className="p-5 font-bold text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50 text-slate-800 dark:text-slate-200 font-bold">
                    {suppliersWithBalances.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-100/40 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="p-5 font-black font-mono text-indigo-600 dark:text-indigo-400 text-left whitespace-nowrap">SUP-{String(s.id).padStart(2, '0')}</td>
                        <td className="p-5 text-left whitespace-nowrap">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <span className="text-slate-900 dark:text-slate-100 font-black">{s.supplier_name || s.name || 'Unnamed Supplier'}</span>
                            
                            {/* 👑 DYNAMIC RTL URDU SESSION STATUS BADGE */}
                            {s.khata_status === 'closed' ? (
                              <span dir="rtl" className="w-max inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black border bg-rose-500/10 text-rose-400 border-rose-500/20">
                                🔒 Session Closed
                              </span>
                            ) : (
                              <span dir="rtl" className="w-max inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                ⚡ Active Session
                              </span>
                            )}
                          </div>
                          {(s.address || s.Address) && <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">🏠 {s.address || s.Address}</p>}
                        </td>
                        <td className="p-5 font-black font-mono text-left whitespace-nowrap">{formatCurrency(s.totalBillSum)}</td>
                        <td className="p-5 text-left whitespace-nowrap">
                          <div className={`font-black font-mono ${s.realTimeBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{formatCurrency(s.realTimeBalance)}</div>
                          <div className="text-xs text-slate-400 mt-1 font-black font-mono">{s.realTimeDueDate}</div>
                        </td>
                        <td className="p-5 text-left whitespace-nowrap">{s.statusTag === 'paid' ? <span className="px-2.5 py-1 rounded-lg text-xs font-bold border bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 uppercase tracking-wider">Paid</span> : <span className="px-2.5 py-1 rounded-lg text-xs font-bold border bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 uppercase tracking-wider">PARTIAL</span>}</td>
                        <td className="p-5 text-sm text-slate-500 dark:text-slate-400 text-left font-mono font-bold whitespace-nowrap">{s.created_at ? new Date(s.created_at).toLocaleDateString('en-GB') : '26/06/2026'}</td>
                        <td className="p-5 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2 min-w-max">
                            <button type="button" onClick={() => setSelectedEntity(s)} className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-600 transition-colors cursor-pointer">View</button>
                            <button type="button" onClick={() => { setEditingSupplier(s); setShowEditSupplierModal(true); }} className="p-2 bg-slate-200 dark:bg-slate-700 hover:bg-indigo-600 text-slate-600 dark:text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-300 dark:border-slate-600"><Edit className="w-4 h-4" /></button>
                            <button type="button" onClick={() => handleDeleteSupplier(s.id)} className="p-2 bg-slate-200 dark:bg-slate-700 hover:bg-rose-600 text-slate-600 dark:text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-300 dark:border-slate-600"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div id="printable-ledger" className="bg-white p-3 sm:p-6 rounded-2xl shadow-2xl border border-slate-200 text-slate-900 mx-auto max-w-3xl font-sans text-left">
          <div className="no-print mb-6 flex flex-wrap justify-between items-center gap-4 border-b border-slate-100 pb-4">
            <button type="button" onClick={() => setSelectedEntity(null)} className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg text-sm cursor-pointer font-bold"><ArrowLeft className="w-4 h-4" /> Back to List</button>
            <div className="flex flex-wrap gap-4 items-center">
              
              {/* 🔒 ERP SESSION LOCK / UNLOCK SYSTEM TRIGGER */}
              <button
                type="button"
                disabled={sessionLoading}
                onClick={handleToggleLedgerSession}
                className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all border shadow-sm ${
                  selectedEntity?.khata_status === 'closed'
                    ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500/40'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                }`}
              >
                {sessionLoading ? 'Syncing...' : selectedEntity?.khata_status === 'closed' ? '🔓 Re-open Ledger Session' : '🔒 Close Current Session'}
              </button>

             <select value={printPaperSize} onChange={(e) => setPrintPaperSize(e.target.value)} className="bg-slate-800 px-3 py-2 text-xs text-white rounded-xl focus:outline-none cursor-pointer font-bold">
              <option value="A4">Standard A4 Page</option>
              <option value="Legal">Legal Size Sheet</option>
              <option value="Thermal">80mm POS Thermal Slip</option>
            </select>
              <button type="button" onClick={handlePrint} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold cursor-pointer text-sm"><Printer className="w-4 h-4" /> Print Statement</button>
              <button 
                type="button"
                disabled={isGeneratingPDF}
                onClick={async () => {
                  const activePhone = selectedEntity?.phone || selectedEntity?.whatsapp_number || selectedEntity?.mobile || selectedEntity?.contact_number || selectedEntity?.cell || '';
                  if (!activePhone || String(activePhone).trim() === '' || String(activePhone).length < 10) {
                    alert("🚨 Error: WhatsApp mobile number is not registered!");
                    return;
                  }
                  try {
                    setIsGeneratingPDF(true);
                    const totalBaqi = currentOutstandingTotal;

                    let contextBlock = `🔹 *Outstanding Balance Due:* ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(totalBaqi).toLocaleString()}`;
                    if (entityTransactions.length > 0) {
                      const latestTx = entityTransactions[entityTransactions.length - 1];
                      const tType = String(latestTx.transaction_type).toLowerCase();
                      if (tType === 'payment_out' || tType === 'payment') {
                        const paymentAmount = parseFloat(latestTx.cash_paid_received || latestTx.amount || 0);
                        const previousBaqi = totalBaqi + paymentAmount;
                        contextBlock = `📊 *Previous Total Balance:* ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(previousBaqi).toLocaleString()}\n💵 *Payment Made:* ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(paymentAmount).toLocaleString()}\n🔹 *New Remaining Balance:* ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(totalBaqi).toLocaleString()}`;
                      } else if (tType === 'purchase') {
                        const billTotal = parseFloat(latestTx.total_bill || latestTx.amount || 0);
                        const cashPaid = parseFloat(latestTx.cash_paid_received || 0);
                        contextBlock = `🧾 *Total Purchase Bill:* ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(billTotal).toLocaleString()}\n💵 *Ada Kiye Gaye (Cash Paid):* ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(cashPaid).toLocaleString()}\n🔹 *Baki Remaining Balance:* ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(totalBaqi).toLocaleString()}`;
                      }
                    }

                    const msg = `*Invovo ERP Supplier Ledger* 📊\n\n` +
                      `🏢 *Business / Shop Details:*\n` +
                      `• *Shop:* ${activeShopInfo?.name || 'Invovo'}\n` +
                      `• *Phone:* ${activeShopInfo?.phone || '03336825383'}\n` +
                      `• *Address:* ${activeShopInfo?.address || 'District Mianwali'}\n\n` +
                      `Dear *${selectedEntity.supplier_name || selectedEntity.name}*,\n` +
                      `Your complete live ledger summary is provided below:\n\n` +
                      `${contextBlock}\n\n` +
                      `---\n` +
                      `_Powered by Invovo | Invovo ERP_`;
                    
                    dispatchWhatsAppMessage(activePhone, msg);
                  } catch (e) {
                    console.error("WhatsApp Error:", e);
                    alert("WhatsApp dispatch error.");
                  } finally {
                    setIsGeneratingPDF(false);
                  }
                }}
                className={`px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold cursor-pointer text-sm ${isGeneratingPDF ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isGeneratingPDF ? '⏳ Generating...' : '💬 WhatsApp Slip'}
              </button>
            </div>
          </div>

          <div className="border-b border-slate-200 pb-4 mb-4 flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <h2 className="text-2xl font-black text-indigo-900 uppercase tracking-tight">{activeShopInfo.name}</h2>
              <p className="text-xs text-slate-700 font-semibold mt-1">🏠 Address: {activeShopInfo.address}</p>
              <p className="text-xs text-slate-700 font-mono font-bold mt-0.5">📱 Phone: {activeShopInfo.phone}</p>
            </div>
            <div className="text-left sm:text-right">
              <div className="bg-slate-900 text-white px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-widest inline-block sm:block">SUPPLIER LEDGER</div>
              <p className="text-xs text-slate-500 font-mono font-bold mt-2">Code: <span className="text-slate-800 font-black font-sans">SUP-{String(selectedEntity.id).padStart(2, '0')}</span></p>
              <p className="text-xs text-slate-500 font-medium">Date: <span className="text-slate-800 font-bold">{new Date().toLocaleDateString('en-GB')}</span></p>
            </div>
          </div>

          <div className="mb-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col gap-1 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600"></div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="inline-block bg-indigo-600 text-white px-2 py-0.5 text-[9px] font-black tracking-wider rounded-md uppercase w-max">SUPPLIER INFO</div>
              
              <span className={`px-2 py-0.5 text-[10px] font-black rounded-md border uppercase font-mono tracking-wider ${
                selectedEntity?.khata_status === 'closed' ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-emerald-100 text-emerald-700 border-emerald-300'
              }`}>
                ● {selectedEntity?.khata_status === 'closed' ? 'Session Closed' : 'Active'}
              </span>
            </div>
            <p className="text-sm font-black text-slate-800 uppercase m-0 mt-1">{selectedEntity.supplier_name || selectedEntity.name || 'Unnamed Supplier'}</p>
            {selectedEntity.phone && <p className="text-xs text-slate-600 font-mono font-bold">📱 Phone: {selectedEntity.phone}</p>}
            {(selectedEntity.address || selectedEntity.Address) && <p className="text-xs text-slate-600 font-semibold">🏠 Address: {selectedEntity.address || selectedEntity.Address}</p>}
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-100/40 overflow-x-auto overflow-y-visible mb-5">
            <div className="overflow-x-auto w-full"><table className="w-full text-left border-collapse text-xs">
              <thead>
               <tr className="bg-slate-900 text-white text-[11px] uppercase font-bold">
              <th className="p-2 text-white border border-slate-700 whitespace-nowrap" style={{ width: printPaperSize === 'Thermal' ? '25%' : '18%' }}>Date</th>
              <th className="p-2 text-white border border-slate-700 whitespace-nowrap" style={{ width: printPaperSize === 'Thermal' ? '27%' : '32%' }}>Details</th>
              <th className="p-2 text-right text-white border border-slate-700 whitespace-nowrap" style={{ width: printPaperSize === 'Thermal' ? '15%' : '16%' }}>Debit (Purchase)</th>
              <th className="p-2 text-right text-white border border-slate-700 whitespace-nowrap" style={{ width: printPaperSize === 'Thermal' ? '15%' : '16%' }}>Credit (Paid)</th>
              <th className="p-2 text-right text-orange-400 border border-slate-700 whitespace-nowrap" style={{ width: printPaperSize === 'Thermal' ? '18%' : '18%' }}>Balance</th>
            </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold text-xs">
                {(() => {
                  let accumulativeBalance = 0;
                  const rowsWithBalance = entityTransactions.map((tx) => {
                    const tType = String(tx.transaction_type).toLowerCase();
                    const isPurchase = tType === 'purchase';
                    const amt = parseFloat(tx.total_bill || tx.amount || 0);
                    const paid = isPurchase ? parseFloat(tx.cash_paid_received || 0) : parseFloat(tx.cash_paid_received || tx.amount || 0);
                    
                    if (isPurchase) {
                      accumulativeBalance += amt;
                      accumulativeBalance -= paid;
                    } else {
                      accumulativeBalance -= paid;
                    }
                    
                    return { ...tx, isPurchase, amt, paid, currentLineBalance: accumulativeBalance };
                  });

              return rowsWithBalance.reverse().map((tx, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                      <td className="p-2 font-mono whitespace-nowrap border border-slate-200">{new Date(tx.created_at).toLocaleDateString('en-GB')}</td>
                      <td className="p-2 text-slate-800 whitespace-normal break-words border border-slate-200 whitespace-nowrap">
                        {tx.isPurchase ? '📦 Purchase Bill' : '💰 Cash Paid Out'} {tx.notes ? ` - ${tx.notes}` : ''}
                      </td>
                      <td className="p-2 text-right font-mono text-rose-600 font-bold border border-slate-200 whitespace-nowrap">{tx.isPurchase ? Number(tx.amt).toLocaleString() : '0'}</td>
                      <td className="p-2 text-right font-mono text-emerald-600 font-bold border border-slate-200 whitespace-nowrap">{Number(tx.paid).toLocaleString()}</td>
                      <td className="p-2 text-right font-mono text-indigo-950 font-black whitespace-nowrap border border-slate-200">{Number(tx.currentLineBalance).toLocaleString()}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table></div>
          </div>

          <div className="flex justify-end mb-4">
            <div className="w-full sm:w-80 bg-slate-900 text-white p-5 rounded-2xl shadow-xl flex flex-col gap-3 text-sm font-semibold">
              <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-1 pt-1">
                <span className="text-orange-400 text-xs font-black uppercase">OUTSTANDING BALANCE:</span>
                <span className="font-mono font-black text-xl text-orange-400">Rs. {Number(currentOutstandingTotal).toLocaleString()}</span>
              </div>
              {currentOutstandingTotal <= 0 && (
                <div className="w-full p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-center font-black rounded-xl text-xs flex items-center justify-center gap-1.5 uppercase tracking-wide">✓ FULLY PAID</div>
              )}
            </div>
          </div>

          <div className="no-print mt-4 pt-4 border-t border-slate-100 flex justify-start">
            {selectedEntity?.khata_status === 'closed' ? (
              <div className="w-full p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-center font-black rounded-xl text-xs uppercase tracking-wide">🔒 SESSION CLOSED (No new transactions allowed)</div>
            ) : (
              <button type="button" onClick={() => { setNewTx({ type: 'purchase', amount: '', due_date: '', notes: '' }); setShowTxModal(true); }} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer">➕ Log Fast Transaction</button>
            )}
          </div>

          <div className='mt-8 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-500 font-bold'>{activeShopInfo.footer_message}</div>
          <div className='mt-2 pt-2 border-t border-dashed border-slate-300 text-center text-[9px] text-slate-400 font-bold font-mono uppercase tracking-wider'>Powered by Invovo (Contact: +92 305 9352744)</div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 shadow-2xl rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto text-xs font-bold">
            <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
              <h3 className="text-xl font-bold text-white">Create New Supplier</h3>
              <button type="button" onClick={() => setShowAddSupplierModal(false)} className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateSupplier} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Supplier Name *</label>
                <input type="text" required value={newSupplier.supplier_name} onChange={e => setNewSupplier({...newSupplier, supplier_name: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Phone</label>
                <input type="tel" inputMode="numeric" pattern="[0-9]*" value={newSupplier.phone || ''} onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white font-mono outline-none" placeholder="03001234567" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Address</label>
                <input type="text" value={newSupplier.address || ''} onChange={e => setNewSupplier({...newSupplier, address: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white outline-none" placeholder="Business address" />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowAddSupplierModal(false)} className="flex-1 py-3 px-4 bg-slate-700 text-white rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Supplier Modal */}
      {showEditSupplierModal && editingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 shadow-2xl rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto text-xs font-bold">
            <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
              <h3 className="text-xl font-bold text-white">Edit Supplier</h3>
              <button type="button" onClick={() => { setShowEditSupplierModal(false); setEditingSupplier(null); }} className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleUpdateSupplier} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Supplier Name *</label>
                <input type="text" required value={editingSupplier.supplier_name || ''} onChange={e => setEditingSupplier({...editingSupplier, supplier_name: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Phone</label>
                <input type="tel" inputMode="numeric" pattern="[0-9]*" value={editingSupplier.phone || ''} onChange={e => setEditingSupplier({...editingSupplier, phone: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white font-mono outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Address</label>
                <input type="text" value={editingSupplier.address || editingSupplier.Address || ''} onChange={e => setEditingSupplier({...editingSupplier, address: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white outline-none" />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => { setShowEditSupplierModal(false); setEditingSupplier(null); }} className="flex-1 py-3 px-4 bg-slate-700 text-white rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl">Update</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Transaction Modal */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 shadow-2xl rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto text-xs font-bold">
            <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
              <h3 className="text-xl font-bold text-white">Log Transaction</h3>
              <button type="button" onClick={() => setShowTxModal(false)} className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveTransaction} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Transaction Type</label>
                <select value={newTx.type} onChange={e => setNewTx({...newTx, type: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white cursor-pointer">
                  <option value="purchase">Total Bill (Purchase)</option>
                  <option value="payment_out">Cash Paid</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Amount ({APP_CONFIG.defaultCurrency}) *</label>
                <input type="number" inputMode="decimal" min="1" required value={newTx.amount} onChange={e => setNewTx({...newTx, amount: e.target.value})} onFocus={(e) => e.target.select()} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white font-mono outline-none" placeholder="Enter amount..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Due Date</label>
                <input type="date" value={newTx.due_date} onChange={e => setNewTx({...newTx, due_date: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
                <input type="text" value={newTx.notes} onChange={e => setNewTx({...newTx, notes: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white" placeholder="Transaction details..." />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowTxModal(false)} className="flex-1 py-3 px-4 bg-slate-700 text-white rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
