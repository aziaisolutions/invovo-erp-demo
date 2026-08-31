import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { getSafeErrorMessage, dispatchWhatsAppMessage } from '../utils/erpHelpers';
import { useRole } from '../hooks/useRole';
import { supabase } from '../lib/supabase';
import { FileText, Plus, X, Search, Printer, Edit, Trash2, Calendar, DollarSign, ArrowLeft } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { useOfflineSync } from '../contexts/OfflineSyncContext';
import { formatCurrency, APP_CONFIG } from '../config/appConfig';

export default function Invoices() {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeShopId } = useRole();
  const { queueOfflineTransaction } = useOfflineSync();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  // 📝 credit tracking states
  const [previousBalance, setPreviousBalance] = useState(0);
  const [freshDueDate, setFreshDueDate] = useState('');
  
  // 🔒 Invovo ERP SESSION STATES REGISTERED
  const [showUrduSessionPrompt, setShowUrduSessionPrompt] = useState(false);
  const [selectedActiveEntity, setSelectedActiveEntity] = useState(null);
  const [sessionChoice, setSessionChoice] = useState('current'); // 'current' or 'new'

  // ⚡ Live transactions se accurate outstanding balance calculate karne ka function
  const fetchLiveCustomerBalance = async (customerId, backupBalance = 0) => {
    try {
      const { data: dbTransactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('party_id', customerId)
        .eq('party_type', 'customer');
      
      if (error) throw error;

      const computedBal = (dbTransactions || []).reduce((acc, tx) => {
        const tType = String(tx.transaction_type || '').toLowerCase();
        const amt = parseFloat(tx.total_bill || tx.amount || 0);
        const rec = parseFloat(tx.cash_paid_received || 0);
        const finalPaid = tType === 'sale' ? rec : parseFloat(tx.amount || tx.cash_paid_received || 0);

        if (tType === 'sale') {
          return acc + amt - finalPaid;
        } else {
          return acc - finalPaid;
        }
      }, 0);

      setPreviousBalance(computedBal);
    } catch (err) {
      console.error("Error calculating live balance:", err);
      setPreviousBalance(parseFloat(backupBalance));
    }
  };

  // Arrays
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

  // 🏢 Shop Profile Branding State
  const [activeShopInfo, setActiveShopInfo] = useState({
    name: 'Invovo ERP Store',
    phone: '',
    address: '',
    invoice_terms: 'Sold goods cannot be returned or exchanged.',
    footer_message: 'Thank you for using Invovo ERP App!'
  });

  // Modals Overlay States Panels
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null); 
  const [printPaperSize, setPrintPaperSize] = useState('A4');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTargetInvoice, setEditTargetInvoice] = useState(null);
  
  // Edit Form State Inputs
  const [receiveAmount, setReceiveAmount] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

  // Create Form State Inputs
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formCustomerAddress, setFormCustomerAddress] = useState('');
  const [lineItems, setLineItems] = useState([]); 
  const [discount, setDiscount] = useState(0);
  const [applyTax, setApplyTax] = useState(false);
  const [cashReceived, setCashReceived] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // 🔄 PARTIAL SALES RETURN STATES REGISTERED SAFELY
  const [showPartialReturnModal, setShowPartialReturnModal] = useState(false);
  const [returnTargetInvoice, setReturnTargetInvoice] = useState(null);
  const [returnQuantities, setReturnQuantities] = useState({});

  // Pagination States
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

    
  const fetchInvoicesData = async (pageNum = 0, isLoadMore = false) => {
    if (!activeShopId) return;
    try {
      if (!isLoadMore) setLoading(true);
      
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: invData, error: invError } = await supabase
        .from('invoices')
        .select('*')
        .eq('shop_id', activeShopId)
        .neq('status', 'cancelled')
        .neq('status', 'hidden')
        .order('created_at', { ascending: false })
        .range(from, to);
        
      if (invError) throw invError;
      
      if (invData.length < PAGE_SIZE) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      if (isLoadMore) {
        setInvoices(prev => [...prev, ...(invData || [])]);
      } else {
        setInvoices(invData || []);
      }

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
      } else {
        const { data: currentShopData } = await supabase
          .from('shops')
          .select('*')
          .eq('id', activeShopId)
          .single();
          
        if (currentShopData) {
          setActiveShopInfo({
            name: currentShopData.shop_name || currentShopData.name || 'Demo Company',
            phone: currentShopData.shop_phone || currentShopData.phone || '+1-800-INVOVO',
            address: currentShopData.shop_address || currentShopData.address || 'Main Bazar',
            invoice_terms: currentShopData.invoice_terms || 'Sold goods cannot be returned or exchanged.',
            footer_message: currentShopData.footer_message || 'Thank you for using Invovo ERP App!'
          });
        }
      }

     // 🔒 ACTIVE CUSTOMERS FILTER: Dropdown se archived/deleted customers ko nikalne k liye strict check
    // 🔒 STRICТ SESSION BARRIER PATCH: Dropdown se archived aur closed dono customers ko nikalne k liye check
      const { data: cData } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', activeShopId)
        .neq('status', 'archived')
        .neq('khata_status', 'closed');
      setCustomers(cData || []);

     // 🔒 ACTIVE PRODUCTS FILTER: Billing search se archived/deleted products ko saaf karne k liye check
      const { data: pData } = await supabase.from('products').select('*').eq('shop_id', activeShopId).neq('status', 'archived');
      setProducts(pData || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoicesData(0, false);
    if (location && location.state && location.state.autoOpenNew) {
      setShowCreateModal(true);
    }
  }, [activeShopId, location]);

  const { subtotal, taxAmount, grandTotal } = useMemo(() => {
    const sub = lineItems.reduce((acc, item) => acc + (parseFloat(item.selling_price || 0) * parseFloat(item.quantity || 1)), 0);
    const disc = parseFloat(discount) || 0;
    const taxableAmount = sub - disc;
    const tax = applyTax ? taxableAmount * 0.05 : 0;
    const total = taxableAmount + tax;
    
    return { subtotal: sub, taxAmount: tax, grandTotal: total };
  }, [lineItems, discount, applyTax]);

  const handleAddLineItem = (product) => {
    const availableStock = parseFloat(product.current_stock) || 0;
    
    if (availableStock <= 0) {
      alert(`🚨 OUT OF STOCK: ${product.name} is out of stock!`);
      return;
    }

    const existing = lineItems.find(item => item.product_id === product.id);
    const newQty = existing ? existing.quantity + 1 : 1;

    if (newQty > availableStock) {
      alert(`⚠️ STOCK LIMIT REACHED: You cannot add more than ${availableStock} units of ${product.name}!`);
      return;
    }

    if (existing) {
      setLineItems(lineItems.map(item => 
        item.product_id === product.id ? { ...item, quantity: newQty } : item
      ));
    } else {
      setLineItems([...lineItems, { 
        product_id: product.id, 
        name: product.name, 
        selling_price: product.selling_price || 0, 
        quantity: 1 
      }]);
    }
    setSearchTerm(''); 
  };

  const handleUpdateQuantity = (productId, qty) => {
    // Allow empty string for smooth mobile backspace/delete UX
    if (qty === '' || qty === null || qty === undefined) {
      setLineItems(lineItems.map(item => item.product_id === productId ? { ...item, quantity: '' } : item));
      return;
    }
    const num = parseFloat(qty);
    if (isNaN(num) || num <= 0) return;
    const matchedProduct = products.find(p => p.id === productId);
    const availableStock = matchedProduct ? parseFloat(matchedProduct.current_stock || 0) : 99999;
    if (num > availableStock) {
      alert(`⚠️ STOCK LIMIT EXCEEDED: Only ${availableStock} units are available in the store!`);
      return;
    }
    setLineItems(lineItems.map(item => item.product_id === productId ? { ...item, quantity: num } : item));
  };

  const handleQuantityBlur = (productId) => {
    setLineItems(lineItems.map(item => {
      if (item.product_id === productId && (item.quantity === '' || item.quantity === null || item.quantity === undefined || isNaN(parseFloat(item.quantity)) || parseFloat(item.quantity) <= 0)) {
        return { ...item, quantity: 1 };
      }
      return item;
    }));
  };

  const handleRemoveLineItem = (productId) => {
    setLineItems(lineItems.filter(item => item.product_id !== productId));
  };

  // --- INTERCEPT TRIGGER BEFORE CORE EXECUTOR TO CHECK SESSIONS SAFELY ---
  const handleInvoiceFormSubmission = (e) => {
    e.preventDefault();
    if (formCustomerId) {
      const match = customers.find(c => String(c.id) === String(formCustomerId));
      if (match) {
        setSelectedActiveEntity(match);
        setShowUrduSessionPrompt(true); // Fire up the shopkeeper friendly alert
        return;
      }
    }
    // Directly run original engine if it's a walk-in customer
    executeCoreInvoiceGeneration();
  };

  const executeCoreInvoiceGeneration = async () => {
    const balanceDueCalculated = Math.max(0, grandTotal - parseFloat(cashReceived || 0));
    
    if (balanceDueCalculated > 0 && freshDueDate && freshDueDate.trim() !== '') {
      const selectedDateInput = new Date(freshDueDate);
      const pureTodayStandardDate = new Date();
      pureTodayStandardDate.setHours(0, 0, 0, 0); 
      
      if (selectedDateInput < pureTodayStandardDate) {
        alert("🚨 ERROR: A past date was selected by mistake!");
        return;
      }
    }
    if (lineItems.length === 0) {
      alert("Please add at least one product to the invoice.");
      return;
    }

    try {
      setLoading(true);
      const { data: maxInv, error: countError } = await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('shop_id', activeShopId)
        .order('invoice_number', { ascending: false })
        .limit(1);

      if (countError) throw countError;

      let newSequence = 1;
      if (maxInv && maxInv.length > 0) {
        const lastNumStr = maxInv[0].invoice_number.replace('INV-', '');
        const lastNum = parseInt(lastNumStr, 10);
        if (!isNaN(lastNum)) {
          newSequence = lastNum + 1;
        }
      }
      const invoiceNumber = `INV-${String(newSequence).padStart(4, '0')}`;

      let finalCustomerId = formCustomerId;

      // --- ACCOUNTING LEDGER SWITCHER LOGIC CRITICAL LOOP ---
      if (sessionChoice === 'new' && selectedActiveEntity) {
        try {
          await supabase
            .from('customers')
            .update({ khata_status: 'closed' })
            .eq('id', parseInt(selectedActiveEntity.id));

          const { data: newCust, error: newCustErr } = await supabase
            .from('customers')
            .insert([{
              shop_id: activeShopId,
              full_name: selectedActiveEntity.full_name || selectedActiveEntity.name,
              phone: selectedActiveEntity.phone || '',
              address: selectedActiveEntity.email || selectedActiveEntity.address || '',
              payment_due: 0,
              khata_status: 'active'
            }])
            .select()
            .single();

          if (newCustErr) throw newCustErr;
          if (newCust) {
            finalCustomerId = newCust.id;
          }
        } catch (sessionErr) {
          console.error("Session profile cloning crashed:", sessionErr);
          finalCustomerId = formCustomerId;
        }
      } else if (!finalCustomerId && formCustomerName.trim()) {
        const { data: newCust, error: custErr } = await supabase.from('customers').insert([{
          shop_id: activeShopId,
          full_name: formCustomerName.trim(),
          phone: formCustomerPhone || null,
          email: formCustomerAddress || null 
        }]).select().single();
        if (!custErr && newCust) finalCustomerId = newCust.id;
      }

      const payload = {
        shop_id: activeShopId,
        invoice_number: invoiceNumber,
        customer_id: finalCustomerId || null,
        customer_name: formCustomerName.trim() || 'Walk-in Customer',
        items: lineItems,
        subtotal: subtotal,
        discount: parseFloat(discount) || 0,
        tax_amount: taxAmount,
        grand_total: grandTotal,
        balance_due: balanceDueCalculated,
        due_date: balanceDueCalculated > 0 ? (freshDueDate || null) : null,
        status: balanceDueCalculated <= 0 ? 'paid' : 'unpaid'
      };

      // 📡 OFFLINE RETAIL PIPELINE STANDARD CHECK
      let data = null;
      let error = null;

      if (!navigator.onLine) {
        // No internet connection, locking data in local storage queue
        const offlinePayload = {
          ...payload,
          status: balanceDueCalculated <= 0 ? 'paid' : 'unpaid',
          created_at: new Date().toISOString()
        };
        
        queueOfflineTransaction('invoices', offlinePayload);
        alert("🔒 No internet connection! The invoice has been saved locally on the store computer. It will automatically sync when the internet is restored.");
        
        // Form resetting state fallback (Taake agla bill banaya ja sakay)
        setLineItems([]);
        setDiscount(0);
        setLoading(false);
        return; // Return execution early to prevent remote crash
      } else {
        // Internet is active, executing normal cloud save
        const response = await supabase
          .from('invoices')
          .insert([payload])
          .select()
          .single();
          
        data = response.data;
        error = response.error;
      }

      if (error) throw error;
      setInvoices([data, ...invoices]);

      for (const item of lineItems) {
        const { data: pData } = await supabase.from('products').select('current_stock').eq('id', item.product_id).single();
        if (pData) {
          const newStock = Math.max(0, pData.current_stock - item.quantity);
          await supabase.from('products').update({ current_stock: newStock }).eq('id', item.product_id).eq('shop_id', activeShopId);
        }
      }

      if (finalCustomerId) {
        let absoluteDbBalance = 0;
        try {
          const { data: latestTxLogs, error: txLogErr } = await supabase
            .from('transactions')
            .select('remaining_balance')
            .eq('party_id', parseInt(finalCustomerId))
            .eq('party_type', 'customer')
            .order('id', { ascending: false })
            .limit(1);

          if (!txLogErr && latestTxLogs && latestTxLogs.length > 0) {
            absoluteDbBalance = parseFloat(latestTxLogs[0].remaining_balance || 0);
          } else {
            const { data: currentCustData } = await supabase
              .from('customers')
              .select('payment_due')
              .eq('id', parseInt(finalCustomerId))
              .maybeSingle();
            absoluteDbBalance = parseFloat(currentCustData?.payment_due || 0);
          }
        } catch (fetchErr) {
          console.error("Error fetching safety net balance, falling back to 0:", fetchErr);
        }

        const currentInvoiceBalanceDue = parseFloat(grandTotal || 0) - parseFloat(cashReceived || 0);
        const trueCumulativeCustomerBalance = sessionChoice === 'new' ? currentInvoiceBalanceDue : absoluteDbBalance + currentInvoiceBalanceDue;

        const txPayload = {
          shop_id: activeShopId,
          party_id: parseInt(finalCustomerId),
          party_type: 'customer',
          transaction_type: 'sale',
          amount: parseFloat(grandTotal) || 0, 
          remaining_balance: parseFloat(trueCumulativeCustomerBalance),
          notes: `${lineItems.map(i => `${i.name} (${i.quantity} Qty)`).join(', ')}`,
          total_bill: parseFloat(grandTotal) || 0,
          cash_paid_received: parseFloat(cashReceived || 0) || 0
        };

        const { error: txError } = await supabase.from('transactions').insert([txPayload]);
        if (txError) throw txError;
        
        await supabase
          .from('customers')
          .update({ 
            payment_due: trueCumulativeCustomerBalance,
            due_date: balanceDueCalculated > 0 ? (freshDueDate || null) : null
          })
          .eq('id', parseInt(finalCustomerId));
      }

      setShowCreateModal(false);
      setLineItems([]);
      setFormCustomerId('');
      setFormCustomerName('');
      setFormCustomerPhone('');
      setFormCustomerAddress('');
      setDiscount(0);
      setApplyTax(false);
      setCashReceived(0);
      setFreshDueDate('');
      setPreviousBalance(0);
      
      // Clean temporary prompts context context
      setShowUrduSessionPrompt(false);
      setSelectedActiveEntity(null);
      setSessionChoice('current');

      alert("Invoice processed and Customer Ledger successfully synchronized!");
      await fetchInvoicesData();

    } catch (err) {
      console.error("REAL DATABASE CRASH REPORT:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', id)
        .eq('shop_id', activeShopId);
        
      if (error) throw error;
      setInvoices(invoices.map(inv => inv.id === id ? { ...inv, status: newStatus } : inv));
      if (selectedInvoice && selectedInvoice.id === id) {
        setSelectedInvoice({ ...selectedInvoice, status: newStatus });
      }
    } catch (err) {
      alert("Failed to update payment status tag properties.");
    }
  };

  const openEditModal = (inv) => {
    setEditTargetInvoice(inv);
    setReceiveAmount('');
    setNewDueDate(inv.due_date || '');
    setShowEditModal(true);
  };

  const handleProcessInstallment = async (e) => {
    e.preventDefault();
    if (!editTargetInvoice) return;

    const received = parseFloat(receiveAmount) || 0;
    const currentBalance = parseFloat(editTargetInvoice.balance_due) || 0;
    
    if (received <= 0 || received > currentBalance) {
      alert("Please enter a valid installment amount.");
      return;
    }

    const newBalance = currentBalance - received;
    const isPaid = newBalance <= 0;
    const finalDate = isPaid ? null : newDueDate;

    if (newBalance > 0 && newDueDate && newDueDate.trim() !== '') {
      const selectedDate = new Date(newDueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        alert("🚨 ERROR: A past date was selected by mistake!");
        return;
      }
    }

    try {
      const finalStatus = isPaid ? 'paid' : 'partially_paid';
      let existingHistory = [];
      try {
        if (typeof editTargetInvoice.payment_history === 'string') {
          existingHistory = JSON.parse(editTargetInvoice.payment_history);
        } else if (Array.isArray(editTargetInvoice.payment_history)) {
          existingHistory = editTargetInvoice.payment_history;
        }
      } catch (e) {
        existingHistory = [];
      }
      
      const newPaymentHistory = [
        ...existingHistory,
        { amount: received, date: new Date().toISOString(), next_due: finalDate }
      ];

      const { error: invErr } = await supabase
        .from('invoices')
        .update({ 
          balance_due: newBalance,
          status: finalStatus,
          due_date: finalDate,
          payment_history: newPaymentHistory
        })
        .eq('id', editTargetInvoice.id)
        .eq('shop_id', activeShopId);

      if (invErr) throw invErr;

      if (editTargetInvoice.customer_id) {
        let currentCustBalance = 0;
        
        const { data: customerData } = await supabase
          .from('customers')
          .select('payment_due')
          .eq('shop_id', activeShopId)
          .eq('id', editTargetInvoice.customer_id)
          .single();

        if (customerData) {
          currentCustBalance = parseFloat(customerData.payment_due || 0);
        }

        const newGlobalCustomerBalance = currentCustBalance - received;

        const txPayload = {
          shop_id: activeShopId,
          party_id: parseInt(editTargetInvoice.customer_id),
          party_type: 'customer',
          transaction_type: 'payment_received',
          amount: received, 
          remaining_balance: parseFloat(newGlobalCustomerBalance),
          notes: `Installment Cash Received for Invoice: ${editTargetInvoice.invoice_number}`,
          cash_paid_received: received,
          total_bill: 0
        };

        await supabase.from('transactions').insert([txPayload]);
        await supabase.from('customers').update({ 
          payment_due: newGlobalCustomerBalance,
          due_date: finalDate
        }).eq('id', parseInt(editTargetInvoice.customer_id));
      }

      setInvoices(invoices.map(inv => 
        inv.id === editTargetInvoice.id 
          ? { ...inv, balance_due: newBalance, status: finalStatus, due_date: finalDate, payment_history: newPaymentHistory } 
          : inv
      ));

      setShowEditModal(false);
      setEditTargetInvoice(null);
      setReceiveAmount('');
      setNewDueDate('');
      alert("Installment collected successfully!");

    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteInvoice = async (inv) => {
    const userChoice = window.prompt(
      "Invoice Delete / Action Menu:\n" +
      "=================================\n" +
      "Type '1' for: Clear Screen (Clear unnecessary bills from the list - Ledger Safe)\n" +
      "Type '2' for: Mukammal Wapsi (Cancel entire bill & restore stock)\n" +
      "Type '3' for: Partial Goods Return (Open Partial Return Form)"
    );

    if (userChoice !== '1' && userChoice !== '2' && userChoice !== '3') {
      alert("No action selected. Invoice secure.");
      return;
    }

    try {
      if (userChoice === '1') {
        setLoading(true);
        const { error: delErr } = await supabase
          .from('invoices')
          .delete()
          .eq('id', inv.id)
          .eq('shop_id', activeShopId);

        if (delErr) {
          const { error: upErr } = await supabase
            .from('invoices')
            .update({ status: 'cancelled' })
            .eq('id', inv.id)
            .eq('shop_id', activeShopId);
          if (upErr) throw upErr;
        }
        setInvoices(invoices.filter(i => i.id !== inv.id));
        alert("Clear Screen Complete: The bill has been cleared from the screen.");
      }
      else if (userChoice === '2') {
        const confirmFull = window.confirm("Do you really want to return all the goods from this entire bill to the store inventory?");
        if (!confirmFull) return;

        setLoading(true);

        const { data: pastReturns } = await supabase
          .from('transactions')
          .select('id')
          .eq('party_id', inv.customer_id)
          .eq('transaction_type', 'return')
          .gt('created_at', inv.created_at || '2000-01-01');

        if (pastReturns && pastReturns.length > 0) {
          alert("🚨 SAFETY LOCK: This customer has already made a partial return. You cannot perform a Full Return on this bill, as it will cause a double-entry! Please adjust manually.");
          setLoading(false);
          return;
        }
        if (inv.customer_id && inv.grand_total) {
          let currentCustBalance = 0;
          const { data: latestDbTx } = await supabase
            .from('transactions')
            .select('remaining_balance')
            .eq('shop_id', activeShopId)
            .eq('party_id', inv.customer_id)
            .eq('party_type', 'customer')
            .order('id', { ascending: false })
            .limit(1);

          if (latestDbTx && latestDbTx.length > 0) {
            currentCustBalance = parseFloat(latestDbTx[0].remaining_balance || 0);
          } else {
            const { data: currentCustData } = await supabase
              .from('customers')
              .select('payment_due')
              .eq('id', parseInt(inv.customer_id))
              .maybeSingle();
            currentCustBalance = parseFloat(currentCustData?.payment_due || 0);
          }

          const reversalAmount = parseFloat(inv.grand_total) || 0;
          if (reversalAmount > 0) {
            const newGlobalBalance = currentCustBalance - reversalAmount;
            
            await supabase.from('transactions').insert([{
              shop_id: activeShopId,
              party_id: parseInt(inv.customer_id),
              party_type: 'customer',
              transaction_type: 'reversal',
              amount: reversalAmount, 
              remaining_balance: newGlobalBalance,
              notes: `Mukammal Wapsi / Reversal for Invoice: ${inv.invoice_number}`
            }]);
            
            await supabase.from('customers').update({ payment_due: newGlobalBalance }).eq('id', parseInt(inv.customer_id));
          }
        }

        if (inv.items && Array.isArray(inv.items)) {
          await Promise.all(inv.items.map(async (item) => {
            if (!item.product_id || !item.quantity) return;
            const { data: pData } = await supabase.from('products').select('current_stock').eq('id', item.product_id).single();
            if (pData) {
              const restoredStock = parseFloat(pData.current_stock || 0) + parseFloat(item.quantity);
              await supabase.from('products').update({ current_stock: restoredStock }).eq('id', item.product_id).eq('shop_id', activeShopId);
            }
          }));
        }

        const { error } = await supabase
          .from('invoices')
          .update({ status: 'cancelled' })
          .eq('id', inv.id)
          .eq('shop_id', activeShopId);

        if (error) throw error;
        setInvoices(invoices.filter(i => i.id !== inv.id));
        alert("Full Return: Invoice cancelled and stock restored successfully!");
      }
      else if (userChoice === '3') {
        if (!inv.items || inv.items.length === 0) {
          alert("There are no items in this invoice.");
          return;
        }

        let itemMenu = "Goods Return Form:\nSelect an item (Enter Number):\n\n";
        inv.items.forEach((item, index) => {
          itemMenu += `${index + 1}. ${item.product_name || item.name || 'Unknown'} (Sale Qty: ${item.quantity})\n`;
        });

        const selectedIndexInput = window.prompt(itemMenu);
        if (selectedIndexInput === null) return;

        const selectedIndex = parseInt(selectedIndexInput) - 1;
        if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= inv.items.length) {
          alert("🚨 Invalid number entered! Action aborted.");
          return;
        }

        const itemToReturn = inv.items[selectedIndex]; 
        const returnQtyInput = window.prompt(`Quantity to Return:\nItem: ${itemToReturn.product_name || itemToReturn.name}\nSale Qty: ${itemToReturn.quantity}\n\nHow much quantity do you want to return to the store?`);
        if (returnQtyInput === null) return;

        const returnQty = parseFloat(returnQtyInput);
        if (isNaN(returnQty) || returnQty <= 0 || returnQty > parseFloat(itemToReturn.quantity)) {
          alert("🚨 Invalid Quantity! Action aborted safely.");
          return;
        }

        setLoading(true);

        const { data: pData } = await supabase.from('products').select('current_stock').eq('id', itemToReturn.product_id).single();
        if (pData) {
          const restoredStock = parseFloat(pData.current_stock || 0) + returnQty;
          await supabase.from('products').update({ current_stock: restoredStock }).eq('id', itemToReturn.product_id).eq('shop_id', activeShopId);
        }

        const itemRate = parseFloat(itemToReturn.rate || itemToReturn.price || itemToReturn.selling_price || 0);
        const returnValue = returnQty * itemRate;

        const oldGrandTotal = parseFloat(inv.grand_total || 0);
        const newGrandTotal = oldGrandTotal - returnValue; 
        
        const actualCashReceived = parseFloat(inv.cash_paid_received || 0);
        let newBalanceDue = newGrandTotal - actualCashReceived; 

        if (newBalanceDue < 0) {
          newBalanceDue = 0; 
        }

        const updatedItems = inv.items.map((item, idx) => {
          if (idx === selectedIndex) {
            return { ...item, quantity: parseFloat(item.quantity) - returnQty };
          }
          return item;
        });

        await supabase
          .from('invoices')
          .update({
            grand_total: newGrandTotal,
            balance_due: newBalanceDue,
            items: updatedItems
          })
          .eq('id', inv.id);

        let currentCustBalance = 0;
        const { data: latestDbTx } = await supabase
          .from('transactions')
          .select('remaining_balance')
          .eq('shop_id', activeShopId)
          .eq('party_id', inv.customer_id)
          .eq('party_type', 'customer')
          .order('id', { ascending: false })
          .limit(1);

        if (latestDbTx && latestDbTx.length > 0) {
          currentCustBalance = parseFloat(latestDbTx[0].remaining_balance || 0);
        } else {
          const { data: currentCustData } = await supabase
            .from('customers')
            .select('payment_due')
            .eq('id', parseInt(inv.customer_id))
            .maybeSingle();
          currentCustBalance = parseFloat(currentCustData?.payment_due || 0);
        }

        await supabase.from('transactions').insert([{
          shop_id: activeShopId,
          party_id: parseInt(inv.customer_id),
          party_type: 'customer',
          transaction_type: 'return',
          amount: returnValue, 
          cash_paid_received: returnValue,
          remaining_balance: currentCustBalance - returnValue,
          notes: `Maal Wapsi (Return): ${returnQty} Qty of ${itemToReturn.name || 'Items'} from Inv: ${inv.invoice_number}`
        }]);

        await supabase
          .from('customers')
          .update({ payment_due: currentCustBalance - returnValue })
          .eq('id', parseInt(inv.customer_id));

        setInvoices(invoices.map(i => i.id === inv.id ? { ...i, grand_total: newGrandTotal, balance_due: newBalanceDue, items: updatedItems } : i));
        
        alert(`🎉 ERP Return Complete:\n${returnQty} Units have been restored to stock and in the Customer Ledger Rs. ${returnValue.toLocaleString()} have been CREDITED!`);
        
        fetchInvoicesData();
      }

    } catch (err) {
      console.error("Invoice Action Exception:", err);
      alert("System Action failed safely.");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePartialReturn = async (e) => {
    e.preventDefault();
    if (!returnTargetInvoice) return;

    try {
      setLoading(true);
      let totalReturnCreditValue = 0;
      const updatedItemsArray = [];
      const rollbackInventoryPromises = [];

      for (const item of returnTargetInvoice.items) {
        const returnQty = parseFloat(returnQuantities[item.product_id]) || 0;
        const soldQty = parseFloat(item.quantity) || 0;

        if (returnQty < 0) {
          alert("Return quantity cannot be negative.");
          setLoading(false);
          return;
        }
        if (returnQty > soldQty) {
          alert(`🚨 LIMIT EXCEEDED: ${item.name} out of total purchased ${soldQty} units cannot be returned!`);
          setLoading(false);
          return;
        }

        const saleRate = parseFloat(item.selling_price || 0);
        totalReturnCreditValue += returnQty * saleRate;

        const remainingQty = soldQty - returnQty;
        updatedItemsArray.push({
          ...item,
          quantity: remainingQty
        });

        if (returnQty > 0) {
          rollbackInventoryPromises.push((async () => {
            const { data: pData } = await supabase.from('products').select('current_stock').eq('id', item.product_id).single();
            if (pData) {
              const newRestoredStock = parseFloat(pData.current_stock || 0) + returnQty;
              await supabase.from('products').update({ current_stock: newRestoredStock }).eq('id', item.product_id).eq('shop_id', activeShopId);
            }
          })());
        }
      }

      if (totalReturnCreditValue <= 0) {
        alert("Please enter a return quantity for at least one item.");
        setLoading(false);
        return;
      }

      if (rollbackInventoryPromises.length > 0) {
        await Promise.all(rollbackInventoryPromises);
      }

      const currentInvoiceBalance = parseFloat(returnTargetInvoice.balance_due) || 0;
      const newInvoiceBalance = Math.max(0, currentInvoiceBalance - totalReturnCreditValue);
      const isNowFullyPaid = newInvoiceBalance <= 0;

      await supabase
        .from('invoices')
        .update({
          balance_due: newInvoiceBalance,
          items: updatedItemsArray,
          status: isNowFullyPaid ? 'paid' : returnTargetInvoice.status
        })
        .eq('id', returnTargetInvoice.id);

      if (returnTargetInvoice.customer_id) {
        let currentCustBalance = 0;
        const { data: customerData } = await supabase
          .from('customers')
          .select('payment_due')
          .eq('shop_id', activeShopId)
          .eq('id', returnTargetInvoice.customer_id)
          .single();

        if (customerData) {
          currentCustBalance = parseFloat(customerData.payment_due || 0);
        }

        const newGlobalCustomerBalance = Math.max(0, currentCustBalance - totalReturnCreditValue);

        const returnTxPayload = {
          shop_id: activeShopId,
          party_id: parseInt(returnTargetInvoice.customer_id),
          party_type: 'customer',
          transaction_type: 'reversal',
          amount: totalReturnCreditValue,
          remaining_balance: parseFloat(newGlobalCustomerBalance),
          notes: `Maal Wapsi / Partial Return for Invoice No: ${returnTargetInvoice.invoice_number}`,
          cash_paid_received: totalReturnCreditValue,
          total_bill: 0
        };

        await supabase.from('transactions').insert([returnTxPayload]);
        
        await supabase
          .from('customers')
          .update({ payment_due: newGlobalCustomerBalance })
          .eq('id', parseInt(returnTargetInvoice.customer_id));
      }

      setShowPartialReturnModal(false);
      setReturnTargetInvoice(null);
      alert("Choti Maal Wapsi Complete: Stock and Ledger synchronized safely!");
      await fetchInvoicesData();

    } catch (err) {
      console.error("Partial Return Crash Stack Trace:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (startDate || endDate) {
        const invDate = new Date(inv.created_at);
        invDate.setHours(0,0,0,0);
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0,0,0,0);
          if (invDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(0,0,0,0);
          if (invDate > end) return false;
        }
      }
      return true;
    });
  }, [invoices, statusFilter, startDate, endDate]);

  const getStatusBadge = (status) => {
    switch(status) {
      case 'paid': return <span className="px-2.5 py-1 rounded-lg text-xs font-bold border bg-emerald-500/20 text-emerald-400 border-emerald-500/30 uppercase tracking-wider">Paid</span>;
      case 'unpaid': return <span className="px-2.5 py-1 rounded-lg text-xs font-bold border bg-rose-500/20 text-rose-400 border-rose-500/30 uppercase tracking-wider">Unpaid</span>;
      case 'partially_paid': return <span className="px-2.5 py-1 rounded-lg text-xs font-bold border bg-amber-500/20 text-amber-400 border-amber-500/30 uppercase tracking-wider">Partial</span>;
      default: return <span className="px-2.5 py-1 rounded-lg text-xs font-bold border bg-slate-700 text-slate-300 border-slate-600 uppercase tracking-wider">{status}</span>;
    }
  };

  if (!activeShopId) {
    return (
      <div className="p-8 text-center text-slate-900 dark:text-white">
        <h2 className="text-2xl font-bold mb-4">No Shop Selected / کوئی دکان منتخب نہیں ہے</h2>
        <p className="text-slate-500 dark:text-slate-400">Please select a workspace to manage invoices.</p>
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="animate-in fade-in duration-500 text-left">
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { 
            size: ${printPaperSize === 'Thermal' ? '80mm auto' : printPaperSize === 'Legal' ? 'legal portrait' : 'A4 portrait'}; 
            margin: ${printPaperSize === 'Thermal' ? '2mm 3mm 2mm 3mm' : '10mm 10mm 10mm 10mm'}; 
          }
          html, body, #root, main, .min-h-screen { 
            background: #ffffff !important; color: #000000 !important; font-family: system-ui, sans-serif !important;
            min-height: 0 !important;
            height: auto !important;
            position: static !important;
            overflow: visible !important;
          }
          .no-print, .no-print *, button, select, nav, aside, header, .flex.gap-4.items-center { 
            display: none !important; 
            visibility: hidden !important; 
            opacity: 0 !important; 
            height: 0 !important; 
            padding: 0 !important; 
            margin: 0 !important; 
          }
          #printable-invoice {
            position: static !important; width: 100% !important; height: auto !important;
            max-width: ${printPaperSize === 'Thermal' ? '74mm' : '100%'} !important;
            padding: 0px !important; margin: 0 !important; background: #ffffff !important; box-shadow: none !important; border: none !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; margin-top: 10px !important; border: 1px solid #000000 !important; }
          th, td { 
            padding: ${printPaperSize === 'Thermal' ? '3px 2px' : '6px 5px'} !important; 
            font-size: ${printPaperSize === 'Thermal' ? '8pt' : '9.5pt'} !important; 
            border: 1px solid #000000 !important; word-wrap: break-words !important; color: #000000 !important; 
          }
          th { background: #f8fafc !important; font-weight: bold !important; border-top: 2px solid #000000 !important; border-bottom: 2px solid #000000 !important; }
          .flex.justify-end.mb-6 { margin-bottom: ${printPaperSize === 'Thermal' ? '2px' : '24px'} !important; }
          .w-full.sm\\:w-80 { width: ${printPaperSize === 'Thermal' ? '100%' : '20rem'} !important; padding: ${printPaperSize === 'Thermal' ? '8px' : '20px'} !important; border-radius: 0px !important; border: 1px solid #000000 !important; background: transparent !important; color: #000000 !important; }
          .w-full.sm\\:w-80 span, .w-full.sm\\:w-80 font-mono { color: #000000 !important; font-size: ${printPaperSize === 'Thermal' ? '8.5pt' : '10pt'} !important; }
        }
      `}} />

      {!selectedInvoice ? (
        <>
          {/*Header panel*/}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 p-6 rounded-3xl border border-indigo-500/30 shadow-2xl shadow-indigo-500/10 relative overflow-hidden group text-left bg-[#050b21] no-print">
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
            
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes InvovoERPVibrantWave {
                0% { background-position: 0% 50% }
                50% { background-position: 100% 50% }
                100% { background-position: 0% 50% }
              }
            `}} />

            <div className="relative flex items-center gap-4 text-left z-10">
              <div className="p-3.5 bg-slate-900/80 border border-indigo-400/50 rounded-2xl text-2xl shadow-xl backdrop-blur-md animate-bounce duration-1000">
                🧾
              </div>
              <div>
                <h2 className="text-[11px] font-black tracking-widest text-indigo-300 uppercase font-mono bg-slate-950/40 px-2 py-0.5 rounded w-max border border-indigo-500/20 backdrop-blur-sm">Sales Billing Engine</h2>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase mt-1.5" style={{ textShadow: '0 2px 20px rgba(219,39,119,0.6), 0 4px 10px rgba(99,102,241,0.6)' }}>
                  Invoices &amp; Billing / <span className="text-indigo-300 font-extrabold">رسیدیں اور بلنگ</span>
                </h1>
                <p className="text-xs text-slate-200 mt-1.5 font-medium tracking-wide flex items-center gap-2 drop-shadow-md">
                  <span className="font-bold">Invovo ERP Suite</span> • <span className="text-slate-300">Transaction History</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap no-print z-10 self-end md:self-center w-full sm:w-auto">
              <button 
                type="button"
                onClick={() => {
                  setLineItems([]);
                  setFormCustomerId('');
                  setFormCustomerName('');
                  setFormCustomerPhone('');
                  setFormCustomerAddress('');
                  setDiscount(0);
                  setApplyTax(false);
                  setCashReceived(0);
                  setFreshDueDate('');
                  setPreviousBalance(0);
                  setShowCreateModal(true);
                }}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs shadow-md transition-all duration-300 transform active:scale-95 border border-indigo-500/40 cursor-pointer flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Create Invoice
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          <div className="flex flex-col md:flex-row gap-4 mb-6 no-print items-stretch sm:items-end bg-slate-200/50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-300 dark:border-slate-750">
            <div className="w-full md:w-1/4">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Status Filter</label>
              <select 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)} 
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm font-bold cursor-pointer focus:outline-none"
              >
                <option value="all">All Bills / تمام بل</option>
                <option value="paid">Paid / ناگد</option>
                <option value="unpaid">Unpaid / ادھار</option>
                <option value="partially_paid">Partial / کچھ بقایا</option>
              </select>
            </div>
            
            <div className="w-full md:w-1/4">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">From Date (تاریخ سے)</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm font-mono focus:outline-none" 
              />
            </div>

            <div className="w-full md:w-1/4">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">To Date (تاریخ تک)</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm font-mono focus:outline-none" 
              />
            </div>

            {(statusFilter !== 'all' || startDate || endDate) && (
              <button 
                type="button"
                onClick={() => { setStatusFilter('all'); setStartDate(''); setEndDate(''); }} 
                className="px-4 py-2 bg-rose-600/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold rounded-xl hover:bg-rose-600 hover:text-white transition-all cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>

          {invoices.length === 0 ? (
            <EmptyState 
              icon={FileText}
              title="No Invoices Generated"
              description="Start billing your customers to see your invoice history here."
              buttonText="Create Invoice"
              onAction={() => setShowCreateModal(true)}
            />
          ) : (
            <div className="bg-white dark:bg-slate-800/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <div className="overflow-x-auto w-full"><table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-sm uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      <th className="p-5 font-bold text-left whitespace-nowrap">Invoice Number</th>
                      <th className="p-5 font-bold text-left whitespace-nowrap">Customer Name</th>
                      <th className="p-5 font-bold text-left whitespace-nowrap">Total Bill</th>
                      <th className="p-5 font-bold text-left whitespace-nowrap">Balance Due &amp; Date</th>
                      <th className="p-5 font-bold text-left whitespace-nowrap">Status</th>
                      <th className="p-5 font-bold text-left whitespace-nowrap">Date Created</th>
                      <th className="p-5 font-bold text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50 text-slate-800 dark:text-slate-200 font-medium">
                   {filteredInvoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-100/40 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="p-5 font-black font-mono text-indigo-600 dark:text-indigo-400 text-left whitespace-nowrap">{inv.invoice_number}</td>
                        <td className="p-5 font-black text-left whitespace-nowrap">{inv.customer_name || 'Walk-in Customer'}</td>
                        <td className="p-5 font-black font-mono text-left whitespace-nowrap">{formatCurrency(inv.grand_total)}</td>
                        <td className="p-5 text-left whitespace-nowrap">
                          <div className="font-black font-mono text-rose-600 dark:text-rose-400">{formatCurrency(inv.balance_due || 0)}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-bold">{inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB') : 'No Date'}</div>
                        </td>
                        <td className="p-5 text-left whitespace-nowrap">{getStatusBadge(inv.status)}</td>
                        <td className="p-5 text-sm text-slate-500 dark:text-slate-400 text-left font-mono font-bold whitespace-nowrap">{new Date(inv.created_at).toLocaleDateString('en-GB')}</td>
                        <td className="p-5 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2 min-w-max">
                            <button 
                              type="button"
                              onClick={() => setSelectedInvoice(inv)}
                              className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-lg text-xs font-bold transition-colors border border-slate-300 dark:border-slate-600 cursor-pointer"
                            >
                              View
                            </button>
                            <button 
                              type="button"
                              onClick={() => openEditModal(inv)}
                              className="p-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-indigo-600 text-slate-600 dark:text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-300 dark:border-slate-600 hover:border-indigo-500 cursor-pointer"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleDeleteInvoice(inv)}
                              className="p-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-rose-600 text-slate-600 dark:text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-300 dark:border-slate-600 hover:border-rose-500 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
              {hasMore && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-center">
                   <button 
                     type="button" 
                     onClick={() => {
                       const nextPage = page + 1;
                       setPage(nextPage);
                       fetchInvoicesData(nextPage, true);
                     }}
                     className="px-6 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-xl text-sm font-bold transition-colors border border-slate-300 dark:border-slate-600 cursor-pointer"
                   >
                     Load More Invoices...
                   </button>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* PRINT SLIP VIEW */
        <div id="printable-invoice" className="bg-white p-4 sm:p-8 rounded-2xl shadow-2xl border border-slate-200 text-slate-900 mx-auto max-w-3xl font-sans text-left">
          <div className="no-print mb-8 flex flex-wrap justify-between items-center gap-4 border-b border-slate-100 pb-4">
            <button 
              type="button"
              onClick={() => setSelectedInvoice(null)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg text-sm cursor-pointer font-bold"
            >
              <ArrowLeft className="w-4 h-4" /> Back to List
            </button>
            <div className="flex flex-wrap gap-4 items-center">
              <select value={printPaperSize} onChange={(e) => setPrintPaperSize(e.target.value)} className="bg-slate-800 px-3 py-2 text-sm text-white rounded-xl focus:outline-none cursor-pointer font-bold">
                <option value="A4">Standard A4 Page</option>
                <option value="Legal">Legal Size Sheet</option>
                <option value="Thermal">80mm POS Thermal Slip</option>
              </select>
              <button type="button" onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold cursor-pointer text-sm"><Printer className="w-4 h-4" /> Print Bill</button>
              <button 
                type="button" 
                disabled={isGeneratingPDF}
                onClick={async () => {
                  const targetCustomerObj = customers.find(cust => cust.id === selectedInvoice.customer_id);
                  const activePhone = targetCustomerObj?.phone || selectedInvoice.customer_phone || '';

                  if (!activePhone || activePhone.trim() === '' || activePhone.length < 10) {
                    alert("🚨 Error: This customer's WhatsApp mobile number is not registered in the ledger!");
                    return;
                  }

                  try {
                    setIsGeneratingPDF(true);
                    let itemListText = '';
                    if (selectedInvoice.items && selectedInvoice.items.length > 0) {
                      itemListText = '*Purchased Items:*\n';
                      selectedInvoice.items.forEach((item, index) => {
                        const qty = parseInt(item.quantity || 1);
                        const rate = parseFloat(item.selling_price || 0);
                        const total = qty * rate;
                        itemListText += `${index + 1}. ${item.name || item.product_name || 'Item'} (${qty} x ${rate}) = ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${total.toLocaleString()}\n`;
                      });
                    }

                    const shopName = activeShopInfo?.name || 'Invovo ERP Shop';
                    const shopAddress = activeShopInfo?.address || '';
                    const shopPhone = activeShopInfo?.phone || '';
                    const invoiceNo = selectedInvoice?.invoice_number || '';
                    const invoiceDate = selectedInvoice?.created_at ? new Date(selectedInvoice.created_at).toLocaleDateString('en-GB') : '';

                    const customerName = selectedInvoice?.customer_name || 'Walk-in Customer';
                    const customerPhone = activePhone;

                    const totalBill = Number(selectedInvoice?.grand_total || 0).toLocaleString();
                    const balanceDue = Number(selectedInvoice?.balance_due || 0).toLocaleString();
                    const cashReceived = Number((selectedInvoice?.grand_total || 0) - (selectedInvoice?.balance_due || 0)).toLocaleString();

                    const rawMessage = `*${shopName}*\n${shopAddress ? `🏠 ${shopAddress}\n` : ''}${shopPhone ? `📱 ${shopPhone}\n` : ''}\n🧾 *INVOICE No:* ${invoiceNo}\n📅 *Date:* ${invoiceDate}\n------------------------\n👤 *Customer:* ${customerName}\n📞 *Phone:* ${customerPhone}\n------------------------\n${itemListText}------------------------\n💰 *Total Bill:* ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${totalBill}\n💵 *Cash Received:* ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${cashReceived}\n🔺 *Balance Due:* ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${balanceDue}\n------------------------\n!استعمال کرنے کا شکریہ\n_Powered by Invovo | Invovo ERP_`;

                    dispatchWhatsAppMessage(activePhone, rawMessage);
                  } catch (e) {
                    console.error("WhatsApp Dispatch Error:", e);
                  } finally {
                    setIsGeneratingPDF(false);
                  }
                }} 
                className={`px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold cursor-pointer text-sm shadow-md transition-colors ${isGeneratingPDF ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isGeneratingPDF ? '⏳ Generating...' : '💬 WhatsApp Bill'}
              </button>
            </div>
          </div>

          <div className="border-b border-slate-200 pb-4 mb-4 flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <h2 className="text-2xl font-black text-indigo-900 uppercase tracking-tight">{activeShopInfo.name || 'Demo Company'}</h2>
              <p className="text-xs text-slate-700 font-semibold mt-1">
                🏠 Address: {activeShopInfo.address || 'Main Bazar'}
              </p>
              <p className="text-xs text-slate-700 font-mono font-bold mt-0.5">
                📱 Phone: {activeShopInfo.phone || 'Contact Settings'}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <div className="bg-slate-900 text-white px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-widest inline-block sm:block">INVOICE</div>
              <p className="text-xs text-slate-500 font-mono font-bold mt-2">Invoice No: <span className="text-slate-800 font-black font-sans">{selectedInvoice.invoice_number}</span></p>
              <p className="text-xs text-slate-500 font-medium">Date: <span className="text-slate-800 font-bold">{new Date(selectedInvoice.created_at).toLocaleDateString('en-GB')}</span></p>
            </div>
          </div>

          <div className="mb-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col gap-1 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600"></div>
            <div className="inline-block bg-indigo-600 text-white px-2 py-0.5 text-[9px] font-black tracking-wider rounded-md uppercase w-max">BILL TO</div>
            <p className="text-sm font-black text-slate-800 uppercase m-0">{selectedInvoice.customer_name || 'Walk-in Customer'}</p>
            
            {customers.find(cust => cust.id === selectedInvoice.customer_id)?.phone && (
              <p className="text-xs text-slate-600 font-mono font-bold">📱 Phone: {customers.find(cust => cust.id === selectedInvoice.customer_id).phone}</p>
            )}
            {(customers.find(cust => cust.id === selectedInvoice.customer_id)?.email || customers.find(cust => cust.id === selectedInvoice.customer_id)?.address) && (
              <p className="text-xs text-slate-600 font-semibold">🏠 Address: {customers.find(cust => cust.id === selectedInvoice.customer_id).email || customers.find(cust => cust.id === selectedInvoice.customer_id).address}</p>
            )}
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
            <div className="overflow-x-auto w-full"><table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white text-[11px] uppercase font-bold">
                  <th className="p-2 text-white text-left border border-slate-700 whitespace-nowrap" style={{ width: '45%' }}>Item</th>
                  <th className="p-2 text-center text-white border border-slate-700 whitespace-nowrap" style={{ width: '15%' }}>Qty</th>
                  <th className="p-2 text-right text-white border border-slate-700 whitespace-nowrap" style={{ width: '20%' }}>Rate</th>
                  <th className="p-2 text-right text-white border border-slate-700 whitespace-nowrap" style={{ width: '20%' }}>Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold text-xs">
                {selectedInvoice.items && selectedInvoice.items.map((item, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                    <td className="p-2 font-bold text-slate-800 whitespace-normal break-words border border-slate-200 whitespace-nowrap">{item.name}</td>
                    <td className="p-2 text-center font-mono border border-slate-200 whitespace-nowrap">{item.quantity}</td>
                    <td className="p-2 text-right font-mono border border-slate-200 whitespace-nowrap">{Number(item.selling_price || 0).toLocaleString()}</td>
                    <td className="p-2 text-right font-mono font-bold text-slate-800 border border-slate-200 whitespace-nowrap">{Number(parseFloat(item.selling_price || 0) * parseInt(item.quantity || 1)).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>

          <div className="flex justify-end mb-6">
            <div className="w-full sm:w-80 bg-slate-900 text-white p-5 rounded-2xl shadow-xl flex flex-col gap-3 text-sm font-semibold">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
                <span className="text-slate-400 text-xs font-black uppercase">TOTAL BILL:</span>
                <span className="font-mono font-bold text-base">Rs. {Number(selectedInvoice.grand_total || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
                <span className="text-slate-400 text-xs font-black uppercase">CASH RECEIVED:</span>
                <span className="font-mono font-bold text-base text-emerald-400">Rs. {Number((selectedInvoice.grand_total || 0) - (selectedInvoice.balance_due || 0)).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-orange-400 text-xs font-black uppercase">BALANCE DUE:</span>
                <span className="font-mono font-black text-xl text-orange-400">Rs. {Number(selectedInvoice.balance_due || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className='mt-8 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-500 font-bold'>{activeShopInfo.footer_message}</div>
          <div className='mt-2 pt-2 border-t border-dashed border-slate-300 text-center text-[9px] text-slate-400 font-bold font-mono uppercase tracking-wider'>
            Powered by Invovo (Contact: +92 305 9352744)
          </div>
        </div>
      )}

      {/* CREATE INVOICE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 overflow-y-auto w-full h-full">
          <div className="w-full min-h-screen bg-slate-900 flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 border-b border-slate-800 bg-slate-950 sticky top-0 z-10 shadow-md">
              <h3 className="text-2xl font-bold text-white">Create Retail Sales Invoice</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white p-2 bg-slate-800 rounded-full cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleInvoiceFormSubmission} className="p-4 sm:p-8 flex-1 max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-10">
              <div className="flex-1 space-y-6 text-left">
                <div className="bg-slate-800/90 border border-slate-700/60 p-6 rounded-2xl shadow-xl space-y-4">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 border-b border-slate-700/50 pb-2">1. Customer Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Customer Name *</label>
                      <input 
                        type="text" 
                        required 
                        value={formCustomerName} 
                        onChange={(e) => {
                          const inputVal = e.target.value;
                          setFormCustomerName(inputVal);
                          
                          const match = customers.find(c => 
                            String(c.full_name || c.name || '').toLowerCase() === inputVal.toLowerCase().trim()
                          );
                          
                          if (match) {
                            setFormCustomerId(match.id);
                            setFormCustomerPhone(match.phone || '');
                            setFormCustomerAddress(match.email || match.address || ''); 
                            fetchLiveCustomerBalance(match.id, match.payment_due || 0); 
                          } else {
                            setFormCustomerId('');
                            setFormCustomerPhone('');
                            setFormCustomerAddress('');
                            setPreviousBalance(0);
                          }
                        }}
                        className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white outline-none focus:border-indigo-500 text-sm font-bold" 
                        placeholder="Type registered name..."
                        list="customer-suggestions"
                      />
                      <datalist id="customer-suggestions">
                        {customers.map(c => <option key={c.id} value={c.full_name || c.name} />)}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Mobile Number</label>
                      <input type="tel" value={formCustomerPhone} onChange={e => setFormCustomerPhone(e.target.value)} className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white font-mono outline-none text-left text-sm font-bold" placeholder="03001234567" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Customer Address</label>
                    <input type="text" value={formCustomerAddress} onChange={e => setFormCustomerAddress(e.target.value)} className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white outline-none text-sm font-bold" placeholder="Customer Address details" />
                  </div>
                </div>

                <div className="bg-slate-800/90 border border-slate-700/60 p-6 rounded-2xl shadow-xl space-y-4">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 border-b border-slate-700/50 pb-2">2. Search &amp; Add Products</h4>
                  <div className="relative">
                    <Search className="w-5 h-5 text-slate-500 absolute left-4 top-3" />
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white outline-none focus:border-indigo-500 text-sm font-bold" placeholder="Search product name..." />
                  </div>
                  {searchTerm.trim() !== '' && (
                    <div className="bg-slate-950 border border-slate-700 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-800 z-30 relative text-left">
                      {filteredProducts.map(p => (
                        <button key={p.id} type="button" onClick={() => handleAddLineItem(p)} className="w-full text-left p-3 flex justify-between items-center hover:bg-slate-800/60 text-slate-200">
                          <div>
                            <p className="font-bold text-xs">{p.name}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 font-bold">Stock: {p.current_stock} units</p>
                          </div>
                          <p className="font-mono text-xs font-bold text-indigo-400">{formatCurrency(p.selling_price)}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {lineItems.length > 0 && (
                    <div className="border border-slate-700/40 rounded-xl overflow-x-auto mt-4">
                      <div className="overflow-x-auto w-full"><table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-900/80 text-slate-400 font-bold">
                          <tr>
                            <th className="p-3 whitespace-nowrap">Item Description</th>
                            <th className="p-3 text-center w-24 whitespace-nowrap">Qty</th>
                            <th className="p-3 text-right whitespace-nowrap">Price</th>
                            <th className="p-3 text-right whitespace-nowrap">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-200 font-bold">
                          {lineItems.map(item => (
                            <tr key={item.product_id}>
                              <td className="p-3 font-black whitespace-nowrap">{item.name}</td>
                              <td className="p-3 text-center whitespace-nowrap">
                               <input type="number" inputMode="decimal" step="any" min="0.01" value={item.quantity} onChange={e => handleUpdateQuantity(item.product_id, e.target.value)} onFocus={(e) => e.target.select()} onBlur={() => handleQuantityBlur(item.product_id)} className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center font-mono text-sm font-black text-white outline-none" />
                              </td>
                              <td className="p-3 font-mono text-right text-slate-400 whitespace-nowrap">{formatCurrency(item.selling_price)}</td>
                              <td className="p-3 font-mono text-right font-black text-indigo-400 whitespace-nowrap">{formatCurrency(item.selling_price * item.quantity)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table></div>
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full lg:w-96 text-left font-bold">
                <div className="bg-slate-800/90 border border-slate-700/60 p-6 rounded-2xl shadow-2xl relative lg:sticky lg:top-28 space-y-5">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 border-b border-slate-700/50 pb-2">3. Summary &amp; Payment</h4>
                  
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-700/60 space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Previous Due Balance</span>
                    <span className="text-base font-mono font-black text-rose-400 block">
                      {APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} {Number(previousBalance || 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="space-y-2.5 text-sm pb-3 border-b border-slate-700/40">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal:</span>
                      <span className="font-mono text-slate-200">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="space-y-1.5 pt-1.5">
                      <label className="block text-xs font-bold text-slate-400">Discount Amount ({APP_CONFIG.defaultCurrency})</label>
                      <input type="number" inputMode="decimal" value={discount} onChange={e => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-right text-sm font-bold" placeholder="0" />
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm font-bold text-slate-300">Grand Total:</span>
                    <span className="text-2xl font-black text-white font-mono">{formatCurrency(grandTotal)}</span>
                  </div>

                  <div className="space-y-1.5 border-t border-slate-700/40 pt-4">
                    <label className="block text-xs font-bold uppercase text-slate-400">Cash Received / نقد رقم آئی *</label>
                    <input type="number" inputMode="decimal" min="0" required value={cashReceived} onChange={e => setCashReceived(Math.max(0, parseFloat(e.target.value) || 0))} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-lg font-black text-right text-emerald-400 focus:outline-none" placeholder="0" />
                  </div>

                  {(grandTotal - cashReceived > 0) && (
                    <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl space-y-2.5">
                      <div className="flex justify-between text-xs font-bold font-mono text-rose-400">
                        <span>Net Balance Due:</span>
                        <span>{formatCurrency(grandTotal - cashReceived)}</span>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Waade Ki Nayi Tarikh *</label>
                        <input type="date" required value={freshDueDate} onChange={e => setFreshDueDate(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none" />
                      </div>
                    </div>
                  )}

                  <div className="pt-2 text-[11px] text-slate-400 font-bold leading-relaxed border-t border-slate-700/40">
                    * Total new ledger balance: <span className="font-mono font-black text-white text-xs">{APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} {(previousBalance + Math.max(0, grandTotal - cashReceived)).toLocaleString()}</span> will be.
                  </div>

                  <button 
                    type="submit" 
                    disabled={lineItems.length === 0} 
                    className="w-full mt-4 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs tracking-wider uppercase shadow-lg shadow-indigo-500/20 transition-all cursor-pointer text-center block"
                  >
                    🚀 Generate Sales Invoice / بل محفوظ کریں
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔒 DUKANDAR FRIENDLY URDU PROMPT MODAL OVERLAY */}
      {showUrduSessionPrompt && selectedActiveEntity && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-indigo-500/40 shadow-2xl rounded-3xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto p-6 text-right" dir="rtl">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
              <span className="text-2xl">🔒</span>
              <h3 className="text-xl font-black text-white tracking-tight">کھاتہ سیشن کنٹرول (Ledger Session Management)</h3>
            </div>
            
            <p className="text-sm font-bold text-slate-200 leading-loose">
              گاہک <span className="text-indigo-400 font-black font-sans text-base">"{selectedActiveEntity.full_name || selectedActiveEntity.name}"</span> کا کھاتہ پہلے سے موجود ہے۔ بل محفوظ کرنے سے پہلے سیشن کا انتخاب کریں:
            </p>

            <div className="mt-5 space-y-3">
              <label className={`flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${sessionChoice === 'current' ? 'bg-indigo-600/10 border-indigo-500 text-white' : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'}`}>
                <input type="radio" name="sessionRadio" checked={sessionChoice === 'current'} onChange={() => setSessionChoice('current')} className="mt-1 accent-indigo-500" />
                <div className="text-right">
                  <p className="font-black text-sm text-slate-100">اسی کھاتے میں شامل کریں (Continue Current Ledger)</p>
                  <p className="text-[11px] font-bold text-slate-400 mt-0.5">نیا ادھار گاہک کے اسی پرانے چلتے ہوئے بیلنس میں جمع ہو جائے گا۔</p>
                </div>
              </label>

              <label className={`flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${sessionChoice === 'new' ? 'bg-amber-600/10 border-amber-500 text-white' : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'}`}>
                <input type="radio" name="sessionRadio" checked={sessionChoice === 'new'} onChange={() => setSessionChoice('new')} className="mt-1 accent-amber-500" />
                <div className="text-right">
                  <p className="font-black text-sm text-slate-100">پرانا بند کر کے نیا سیشن شروع کریں (Close &amp; Open New Session)</p>
                  <p className="text-[11px] font-bold text-slate-400 mt-0.5">پرانا کھاتہ اسی جگہ فریز ہو جائے گا اور یہ بل بالکل <span className="text-amber-400 font-black">Rs. 0</span> بیلنس کے نئے سیشن میں درج ہوگا۔</p>
                </div>
              </label>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col-reverse sm:flex-row-reverse gap-3">
              <button type="button" onClick={executeCoreInvoiceGeneration} className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md cursor-pointer text-center">
                ✓ سیشن لاگو کریں اور بل بنائیں
              </button>
              <button type="button" onClick={() => { setShowUrduSessionPrompt(false); setSelectedActiveEntity(null); }} className="py-3 px-5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer">
                کینسل کریں
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL OVERLAY */}
      {showEditModal && editTargetInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto font-bold">
            <div className="p-5 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/50">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><DollarSign className="w-5 h-5 text-indigo-400" /> Adjust Installments</h2>
              <button type="button" onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white transition-colors p-2 rounded-full cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleProcessInstallment} className="p-6 space-y-5 text-left">
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 text-center">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Current Balance Due</p>
                <p className="text-3xl font-black font-mono text-rose-400">{formatCurrency(editTargetInvoice.balance_due || 0)}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Receive Amount ({APP_CONFIG.defaultCurrency}) *</label>
                <input type="number" inputMode="decimal" min="1" max={editTargetInvoice.balance_due || 0} required value={receiveAmount} onChange={e => setReceiveAmount(e.target.value)} className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-lg font-bold text-right text-emerald-400 focus:outline-none" placeholder="0.00" />
              </div>
              {((parseFloat(editTargetInvoice.balance_due || 0) - parseFloat(receiveAmount || 0)) > 0) && (
                <div className="pt-2">
                  <label className="block text-sm font-semibold text-slate-300 mb-2">New Reminder Due Date *</label>
                  <input type="date" required value={newDueDate} onChange={e => setNewDueDate(e.target.value)} className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono focus:outline-none" />
                </div>
              )}
              <div className="pt-4 border-t border-slate-700/50 flex gap-3">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-3 px-4 bg-slate-700 text-white rounded-xl font-bold cursor-pointer">Cancel</button>
                <button type="submit" className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold cursor-pointer">Process Installment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PARTIAL SALES RETURN DIALOG FORM POP-UP */}
      {showPartialReturnModal && returnTargetInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in zoom-in-95 duration-150">
          <div className="bg-slate-800 border border-slate-700 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-slate-700/50 bg-slate-900/40 flex justify-between items-center text-left">
              <div>
                <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-1.5">📦 Partial Maal Wapsi Form</h2>
                <p className="text-mono font-semibold text-[10px] text-slate-400 mt-0.5">Invoice: {returnTargetInvoice.invoice_number} • Customer: {returnTargetInvoice.customer_name}</p>
              </div>
              <button type="button" onClick={() => { setShowPartialReturnModal(false); setReturnTargetInvoice(null); }} className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-700">✕</button>
            </div>

            <form onSubmit={handleSavePartialReturn} className="p-6 overflow-y-auto space-y-4 text-xs font-bold text-left flex-1">
              <p className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl">
                💡 Note: Enter only the quantity the customer is returning. The sale rate is automatically fetched from the old invoice.
              </p>

              <div className="space-y-3">
                {returnTargetInvoice.items && returnTargetInvoice.items.map((item) => (
                  <div key={item.product_id} className="p-3.5 bg-slate-900/40 border border-slate-700/60 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-semibold text-xs">
                    <div className="flex-1">
                      <p className="font-black text-slate-100 text-sm">{item.name}</p>
                      <div className="flex gap-4 mt-1 text-[10px] text-slate-400 font-mono font-bold">
                        <span>Sold Qty: <span className="text-white">{item.quantity}</span></span>
                        <span>Sale Rate: <span className="text-indigo-400">{formatCurrency(item.selling_price)}</span></span>
                      </div>
                    </div>
                    
                    <div className="w-full sm:w-28">
                      <label className="block text-[10px] text-slate-400 uppercase mb-1 font-bold">Return Qty</label>
                      <input 
                        type="number" inputMode="decimal" 
                        step="any"
                        min="0"
                        max={item.quantity}
                        placeholder="0"
                        value={returnQuantities[item.product_id] || ''}
                        onChange={e => setReturnQuantities({
                          ...returnQuantities,
                          [item.product_id]: e.target.value
                        })}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-center text-white font-mono font-black outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                ))} 
              </div>

              <div className="pt-4 border-t border-slate-700/50 flex gap-3 bg-slate-800">
                <button type="button" onClick={() => { setShowPartialReturnModal(false); setReturnTargetInvoice(null); }} className="flex-1 py-2.5 px-4 bg-slate-700 text-white rounded-xl cursor-pointer">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md cursor-pointer">💾 Save Maal Wapsi</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
