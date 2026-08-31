import { useState, useEffect, useMemo } from 'react';
import { useRole } from '../hooks/useRole';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Plus, Package, Edit, Trash2, Search, Filter, AlertTriangle, TrendingUp, Banknote, Layers, UserPlus, Phone, MapPin, Calendar, CheckCircle, X } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { formatCurrency, APP_CONFIG } from '../config/appConfig';

export default function Inventory() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, activeShopId } = useRole();
  
  const [products, setProducts] = useState([]);
  const [customUnits, setCustomUnits] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // 💵 SINGLE PRODUCT MODAL FINANCIAL LEDGER STATES
  const [productCashPaid, setProductCashPaid] = useState(0);
  const [productDueDate, setProductDueDate] = useState('');

  // Batch Intake Wizard States
  const [showIntakeWizard, setShowIntakeWizard] = useState(false);
  const [intakeSupplierId, setIntakeSupplierId] = useState('');
  const [intakeSearchTerm, setIntakeSearchTerm] = useState('');
  const [intakeLineItems, setIntakeLineItems] = useState([]); 
  const [intakeCash, setIntakeCash] = useState(0);
  const [intakeDueDate, setIntakeDueDate] = useState('');

  // Modals Overlay Toggle States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);

  // Core Product Object Structure State
  const [newProduct, setNewProduct] = useState({
    name: '', sku: '', category: '', unit: 'Piece',
    purchase_price: '', selling_price: '', current_stock: '',
    incoming_stock: '', low_stock_threshold: '5', supplier_id: '', image_url: ''
  });

  // Supplier Quick Create States inside Add Modal
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState(null);
  const [supplierForm, setSupplierForm] = useState({
    supplier_name: '', phone: '', address: '',
    payment_made: '0', payment_due: '0', due_date: ''
  });

  
  // Core Data Fetcher from Supabase Live Registry
  const fetchData = async () => {
    if (!activeShopId) return;
    try {
      setLoading(true);
      const { data: pData, error: pError } = await supabase
        .from('products').select('*').eq('shop_id', activeShopId)
        .neq('status', 'archived')
        .order('created_at', { ascending: false });
      if (pError) throw pError;
      setProducts(pData || []);

      const { data: cuData } = await supabase.from('custom_units').select('*').eq('shop_id', activeShopId);
      setCustomUnits(cuData || []);

     // 🔒 STUCTURAL BARRIER PATCH: Dropdowns se closed aur archived suppliers gayab karne ke liye strict filtering
      const { data: sData } = await supabase
        .from('suppliers')
        .select('*')
        .eq('shop_id', activeShopId)
        .neq('status', 'archived')
        .neq('khata_status', 'closed')
        .order('created_at', { ascending: false });
      if (sData) setSuppliers(sData || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load inventory data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeShopId]);

  useEffect(() => {
    if (location && location.state) {
      if (location.state.openAddModal === true || location.state.autoOpenIntake === true) {
        setShowIntakeWizard(true);
      }
    }
  }, [location]);

  const stats = useMemo(() => {
    let totalProducts = products.length;
    let purchaseValue = 0; let sellingValue = 0; let lowStockCount = 0;
    products.forEach(p => {
      const stock = p.current_stock || 0;
      purchaseValue += stock * (p.purchase_price || 0);
      sellingValue += stock * (p.selling_price || 0);
      if (stock <= (p.low_stock_threshold || 0)) lowStockCount++;
    });
    return { totalProducts, purchaseValue, sellingValue, potentialProfit: sellingValue - purchaseValue, lowStockCount };
  }, [products]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(cats);
  }, [products]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = (p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // 🔄 GOLDEN AUTO-POPULATE ENGINE
  const handleProductNameChange = (nameVal) => {
    setNewProduct(prev => ({ ...prev, name: nameVal }));
    const match = products.find(p => p.name.toLowerCase() === nameVal.toLowerCase().trim());
    
    if (match) {
      setEditingProductId(match.id);
      setNewProduct({
        name: match.name,
        sku: match.sku || '',
        category: match.category || '',
        unit: match.unit || 'Piece',
        purchase_price: match.purchase_price || '',
        selling_price: match.selling_price || '',
        current_stock: match.current_stock !== undefined ? match.current_stock : 0, 
        incoming_stock: '',
        low_stock_threshold: match.low_stock_threshold || '5',
        supplier_id: match.supplier_id || '',
        image_url: match.image_url || ''
      });
    } else {
      setEditingProductId(null);
    }
  };

  // 🔄 Custom Stock Units manage karne ka logic
  const handleIntakeUnitChange = async (itemId, e) => {
    const val = e.target.value;
    if (val === 'ADD_NEW_UNIT') {
      const newUnit = window.prompt("Enter new unit name (e.g. Dozen, Pack)");
      if (newUnit && newUnit.trim()) {
        try {
          const { data, error } = await supabase.from('custom_units').insert([{ shop_id: activeShopId, unit_name: newUnit.trim() }]).select().single();
          if (error) throw error;
          setCustomUnits([...customUnits, data]);
          updateIntakeLineItem(itemId, 'unit', data.unit_name);
        } catch (err) {
          alert('Failed to save unit to database. ');
        }
      }
    } else {
      updateIntakeLineItem(itemId, 'unit', val);
    }
  };

  const handleUnitChange = async (e) => {
    const val = e.target.value;
    if (val === 'ADD_NEW_UNIT') {
      const newUnit = window.prompt("Enter new unit name (e.g. Dozen, Pack)");
      if (newUnit && newUnit.trim()) {
        try {
          const { data, error } = await supabase
            .from('custom_units')
            .insert([{ shop_id: activeShopId, unit_name: newUnit.trim() }])
            .select()
            .single();
            
          if (error) throw error;
          setCustomUnits([...customUnits, data]);
          setNewProduct({ ...newProduct, unit: data.unit_name });
        } catch (err) {
          alert('Failed to save unit to database. ');
          setNewProduct({ ...newProduct, unit: 'Piece' });
        }
      } else {
        setNewProduct({ ...newProduct, unit: 'Piece' });
      }
    } else {
      setNewProduct({ ...newProduct, unit: val });
    }
  };

  // 💾 Single Product save karne ka core function
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (productDueDate && productDueDate.trim() !== '') {
      const selectedDate = new Date(productDueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        alert("🚨 ERROR: A past date was selected by mistake!");
        return;
      }
    }
    const { name, purchase_price: price, supplier_id } = newProduct; 

    if (!name || !name.trim()) {
      alert("Product Title is required!");
      return;
    }
    if (price === '' || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      alert("Please enter a valid numeric Purchase Price!");
      return;
    }
    if (newProduct.selling_price === '' || isNaN(parseFloat(newProduct.selling_price)) || parseFloat(newProduct.selling_price) < 0) {
      alert("Please enter a valid numeric Selling Price!");
      return;
    }

    const threshold = parseFloat(newProduct.low_stock_threshold);
    if (isNaN(threshold) || threshold < 0) {
      alert("Please enter a valid numeric value for Low Stock Threshold!");
      return;
    }

    try {
      setLoading(true);
      
      let existingStock = parseFloat(newProduct.current_stock) || 0;
      if (editingProductId) {
        const { data: liveProduct } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', editingProductId)
          .single();
        if (liveProduct) {
           existingStock = parseFloat(liveProduct.current_stock || 0);
        }
      }
      const incomingStockVal = parseFloat(newProduct.incoming_stock) || 0;
      const finalUpdatedStock = editingProductId ? (existingStock + incomingStockVal) : (parseFloat(newProduct.current_stock) || 0);

      // 1. FIX NEGATIVE STOCK BYPASS
      if (finalUpdatedStock < 0) {
        alert("Stock cannot be negative!");
        setLoading(false);
        return;
      }

      const payload = {
        shop_id: activeShopId,
        name: String(name || '').trim(),
        sku: (newProduct.sku && String(newProduct.sku).trim() !== '') ? String(newProduct.sku).trim() : 'AUTO-' + Date.now(),
        category: (newProduct.category && String(newProduct.category).trim() !== '') ? String(newProduct.category).trim() : 'Uncategorized',
        unit: String(newProduct.unit || 'Piece'),
        purchase_price: parseFloat(price) || 0,
        selling_price: parseFloat(newProduct.selling_price) || 0,
        current_stock: finalUpdatedStock,
        low_stock_threshold: threshold,
        supplier_id: (supplier_id && String(supplier_id).trim() !== '' && String(supplier_id) !== 'null') ? parseInt(supplier_id) : null
      };

      if (editingProductId) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingProductId)
          .eq('shop_id', activeShopId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert([payload]);
        if (error) throw error;
      }

      const effectiveBillingQuantity = editingProductId ? incomingStockVal : (parseFloat(newProduct.current_stock) || 0);
      const calculatedTotalBatchCost = (parseFloat(price) || 0) * effectiveBillingQuantity;
      
      if (supplier_id && String(supplier_id) !== 'null' && calculatedTotalBatchCost > 0) {
        const targetSupId = parseInt(supplier_id);
        const cashPaidVal = parseFloat(productCashPaid) || 0;
        const netNewUdharLiability = Math.max(0, calculatedTotalBatchCost - cashPaidVal);

        let supplierLatestRunningBalance = 0;

        const { data: latestTxLogs } = await supabase
          .from('transactions')
          .select('remaining_balance')
          .eq('shop_id', activeShopId)
          .eq('party_id', targetSupId)
          .eq('party_type', 'supplier')
          .order('id', { ascending: false })
          .limit(1);

        if (latestTxLogs && latestTxLogs.length > 0) {
          supplierLatestRunningBalance = parseFloat(latestTxLogs[0].remaining_balance || 0);
        } else {
          const { data: coreSupRow } = await supabase
            .from('suppliers')
            .select('payment_due')
            .eq('id', targetSupId)
            .single();
          supplierLatestRunningBalance = parseFloat(coreSupRow?.payment_due || 0);
        }

        const trueCumulativeSupplierBalance = supplierLatestRunningBalance + netNewUdharLiability;
        const cleanDate = netNewUdharLiability > 0 && productDueDate ? productDueDate : null;

        const supplierUpdatePayload = { payment_due: trueCumulativeSupplierBalance };
        if (cleanDate) { supplierUpdatePayload.due_date = cleanDate; }

        const { error: supErr } = await supabase.from('suppliers').update(supplierUpdatePayload).eq('id', targetSupId);
        if (supErr) throw supErr;

        const { error: txErr } = await supabase.from('transactions').insert([{
          shop_id: activeShopId,
          party_id: targetSupId,
          party_type: 'supplier',
          transaction_type: 'purchase',
          amount: parseFloat(netNewUdharLiability),
          remaining_balance: parseFloat(trueCumulativeSupplierBalance),
          due_date: cleanDate,
          notes: `${String(name).trim()} (${effectiveBillingQuantity} Qty Added)`,
          total_bill: parseFloat(calculatedTotalBatchCost),
          cash_paid_received: parseFloat(cashPaidVal)
        }]);

        if (txErr) throw txErr;

        await supabase.from('suppliers').update({ status: 'active' }).eq('id', targetSupId);
        
        }

      
      setShowAddModal(false);
      setEditingProductId(null);
      setProductCashPaid(0);
      setProductDueDate('');
      
      alert("Product saved smoothly!");
      
      // 3. OPTIMIZE NETWORK OVERHEAD (ATOMIC STATE MUTATION)
      if (editingProductId) {
        const updatedProduct = { id: editingProductId, ...payload };
        setProducts(prev => prev.map(p => p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p));
      } else {
        await fetchData();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to process stock entry.");
    } finally {
      setLoading(false);
    }
  };

  // 🔄 Product Form ke andar Supplier quick setup
  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    if (!supplierForm.supplier_name.trim()) {
      alert("Supplier Name is required!");
      return;
    }

    try {
      const payload = {
        shop_id: activeShopId,
        supplier_name: supplierForm.supplier_name.trim(),
        phone: supplierForm.phone ? supplierForm.phone.trim() : null,
        address: supplierForm.address ? supplierForm.address.trim() : null,
        payment_made: 0,
        payment_due: 0, 
        due_date: null
      };

      let responseError = null;
      let savedData = null;

      if (editingSupplierId) {
        const { data, error } = await supabase
          .from('suppliers')
          .update(payload)
          .eq('id', editingSupplierId)
          .eq('shop_id', activeShopId)
          .select();
        responseError = error;
        if (data && data.length > 0) savedData = data[0];
      } else {
        const { data, error } = await supabase
          .from('suppliers')
          .insert([payload])
          .select();
        responseError = error;
        if (data && data.length > 0) savedData = data[0];
      }

      if (responseError) throw responseError;

      if (savedData) {
        setNewProduct(prev => ({ ...prev, supplier_id: String(savedData.id) }));
      }

      await fetchData();
      setShowSupplierModal(false);
      setEditingSupplierId(null);
      setSupplierForm({ supplier_name: '', phone: '', address: '', payment_made: '0', payment_due: '0', due_date: '' });
      alert("Supplier registered successfully!");
    } catch (err) {
      console.error(err);
      alert("Supplier Save Error.");
    }
  };

  const handleEditSupplierClick = (supplierId) => {
    const match = suppliers.find(s => String(s.id) === String(supplierId));
    if (!match) return;
    setEditingSupplierId(match.id);
    setSupplierForm({
      supplier_name: match.supplier_name || match.name || '',
      phone: match.phone || '',
      address: match.address || '',
      payment_made: String(match.payment_made || 0),
      payment_due: String(match.payment_due || 0),
      due_date: match.due_date || ''
    });
    setShowSupplierModal(true);
  };

  const handleAddExistingProduct = (prod) => {
    const existing = intakeLineItems.find(item => item.product_id === prod.id || item.id === prod.id);
    
    if (prod.supplier_id && !intakeSupplierId) {
      setIntakeSupplierId(String(prod.supplier_id));
    }

    if (existing) {
      setIntakeLineItems(intakeLineItems.map(item => 
        (item.id === prod.id || item.product_id === prod.id) 
          ? { ...item, quantity: parseInt(item.quantity || 1) + 1 } 
          : item
      ));
    } else {
      setIntakeLineItems([...intakeLineItems, {
        id: prod.id,
        product_id: prod.id,
        name: prod.name,
        isNew: false,
        quantity: 1,
        cost: prod.purchase_price || 0, 
        sellingPrice: prod.selling_price || 0, 
        warehouse_stock: prod.current_stock || 0,
        low_stock_threshold: prod.low_stock_threshold || '5'
      }]);
    }
    setIntakeSearchTerm('');
  };

  const handleAddNewCustomProduct = () => {
    if (!intakeSearchTerm.trim()) return;
    setIntakeLineItems([...intakeLineItems, {
      id: 'NEW-' + Date.now(),
      name: intakeSearchTerm.trim(),
      isNew: true,
      quantity: 1,
      cost: 0,
      sellingPrice: 0,
      low_stock_threshold: '5'
    }]);
    setIntakeSearchTerm('');
  };

  const updateIntakeLineItem = (id, field, value) => {
    setIntakeLineItems(intakeLineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const removeIntakeLineItem = (id) => {
    setIntakeLineItems(intakeLineItems.filter(item => item.id !== id));
  };

  const intakeGrandTotal = useMemo(() => {
    return intakeLineItems.reduce((acc, item) => acc + (parseFloat(item.cost || 0) * parseFloat(item.quantity || 1)), 0);
  }, [intakeLineItems]);

  const handleSaveIntake = async (e) => {
    e.preventDefault();
    if (intakeDueDate && intakeDueDate.trim() !== '') {
      const selectedDate = new Date(intakeDueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        alert("🚨 ERROR: A past date was selected by mistake!");
        return;
      }
    }

    if (!intakeSupplierId || intakeLineItems.length === 0) {
      alert("Please select a supplier and add at least one product.");
      return;
    }

    try {
      setLoading(true);
      let totalBill = 0;

      for (const item of intakeLineItems) {
        totalBill += (item.quantity * item.cost);
        
        if (!item.isNew) {
          const { data: pData } = await supabase.from('products').select('current_stock').eq('id', item.id).single();
          const newStock = (pData?.current_stock || 0) + parseFloat(item.quantity);
          
          await supabase.from('products').update({ 
            current_stock: newStock,
            purchase_price: parseFloat(item.cost) || 0,
            selling_price: parseFloat(item.sellingPrice) || 0,
            unit: item.unit || 'Piece',
            low_stock_threshold: isNaN(parseFloat(item.low_stock_threshold)) || parseFloat(item.low_stock_threshold) < 0 ? 5 : parseFloat(item.low_stock_threshold)
          }).eq('id', item.id).eq('shop_id', activeShopId);
        } else {
          await supabase.from('products').insert([{
            shop_id: activeShopId,
            supplier_id: parseInt(intakeSupplierId),
            name: String(item.name).trim(),
            purchase_price: parseFloat(item.cost),
            selling_price: parseFloat(item.sellingPrice) || (parseFloat(item.cost) * 1.2),
            current_stock: parseFloat(item.quantity),
            sku: 'AUTO-' + Date.now() + Math.floor(Math.random() * 100),
            category: 'Uncategorized',
            unit: item.unit || 'Piece',
            low_stock_threshold: isNaN(parseFloat(item.low_stock_threshold)) || parseFloat(item.low_stock_threshold) < 0 ? 5 : parseFloat(item.low_stock_threshold)
          }]);
        }
      }

      const cashVal = parseFloat(intakeCash) || 0;
      const balance = Math.max(0, totalBill - cashVal);
      const targetSupId = parseInt(intakeSupplierId);

      let runningLatestBalance = 0;
      const { data: latestDbTx, error: txFetchErr } = await supabase
        .from('transactions')
        .select('remaining_balance')
        .eq('shop_id', activeShopId)
        .eq('party_id', targetSupId)
        .eq('party_type', 'supplier')
        .order('id', { ascending: false })
        .limit(1);

      if (!txFetchErr && latestDbTx && latestDbTx.length > 0) {
        runningLatestBalance = parseFloat(latestDbTx[0].remaining_balance || 0);
      } else {
        const { data: fallbackSup } = await supabase.from('suppliers').select('payment_due').eq('id', targetSupId).single();
        runningLatestBalance = parseFloat(fallbackSup?.payment_due || 0);
      }

     const trueCumulativeBalance = runningLatestBalance + balance;
      const finalIntakeDueDate = balance > 0 && intakeDueDate && intakeDueDate.trim() !== '' ? intakeDueDate : null;

      const supplierUpdatePayload = { payment_due: trueCumulativeBalance };
      if (finalIntakeDueDate) { supplierUpdatePayload.due_date = finalIntakeDueDate; }

      const { error: supErr } = await supabase.from('suppliers').update(supplierUpdatePayload).eq('id', targetSupId);
      if (supErr) throw supErr;

      const { error: txErr } = await supabase.from('transactions').insert([{
        shop_id: activeShopId,
        party_id: targetSupId,
        party_type: 'supplier',
        transaction_type: 'purchase',
        amount: parseFloat(balance),
        remaining_balance: parseFloat(trueCumulativeBalance),
        due_date: finalIntakeDueDate,
        notes: `${intakeLineItems.map(i => `${i.name} (${i.quantity} Qty)`).join(', ')}`,
        total_bill: parseFloat(totalBill),
        cash_paid_received: parseFloat(cashVal)
      }]);

      if (txErr) throw txErr;  

      // 🌟 Restores archived supplier profile visibility immediately
      await supabase.from('suppliers').update({ status: 'active' }).eq('id', targetSupId);
      
      setShowIntakeWizard(false);
      setIntakeSupplierId('');
      setIntakeLineItems([]);
      setIntakeSearchTerm('');
      setIntakeCash(0);
      setIntakeDueDate('');
      
      alert("Stock Intake Batch Processed Successfully!");
      await fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to save intake batch.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (p) => {
    setEditingProductId(p.id);
    setNewProduct({
      name: p.name,
      sku: p.sku || '',
      category: p.category || '',
      unit: p.unit || 'Piece',
      purchase_price: p.purchase_price || '',
      selling_price: p.selling_price || '',
      current_stock: p.current_stock,
      incoming_stock: '',
      low_stock_threshold: p.low_stock_threshold || '5',
      supplier_id: p.supplier_id || '',
      image_url: p.image_url || ''
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id, name) => {
    const confirmDelete = window.confirm(`Are you sure you want to archive (soft-delete) ${name}?`);
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from('products')
        .update({ status: 'archived' })
        .eq('id', id)
        .eq('shop_id', activeShopId);
      if (error) throw error;
      setProducts(products.filter(p => p.id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to archive item.");
    }
  };

  const pp = parseFloat(newProduct.purchase_price) || 0;
  const sp = parseFloat(newProduct.selling_price) || 0;
  const liveProfit = sp - pp;
  const liveMargin = sp > 0 ? ((liveProfit / sp) * 100).toFixed(1) : 0;

  if (!activeShopId) {
    return (
      <div className="p-8 text-center text-white animate-in fade-in">
        <h2 className="text-2xl font-bold mb-4">No Shop Selected</h2>
        <p className="text-slate-400">Please select a shop workspace to view the ERP inventory suite.</p>
      </div>
    );
  }

  if (loading && products.length === 0) return <LoadingSpinner />;

  return (
    <div className="animate-in fade-in duration-500 space-y-6 text-left">
      
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
            📦
          </div>
          <div>
            <h2 className="text-[11px] font-black tracking-widest text-indigo-300 uppercase font-mono bg-slate-950/40 px-2 py-0.5 rounded w-max border border-indigo-500/20 backdrop-blur-sm">Warehouse Registry</h2>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase mt-1.5" style={{ textShadow: '0 2px 20px rgba(219,39,119,0.6), 0 4px 10px rgba(99,102,241,0.6)' }}>
              Inventory &amp; Stock
            </h1>
            <p className="text-xs text-slate-200 mt-1.5 font-medium tracking-wide flex items-center gap-2 drop-shadow-md">
              <span className="font-bold">Invovo ERP Suite</span> • <span className="text-slate-300">Catalog Registry</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap no-print z-10 self-end md:self-center w-full sm:w-auto">
          <button 
            type="button"
            onClick={() => setShowIntakeWizard(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs shadow-md transition-all duration-300 transform active:scale-95 border border-purple-500/40 cursor-pointer"
          >
            📦 Log Supplier Purchase
          </button>
          <button 
            type="button"
            onClick={() => {
              setEditingProductId(null);
              setNewProduct({ name: '', sku: '', category: '', unit: 'Piece', purchase_price: '', selling_price: '', current_stock: '', incoming_stock: '', low_stock_threshold: '5', supplier_id: '', image_url: '' });
              setShowAddModal(true);
            }}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-md transition-all duration-300 transform active:scale-95 border border-indigo-500/40 cursor-pointer flex items-center justify-center gap-1"
          >
            ➕ Add Single Product
          </button>
        </div>
      </div>

      {error && <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-xs">{error}</div>}

      {/* 📊 2. LOGISTICS STATS CARDS STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 no-print font-bold text-xs">
        <div className="bg-white dark:bg-[#121b36] border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm transition-colors duration-300 relative overflow-hidden group">
          <Layers className="absolute -right-4 -top-4 w-16 h-16 text-slate-700/10 group-hover:text-indigo-500/10 transition-colors" />
          <h3 className="font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Products</h3>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-3 font-mono">{stats.totalProducts}</p>
        </div>
        <div className="bg-white dark:bg-[#121b36] border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm transition-colors duration-300 relative overflow-hidden group">
          <Package className="absolute -right-4 -top-4 w-16 h-16 text-slate-700/10 group-hover:text-emerald-500/10 transition-colors" />
          <h3 className="font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Purchase Value</h3>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-3 font-mono">{formatCurrency(stats.purchaseValue)}</p>
        </div>
        <div className="bg-white dark:bg-[#121b36] border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm transition-colors duration-300 relative overflow-hidden group">
          <Banknote className="absolute -right-4 -top-4 w-16 h-16 text-slate-700/10 group-hover:text-blue-500/10 transition-colors" />
          <h3 className="font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Selling Value</h3>
          <p className="text-lg font-black text-blue-600 dark:text-blue-400 mt-3 font-mono">{formatCurrency(stats.sellingValue)}</p>
        </div>
        <div className="bg-white dark:bg-[#121b36] border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm transition-colors duration-300 relative overflow-hidden group">
          <TrendingUp className="absolute -right-4 -top-4 w-16 h-16 text-slate-700/10 group-hover:text-purple-500/10 transition-colors" />
          <h3 className="font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Potential Profit</h3>
          <p className="text-lg font-black text-purple-600 dark:text-purple-400 mt-3 font-mono">{formatCurrency(stats.potentialProfit)}</p>
        </div>
        <div className="bg-white dark:bg-[#121b36] border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm transition-colors duration-300 relative overflow-hidden group">
          <AlertTriangle className="absolute -right-4 -top-4 w-16 h-16 text-slate-700/10 group-hover:text-rose-500/10 transition-colors" />
          <h3 className="font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Low Stock</h3>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-3 font-mono">{stats.lowStockCount}</p>
        </div>
      </div>

      {/* 🔍 3. FILTER & SEARCH CONTROL MATRIX */}
      <div className="flex flex-col sm:flex-row gap-4 no-print">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search warehouse inventory by name or SKU digits..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm font-bold focus:outline-none" 
          />
        </div>
        <div className="relative w-full sm:w-64">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <select 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)} 
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm font-bold focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* 📋 4. DATA SHEET MAIN TABLE GRID */}
      {products.length === 0 && !loading ? (
        <EmptyState icon={Package} title="No Products Configured" description="Start filling up your digital warehouse rows." buttonText="Add Product" onAction={() => setShowAddModal(true)} />
      ) : (
        <div className="bg-white dark:bg-[#121b36] border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <div className="overflow-x-auto w-full"><table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-[#0b1329] text-slate-600 dark:text-slate-300 font-black border-b border-slate-200 dark:border-slate-800 text-sm uppercase tracking-wider">
                  <th className="p-4 text-left whitespace-nowrap">Product</th>
                  <th className="p-4 text-left whitespace-nowrap">Category</th>
                  {role === 'shop_owner' && <th className="p-4 text-left whitespace-nowrap">Purchase Rate</th>}
                  <th className="p-4 text-left whitespace-nowrap">Selling Rate</th>
                  {role === 'shop_owner' && <th className="p-4 text-left whitespace-nowrap">Profit</th>}
                  {role === 'shop_owner' && <th className="p-4 text-left whitespace-nowrap">Margin</th>}
                  <th className="p-4 text-left whitespace-nowrap">Stock Balance</th>
                  <th className="p-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50 text-slate-800 dark:text-slate-200 font-bold">
                {filteredProducts.map(p => {
                  const profit = (p.selling_price || 0) - (p.purchase_price || 0);
                  const margin = p.selling_price > 0 ? ((profit / p.selling_price) * 100).toFixed(1) : 0;
                  // 2. PARSEFLOAT TYPE COERCION FOR ALERTS
                  const isLowStock = parseFloat(p.current_stock || 0) <= parseFloat(p.low_stock_threshold || 0);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-[#182346] transition-colors duration-200">
                      <td className="p-4 text-left whitespace-nowrap">
                        <p className="font-black text-sm text-slate-900 dark:text-slate-100">{p.name}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 font-bold">SKU: {p.sku || '-'}</p>
                      </td>
                      <td className="p-4 text-slate-500 dark:text-slate-400 text-left font-black whitespace-nowrap">{p.category || '-'}</td>
                      {role === 'shop_owner' && <td className="p-4 font-mono text-slate-500 dark:text-slate-400 text-left whitespace-nowrap">{formatCurrency(p.purchase_price)}</td>}
                      <td className="p-4 font-mono font-black text-blue-600 dark:text-blue-400 text-left whitespace-nowrap">{formatCurrency(p.selling_price)}</td>
                      {role === 'shop_owner' && <td className="p-4 font-mono text-emerald-600 dark:text-emerald-400 text-left whitespace-nowrap">{formatCurrency(profit)}</td>}
                      {role === 'shop_owner' && <td className="p-4 font-mono text-emerald-600 dark:text-emerald-400 text-left whitespace-nowrap">{margin}%</td>}
                      <td className="p-4 text-left whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-black font-mono border ${isLowStock ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 animate-pulse' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'}`}>
                          {p.current_stock} {p.unit}
                        </span>
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="flex justify-end items-center gap-1.5 min-w-max">
                          <button type="button" onClick={() => handleEdit(p)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"><Edit className="w-4 h-4" /></button>
                          <button type="button" onClick={() => handleDelete(p.id, p.name)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"><Trash2 className="w-4 h-4" /></button>
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

      {/* =========================================================================
          ⚙️ MODAL 1: ADD / EDIT PRODUCT PANEL
          ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 w-full max-w-2xl rounded-3xl shadow-2xl transition-all duration-300 overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/40">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Package className="w-6 h-6 text-indigo-400" />
                {editingProductId ? 'Edit Core Inventory Product' : 'Add New Inventory Product Log'}
              </h2>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-700">✕</button>
            </div>

            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-6 space-y-5 text-left font-bold text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">Product Title</label>
                  <input 
                    type="text" 
                    required 
                    value={newProduct.name} 
                    onChange={e => handleProductNameChange(e.target.value)} 
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-indigo-500" 
                    placeholder="Type title or item model label..." 
                    list="product-autofill-suggestions"
                  />
                  <datalist id="product-autofill-suggestions">
                    {products.map(p => <option key={p.id} value={p.name} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">SKU / Barcode</label>
                  <input type="text" value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono outline-none focus:border-indigo-500" placeholder="Optional SKU number..." />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">Category</label>
                  <input type="text" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none" placeholder="e.g., Electronics, Grocery..." />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">Stock Unit</label>
                  <select value={newProduct.unit} onChange={handleUnitChange} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white cursor-pointer outline-none">
                    <option value="Piece">Piece</option>
                    <option value="KG">KG</option>
                    <option value="Bags">Bags</option>
                    <option value="Cft">Cft</option>
                    <option value="Box/Pack">Box/Pack</option>
                    <option value="Feet">Feet</option>
                    <option value="Meter">Meter</option>
                    <option value="Dozen">Dozen</option>
                    <option value="Litre">Litre</option>
                    <option value="Gram">Gram</option>
                    {customUnits.map(cu => <option key={cu.id} value={cu.unit_name}>{cu.unit_name}</option>)}
                    <option value="ADD_NEW_UNIT" className="text-indigo-400 font-bold">+ Add Custom Unit</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">Khareed Rate / Purchase Price *</label>
                  <input type="number" inputMode="decimal" min="0" step="0.01" required value={newProduct.purchase_price} onChange={e => setNewProduct({...newProduct, purchase_price: e.target.value})} onFocus={(e) => e.target.select()} onBlur={(e) => setNewProduct({...newProduct, purchase_price: e.target.value === '' || isNaN(parseFloat(e.target.value)) ? 0 : parseFloat(e.target.value)})} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm outline-none text-right text-rose-400" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">Sale Rate / Selling Price *</label>
                  <input type="number" inputMode="decimal" min="0" step="0.01" required value={newProduct.selling_price} onChange={e => setNewProduct({...newProduct, selling_price: e.target.value})} onFocus={(e) => e.target.select()} onBlur={(e) => setNewProduct({...newProduct, selling_price: e.target.value === '' || isNaN(parseFloat(e.target.value)) ? 0 : parseFloat(e.target.value)})} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm outline-none text-right text-blue-400" />
                </div>
              </div>

              <div className="bg-indigo-900/10 border border-indigo-500/20 p-4 rounded-xl flex items-center justify-between font-bold text-xs">
                <div className="flex gap-6">
                  <div>
                    <p className="text-indigo-300/70 uppercase text-[10px]">Computed Unit Profit</p>
                    <p className={`text-base font-mono ${liveProfit < 0 ? 'text-red-400' : 'text-indigo-400'}`}>{formatCurrency(liveProfit)}</p>
                  </div>
                  <div>
                    <p className="text-indigo-300/70 uppercase text-[10px]">Margin Percentage</p>
                    <p className="text-base font-mono text-indigo-400">{liveMargin}%</p>
                  </div>
                </div>
                <TrendingUp className="w-6 h-6 text-indigo-500/20" />
              </div>

              {/* 🏠 SMART TRACKER GRID CONTAINER */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                    {editingProductId ? "Current Live Warehouse Stock" : "Initial Stock Quantity"}
                  </label>
                 <input 
                type="number" inputMode="decimal" 
                min="0" 
                value={newProduct.current_stock} 
                onChange={e => setNewProduct({...newProduct, current_stock: e.target.value})} 
                onFocus={(e) => e.target.select()}
                onBlur={(e) => setNewProduct({...newProduct, current_stock: e.target.value === '' || isNaN(parseFloat(e.target.value)) ? 0 : parseFloat(e.target.value)})}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono outline-none" 
                placeholder="0" 
              />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">Low Stock Threshold Limit</label>
                  <input type="number" inputMode="decimal" min="0" value={newProduct.low_stock_threshold} onChange={e => setNewProduct({...newProduct, low_stock_threshold: e.target.value})} onFocus={(e) => e.target.select()} onBlur={(e) => setNewProduct({...newProduct, low_stock_threshold: e.target.value === '' || isNaN(parseFloat(e.target.value)) ? 0 : parseFloat(e.target.value)})} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono outline-none" />
                </div>
              </div>

              {editingProductId && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-bold text-emerald-400 uppercase mb-1.5 border-b border-emerald-500/10 pb-0.5">
                    + Add New Incoming Quantity (Optional)
                  </label>
                  <input 
                    type="number" inputMode="decimal" 
                    min="1" 
                    value={newProduct.incoming_stock || ''} 
                    onChange={e => setNewProduct({...newProduct, incoming_stock: e.target.value})} 
                    onFocus={(e) => e.target.select()}
                    onBlur={(e) => setNewProduct({...newProduct, incoming_stock: e.target.value === '' || isNaN(parseFloat(e.target.value)) ? 0 : parseFloat(e.target.value)})}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-emerald-500 rounded-xl text-emerald-400 font-mono font-black text-sm outline-none focus:ring-1 focus:ring-emerald-400" 
                    placeholder="How many more units purchased? (Leave blank if none)" 
                  />
                </div>
              )}

              <div className="border-t border-slate-700/60 pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">Assigned Merchant Supplier</label>
                  <button type="button" onClick={() => { setEditingSupplierId(null); setSupplierForm({ supplier_name: '', phone: '', address: '', payment_made: '0', payment_due: '0', due_date: '' }); setShowSupplierModal(true); }} className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold transition-colors cursor-pointer">+ Register Supplier Account</button>
                </div>
                <div className="flex gap-2">
                  <select value={newProduct.supplier_id} onChange={e => setNewProduct({...newProduct, supplier_id: e.target.value})} className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white cursor-pointer outline-none">
                    <option value="">No wholesale merchant tied (Default walking supplier)</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.supplier_name || s.name} {s.phone ? `(${s.phone})` : ''}</option>
                    ))}
                  </select>
                  {newProduct.supplier_id && (
                    <button type="button" onClick={() => handleEditSupplierClick(newProduct.supplier_id)} className="px-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-xl text-slate-300 hover:text-white transition-colors">Edit</button>
                  )}
                </div>

                {newProduct.supplier_id && (() => {
                  const targetProfile = suppliers.find(s => String(s.id) === String(newProduct.supplier_id));
                  if (!targetProfile) return null;
                  return (
                    <div className="p-3.5 bg-slate-900/60 border border-slate-700/60 rounded-xl space-y-1.5 font-medium text-xs">
                      <div className="flex justify-between font-bold text-slate-300">
                        <span>Wholesale Account Name:</span>
                        <span>{targetProfile.supplier_name || targetProfile.name}</span>
                      </div>
                      <div className="flex justify-between text-rose-400 font-bold">
                        <span>Total Owed Debt Balance:</span>
                        <span className="font-mono">{formatCurrency(targetProfile.payment_due)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {newProduct.supplier_id && (() => {
                const billingQty = editingProductId ? (parseFloat(newProduct.incoming_stock) || 0) : (parseFloat(newProduct.current_stock) || 0);
                const currentBatchPriceTotal = (parseFloat(newProduct.purchase_price) || 0) * billingQty;
                
                if (currentBatchPriceTotal <= 0) return null;
                const dynamicBatchBalanceDue = Math.max(0, currentBatchPriceTotal - (parseFloat(productCashPaid) || 0));

                return (
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-4 animate-in slide-in-from-top-2 duration-200 text-left">
                    <div className="flex justify-between items-center text-xs text-slate-300 border-b border-slate-800/80 pb-2">
                      <span className="font-bold">Current Batch Cost:</span>
                      <span className="font-mono font-black text-white text-base">{formatCurrency(currentBatchPriceTotal)}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cash Paid</label>
                      <input 
                        type="number" inputMode="decimal" 
                        min="0"
                        max={currentBatchPriceTotal}
                        value={productCashPaid}
                        onChange={e => setProductCashPaid(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
                        onFocus={(e) => e.target.select()}
                        onBlur={(e) => setProductCashPaid(e.target.value === '' || isNaN(parseFloat(e.target.value)) ? 0 : Math.max(0, parseFloat(e.target.value)))}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-right text-emerald-400 text-sm font-bold outline-none focus:border-emerald-500"
                        placeholder="0"
                      />
                    </div>

                    {dynamicBatchBalanceDue > 0 && (
                      <div className="space-y-3 pt-1 border-t border-slate-900/60 animate-in fade-in duration-150">
                        <div className="flex justify-between items-center text-xs font-bold text-rose-400">
                          <span>Remaining Due:</span>
                          <span className="font-mono font-black">{formatCurrency(dynamicBatchBalanceDue)}</span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Payment Due Date</label>
                          <input 
                            type="date"
                            required
                            min={new Date().toISOString().split('T')[0]}
                            value={productDueDate}
                            onChange={e => setProductDueDate(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono cursor-pointer outline-none focus:border-rose-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="pt-4 border-t border-slate-700/50 flex flex-col-reverse sm:flex-row gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 px-4 bg-slate-700 text-white rounded-xl font-bold cursor-pointer">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 px-4 bg-indigo-600 text-white rounded-xl font-bold shadow-md cursor-pointer">💾 Save Product Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          👤 MODAL 2: QUICK SUPPLIER REGISTRY WINDOW OVERLAY 
          ========================================================================= */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto transition-all duration-300 animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-700/50 bg-slate-900/40 flex justify-between items-center">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5"><UserPlus className="w-4 h-4 text-indigo-400" /> Register Wholesale Supplier</h2>
              <button type="button" onClick={() => { setShowSupplierModal(false); setEditingSupplierId(null); }} className="text-slate-400 p-2">✕</button>
            </div>
            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4 text-left text-xs font-bold">
              <div>
                <label className="block text-slate-400 uppercase mb-1">Supplier Merchant Title *</label>
                <input type="text" required value={supplierForm.supplier_name} onChange={e => setSupplierForm({...supplierForm, supplier_name: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-indigo-500" placeholder="e.g., Al-Makkah Traders Lahore" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 uppercase mb-1 flex items-center gap-1"><Phone className="w-3 h-3" /> Contact Mobile</label>
                  <input type="tel" inputMode="numeric" pattern="[0-9]*" value={supplierForm.phone || ''} onChange={e => setSupplierForm({...supplierForm, phone: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none" placeholder="+1 234 567 8900" />
                </div>
                <div>
                  <label className="block text-slate-400 uppercase mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Market Address</label>
                  <input type="text" value={supplierForm.address || ''} onChange={e => setSupplierForm({...supplierForm, address: e.target.value})} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none" placeholder="e.g. Shah Alam Market" />
                </div>
              </div>
              <div className="pt-3 flex flex-col-reverse sm:flex-row gap-2">
                <button type="button" onClick={() => { setShowSupplierModal(false); setEditingSupplierId(null); }} className="flex-1 py-2.5 px-4 bg-slate-700 text-white rounded-xl cursor-pointer">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 px-4 bg-indigo-600 text-white rounded-xl shadow-md cursor-pointer">Save Supplier Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          📦 MODAL 3: SUPPLIER INTAKE BATCH WIZARD INTERFACE FULLSCREEN 
          ========================================================================= */}
      {showIntakeWizard && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 overflow-y-auto animate-in fade-in duration-200 w-full h-full text-xs font-bold">
          <div className="w-full min-h-screen bg-slate-900 flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 border-b border-slate-800 bg-slate-950 sticky top-0 z-10 shadow-md">
              <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2"><Package className="w-5 h-5 text-indigo-400" /> Wholesale Stock Procurement Sheet</h3>
              <button type="button" onClick={() => setShowIntakeWizard(false)} className="text-slate-400 hover:text-white p-2 bg-slate-800 rounded-full hover:bg-slate-700 cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleSaveIntake} className="p-4 sm:p-8 flex-1 max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-10">
              <div className="flex-1 space-y-6 text-left">
                <div className="bg-slate-900/40 p-5 border border-slate-700/50 rounded-2xl">
                  <label className="block text-slate-300 font-bold uppercase tracking-wider mb-2">1. Select Wholesale Supplier Merchant *</label>
                 <select 
                  required
                  value={intakeSupplierId} 
                  onChange={async (e) => {
                    const val = e.target.value;
                    setIntakeSupplierId(val);
                    
                    // 🚀 Professional Data Sync Engine: Dropdown change hotay hi direct fresh database loading
                    if (val) {
                      try {
                        const { data: latestSup } = await supabase
                          .from('suppliers')
                          .select('*')
                          .eq('shop_id', activeShopId)
                          .order('created_at', { ascending: false });
                          
                        if (latestSup) {
                          setSuppliers(latestSup);
                        }
                      } catch (err) {
                        console.error("Supplier dropdown dynamic sync failed:", err);
                      }
                    }
                  }} 
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white cursor-pointer text-left outline-none"
                >
                  <option value="">Choose wholesaler profile map...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.supplier_name || s.name} - Current Credit Balance: {formatCurrency(s.payment_due)}
                    </option>
                  ))}
                </select>

                  {intakeSupplierId && (() => {
                    // Strict type alignment to prevent leaking metadata from incorrect rows
                    const chosen = suppliers.find(s => s.id === parseInt(intakeSupplierId));
                    if (!chosen) return null;
                    return (
                      <div className="mt-4 p-4 bg-slate-800/60 rounded-xl border border-slate-700/50 space-y-1.5 font-medium text-xs">
                        <div className="flex justify-between text-slate-200"><span>Merchant Supplier Name:</span><span className="font-bold">{chosen.supplier_name || chosen.name}</span></div>
                        <div className="flex justify-between text-rose-400 font-bold"><span>Real-time Payable Credit:</span><span className="font-mono">{formatCurrency(parseFloat(chosen.payment_due || 0))}</span></div>
                        {chosen.address && <p className="text-[10px] text-slate-500 mt-1">🏠 Location address: {chosen.address}</p>}
                      </div>
                    );
                  })()}
                </div>

                <div className="bg-slate-900/40 p-5 border border-slate-700/50 rounded-2xl space-y-4">
                  <label className="block text-slate-300 font-bold uppercase tracking-wider">2. Search Stock Directory Sheet</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input type="text" placeholder="Type name to drop down matching warehouse rows..." value={intakeSearchTerm} onChange={e => setIntakeSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none" />
                    </div>
                    {intakeSearchTerm.trim() && !products.some(p => p.name.toLowerCase() === intakeSearchTerm.toLowerCase().trim()) && (
                      <button type="button" onClick={handleAddNewCustomProduct} className="px-4 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-1 cursor-pointer">➕ Add New Line</button>
                    )}
                  </div>

                  {intakeSearchTerm.trim() && (
                    <div className="max-h-40 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-800 text-left">
                      {products.filter(p => p.name.toLowerCase().includes(intakeSearchTerm.toLowerCase())).map(p => (
                        <div key={p.id} onClick={() => handleAddExistingProduct(p)} className="p-3 hover:bg-slate-800 flex justify-between items-center cursor-pointer transition-colors border-l-4 border-indigo-500/50">
                          <div>
                            <p className="font-bold text-slate-200">{p.name}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Mojooda Stock Inventory: {p.current_stock} {p.unit || 'units'}</p>
                          </div>
                          <span className="font-mono text-indigo-400 font-bold">{formatCurrency(p.purchase_price)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 flex flex-col border-t lg:border-t-0 lg:border-l border-slate-700/40 pt-6 lg:pt-0 lg:pl-8 text-left">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Intake Matrix Worksheet</h4>
                <div className="flex-1 overflow-y-auto max-h-[300px] space-y-3 mb-6 pr-1">
                  {intakeLineItems.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-slate-700 rounded-xl italic text-slate-500">Spreadsheet blank. Select entries above.</div>
                  ) : (
                    intakeLineItems.map(item => (
                      <div key={item.id} className="p-4 bg-slate-800 border border-slate-700/80 rounded-xl flex flex-col gap-2.5">
                        <div className="flex justify-between items-center">
                          <p className="font-bold text-slate-100">{item.name}</p>
                          <button type="button" onClick={() => removeIntakeLineItem(item.id)} className="text-slate-500 hover:text-rose-400 p-1.5">✕</button>
                        </div>
                        
                        {!item.isNew && (
                          <div className="text-[10px] text-indigo-400 font-semibold mb-1 flex items-center gap-1 bg-indigo-500/5 border border-indigo-500/10 px-2 py-1 rounded-lg w-max">
                            📦 Existing Stock in Store: <span className="text-white font-mono font-black">{item.warehouse_stock}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 uppercase mb-1">Quantity</label>
                            <input type="number" inputMode="decimal" min="1" value={item.quantity} onChange={e => updateIntakeLineItem(item.id, 'quantity', e.target.value)} onFocus={(e) => e.target.select()} onBlur={(e) => updateIntakeLineItem(item.id, 'quantity', e.target.value === '' || isNaN(parseFloat(e.target.value)) || parseFloat(e.target.value) <= 0 ? 1 : parseFloat(e.target.value))} className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-mono" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 uppercase mb-1">Khareed Rate</label>
                            <input type="number" inputMode="decimal" min="0" value={item.cost} onChange={e => updateIntakeLineItem(item.id, 'cost', e.target.value)} onFocus={(e) => e.target.select()} onBlur={(e) => updateIntakeLineItem(item.id, 'cost', e.target.value === '' || isNaN(parseFloat(e.target.value)) ? 0 : parseFloat(e.target.value))} className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-right text-rose-400 font-mono" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-emerald-400 uppercase mb-1">Sale Rate</label>
                            <input type="number" inputMode="decimal" min="0" value={item.sellingPrice || ''} onChange={e => updateIntakeLineItem(item.id, 'sellingPrice', e.target.value)} onFocus={(e) => e.target.select()} onBlur={(e) => updateIntakeLineItem(item.id, 'sellingPrice', e.target.value === '' || isNaN(parseFloat(e.target.value)) ? 0 : parseFloat(e.target.value))} className="w-full px-2 py-1 bg-slate-900 border border-emerald-800 rounded text-right text-emerald-400 font-mono font-bold" placeholder="New" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 uppercase mb-1">Unit</label>
                            <select value={item.unit || 'Piece'} onChange={e => handleIntakeUnitChange(item.id, e)} className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white cursor-pointer outline-none text-sm">
                              <option value="Piece">Piece</option>
                              <option value="KG">KG</option>
                              <option value="Bags">Bags</option>
                              <option value="Cft">Cft</option>
                              <option value="Box/Pack">Box/Pack</option>
                              <option value="Feet">Feet</option>
                              <option value="Meter">Meter</option>
                              <option value="Dozen">Dozen</option>
                              <option value="Litre">Litre</option>
                              <option value="Gram">Gram</option>
                              {customUnits.map(cu => <option key={cu.id} value={cu.unit_name}>{cu.unit_name}</option>)}
                              <option value="ADD_NEW_UNIT" className="text-indigo-400 font-bold">+ Custom Unit</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-amber-400 uppercase mb-1">Low Stock Limit</label>
                            <input type="number" inputMode="decimal" min="0" value={item.low_stock_threshold || ''} onChange={e => updateIntakeLineItem(item.id, 'low_stock_threshold', e.target.value)} onFocus={(e) => e.target.select()} onBlur={(e) => updateIntakeLineItem(item.id, 'low_stock_threshold', e.target.value === '' || isNaN(parseFloat(e.target.value)) ? 0 : parseFloat(e.target.value))} className="w-full px-2 py-1 bg-slate-900 border border-amber-800/50 rounded text-center text-amber-400 font-mono" placeholder="5" />
                          </div>
                          <div className="flex items-end justify-end">
                            <div className="w-full bg-slate-950 px-3 py-1.5 rounded border border-slate-800 text-right">
                              <span className="text-[10px] text-slate-500 uppercase block leading-none mb-1">Row Sum</span>
                              <span className="text-white font-mono font-bold">{formatCurrency(parseFloat(item.cost || 0) * parseFloat(item.quantity || 1))}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="bg-slate-950 p-5 border border-slate-800 rounded-2xl space-y-3 mt-auto">
                  <div className="flex justify-between border-b border-slate-800 pb-2.5 items-center">
                    <span className="text-slate-400">➜ Combined Total Stock Balance:</span>
                    <span className="font-mono text-white font-black text-xl">{formatCurrency(intakeGrandTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Cash Paid *</span>
                    <input type="number" inputMode="decimal" min="0" required value={intakeCash} onChange={e => setIntakeCash(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))} onFocus={(e) => e.target.select()} onBlur={(e) => setIntakeCash(e.target.value === '' || isNaN(parseFloat(e.target.value)) ? 0 : Math.max(0, parseFloat(e.target.value)))} className="w-full sm:w-32 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-emerald-400 font-mono text-right text-sm" />
                  </div>
                  
                  {(intakeGrandTotal - intakeCash > 0) && (
                    <div className="space-y-3 pt-2.5 border-t border-slate-900 animate-in slide-in-from-top-2 duration-150 text-left">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-rose-400">Remaining Balance:</span>
                        <span className="font-mono text-rose-400 font-black">{formatCurrency(intakeGrandTotal - intakeCash)}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Payment Due Date *</label>
                        <input 
                          type="date"
                          required
                          min={new Date().toISOString().split('T')[0]}
                          value={intakeDueDate}
                          onChange={e => setIntakeDueDate(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm cursor-pointer outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <button type="submit" disabled={intakeLineItems.length === 0} className="w-full mt-4 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs uppercase rounded-xl tracking-wider shadow-lg transition-transform active:scale-95 cursor-pointer">🚀 Log Purchase Batch &amp; Sync Ledger</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
