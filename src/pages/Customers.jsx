import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRole } from '../hooks/useRole';
import { supabase } from '../lib/supabase';
import { dispatchWhatsAppMessage } from '../utils/erpHelpers';
import { UserCheck, Search, Plus, Edit, Trash2, X, ArrowLeft, Printer } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { formatCurrency, APP_CONFIG } from '../config/appConfig';

export default function Customers() {
  const { activeShopId } = useRole();
  const [customers, setCustomers] = useState([]);
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
    
    // Check current status (default to active if null/empty)
    const currentStatus = selectedEntity.khata_status === 'closed' ? 'active' : 'closed';
    const confirmMsg = currentStatus === 'closed' 
      ? "🔒 Do you want to completely close the current customer session?" 
      : "🔓 Do you want to Re-open this session for new transactions?";
      
    if (!window.confirm(confirmMsg)) return;

    try {
      setSessionLoading(true);
      
      // Update database status safely without affecting financial rows
      const { error } = await supabase
        .from('customers')
        .update({ khata_status: currentStatus })
        .eq('id', selectedEntity.id)
        .eq('shop_id', activeShopId);

      if (error) throw error;

      // Local State Update inside view context instantly
      setSelectedEntity(prev => ({ ...prev, khata_status: currentStatus }));
      
      // Master list state refresh to ensure visual persistence
      setCustomers(prevCustomers => prevCustomers.map(c => 
        c.id === selectedEntity.id ? { ...c, khata_status: currentStatus } : c
      ));

      alert(currentStatus === 'closed' ? "Customer session has been locked successfully!" : "Customer session has been re-activated!");
    } catch (err) {
      console.error("Session Toggle Error:", err);
      console.error("Database error: Session status change failed.", err);
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
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showTxModal, setShowTxModal] = useState(false);
  const [newTx, setNewTx] = useState({ type: 'sale', amount: '', due_date: '', notes: '' });

  const [newCustomer, setNewCustomer] = useState({ full_name: '', phone: '', address: '' });

  // 🎯 DATA FETCH ENGINE WITH AUTO SESSION SORTING
  const fetchCustomersData = useCallback(async () => {
    if (!activeShopId) return;
    try {
      setLoading(true);
      
      // 1. Customers Fetch WITH EXPLICIT ACCOUNTING SESSION FILTER
      const { data: entityData, error: eError } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', activeShopId)
        .neq('status', 'archived')
        .order('khata_status', { ascending: true }) // Active on top, Closed pushed to bottom logs
        .order('created_at', { ascending: false });
      if (eError) throw eError;

      // 2. Invoices Fetch
      const { data: invData, error: invError } = await supabase
        .from('invoices')
        .select('*')
        .eq('shop_id', activeShopId);
      if (invError) console.error("Invoice Fetch Error:", invError);

      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('shop_id', activeShopId)
        .order('created_at', { ascending: true });
      if (txError) throw txError;

      // 3. Frontend Calculations with Array Mapping
      const allInvoices = invData || [];
      const computedCustomers = (entityData || []).map(cust => {
        // Exact matching by Name and ID
        const custInvoices = allInvoices.filter(inv => 
          (inv.customer_id && String(inv.customer_id) === String(cust.id)) || 
          (inv.customer_name && inv.customer_name.trim().toLowerCase() === cust.full_name.trim().toLowerCase())
        );

        const totalSales = custInvoices.reduce((sum, inv) => sum + (Number(inv.grand_total) || 0), 0);
        const netUdhar = custInvoices.reduce((sum, inv) => sum + (Number(inv.balance_due) || 0), 0);
        
        // Extract due date of the latest invoice
        const sortedInvs = [...custInvoices].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const invoiceDueDate = sortedInvs[0]?.due_date ? sortedInvs[0].due_date.split('-').reverse().join('/') : null;

        return {
          ...cust,
          invoices: custInvoices, // 🌟 Required for statement box!
          total_sales_bill: totalSales, 
          balance_due: netUdhar,
          due_date: invoiceDueDate || cust.due_date // 🌟 Pass due date to the main table
        };
      });

      setCustomers(computedCustomers);
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
    fetchCustomersData();
  }, [fetchCustomersData]);

  
  const filteredCustomers = customers.filter(c => {
    const nameStr = c.full_name || c.name || '';
    // 3. EXPAND INCOMPLETE SEARCH (Evaluate both name and phone)
    return nameStr.toLowerCase().includes(searchTerm.toLowerCase()) || String(c.phone || '').includes(searchTerm);
  });

  const customersWithBalances = useMemo(() => {
    // 1. Group transactions by customer ID for O(N+M) instead of O(N*M)
    const txByCustomer = transactions.reduce((acc, tx) => {
      if (tx && String(tx.party_type).toLowerCase() === 'customer') {
        const id = String(tx.party_id);
        if (!acc[id]) acc[id] = [];
        acc[id].push(tx);
      }
      return acc;
    }, {});

    return filteredCustomers.map((c) => {
      const customerTx = txByCustomer[String(c.id)] || [];
      
      // Calculate actual running balance from transactions array directly
      const realTimeBalance = customerTx.reduce((acc, tx) => {
        const tType = String(tx.transaction_type).toLowerCase();
        const amt = parseFloat(tx.total_bill || tx.amount || 0);
        const rec = parseFloat(tx.cash_paid_received || 0);
        
        const finalPaid = tType === 'sale' ? rec : parseFloat(tx.amount || tx.cash_paid_received || 0);

        if (tType === 'sale') {
          return acc + amt - finalPaid;
        } else {
          return acc - finalPaid;
        }
      }, 0);

      const latestTx = customerTx[customerTx.length - 1];
      const realTimeDueDate = latestTx && latestTx.due_date 
        ? latestTx.due_date.split('-').reverse().join('/') 
        : (c.due_date ? c.due_date : 'No Due Date');

      const statusTag = realTimeBalance <= 0 ? 'paid' : 'partially_paid';

      let totalSales = 0;
      customerTx.forEach(t => {
        if (String(t.transaction_type).toLowerCase() === 'sale') totalSales += parseFloat(t.total_bill || t.amount || 0);
      });

      return {
        ...c,
        realTimeBalance, // Lock dynamic balance
        realTimeDueDate,
        statusTag,
        totalBillSum: totalSales
      };
    });
  }, [filteredCustomers, transactions]);
    const entityTransactions = useMemo(() => {
    if (!selectedEntity) return [];
    
    // 1. Fetch only manual payments/receipts or bills stored in transactions table
    const dbTx = Array.isArray(transactions) 
      ? transactions.filter(tx => tx && String(tx.party_id) === String(selectedEntity.id) && tx.party_type && String(tx.party_type).toLowerCase() === 'customer')
      : [];

    // 2. Sort strictly chronologically
    return [...dbTx].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }, [selectedEntity, transactions]);

    const viewLineItemsComputed = useMemo(() => {
    if (!entityTransactions || entityTransactions.length === 0) return [];
    
    let accumulativeBalance = 0;
    
    // Sort strictly chronologically to calculate running balance correctly from bottom to top
    const sortedTx = [...entityTransactions].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    return sortedTx.map((tx) => {
      const tType = String(tx.transaction_type || '').toLowerCase();
      const isSale = tType === 'sale';
      const amt = parseFloat(tx.total_bill || tx.amount || 0);
      const rec = parseFloat(tx.cash_paid_received || 0);
      
      const finalPaid = isSale ? rec : parseFloat(tx.amount || tx.cash_paid_received || 0);
      
      if (isSale) {
        accumulativeBalance += amt;       // Bill increases debt
        accumulativeBalance -= finalPaid; // Cash received on bill reduces debt
      } else {
        accumulativeBalance -= finalPaid; // Manual payment further reduces debt
      }
      
      return {
        ...tx,
        isSale,
        amt,
        rec: finalPaid,
        currentLineBalance: accumulativeBalance // Dynamic safe math calculation!
      };
    });
  }, [entityTransactions]);

    const handleDeleteCustomer = async (customerId) => {
    const targetCust = customers.find(c => c.id === customerId);
    if (!targetCust) return;

    const userChoice = window.prompt(
      `Customer Management Center:\n========================\nChoose Action for: ${targetCust.full_name || targetCust.name}\n\n` +
      `Type '1' : Soft Delete / Archive Customer Profile Only\n` +
      `Type '2' : Partial/Multi-Item Sales Return Engine`
    );

    if (!userChoice) return;

    // =========================================================================
    // OPTION 1: SOFT DELETE / ARCHIVE PROFILE ONLY
    // =========================================================================
    if (userChoice === '1') {
      if (Math.abs(parseFloat(targetCust.payment_due || targetCust.balance_due || 0)) > 0) {
        alert("🚨 SAFETY LOCK: There is an outstanding balance in this account! Please clear the balance (0) before archiving.");
        return;
      }
      const confirmLog = window.confirm("Are you sure you want to archive this customer profile? The name will be removed from the active directory.");
      if (!confirmLog) return;
      
      setLoading(true);
      try {
        const { error } = await supabase
          .from('customers')
          .update({ status: 'archived' })
          .eq('id', customerId)
          .eq('shop_id', activeShopId);

        if (error) throw error;
        setCustomers(customers.filter(c => c.id !== customerId));
        alert("Customer profile archived successfully.");
      } catch (err) {
        console.error(err);
        alert("Failed to archive customer profile.");
      } finally {
        setLoading(false);
      }
    }
  // =========================================================================
    // 🌟 OPTION 2: CHOTI MAAL WAPSI (STRICT ACTIVE INVENTORY FILTER)
    // =========================================================================
    else if (userChoice === '2') {
      setLoading(true);

      try {
        // 🌟 PERMANENT FIX: Fetch actual items sold to this customer from invoices
        const { data: custInvoices, error: invFetchErr } = await supabase
          .from('invoices')
          .select('items')
          .eq('shop_id', activeShopId)
          .eq('customer_id', customerId)
          .neq('status', 'cancelled');

        if (invFetchErr) throw invFetchErr;

        const soldItemsMap = {};
        (custInvoices || []).forEach(inv => {
          (inv.items || []).forEach(item => {
            const pId = item.product_id || item.id;
            if (!pId) return;
            
            if (!soldItemsMap[pId]) {
              soldItemsMap[pId] = {
                id: pId,
                name: item.name || item.product_name || 'Unknown Item',
                total_sold_qty: 0,
                rate: parseFloat(item.selling_price || item.rate || item.cost || 0)
              };
            }
            soldItemsMap[pId].total_sold_qty += parseFloat(item.quantity || 0);
          });
        });

        const allProds = Object.values(soldItemsMap);

        if (allProds.length === 0) {
          alert("🚨 No items have been sold to this customer yet!");
          setLoading(false);
          return;
        }

        let returnBatchItems = [];
        let totalReturnBillAmount = 0;
        let continueAdding = true;

        setLoading(false);

        // Master wizard loop for multi-items
        while (continueAdding) {
          let itemMenuString = `Select Item for Customer Return [Item #${returnBatchItems.length + 1}]:\n`;
          itemMenuString += `====================================\n`;
          allProds.forEach((prod, index) => {
            itemMenuString += `${index + 1}) ${prod.name} (Sold Qty: ${prod.total_sold_qty} | Rate: Rs.${prod.rate})\n`;
          });
          itemMenuString += `\nEnter Option Number (e.g., 1 or 2):`;

          const userSelectionInput = window.prompt(itemMenuString);
          if (!userSelectionInput || userSelectionInput.trim() === "") {
            break; 
          }

          const selectionIndex = parseInt(userSelectionInput) - 1;
          const selectedProduct = allProds[selectionIndex];

          if (!selectedProduct) {
            alert("🚨 Invalid Option selected! Please try again.");
            continue;
          }

          // Quantity Input
          const inputQty = window.prompt(
            `Customer Sales Return [${selectedProduct.name}]:\n====================================\n` +
            `Total Quantity Sold to Customer: ${selectedProduct.total_sold_qty}\n\nHow much Quantity is the Customer returning?`
          );
          const returnQty = parseFloat(inputQty);

          if (isNaN(returnQty) || returnQty <= 0) {
            alert("🚨 Invalid Quantity! Entry for this item has been cancelled.");
            continue;
          }

          if (returnQty > selectedProduct.total_sold_qty) {
            alert(`🚨 Invalid! The customer only purchased ${selectedProduct.total_sold_qty}. You cannot accept more returns than sold.`);
            continue;
          }

          // Auto-Rate Fetching & Confirmation
          const defaultRate = parseFloat(selectedProduct.rate || 0);
          const inputRate = window.prompt(
            `Sales Return Rate [${selectedProduct.name}]:\n====================================\n` +
            `System detected rate: Rs. ${defaultRate}\n\nPress Enter to use this rate, or enter a new rate:`
          , defaultRate);

          const finalRate = parseFloat(inputRate);

          if (isNaN(finalRate) || finalRate <= 0) {
            alert("🚨 Invalid Rate! Entry for this item has been cancelled.");
            continue;
          }

          const itemTotalCost = returnQty * finalRate;
          totalReturnBillAmount += itemTotalCost;

          returnBatchItems.push({
            id: selectedProduct.id,
            name: selectedProduct.name,
            qty: returnQty,
            rate: finalRate
          });

          const nextChoice = window.prompt("Would you like to add another item to this return bill?\nType 'YES' to add another item, or press Enter to finalize:");
          if (!nextChoice || nextChoice.trim().toUpperCase() !== 'YES') {
            continueAdding = false;
          }
        }

        if (returnBatchItems.length === 0) {
          alert("Return system aborted. No items processed.");
          return;
        }

        setLoading(true);

        // A. Update live stocks sequentially (Add back to inventory)
        for (const item of returnBatchItems) {
          const { data: liveProduct } = await supabase
            .from('products')
            .select('current_stock')
            .eq('id', item.id)
            .single();
            
          if (liveProduct) {
            const updatedStock = parseFloat(liveProduct.current_stock || 0) + item.qty;
            await supabase.from('products').update({ current_stock: updatedStock }).eq('id', item.id).eq('shop_id', activeShopId);
          }
        }

        // B. Apply calculation adjustments
        const currentCustomerDebt = parseFloat(targetCust.payment_due || targetCust.balance_due || 0);
        const newCustomerDebt = Math.max(0, currentCustomerDebt - totalReturnBillAmount);

        // Update customers master table
        const { error: custUpdateErr } = await supabase
          .from('customers')
          .update({ payment_due: newCustomerDebt })
          .eq('id', customerId)
          .eq('shop_id', activeShopId);

        if (custUpdateErr) throw custUpdateErr;

        // Sync with invoices table for alignment
        await supabase
          .from('invoices')
          .update({ balance_due: newCustomerDebt })
          .eq('customer_id', customerId)
          .eq('shop_id', activeShopId);

        // C. Record Compound Clean Independent Ledger Entry
        const itemSummaryNotes = returnBatchItems.map(i => `${i.name} (${i.qty} Qty @ Rs.${i.rate})`).join(', ');

        await supabase.from('transactions').insert([{
          shop_id: activeShopId,
          party_id: parseInt(customerId),
          party_type: 'customer',
          transaction_type: 'return', 
          amount: totalReturnBillAmount,
          cash_paid_received: 0, 
          remaining_balance: newCustomerDebt,
          notes: `Customer Sales Return Voucher: Received [ ${itemSummaryNotes} ] back to inventory.`
        }]);

        alert(
          `🎉 ERP Multi-Item Sales Return Complete!\n\n` +
          `Total Items Received Back: ${returnBatchItems.length}\n` +
          `Total Returned Credit: Rs. ${totalReturnBillAmount.toLocaleString()}\n` +
          `The customer's remaining debt is now Rs. ${newCustomerDebt.toLocaleString()}!`
        );

      } catch (err) {
        console.error("Option 2 Sales Return Core Error:", err);
        console.error("Database connection dropped during sales return sync runtime.", err);
      } finally {
        setLoading(false);
        if (typeof fetchCustomersData === 'function') fetchCustomersData();
      }
    }
  };
  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!activeShopId) return;
    try {
      const { error } = await supabase.from('customers').insert([{
        shop_id: activeShopId,
        full_name: newCustomer.full_name,
        phone: newCustomer.phone || null,
        email: newCustomer.address || null 
      }]);
      if (error) throw error;
      setShowAddCustomerModal(false);
      setNewCustomer({ full_name: '', phone: '', address: '' });
      alert("Customer profile created successfully!");
      await fetchCustomersData();
    } catch (err) {
      alert("Failed to create customer profile.");
    }
  };

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    if (!editingCustomer || !activeShopId) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from('customers')
        .update({
          full_name: editingCustomer.full_name,
          phone: editingCustomer.phone || null,
          email: editingCustomer.address || null
        })
        .eq('id', editingCustomer.id)
        .eq('shop_id', activeShopId);

      if (error) throw error;
      setShowEditCustomerModal(false);
      setEditingCustomer(null);
      alert("Profile updated successfully!");
      await fetchCustomersData();
    } catch (err) {
      console.error(err);
      alert("Failed to modify profile details.");
    } finally {
      setLoading(false);
    }
  };

    const handleSaveTransaction = async (e) => {
    e.preventDefault();
    if (!selectedEntity) return;
    const amount = parseFloat(newTx.amount);
    if (isNaN(amount) || amount <= 0) return;

    try {
      // ⚡ 1. Calculate real-time balance from fresh transaction logs to avoid database errors
      const { data: txList, error: txListErr } = await supabase
        .from('transactions')
        .select('*')
        .eq('party_id', selectedEntity.id)
        .eq('party_type', 'customer');
      
      if (txListErr) throw txListErr;

      // Extract the latest calculated outstanding balance
      let currentCalculatedBalance = (txList || []).reduce((acc, tx) => {
        const tType = String(tx.transaction_type).toLowerCase();
        const amt = parseFloat(tx.total_bill || tx.amount || 0);
        const rec = parseFloat(tx.cash_paid_received || 0);
        const finalPaid = tType === 'sale' ? rec : parseFloat(tx.amount || tx.cash_paid_received || 0);

        if (tType === 'sale') {
          return acc + amt - finalPaid;
        } else {
          return acc - finalPaid;
        }
      }, 0);

      // ⚡ 2. Calculate new balance based on the new transaction
      let newBalance = currentCalculatedBalance;
      let totalBill = 0;
      let cashPaidReceived = 0;
      const currentType = String(newTx.type).toLowerCase();

      if (currentType === 'sale') {
        newBalance += amount;
        totalBill = amount;
      } else {
        newBalance -= amount;
        cashPaidReceived = amount;
      }

      // Payload remains the same...
      const txPayload = {
        shop_id: activeShopId,
        party_id: parseInt(selectedEntity.id),
        party_type: 'customer',
        transaction_type: currentType,
        amount: amount,
        remaining_balance: parseFloat(newBalance),
        due_date: newTx.due_date || null,
        notes: newTx.notes || 'Fast Manual Transaction',
        total_bill: totalBill,
        cash_paid_received: cashPaidReceived
      };

      // ⚡ 3. Save to Transactions
      const { data, error: txError } = await supabase
        .from('transactions')
        .insert([txPayload])
        .select()
        .single();
      if (txError) throw txError;

      // ⚡ 4. Real-time update in Customers table! (Is se Billing page bhi update ho jayega)
      const { error: custError } = await supabase
        .from('customers')
        .update({ payment_due: parseFloat(newBalance) })
        .eq('id', selectedEntity.id);
      if (custError) throw custError;

      // 🎯 LOCAL STATE UPDATE (Instant screen sync)
      setTransactions(prev => [...prev, data]);
      setSelectedEntity(prev => ({
        ...prev,
        payment_due: newBalance,
        balance_due: newBalance
      }));

      setShowTxModal(false);
      setNewTx({ type: 'sale', amount: '', due_date: '', notes: '' });
      
      alert("Transaction saved and DB balance successfully synced!");
      await fetchCustomersData();
    } catch (err) {
      console.error("Fast transaction execution crashed:", err);
    }
  };
  const handlePrint = () => window.print();

  if (!activeShopId) return null;
  if (loading && customers.length === 0) return <LoadingSpinner />;

  return (
    <div className="animate-in fade-in duration-500 text-left">
      
      {/* 📄 OPTIMIZED ERP MULTI-PAGE PRINT ENGINE */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { 
           size: ${printPaperSize === 'Thermal' ? '80mm auto' : printPaperSize === 'Legal' ? 'legal portrait' : 'A4 portrait'}; 
            margin: ${printPaperSize === 'Thermal' ? '2mm 3mm 5mm 3mm' : '12mm 15mm 15mm 15mm'}; 
          }
          html, body, #root, main, .min-h-screen { 
            background: #ffffff !important; 
            color: #000000 !important; 
            font-family: 'Segoe UI', system-ui, sans-serif !important;
            width: 100% !important;
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
            position: static !important; 
            width: 100% !important;
            height: auto !important;
            max-width: ${printPaperSize === 'Thermal' ? '74mm' : '100%'} !important;
            padding: 0px !important; 
            margin: 0 auto !important; 
            background: #ffffff !important; 
            box-shadow: none !important; 
            border: none !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          
          /* 📊 Responsive Table Structure for A4 vs Thermal */
          table { 
            width: 100% !important; 
            table-layout: fixed !important; 
            border-collapse: collapse !important; 
            margin-top: 15px !important; 
            border: 1px solid #000000 !important; 
          }
          th, td { 
            padding: ${printPaperSize === 'Thermal' ? '4px 2px' : '9px 8px'} !important; 
            font-size: ${printPaperSize === 'Thermal' ? '7.5pt' : '10pt'} !important; 
            line-height: ${printPaperSize === 'Thermal' ? '1' : '1.3'} !important;
            border: 1px solid #000000 !important; 
            word-wrap: break-word !important; 
            white-space: nowrap !important; /* Prevent large numbers from breaking line */
            color: #000000 !important; 
          }
          th { 
            background: #f1f5f9 !important; 
            font-weight: bold !important; 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
          }
          /* Details wale text column ko wrap hone ki ijazat dein ge, baqi numbers seedhe rahenge */
          td:nth-child(2) {
            white-space: normal !important;
          }
          
          /* Auto-stretching layout components */
          .flex-col { flex-direction: column !important; }
          .sm\\:flex-row { flex-direction: row !important; }
        }
      `}} />

      {!selectedEntity ? (
        <>
          {/* 🎯 FIXED ULTRA-VISIBLE HEADER PANEL WITH HIGH-VIBRANT CYBER COLOR WAVE */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 p-4 sm:p-6 rounded-3xl border border-indigo-500/30 shadow-2xl shadow-indigo-500/10 relative overflow-hidden group text-left bg-[#050b21] no-print">
            
            {/* 🌊 HIGH-DEFINED CYBER COLOR WAVE LIGHT ENGINE */}
            <div 
              className="absolute inset-0 opacity-60 pointer-events-none transition-all duration-700 mix-blend-screen"
              style={{
                background: 'linear-gradient(-45deg, #4338ca 0%, #7c3aed 25%, #db2777 50%, #2563eb 75%, #4338ca 100%)',
                backgroundSize: '300% 300%',
                animation: 'InvovoERPVibrantWave 5s ease-in-out infinite'
              }}
            />
            <div className="absolute -right-10 -top-10 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl group-hover:bg-purple-500/30 transition-all duration-700" />
            <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl group-hover:bg-blue-500/30 transition-all duration-700" />
            
            {/* 🛠️ Embedded High-Speed Wave Animation Injector */}
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes InvovoERPVibrantWave {
                0% { background-position: 0% 50% }
                50% { background-position: 100% 50% }
                100% { background-position: 0% 50% }
          }
            `}} />

            <div className="relative flex items-center gap-4 text-left z-10">
              <div className="p-3.5 bg-slate-900/80 border border-indigo-400/50 rounded-2xl text-2xl shadow-xl backdrop-blur-md animate-bounce duration-1000">
                👥
              </div>
              <div>
                <h2 className="text-[11px] font-black tracking-widest text-indigo-300 uppercase font-mono bg-slate-950/40 px-2 py-0.5 rounded w-max border border-indigo-500/20 backdrop-blur-sm">Accounts Receivable</h2>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase mt-1.5" style={{ textShadow: '0 2px 20px rgba(219,39,119,0.6), 0 4px 10px rgba(99,102,241,0.6)' }}>
                  Customers Ledger / <span className="text-indigo-300 font-extrabold">Customer Ledger</span>
                </h1>
                <p className="text-xs text-slate-200 mt-1.5 font-medium tracking-wide flex items-center gap-2 drop-shadow-md">
                  <span className="font-bold">Invovo ERP Suite</span> • <span className="text-slate-300">Party Profiles</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap no-print z-10 self-end md:self-center w-full sm:w-auto">
              <button 
                type="button" 
                onClick={() => setShowAddCustomerModal(true)} 
                className="flex-1 sm:flex-none px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-md transition-all duration-300 transform active:scale-95 border border-indigo-500/40 cursor-pointer flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add New Customer
              </button>
            </div>
          </div>

          <div className="relative max-w-md mb-6 no-print">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search customers by full name..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-bold focus:outline-none" 
            />
          </div>

          {filteredCustomers.length === 0 ? (
            <EmptyState icon={UserCheck} title="No Customers Found" description="Add entries to start tracking customer ledgers." buttonText="Understood" />
          ) : (
            /* 👑 RE-ALIGNED CLEAN DIRECTORY PANEL GRID */
            <div className="bg-white dark:bg-slate-800/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden animate-in fade-in">
              <div className="overflow-x-auto">
                <div className="overflow-x-auto w-full"><table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-sm uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      <th className="p-5 font-bold text-left whitespace-nowrap">Customer Code</th>
                      <th className="p-5 font-bold text-left whitespace-nowrap">Customer Name</th>
                      <th className="p-5 font-bold text-left whitespace-nowrap">Total Sales Bill</th>
                      <th className="p-5 font-bold text-left whitespace-nowrap">Net Due Balance</th>
                      <th className="p-5 font-bold text-left whitespace-nowrap">Status</th>
                      <th className="p-5 font-bold text-left whitespace-nowrap">Date Created</th>
                      <th className="p-5 font-bold text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50 text-slate-800 dark:text-slate-200 font-bold">
                    {customersWithBalances.map((c) => {
                      return (
                        <tr key={c.id} className="hover:bg-slate-100/40 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="p-5 font-black font-mono text-indigo-600 dark:text-indigo-400 text-left whitespace-nowrap">CST-{String(c.id).padStart(2, '0')}</td>
                          <td className="p-5 text-left whitespace-nowrap">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <span className="text-slate-900 dark:text-slate-100 font-black">{c.full_name || c.name || 'Unnamed Customer'}</span>
                              
                              {/* 👑 DYNAMIC RTL URDU SESSION STATUS BADGE */}
                              {c.khata_status === 'closed' ? (
                                <span dir="rtl" className="w-max inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black border bg-rose-500/10 text-rose-400 border-rose-500/20">
                                  🔒 Session Closed
                                </span>
                              ) : (
                                <span dir="rtl" className="w-max inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                  ⚡ Active Session
                                </span>
                              )}
                            </div>
                            {(c.email || c.address) && <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">🏠 {c.email || c.address}</p>}
                          </td>
                          <td className="p-5 font-black font-mono text-left whitespace-nowrap">{formatCurrency(c.totalBillSum)}</td>
                          <td className="p-5 text-left whitespace-nowrap">
                            <div className={`font-black font-mono ${
                              parseFloat(c.payment_due || c.balance_due || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                              {/* 🎯 DIRECT CONNECTION WITH DATABASE FIELD */}
                             {formatCurrency(c.realTimeBalance)}
                            </div>
                            <div className="text-xs text-slate-400 mt-1 font-black font-mono">{c.realTimeDueDate}</div>
                          </td>
                          <td className="p-5 text-left whitespace-nowrap">{c.statusTag === 'paid' ? <span className="px-2.5 py-1 rounded-lg text-xs font-bold border bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 uppercase tracking-wider">Paid</span> : <span className="px-2.5 py-1 rounded-lg text-xs font-bold border bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 uppercase tracking-wider">PARTIAL</span>}</td>
                          <td className="p-5 text-sm text-slate-500 dark:text-slate-400 text-left font-mono font-bold whitespace-nowrap">
                            {c.created_at ? new Date(c.created_at).toLocaleDateString('en-GB') : '26/06/2026'}
                          </td>
                          <td className="p-5 whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2 min-w-max">
                              <button 
                                type="button"
                                onClick={() => setSelectedEntity(c)}
                                className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-600 transition-colors cursor-pointer"
                              >
                                View
                              </button>
                              <button 
                                type="button"
                                onClick={() => { setEditingCustomer(c); setShowEditCustomerModal(true); }}
                                className="p-2 bg-slate-200 dark:bg-slate-700 hover:bg-indigo-600 text-slate-600 dark:text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-300 dark:border-slate-600"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                type="button"
                                onClick={() => handleDeleteCustomer(c.id)}
                                className="p-2 bg-slate-200 dark:bg-slate-700 hover:bg-rose-600 text-slate-600 dark:text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-300 dark:border-slate-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table></div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* 📜 DYNAMIC PREMIUM THERMAL VIEW FOR CUSTOMER STATEMENT SLIP */
        <div id="printable-ledger" className="bg-white p-3 sm:p-6 rounded-2xl shadow-2xl border border-slate-200 text-slate-900 mx-auto max-w-3xl font-sans text-left">
          
          {/* Action Control Header Panel */}
          <div className="no-print mb-6 flex flex-wrap justify-between items-center gap-4 border-b border-slate-100 pb-4">
            <button 
              type="button"
              onClick={() => setSelectedEntity(null)} 
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg text-sm cursor-pointer font-bold"
            >
              <ArrowLeft className="w-4 h-4" /> Back to List
            </button>
            <div className="flex flex-wrap gap-4 items-center">
              {/* 🔒 NEW: ERP SESSION LOCK / UNLOCK SYSTEM TRIGGER */}
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

              <select 
                value={printPaperSize} 
                onChange={(e) => setPrintPaperSize(e.target.value)} 
                className="bg-slate-800 px-3 py-2 text-xs text-white rounded-xl focus:outline-none cursor-pointer font-bold"
              >
                <option value="A4">Standard A4 Page</option>
                <option value="Legal">Legal Size Sheet</option>
                <option value="Thermal">80mm POS Thermal Slip</option>
              </select>
              <button type="button" onClick={handlePrint} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold cursor-pointer text-sm">
                <Printer className="w-4 h-4" /> Print Statement
              </button>
              {/* Existing Validated WhatsApp Slip Button */}
              <button 
                type="button"
                disabled={isGeneratingPDF}
                onClick={async () => {
                  const activePhone = selectedEntity?.phone || '';
                  if (!activePhone || activePhone.trim() === '' || activePhone.length < 10) {
                    alert("🚨 Error: This customer's WhatsApp mobile number is not registered in the ledger!");
                    return;
                  }
                  try {
                    setIsGeneratingPDF(true);
                    const finalBalanceStr = viewLineItemsComputed && viewLineItemsComputed.length > 0 
                      ? viewLineItemsComputed[viewLineItemsComputed.length - 1].currentLineBalance 
                      : 0;
                    let totalBaqi = parseFloat(finalBalanceStr) || 0;

                    let contextBlock = `🔹 *Outstanding Balance Due:* ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(totalBaqi).toLocaleString()}`;
                    if (viewLineItemsComputed && viewLineItemsComputed.length > 0) {
                      const latestTx = viewLineItemsComputed[viewLineItemsComputed.length - 1];
                      if (!latestTx.isSale) {
                        const paymentAmount = Number(latestTx.rec || 0);
                        const previousBaqi = totalBaqi + paymentAmount;
                        contextBlock = `📊 *Previous Total Balance:* ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(previousBaqi).toLocaleString()}\n💵 *Payment Made:* ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(paymentAmount).toLocaleString()}\n🔹 *New Remaining Balance:* ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(totalBaqi).toLocaleString()}`;
                      } else {
                        const billTotal = Number(latestTx.amt || 0);
                        const cashPaid = Number(latestTx.rec || 0);
                        contextBlock = `🧾 *Total Purchase Bill:* ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(billTotal).toLocaleString()}\n💵 *Amount Paid (Cash):* ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(cashPaid).toLocaleString()}\n🔹 *Remaining Balance:* ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(totalBaqi).toLocaleString()}`;
                      }
                    }

                    const msg = `*Invovo ERP Customer Ledger* 📊\n\n` +
                      `🏢 *Business / Shop Details:*\n` +
                      `• *Shop:* ${activeShopInfo?.name || 'Invovo'}\n` +
                      `• *Phone:* ${activeShopInfo?.phone || '+12345678900'}\n` +
                      `• *Address:* ${activeShopInfo?.address || 'District Mianwali'}\n\n` +
                      `Dear *${selectedEntity?.full_name || selectedEntity?.name || 'Gāhak'}*,\n` +
                      `Your complete live ledger summary is provided below:\n\n` +
                      `${contextBlock}\n\n` +
                      `---\n` +
                      `_Powered by Invovo | Invovo ERP_`;
                    dispatchWhatsAppMessage(activePhone, msg);
                  } catch (e) {
                    console.error("WhatsApp Error:", e);
                    alert("Error.");
                  } finally {
                    setIsGeneratingPDF(false);
                  }
                }}
                className={`px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold cursor-pointer text-sm ${isGeneratingPDF ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isGeneratingPDF ? '⏳ Generating...' : '💬 WhatsApp Slip'}
              </button>

              {/* 📱 COMPANION REGULAR MOBILE SIM SMS TRIGGER */}
              <button
                type="button"
                onClick={() => {
                  const activePhone = selectedEntity?.phone || '';
                  if (!activePhone || activePhone.trim() === '' || activePhone.length < 10) {
                    alert("🚨 Error: Mobile number is not registered for this customer!");
                    return;
                  }
                  
                  const finalBalanceStr = viewLineItemsComputed && viewLineItemsComputed.length > 0 
                    ? viewLineItemsComputed[viewLineItemsComputed.length - 1].currentLineBalance 
                    : 0;
                  let totalBaqi = parseFloat(finalBalanceStr) || 0;

                  let smsContext = `Baqi Balance: ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(totalBaqi).toLocaleString()}`;
                  if (viewLineItemsComputed && viewLineItemsComputed.length > 0) {
                    const latestTx = viewLineItemsComputed[viewLineItemsComputed.length - 1];
                    if (!latestTx.isSale) {
                      const paymentAmount = Number(latestTx.rec || 0);
                      const previousBaqi = totalBaqi + paymentAmount;
                      smsContext = `Previous Balance: ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(previousBaqi).toLocaleString()}, Received: ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(paymentAmount).toLocaleString()}, Net Balance: ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(totalBaqi).toLocaleString()}`;
                    } else {
                      const billTotal = Number(latestTx.amt || 0);
                      const cashPaid = Number(latestTx.rec || 0);
                      smsContext = `Bill: ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(billTotal).toLocaleString()}, Cash Paid: ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(cashPaid).toLocaleString()}, Net Balance: ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(totalBaqi).toLocaleString()}`;
                    }
                  }

                  const shareableLink = `${window.location.origin}/statement/customer/${selectedEntity.id}`;
                  const shopName = activeShopInfo?.name || 'Invovo';
                  const customerName = selectedEntity?.full_name || selectedEntity?.name || 'Gāhak';

                  const smsBody = `Invovo ERP (${shopName})\nDear ${customerName}, ${smsContext}.\nStatement: ${shareableLink}`;

                  window.open(`sms:${activePhone}?body=${encodeURIComponent(smsBody)}`, '_self');
                }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold cursor-pointer text-sm transition-colors"
              >
                📱 Regular SMS
              </button>
            </div>
          </div>

          {/* Shop Header Details Row */}
          <div className="border-b border-slate-200 pb-4 mb-4 flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <h2 className="text-2xl font-black text-indigo-900 uppercase tracking-tight">{activeShopInfo.name}</h2>
              <p className="text-xs text-slate-700 font-semibold mt-1">
                🏠 Address: {activeShopInfo.address}
              </p>
              <p className="text-xs text-slate-700 font-mono font-bold mt-0.5">
                📱 Phone: {activeShopInfo.phone}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <div className="bg-slate-900 text-white px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-widest inline-block sm:block">STATEMENT</div>
              <p className="text-xs text-slate-500 font-mono font-bold mt-2">Code: <span className="text-slate-800 font-black font-sans">CST-{String(selectedEntity.id).padStart(2, '0')}</span></p>
              <p className="text-xs text-slate-500 font-medium">Date: <span className="text-slate-800 font-bold">{new Date().toLocaleDateString('en-GB')}</span></p>
            </div>
          </div>

          {/* Bill To Customer Card Segment */}
          <div className="mb-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col gap-1 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600"></div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="inline-block bg-indigo-600 text-white px-2 py-0.5 text-[9px] font-black tracking-wider rounded-md uppercase w-max">CUSTOMER INFO</div>
              
              {/* 👑 DYNAMIC VISUAL ERP STATUS BADGE */}
              <span className={`px-2 py-0.5 text-[10px] font-black rounded-md border uppercase font-mono tracking-wider ${
                selectedEntity?.khata_status === 'closed'
                  ? 'bg-amber-100 text-amber-700 border-amber-300'
                  : 'bg-emerald-100 text-emerald-700 border-emerald-300'
              }`}>
                ● {selectedEntity?.khata_status === 'closed' ? 'Session Closed' : 'Active'}
              </span>
            </div>
            <p className="text-sm font-black text-slate-800 uppercase m-0 mt-1">{selectedEntity.full_name || selectedEntity.name || 'Unnamed Customer'}</p>
            {selectedEntity.phone && <p className="text-xs text-slate-600 font-mono font-bold">📱 Phone: {selectedEntity.phone}</p>}
            {(selectedEntity.email || selectedEntity.address) && <p className="text-xs text-slate-600 font-semibold">🏠 Address: {selectedEntity.email || selectedEntity.address}</p>}
          </div>

          {/* 📊 CORE BALANCED MATRIX LEDGER ROWS GRID WITH RUNNING BALANCE */}
          <div className="border border-slate-200 rounded-xl overflow-x-auto overflow-y-visible mb-4">
            <div className="overflow-x-auto w-full"><table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white text-[11px] uppercase font-bold">
                  {/* Expanded spacing for thermal columns to prevent figure break */}
                  <th className="p-2 text-white whitespace-nowrap" style={{ width: printPaperSize === 'Thermal' ? '25%' : '15%' }}>Date</th>
                  <th className="p-2 text-white whitespace-nowrap" style={{ width: printPaperSize === 'Thermal' ? '27%' : '45%' }}>Details</th>
                  <th className="p-2 text-right text-white whitespace-nowrap" style={{ width: printPaperSize === 'Thermal' ? '15%' : '13%' }}>Debit</th>
                  <th className="p-2 text-right text-white whitespace-nowrap" style={{ width: printPaperSize === 'Thermal' ? '15%' : '13%' }}>Credit</th>
                  <th className="p-2 text-right text-orange-400 whitespace-nowrap" style={{ width: printPaperSize === 'Thermal' ? '18%' : '14%' }}>Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold text-xs">
                {(() => {
                  if (!viewLineItemsComputed || viewLineItemsComputed.length === 0) {
                    return (
                      <tr>
                        <td colSpan="5" className="p-4 text-center text-slate-400 font-bold">No ledger transactions active.</td>
                      </tr>
                    );
                  }
                  return [...viewLineItemsComputed].reverse().map((tx, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                      <td className="p-2 font-mono whitespace-nowrap">
                        {tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-GB') : '-'}
                      </td>
                      <td className="p-2 text-slate-800 whitespace-normal break-words whitespace-nowrap">
                        {tx.isSale ? '📦 Sale Bill' : '💰 Cash Received'} {tx.notes ? ` - ${tx.notes}` : ''}
                      </td>
                      <td className="p-2 text-right font-mono text-rose-600 font-bold whitespace-nowrap">
                        {tx.isSale ? Number(tx.amt).toLocaleString() : '0'}
                      </td>
                      <td className="p-2 text-right font-mono text-emerald-600 font-bold whitespace-nowrap">
                        {Number(tx.rec).toLocaleString()}
                      </td>
                      <td className="p-2 text-right font-mono text-indigo-950 font-black whitespace-nowrap">
                        {Number(tx.currentLineBalance).toLocaleString()}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table></div>
          </div>

          {/* Summary Segment */}
          <div className="flex justify-end mb-4">
            <div className="w-full sm:w-80 bg-slate-900 text-white p-5 rounded-2xl shadow-xl flex flex-col gap-3 text-sm font-semibold">
              <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-1 pt-1">
                <span className="text-orange-400 text-xs font-black uppercase">OUTSTANDING BALANCE:</span>
                <span className="font-mono font-black text-xl text-orange-400">
                  Rs. {(() => {
                    if (viewLineItemsComputed && viewLineItemsComputed.length > 0) {
                      const finalBalance = viewLineItemsComputed[viewLineItemsComputed.length - 1].currentLineBalance;
                      return Number(finalBalance).toLocaleString();
                    }
                    return "0";
                  })()}
                </span>
              </div>

              {/* 🎯 PAID STAMP: Automatically shows up when balance is exactly 0 */}
              {(() => {
                let isPaid = true;
                if (viewLineItemsComputed && viewLineItemsComputed.length > 0) {
                  const finalBalance = viewLineItemsComputed[viewLineItemsComputed.length - 1].currentLineBalance;
                  isPaid = Number(finalBalance) === 0;
                }
                if (isPaid) {
                  return (
                    <div className="mt-2 pt-2 border-t border-slate-700/60 text-center">
                      <span className="inline-block w-full py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-sm font-black rounded-xl tracking-wider animate-pulse uppercase">
                        ✓ FULLY PAID
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
          
          {/* 👑 PRINT SAFE DYNAMIC FAST TRANSACTION PANELS */}
          <div className="no-print mt-4 pt-4 border-t border-slate-100 flex justify-start">
            <button 
              type="button" 
              onClick={() => { setNewTx({ type: 'sale', amount: '', due_date: '', notes: '' }); setShowTxModal(true); }} 
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer"
            >
              ➕ Log Fast Transaction
            </button>
          </div>

          <div className='mt-8 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-500 font-bold'>{activeShopInfo.footer_message}</div>
          <div className='mt-2 pt-2 border-t border-dashed border-slate-300 text-center text-[9px] text-slate-400 font-bold font-mono uppercase tracking-wider'>
            Powered by Invovo (Contact: +92 305 9352744)
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 shadow-2xl rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
              <h3 className="text-xl font-bold text-white">Create New Customer Profile</h3>
              <button type="button" onClick={() => setShowAddCustomerModal(false)} className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateCustomer} className="p-6 space-y-5 text-xs font-bold">
              <div>
                <label className="block text-slate-300 mb-1">Customer Full Name *</label>
                <input type="text" required value={newCustomer.full_name} onChange={e => setNewCustomer({...newCustomer, full_name: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white outline-none" placeholder="e.g. Kamran Khan" />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Mobile Number (11 Digits)</label>
                <input type="tel" inputMode="numeric" pattern="[0-9]*" value={newCustomer.phone || ''} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white font-mono outline-none" placeholder="+1 234 567 8900" />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Home / Shop Address</label>
                <input type="text" value={newCustomer.address || ''} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white outline-none" placeholder="Address details" />
              </div>
              <div className="pt-4 flex flex-col-reverse sm:flex-row gap-3">
                <button type="button" onClick={() => setShowAddCustomerModal(false)} className="flex-1 py-3 px-4 bg-slate-700 text-white rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl">Save Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEditCustomerModal && editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 shadow-2xl rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
              <h3 className="text-xl font-bold text-white">Modify Customer Details</h3>
              <button type="button" onClick={() => { setShowEditCustomerModal(false); setEditingCustomer(null); }} className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleUpdateCustomer} className="p-6 space-y-5 text-xs font-bold">
              <div>
                <label className="block text-slate-300 mb-1">Customer Full Name *</label>
                <input type="text" required value={editingCustomer.full_name || editingCustomer.name || ''} onChange={e => setEditingCustomer({...editingCustomer, full_name: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white outline-none" />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Mobile Number</label>
                <input type="tel" inputMode="numeric" pattern="[0-9]*" value={editingCustomer.phone || ''} onChange={e => setEditingCustomer({...editingCustomer, phone: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white font-mono outline-none" />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Address</label>
                <input type="text" value={editingCustomer.email || editingCustomer.address || ''} onChange={e => setEditingCustomer({...editingCustomer, address: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white outline-none" />
              </div>
              <div className="pt-4 flex flex-col-reverse sm:flex-row gap-3">
                <button type="button" onClick={() => { setShowEditCustomerModal(false); setEditingCustomer(null); }} className="flex-1 py-3 px-4 bg-slate-700 text-white rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl">Update Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Transaction Modal */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 shadow-2xl rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
              <h3 className="text-xl font-bold text-white">Log Manual Ledger Transaction</h3>
              <button type="button" onClick={() => setShowTxModal(false)} className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveTransaction} className="p-6 space-y-5 text-xs font-bold">
              <div>
                <label className="block text-slate-300 mb-1">Transaction Type</label>
                <select value={newTx.type} onChange={e => setNewTx({...newTx, type: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white cursor-pointer">
                  <option value="sale">Total Bill Owed (Credit / Sale)</option>
                  <option value="payment">Cash Received (Credit Payment)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Amount ({APP_CONFIG.defaultCurrency}) *</label>
                <input type="number" inputMode="decimal" min="1" required value={newTx.amount} onChange={e => setNewTx({...newTx, amount: e.target.value})} onFocus={(e) => e.target.select()} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white font-mono outline-none" placeholder="Enter amount..." />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Waade Ki Tarikh (Due Date)</label>
                <input type="date" value={newTx.due_date} onChange={e => setNewTx({...newTx, due_date: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white" />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Notes / Details</label>
                <input type="text" value={newTx.notes} onChange={e => setNewTx({...newTx, notes: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white" placeholder="Transaction details..." />
              </div>
              <div className="pt-4 flex flex-col-reverse sm:flex-row gap-3">
                <button type="button" onClick={() => setShowTxModal(false)} className="flex-1 py-3 px-4 bg-slate-700 text-white rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl">Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
