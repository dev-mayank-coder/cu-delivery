/**
 * Delivery Executives Constants & Hostel Area Filter Helpers
 * Chandigarh University Campus Store Fleet
 */

export const DELIVERY_AREAS = {
  zakir: {
    id: "zakir",
    name: "Zakir Blocks",
    description: "Zakir Blocks (A, B, C, D) • Order IDs: CU-A-xxx, CU-B-xxx...",
    orderIdPrefixes: ["CU-A-", "CU-B-", "CU-C-", "CU-D-", "CU-ZAKIR-"],
    hostels: ["Zakir A", "Zakir B", "Zakir C", "Zakir D"],
    defaultRunner: "Himanshu (Zakir Runner)"
  },
  nc_1_4: {
    id: "nc_1_4",
    name: "NC 1 to 4 Blocks",
    description: "NC Blocks (1, 2, 3, 4) • Order IDs: CU-1-xxx, CU-2-xxx...",
    orderIdPrefixes: ["CU-1-", "CU-2-", "CU-3-", "CU-4-", "CU-NC1-", "CU-NC2-", "CU-NC3-", "CU-NC4-"],
    hostels: ["NC 1", "NC 2", "NC 3", "NC 4"],
    defaultRunner: "Vinay (NC Runner)"
  }
};

/**
 * Checks whether an order belongs strictly to Zakir Hostels (Zakir A, B, C, D).
 * Matches Order IDs like "CU-A-xxx", "CU-B-xxx", "CU-C-xxx", "CU-D-xxx" or customer hostel containing "zakir".
 */
export function isZakirOrder(order) {
  if (!order) return false;
  const id = String(order.id || '').trim().toUpperCase();
  // Order ID matches CU-A-xxx, CU-B-xxx, CU-C-xxx, CU-D-xxx or CU-ZAKIR-xxx
  if (/^CU-[A-D]-/i.test(id) || /^CU-ZAKIR/i.test(id)) return true;
  
  // Also check customer hostel
  const hostel = String(order.customer?.hostel || '').toLowerCase();
  return hostel.includes('zakir');
}

/**
 * Checks whether an order belongs strictly to NC 1, NC 2, NC 3, or NC 4.
 * Matches Order IDs like "CU-1-xxx", "CU-2-xxx", "CU-3-xxx", "CU-4-xxx" or customer hostel NC 1-4.
 * Strictly excludes NC 5 through NC 11 and all non-NC1-4 blocks!
 */
export function isNC1to4Order(order) {
  if (!order) return false;
  const id = String(order.id || '').trim().toUpperCase();
  // Order ID matches CU-1-xxx, CU-2-xxx, CU-3-xxx, CU-4-xxx (and not CU-10-, CU-11-, CU-5- etc.)
  if (/^CU-[1-4]-/i.test(id) || /^CU-NC[1-4]-/i.test(id)) return true;

  // Also check customer hostel
  const hostel = String(order.customer?.hostel || '').toLowerCase();
  const match = hostel.match(/\bnc\s*[-_]?\s*(\d+)\b/i);
  if (match) {
    const num = parseInt(match[1], 10);
    return num >= 1 && num <= 4;
  }
  return false;
}

/**
 * Filters orders by delivery executive zone
 */
export function filterOrdersByDeliveryArea(orders = [], area = 'zakir') {
  if (!Array.isArray(orders)) return [];
  if (area === 'zakir') {
    return orders.filter(isZakirOrder);
  }
  if (area === 'nc_1_4' || area === 'nc') {
    return orders.filter(isNC1to4Order);
  }
  return [];
}
