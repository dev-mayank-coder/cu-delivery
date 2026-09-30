import { createClient } from '@supabase/supabase-js';

/**
 * Direct Supabase Cloud Database Client for Chandigarh University Delivery Fleet
 * Single authoritative source of truth (zero local API dependencies)
 */
export const SUPABASE_URL = (import.meta.env?.VITE_SUPABASE_URL || 'https://mydctdkrfiwsmfouqkqj.supabase.co').trim().replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = (import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZGN0ZGtyZml3c21mb3Vxa3FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDIwNjQsImV4cCI6MjEwNTQ3ODA2NH0.Ti5_gfbs-bYJJRl_u3MLNwXaWkOMyB83liVAQiK0RLI').trim();
export const SUPABASE_SERVICE_KEY = (import.meta.env?.VITE_SUPABASE_SERVICE_ROLE_KEY || '').trim();

/**
 * Obtain authoritative Supabase client instance (singleton across HMR)
 */
export const getSupabase = () => {
  if (typeof globalThis !== 'undefined' && globalThis.__cuDeliverySupabase) {
    return globalThis.__cuDeliverySupabase;
  }

  try {
    // Prefer service role key if available for administrative order status updates, fallback to anon key
    const activeKey = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
    const client = createClient(SUPABASE_URL, activeKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'cu_delivery_auth_state'
      }
    });

    if (typeof globalThis !== 'undefined') {
      globalThis.__cuDeliverySupabase = client;
    }
    return client;
  } catch (err) {
    console.warn("[Supabase] Failed to initialize client:", err);
    return null;
  }
};

/**
 * Normalizes database row to order object
 */
export const normalizeOrderFromDb = (row) => {
  if (!row || !row.id) return null;
  const idStr = String(row.id).trim();
  if (idStr.startsWith('INSPECT-') || idStr.startsWith('TEST-')) return null;

  let items = [];
  try {
    items = typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []);
  } catch { items = []; }
  if (!Array.isArray(items) || items.length === 0) return null;

  let customer = {};
  try {
    customer = typeof row.customer === 'string' ? JSON.parse(row.customer) : (row.customer || {});
  } catch { customer = {}; }

  const totalAmount = Number(row.total_amount ?? row.total ?? 0);
  const deliveryFee = Number(row.delivery_fee ?? 0);
  const subtotal = Number(row.subtotal ?? (totalAmount - deliveryFee));

  return {
    id: idStr,
    date: row.date || (row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'),
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    deliveredAt: row.delivered_at || null,
    customer,
    items,
    subtotal: subtotal || totalAmount,
    deliveryFee,
    totalAmount: totalAmount || subtotal,
    deliverySlot: row.delivery_slot || 'Regular Delivery',
    isSuperExpress: Boolean(row.is_super_express),
    status: row.status === 'delivered' ? 'delivered' : (row.status || 'paid'),
    paymentMethod: row.payment_method || 'UPI',
    paymentStatus: row.payment_status || (row.payment_id ? 'Paid' : 'Pending'),
    paymentId: row.payment_id || '',
    assignedRunner: row.assigned_runner || 'CU Delivery Executive'
  };
};

/**
 * Fetch orders directly and exclusively from Supabase Cloud
 */
export const fetchOrdersFromSupabase = async () => {
  const client = getSupabase();
  if (!client) {
    console.warn("[Supabase] Client not initialized.");
    return [];
  }

  try {
    const { data, error } = await client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.warn("[Supabase] Direct select error:", error.message);
      return [];
    }

    if (Array.isArray(data)) {
      const normalized = data.map(normalizeOrderFromDb).filter(Boolean);
      try {
        localStorage.setItem('cu_delivery_orders_cache', JSON.stringify(normalized));
      } catch { /* ignore */ }
      return normalized;
    }

    return [];
  } catch (err) {
    console.warn("[Supabase] Network/query exception:", err);
    return [];
  }
};

/**
 * Direct Supabase status update (marks delivered or pending)
 */
export const updateOrderStatusInSupabase = async (orderId, newStatus) => {
  const client = getSupabase();
  if (!client) return false;

  const isDelivered = newStatus === 'delivered';
  const deliveredAt = isDelivered ? new Date().toISOString() : null;

  try {
    const { error } = await client
      .from('orders')
      .update({
        status: newStatus,
        delivered_at: deliveredAt
      })
      .eq('id', orderId);

    if (error) {
      console.warn("[Supabase] Order status update failed:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[Supabase] Exception during order status update:", err);
    return false;
  }
};
