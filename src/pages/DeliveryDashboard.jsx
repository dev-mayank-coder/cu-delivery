import React, { useState, useEffect, useMemo } from 'react';
import { 
  Truck, ShieldCheck, CheckCircle2, Clock, MapPin, 
  Phone, MessageSquare, Search, X, Check, RefreshCcw, 
  Printer, LogOut, Volume2, VolumeX, 
  Zap, Package, Lock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useDeliveryAuth } from '../context/DeliveryAuthContext';
import { 
  fetchOrdersFromSupabase, 
  updateOrderStatusInSupabase, 
  getSupabase, 
  normalizeOrderFromDb 
} from '../utils/supabase';
import { 
  isZakirOrder, 
  isNC1to4Order, 
  DELIVERY_AREAS 
} from '../utils/constants';

// Sound Chime via Web Audio API
const playSoundChime = (type = 'success') => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch { /* ignore */ }
};

export default function DeliveryDashboard() {
  const { currentUser, logout } = useDeliveryAuth();

  // Locked Zone: strictly derived from authenticated user (no switching permitted!)
  const activeZone = currentUser?.assignedArea === 'nc_1_4' || currentUser?.assignedArea === 'nc'
    ? 'nc_1_4'
    : 'zakir';

  const isZakirRunner = activeZone === 'zakir';

  // Orders State (initialized from cache to eliminate blank loading state)
  const [orders, setOrders] = useState(() => {
    try {
      const cached = localStorage.getItem('cu_delivery_orders_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);

  // Audio Toggle
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    if (audioEnabled) playSoundChime(type);
    setTimeout(() => setToast(null), 3500);
  };

  // Local Filters (Default to 'all' so existing orders in the database are immediately visible)
  const [statusTab, setStatusTab] = useState('all');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [searchQuery, setSearchQuery] = useState('');
  const [speedFilter, setSpeedFilter] = useState('all');
  const [hostelSubFilter, setHostelSubFilter] = useState('all');

  // Modals
  const [deliveryConfirmOrder, setDeliveryConfirmOrder] = useState(null);
  const [activeSlipOrder, setActiveSlipOrder] = useState(null);

  // Load orders from Supabase database
  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const fetched = await fetchOrdersFromSupabase();
      if (fetched && Array.isArray(fetched) && fetched.length > 0) {
        setOrders(fetched);
      }
    } catch (err) {
      console.warn("Failed loading orders:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load and continuous background sync
  useEffect(() => {
    loadOrders();

    const handleSync = () => loadOrders();
    window.addEventListener('focus', handleSync);
    const interval = setInterval(handleSync, 8000);

    // Supabase Realtime channel
    const client = getSupabase();
    let channel = null;
    if (client) {
      channel = client
        .channel('cu_delivery_realtime_orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = normalizeOrderFromDb(payload.new);
            if (newOrder) {
              const belongsToThisRunner = isZakirRunner 
                ? isZakirOrder(newOrder) 
                : isNC1to4Order(newOrder);

              setOrders(prev => [newOrder, ...prev.filter(o => o.id !== newOrder.id)]);
              if (belongsToThisRunner) {
                showToast(`New Order #${newOrder.id} for Room ${newOrder.customer?.room || ''}!`);
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = normalizeOrderFromDb(payload.new);
            if (updated) {
              setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            if (deletedId) {
              setOrders(prev => prev.filter(o => o.id !== deletedId));
            }
          }
        })
        .subscribe();
    }

    return () => {
      window.removeEventListener('focus', handleSync);
      clearInterval(interval);
      if (client && channel) client.removeChannel(channel);
    };
  }, [isZakirRunner]);

  // 1. Strict Zone Filtering:
  // Zakir Runner: ONLY Zakir orders (Order IDs: CU-A-xxx, CU-B-xxx... and Zakir hostels)
  // NC (1-4) Runner: ONLY NC 1-4 orders (Order IDs: CU-1-xxx, CU-2-xxx... and NC 1-4 hostels)
  const zoneOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];

    if (isZakirRunner) {
      return orders.filter(isZakirOrder);
    } else {
      return orders.filter(isNC1to4Order);
    }
  }, [orders, isZakirRunner]);

  // 2. Zone Metrics
  const zoneTotalCount = zoneOrders.length;
  const zonePendingOrders = zoneOrders.filter(o => o.status !== 'delivered');
  const zoneDeliveredOrders = zoneOrders.filter(o => o.status === 'delivered');
  const zonePendingCount = zonePendingOrders.length;
  const zoneDeliveredCount = zoneDeliveredOrders.length;

  const zoneExpressCount = zoneOrders.filter(o => 
    o.isSuperExpress || 
    o.deliveryOption === 'super-express' || 
    (o.deliverySlot || '').toLowerCase().includes('super') || 
    (o.deliverySlot || '').toLowerCase().includes('express')
  ).length;

  const zoneRevenue = zoneOrders.reduce((sum, o) => {
    return sum + (Number(o.totalAmount || o.total || o.subtotal) || 0);
  }, 0);

  // 3. Local Search & Secondary Filters
  const filteredOrders = useMemo(() => {
    return zoneOrders.filter(order => {
      // Status Filter
      if (statusTab === 'pending' && order.status === 'delivered') return false;
      if (statusTab === 'delivered' && order.status !== 'delivered') return false;

      // Speed Filter
      const isExpress = order.isSuperExpress || 
        order.deliveryOption === 'super-express' || 
        (order.deliverySlot || '').toLowerCase().includes('super') || 
        (order.deliverySlot || '').toLowerCase().includes('express');
      if (speedFilter === 'express' && !isExpress) return false;
      if (speedFilter === 'regular' && isExpress) return false;

      // Block Sub-Filter
      if (hostelSubFilter !== 'all') {
        const h = (order.customer?.hostel || '').toLowerCase().replace(/\s+/g, '');
        const target = hostelSubFilter.toLowerCase().replace(/\s+/g, '');
        if (!h.includes(target)) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const idMatch = (order.id || '').toLowerCase().includes(q);
        const nameMatch = (order.customer?.name || '').toLowerCase().includes(q);
        const uidMatch = (order.customer?.uid || '').toLowerCase().includes(q);
        const phoneMatch = (order.customer?.phone || '').includes(q);
        const roomMatch = (order.customer?.room || '').toLowerCase().includes(q);
        const hostelMatch = (order.customer?.hostel || '').toLowerCase().includes(q);
        return idMatch || nameMatch || uidMatch || phoneMatch || roomMatch || hostelMatch;
      }

      return true;
    });
  }, [zoneOrders, statusTab, speedFilter, hostelSubFilter, searchQuery]);

  // Action: Confirm Delivery
  const handleConfirmDelivered = async () => {
    if (!deliveryConfirmOrder) return;
    const targetId = deliveryConfirmOrder.id;
    const targetRoom = deliveryConfirmOrder.customer?.room || '';

    // Optimistic update
    setOrders(prev => prev.map(o => o.id === targetId ? { ...o, status: 'delivered', deliveredAt: new Date().toISOString() } : o));
    setDeliveryConfirmOrder(null);

    const success = await updateOrderStatusInSupabase(targetId, 'delivered');
    if (success) {
      try { confetti({ particleCount: 75, spread: 60, origin: { y: 0.65 } }); } catch { /* ignore */ }
      showToast(`Order #${targetId} marked as DELIVERED to Room ${targetRoom}!`);
    } else {
      showToast("Sync error updating cloud status", "error");
    }
  };

  // Action: Revert Delivery to Pending
  const handleRevertToPending = async (order) => {
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'pending', deliveredAt: null } : o));
    const success = await updateOrderStatusInSupabase(order.id, 'pending');
    if (success) {
      showToast(`Order #${order.id} returned to PENDING queue.`, 'info');
    }
  };

  const currentZoneMeta = isZakirRunner 
    ? DELIVERY_AREAS.zakir 
    : DELIVERY_AREAS.nc_1_4;

  const availableHostels = isZakirRunner 
    ? DELIVERY_AREAS.zakir.hostels 
    : DELIVERY_AREAS.nc_1_4.hostels;

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col font-sans pb-16 selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border border-emerald-500/30 bg-slate-900/95 text-white animate-in slide-in-from-bottom duration-300">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 stroke-[3]" />
          </div>
          <span className="text-xs font-semibold">{toast.msg}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-3">
          
          {/* Logo & Portal Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-emerald-600 p-0.5 shadow-lg shadow-emerald-500/20 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-emerald-400">
                <Truck className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-white tracking-tight leading-tight">
                  CU Express Delivery
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Fleet Console
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                User: <strong className="text-white">Delivery Executives</strong> • {currentUser?.displayName}
              </p>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={() => {
                setAudioEnabled(!audioEnabled);
                if (!audioEnabled) playSoundChime('success');
              }}
              className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title={audioEnabled ? "Mute chimes" : "Enable chimes"}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Locked Territory Badge (No switching allowed) */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isZakirRunner ? 'Zakir Blocks Locked' : 'NC (1-4) Blocks Locked'}</span>
            </div>

            {/* Logout */}
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Territory Status Banner */}
        <div className="bg-emerald-950/40 border-t border-b border-emerald-500/20 px-4 py-2">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-300 font-semibold">
                Locked Assigned Territory: <strong className="text-white">{currentZoneMeta.name}</strong> ({currentZoneMeta.description})
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Filtering: <strong className="text-emerald-400 font-mono">{isZakirRunner ? 'CU-A-xxx to CU-D-xxx' : 'CU-1-xxx to CU-4-xxx'}</strong>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6 flex-grow space-y-5">
        
        {/* KPI Scoreboard */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          
          {/* Card 1: PENDING ORDERS */}
          <div 
            onClick={() => setStatusTab('pending')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
              statusTab === 'pending'
                ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30'
                : 'bg-slate-900/90 border-slate-800 hover:border-amber-500/30'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] sm:text-xs text-amber-400 font-bold uppercase tracking-wider">Pending Drops</span>
                  {zonePendingCount > 0 && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                  )}
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight">
                  {zonePendingCount}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium line-clamp-1">
                  Awaiting room delivery
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 group-hover:scale-105 transition-transform shrink-0">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Card 2: DELIVERED ORDERS */}
          <div 
            onClick={() => setStatusTab('delivered')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
              statusTab === 'delivered'
                ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                : 'bg-slate-900/90 border-slate-800 hover:border-emerald-500/30'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] sm:text-xs text-emerald-400 font-bold uppercase tracking-wider">Completed</span>
                <h3 className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1 tracking-tight">
                  {zoneDeliveredCount}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium line-clamp-1">
                  Delivered to rooms
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 group-hover:scale-105 transition-transform shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Card 3: TOTAL ASSIGNED ORDERS */}
          <div 
            onClick={() => setStatusTab('all')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
              statusTab === 'all'
                ? 'bg-blue-500/10 border-blue-500/50 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/30'
                : 'bg-slate-900/90 border-slate-800 hover:border-blue-500/30'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] sm:text-xs text-blue-400 font-bold uppercase tracking-wider">Total Orders</span>
                <h3 className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight">
                  {zoneTotalCount}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium line-clamp-1">
                  Express: <strong className="text-amber-400 font-bold">{zoneExpressCount}</strong>
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30 group-hover:scale-105 transition-transform shrink-0">
                <Package className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Card 4: TOTAL VALUE / CASH COLLECTION */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider">Volume Value</span>
                <h3 className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight">
                  ₹{zoneRevenue.toLocaleString('en-IN')}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium line-clamp-1">
                  {zoneTotalCount > 0 ? `${Math.round((zoneDeliveredCount / zoneTotalCount) * 100)}% completed` : '0%'}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 group-hover:scale-105 transition-transform shrink-0">
                <Truck className="w-5 h-5" />
              </div>
            </div>
          </div>

        </div>

        {/* PRIMARY STATUS TABS & ACTIONS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-2 sm:p-2.5 rounded-2xl border border-slate-800">
          
          {/* Status Tabs */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setStatusTab('pending')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                statusTab === 'pending'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/25'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Pending Deliveries</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                statusTab === 'pending' ? 'bg-slate-950 text-amber-400' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {zonePendingCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusTab('delivered')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                statusTab === 'delivered'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/25'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Completed</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                statusTab === 'delivered' ? 'bg-slate-950 text-emerald-400' : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {zoneDeliveredCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusTab('all')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                statusTab === 'all'
                  ? 'bg-slate-100 text-slate-950 font-black shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>All Orders ({zoneTotalCount})</span>
            </button>
          </div>

          {/* Quick Refresh */}
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                loadOrders();
                showToast("Orders synced from cloud");
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
              title="Refresh Orders"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              <span>Sync Cloud</span>
            </button>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
          
          {/* Search Input */}
          <div className="relative flex-grow max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search room door, student name, phone, order ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pl-10 pr-8 py-2.5 text-xs text-white placeholder:text-slate-600 outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sub-Filters & View Mode (Strictly for their own assigned blocks) */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            
            {/* Specific Block Sub-Filter (Zakir A-D for Zakir, NC 1-4 for NC) */}
            <select
              value={hostelSubFilter}
              onChange={(e) => setHostelSubFilter(e.target.value)}
              className="w-full sm:w-auto bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300 font-semibold outline-none focus:border-emerald-500"
            >
              <option value="all">All {isZakirRunner ? 'Zakir Blocks' : 'NC (1-4) Blocks'}</option>
              {availableHostels.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>

            {/* Speed Filter */}
            <select
              value={speedFilter}
              onChange={(e) => setSpeedFilter(e.target.value)}
              className="w-full sm:w-auto bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300 font-semibold outline-none focus:border-emerald-500"
            >
              <option value="all">All Speeds</option>
              <option value="express">⚡ 30m Express Only</option>
              <option value="regular">Regular Delivery</option>
            </select>

            {/* Cards vs Table View Toggle */}
            <div className="col-span-2 sm:col-span-1 flex items-center justify-center bg-slate-950 p-0.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'cards' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Table
              </button>
            </div>

          </div>
        </div>

        {/* ORDER LISTING: CARDS OR TABLE */}
        {filteredOrders.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-white">
                No {statusTab !== 'all' ? statusTab : ''} orders in {currentZoneMeta.name}
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchQuery || hostelSubFilter !== 'all' || speedFilter !== 'all'
                  ? 'No orders match your active search filters.'
                  : `All caught up! There are currently no ${statusTab} orders queued for ${currentZoneMeta.name}.`}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setHostelSubFilter('all');
                  setSpeedFilter('all');
                  setStatusTab('all');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Clear Search & Filters
              </button>
            </div>
          </div>
        ) : viewMode === 'cards' ? (
          
          /* CARDS VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredOrders.map(order => {
              const isDelivered = order.status === 'delivered';
              const isExpress = order.isSuperExpress || 
                order.deliveryOption === 'super-express' || 
                (order.deliverySlot || '').toLowerCase().includes('super') || 
                (order.deliverySlot || '').toLowerCase().includes('express');
              
              const rawPhone = order.customer?.phone || '';
              const cleanDigits = rawPhone.replace(/\D/g, '').slice(-10);
              const waLink = cleanDigits.length === 10 
                ? `https://wa.me/91${cleanDigits}?text=${encodeURIComponent(`Hello ${order.customer?.name || 'Student'}, this is your CU Delivery Executive at your door for order #${order.id} (Room ${order.customer?.room || ''}, ${order.customer?.hostel || ''}).`)}` 
                : null;

              return (
                <div
                  key={order.id}
                  className={`bg-slate-900/90 border rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col justify-between transition-all relative overflow-hidden ${
                    isDelivered
                      ? 'border-emerald-500/30 hover:border-emerald-500/60'
                      : 'border-amber-500/40 hover:border-amber-500/70 shadow-amber-500/5'
                  }`}
                >
                  <div>
                    {/* Top Bar */}
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800/80">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm sm:text-base text-white">
                            {order.id}
                          </span>
                          {isExpress && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/30 flex items-center gap-1">
                              <Zap className="w-3 h-3 fill-amber-400 text-amber-400" />
                              <span>30m Express</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{order.date || 'Today'}</span>
                        </p>
                      </div>

                      {/* Status Pill */}
                      <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border shrink-0 ${
                        isDelivered
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/40 animate-pulse'
                      }`}>
                        {isDelivered ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Delivered</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                            <span>Pending</span>
                          </>
                        )}
                      </span>
                    </div>

                    {/* LOCATION CARD (Room Door Number in Bold Emerald!) */}
                    <div className="my-3 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-300 truncate">
                            {order.customer?.hostel || 'Hostel Block'}
                          </p>
                          <p className="text-base font-black text-emerald-400 truncate tracking-tight">
                            Room {order.customer?.room || 'Desk Drop'}
                          </p>
                        </div>
                      </div>

                      {/* Direct Phone Call & WhatsApp Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {cleanDigits.length >= 10 && (
                          <a
                            href={`tel:${cleanDigits}`}
                            className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 transition-colors"
                            title="Call Student"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-colors"
                            title="WhatsApp Student"
                          >
                            <MessageSquare className="w-4 h-4" />
                            <span className="hidden xs:inline">WhatsApp</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Student Info */}
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Student:</span>
                        <span className="font-bold text-white truncate max-w-[180px]">
                          {order.customer?.name || 'CU Student'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Phone:</span>
                        <span className="font-mono text-slate-300 font-semibold">
                          {order.customer?.phone || 'N/A'}
                        </span>
                      </div>
                      {order.customer?.notes && (
                        <div className="mt-1 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 italic">
                          "{order.customer.notes}"
                        </div>
                      )}
                    </div>

                    {/* Items List */}
                    <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Items to Drop ({order.items?.length || 1})
                      </p>
                      <div className="space-y-1">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="text-slate-200 font-medium truncate max-w-[200px]">
                              {item.quantity || 1}x {item.name}
                            </span>
                            <span className="font-semibold text-slate-400">
                              ₹{(Number(item.price) || 0) * (item.quantity || 1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Total & Payment */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Total Bill</span>
                        <p className="text-lg font-black text-emerald-400">
                          ₹{order.totalAmount || order.total || order.subtotal || 40}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Payment</span>
                        <p className="text-xs font-bold text-white">
                          {order.paymentStatus === 'Paid' ? (
                            <span className="text-emerald-400">Paid Online (UPI)</span>
                          ) : (
                            <span className="text-amber-400">Cash on Delivery</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Delivered Time */}
                    {isDelivered && order.deliveredAt && (
                      <div className="mt-2 text-[10px] text-emerald-400/90 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 text-center font-semibold">
                        Delivered: {new Date(order.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>

                  {/* BOTTOM ACTIONS */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                    {!isDelivered ? (
                      <button
                        type="button"
                        onClick={() => setDeliveryConfirmOrder(order)}
                        className="w-full py-3.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer min-h-[46px]"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>MARK AS DELIVERED</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                          <span>Delivery Completed</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRevertToPending(order)}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                          title="Undo"
                        >
                          Undo
                        </button>
                      </div>
                    )}

                    {/* Slip Button */}
                    <button
                      type="button"
                      onClick={() => setActiveSlipOrder(order)}
                      className="w-full py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>View Delivery Slip</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

        ) : (

          /* TABLE VIEW */
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Order ID</th>
                    <th className="py-3.5 px-4">Room & Hostel</th>
                    <th className="py-3.5 px-4">Student</th>
                    <th className="py-3.5 px-4">Items</th>
                    <th className="py-3.5 px-4">Bill</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredOrders.map(order => {
                    const isDelivered = order.status === 'delivered';
                    const isExpress = order.isSuperExpress || 
                      order.deliveryOption === 'super-express' || 
                      (order.deliverySlot || '').toLowerCase().includes('super') || 
                      (order.deliverySlot || '').toLowerCase().includes('express');
                    
                    const rawPhone = order.customer?.phone || '';
                    const cleanDigits = rawPhone.replace(/\D/g, '').slice(-10);

                    return (
                      <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-black text-white">{order.id}</span>
                          {isExpress && (
                            <span className="block mt-0.5 text-[10px] text-amber-400 font-bold">
                              ⚡ 30m Express
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-black text-emerald-400 block text-sm">
                            Room {order.customer?.room || 'Desk'}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            {order.customer?.hostel || 'Hostel'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-white block">
                            {order.customer?.name || 'Student'}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {order.customer?.phone || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs truncate text-slate-300">
                          {order.items?.map(i => `${i.quantity}x ${i.name}`).join(', ') || '1x Item'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-black text-emerald-400">
                            ₹{order.totalAmount || order.total || order.subtotal || 40}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            isDelivered
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                          }`}>
                            {isDelivered ? 'Delivered' : 'Pending'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {cleanDigits.length >= 10 && (
                              <a
                                href={`tel:${cleanDigits}`}
                                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 transition-colors"
                                title="Call Student"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {!isDelivered ? (
                              <button
                                type="button"
                                onClick={() => setDeliveryConfirmOrder(order)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                              >
                                Mark Delivered
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRevertToPending(order)}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                              >
                                Undo
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setActiveSlipOrder(order)}
                              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                              title="View Slip"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        )}

      </main>

      {/* CONFIRMATION MODAL */}
      {deliveryConfirmOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-5 shadow-2xl relative">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <Truck className="w-7 h-7" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-black text-white">
                Confirm Room Drop?
              </h3>
              <p className="text-xs text-slate-400">
                Are you at the room door delivering this order right now?
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Order ID:</span>
                <span className="font-mono font-bold text-white">{deliveryConfirmOrder.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Location:</span>
                <span className="font-black text-emerald-400">
                  {deliveryConfirmOrder.customer?.hostel} • Room {deliveryConfirmOrder.customer?.room}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Student:</span>
                <span className="font-bold text-white">{deliveryConfirmOrder.customer?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Bill Total:</span>
                <span className="font-black text-emerald-400">
                  ₹{deliveryConfirmOrder.totalAmount || deliveryConfirmOrder.total || deliveryConfirmOrder.subtotal}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeliveryConfirmOrder(null)}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelivered}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
              >
                Confirm Drop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELIVERY SLIP MODAL */}
      {activeSlipOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  CU Hostel Delivery Slip
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveSlipOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white text-slate-900 p-5 rounded-2xl space-y-4 font-mono text-xs shadow-inner">
              <div className="text-center space-y-0.5 border-b border-slate-300 pb-3">
                <h2 className="font-black text-sm tracking-tight">CHANDIGARH UNIVERSITY</h2>
                <p className="text-[10px] text-slate-600 uppercase font-sans">Student Hostel Stationery Fulfillment</p>
                <p className="text-[10px] text-slate-500 font-sans">Dispatch Zone: {activeSlipOrder.customer?.hostel}</p>
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Order ID:</span>
                  <span className="font-black">{activeSlipOrder.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date/Time:</span>
                  <span>{activeSlipOrder.date || 'Today'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Hostel & Room:</span>
                  <span className="font-black text-emerald-700">
                    {activeSlipOrder.customer?.hostel} • Room {activeSlipOrder.customer?.room}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Student:</span>
                  <span>{activeSlipOrder.customer?.name} ({activeSlipOrder.customer?.uid || 'UID N/A'})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone:</span>
                  <span>{activeSlipOrder.customer?.phone || 'N/A'}</span>
                </div>
              </div>

              <div className="border-t border-b border-slate-300 py-2 space-y-1.5 text-[11px]">
                <div className="flex justify-between font-bold text-slate-700">
                  <span>ITEM</span>
                  <span>PRICE</span>
                </div>
                {activeSlipOrder.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{item.quantity || 1}x {item.name}</span>
                    <span>₹{(Number(item.price) || 0) * (item.quantity || 1)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between font-black text-sm">
                  <span>TOTAL AMOUNT:</span>
                  <span>₹{activeSlipOrder.totalAmount || activeSlipOrder.total || activeSlipOrder.subtotal}</span>
                </div>
                <div className="flex justify-between text-slate-600 text-[10px]">
                  <span>Payment Status:</span>
                  <span className="font-bold">{activeSlipOrder.paymentStatus || 'Paid'}</span>
                </div>
              </div>

              <div className="text-center pt-2 text-[10px] text-slate-500 border-t border-slate-200">
                Delivered by CU Campus Fleet • Room Drop Service
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Slip</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSlipOrder(null)}
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
