// LocalStorage-backed API shim. Replaces the previous axios+Express backend so
// the app can run purely in the browser (e.g. on a static Vercel deployment).
// Each method returns `{ data }` to mirror axios's response shape, and rejects
// with an Error (.message + .status) on failure to mirror the existing client
// error-handling pattern.

import bcrypt from 'bcryptjs';

// bcryptjs tries to require Node's `crypto.randomBytes` for salt generation,
// which Vite externalizes for browser builds — leaving randomBytes undefined
// and breaking every hash() call (silently producing broken hashes that then
// fail compare()). Wire its random fallback to Web Crypto so it works in the
// browser.
if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
  bcrypt.setRandomFallback((len) => {
    const arr = new Uint8Array(len);
    globalThis.crypto.getRandomValues(arr);
    return Array.from(arr);
  });
}

// ---------- storage helpers ----------

const STORAGE = {
  USERS: 'sales_users_v1',
  BUSINESSES: 'sales_businesses_v1',
  CURRENT_USER_ID: 'sales_current_user_id_v1',
  PASSWORD_RESETS: 'sales_password_resets_v1',
  customers: (bid) => `sales_customers_${bid}`,
  orders: (bid) => `sales_orders_${bid}`,
  products: (bid) => `sales_products_${bid}`, // owned by ProductsContext
  orderCounter: (bid, ym) => `sales_counter_order_${bid}_${ym}`,
  invoiceCounter: (bid, fy) => `sales_counter_invoice_${bid}_${fy}`,
};

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const remove = (key) => localStorage.removeItem(key);

const uid = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
};

const fail = (message, status = 400) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const round2 = (n) => Math.round(n * 100) / 100;

// ---------- session ----------

const getCurrentUser = () => {
  const id = read(STORAGE.CURRENT_USER_ID, null);
  if (!id) return null;
  const users = read(STORAGE.USERS, []);
  const user = users.find((u) => u.id === id);
  return user || null;
};

const requireAuth = () => {
  const user = getCurrentUser();
  if (!user) throw fail('Please log in to continue', 401);
  return user;
};

const requireRole = (user, ...allowed) => {
  if (!allowed.includes(user.role)) {
    throw fail("You don't have permission to perform this action", 403);
  }
};

const buildBusinessResponse = (b) => {
  if (!b) return null;
  return {
    id: b.id,
    name: b.name,
    gstNumber: b.gstNumber || '',
    phone: b.phone || '',
    email: b.email || '',
    state: b.state || '',
    address: b.address || '',
    logo: b.logo || '',
  };
};

const buildUserResponse = (user) => {
  if (!user) return null;
  const business = read(STORAGE.BUSINESSES, []).find((b) => b.id === user.business);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    business: buildBusinessResponse(business),
  };
};

// ---------- counters (atomic per call) ----------

const nextOrderNumber = (businessId, date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const ym = `${year}-${month}`;
  const key = STORAGE.orderCounter(businessId, ym);
  const next = (read(key, 0) || 0) + 1;
  write(key, next);
  return `ORD-${year}-${month}-${String(next).padStart(4, '0')}`;
};

const nextInvoiceNumber = (businessId, date = new Date()) => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const start = month >= 4 ? year : year - 1;
  const end = start + 1;
  const key = STORAGE.invoiceCounter(businessId, start);
  const next = (read(key, 0) || 0) + 1;
  write(key, next);
  const yy = String(end % 100).padStart(2, '0');
  return `INV-${start}-${yy}-${String(next).padStart(4, '0')}`;
};

// ---------- handlers ----------

// AUTH

const handleRegister = async (body) => {
  const { name, email, password, businessName, gstNumber = '', phone, state, address } = body || {};
  if (!name || !name.trim()) throw fail('Full name is required');
  if (!email || !email.trim()) throw fail('Email is required');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw fail('Please enter a valid email address');
  if (!password) throw fail('Password is required');
  if (password.length < 8) throw fail('Password must be at least 8 characters long');
  if (!businessName || !businessName.trim()) throw fail('Business name is required');
  if (!phone || !phone.trim()) throw fail('Phone number is required');
  if (!state || !state.trim()) throw fail('Business state is required');
  if (!address || !address.trim()) throw fail('Business address is required');

  const normalizedEmail = email.trim().toLowerCase();
  const users = read(STORAGE.USERS, []);
  if (users.some((u) => u.email === normalizedEmail)) {
    throw fail('An account with this email already exists. Please log in instead.', 409);
  }

  const business = {
    id: uid(),
    name: businessName.trim(),
    gstNumber: gstNumber.trim(),
    phone: phone.trim(),
    email: normalizedEmail,
    state: state.trim(),
    address: address.trim(),
    logo: '',
    owner: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: uid(),
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role: 'Owner',
    business: business.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  business.owner = user.id;

  const businesses = read(STORAGE.BUSINESSES, []);
  businesses.push(business);
  write(STORAGE.BUSINESSES, businesses);
  users.push(user);
  write(STORAGE.USERS, users);
  write(STORAGE.CURRENT_USER_ID, user.id);

  return { user: buildUserResponse(user) };
};

const handleLogin = async (body) => {
  const { email, password } = body || {};
  if (!email || !email.trim()) throw fail('Email is required');
  if (!password) throw fail('Password is required');

  const normalizedEmail = email.trim().toLowerCase();
  const users = read(STORAGE.USERS, []);
  const user = users.find((u) => u.email === normalizedEmail);
  if (!user) throw fail('Incorrect email or password. Please try again.', 401);

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw fail('Incorrect email or password. Please try again.', 401);

  write(STORAGE.CURRENT_USER_ID, user.id);
  return { user: buildUserResponse(user) };
};

const handleLogout = async () => {
  remove(STORAGE.CURRENT_USER_ID);
  return { message: 'Logged out successfully' };
};

const handleMe = async () => {
  const user = requireAuth();
  return { user: buildUserResponse(user) };
};

const handleForgotPassword = async (body) => {
  const neutral = {
    message: "If an account exists for that email, we've sent password reset instructions.",
  };
  const { email } = body || {};
  if (!email || !email.trim()) return neutral;

  const normalized = email.trim().toLowerCase();
  const users = read(STORAGE.USERS, []);
  const user = users.find((u) => u.email === normalized);
  if (!user) return neutral;

  const rawToken = uid().replace(/-/g, '') + uid().replace(/-/g, '');
  const tokenHash = await bcrypt.hash(rawToken, 8);
  const resets = read(STORAGE.PASSWORD_RESETS, []);
  // remove any existing reset for this user
  const filtered = resets.filter((r) => r.userId !== user.id);
  filtered.push({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  write(STORAGE.PASSWORD_RESETS, filtered);

  const link = `${window.location.origin}/reset-password?token=${rawToken}`;
  // Stash the most-recent link so the UI can surface it (frontend-only mode
  // has no email to send through).
  write('sales_last_reset_link', { email: user.email, link, createdAt: new Date().toISOString() });
  console.log('\n========================================');
  console.log(`[password-reset] Reset link for ${user.email}:`);
  console.log(`  ${link}`);
  console.log('  (expires in 1 hour)');
  console.log('========================================\n');

  return { ...neutral, devLink: link };
};

const handleResetPassword = async (body) => {
  const { token, password } = body || {};
  if (!token || !String(token).trim()) throw fail('Reset token is required');
  if (!password) throw fail('Please choose a new password');
  if (password.length < 8) throw fail('Password must be at least 8 characters long');

  const resets = read(STORAGE.PASSWORD_RESETS, []);
  const now = new Date();
  let matched = null;
  for (const r of resets) {
    const expiry = new Date(r.expiresAt);
    if (expiry < now) continue;
    if (await bcrypt.compare(String(token).trim(), r.tokenHash)) {
      matched = r;
      break;
    }
  }
  if (!matched) {
    throw fail('This reset link is invalid or has expired. Please request a new one.');
  }

  const users = read(STORAGE.USERS, []);
  const user = users.find((u) => u.id === matched.userId);
  if (!user) throw fail('This reset link is invalid or has expired. Please request a new one.');

  user.passwordHash = await bcrypt.hash(password, 10);
  user.updatedAt = new Date().toISOString();
  write(STORAGE.USERS, users);
  write(STORAGE.PASSWORD_RESETS, resets.filter((r) => r !== matched));
  return { message: 'Password updated. You can now log in with your new password.' };
};

// USERS (team members)

const sanitizeUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  business: u.business,
});

const handleListUsers = async () => {
  const me = requireAuth();
  requireRole(me, 'Owner');
  const users = read(STORAGE.USERS, []);
  return users.filter((u) => u.business === me.business).map(sanitizeUser);
};

const handleCreateUser = async (body) => {
  const me = requireAuth();
  requireRole(me, 'Owner');
  const { name, email, password, role } = body || {};
  if (!name || !name.trim()) throw fail('Full name is required');
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw fail('Please enter a valid email address');
  if (!password || password.length < 8) throw fail('Password must be at least 8 characters long');
  if (!['Manager', 'Staff'].includes(role)) throw fail('Role must be either Manager or Staff');

  const normalizedEmail = email.trim().toLowerCase();
  const users = read(STORAGE.USERS, []);
  if (users.some((u) => u.email === normalizedEmail)) {
    throw fail('An account with this email already exists', 409);
  }
  const user = {
    id: uid(),
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 10),
    role,
    business: me.business,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  users.push(user);
  write(STORAGE.USERS, users);
  return sanitizeUser(user);
};

const handleDeleteUser = async (userId) => {
  const me = requireAuth();
  requireRole(me, 'Owner');
  if (userId === me.id) throw fail("You can't delete your own account");
  const users = read(STORAGE.USERS, []);
  const user = users.find((u) => u.id === userId && u.business === me.business);
  if (!user) throw fail('User not found', 404);
  if (user.role === 'Owner') throw fail("You can't delete the business owner");
  write(STORAGE.USERS, users.filter((u) => u.id !== userId));
  return { message: 'User removed' };
};

// BUSINESS

const handleGetBusiness = async () => {
  const me = requireAuth();
  const business = read(STORAGE.BUSINESSES, []).find((b) => b.id === me.business);
  if (!business) throw fail('Business not found', 404);
  return buildBusinessResponse(business);
};

const handleUpdateBusiness = async (body) => {
  const me = requireAuth();
  requireRole(me, 'Owner');
  const businesses = read(STORAGE.BUSINESSES, []);
  const business = businesses.find((b) => b.id === me.business);
  if (!business) throw fail('Business not found', 404);

  const next = { ...business };
  ['name', 'gstNumber', 'phone', 'email', 'state', 'address', 'logo'].forEach((key) => {
    if (body && body[key] !== undefined) next[key] = String(body[key] ?? '');
  });
  next.updatedAt = new Date().toISOString();
  Object.assign(business, next);
  write(STORAGE.BUSINESSES, businesses);
  return buildBusinessResponse(business);
};

// CUSTOMERS

const handleListCustomers = async () => {
  const me = requireAuth();
  return read(STORAGE.customers(me.business), []);
};

const handleCreateCustomer = async (body) => {
  const me = requireAuth();
  requireRole(me, 'Owner', 'Manager');
  if (!body?.name || !String(body.name).trim()) throw fail('Customer name is required');
  if (!body?.phone || !String(body.phone).trim()) throw fail('Phone is required');

  const customers = read(STORAGE.customers(me.business), []);
  const now = new Date().toISOString();
  const customer = {
    _id: uid(),
    business: me.business,
    name: String(body.name).trim(),
    phone: String(body.phone).trim(),
    email: String(body.email || '').trim(),
    address: String(body.address || ''),
    city: String(body.city || ''),
    state: String(body.state || ''),
    gstin: String(body.gstin || ''),
    createdAt: now,
    updatedAt: now,
  };
  customers.unshift(customer);
  write(STORAGE.customers(me.business), customers);
  return customer;
};

const handleUpdateCustomer = async (id, body) => {
  const me = requireAuth();
  requireRole(me, 'Owner', 'Manager');
  const customers = read(STORAGE.customers(me.business), []);
  const customer = customers.find((c) => c._id === id);
  if (!customer) throw fail('Customer not found', 404);
  ['name', 'phone', 'email', 'address', 'city', 'state', 'gstin'].forEach((k) => {
    if (body && body[k] !== undefined) customer[k] = String(body[k] ?? '');
  });
  customer.updatedAt = new Date().toISOString();
  write(STORAGE.customers(me.business), customers);
  return customer;
};

const handleDeleteCustomer = async (id) => {
  const me = requireAuth();
  requireRole(me, 'Owner', 'Manager');
  const customers = read(STORAGE.customers(me.business), []);
  if (!customers.some((c) => c._id === id)) throw fail('Customer not found', 404);
  write(STORAGE.customers(me.business), customers.filter((c) => c._id !== id));
  return { message: 'Customer deleted' };
};

// ORDERS

const ORDER_STATUSES = ['Draft', 'Confirmed', 'Delivered', 'Cancelled'];
const PAYMENT_STATUSES = ['Unpaid', 'Partial', 'Paid'];
const ALLOWED_TRANSITIONS = {
  Draft: ['Confirmed', 'Cancelled'],
  Confirmed: ['Delivered', 'Cancelled'],
  Delivered: ['Cancelled'],
  Cancelled: [],
};

const buildOrderItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw fail('At least one item is required');
  }
  return items.map((item) => {
    const name = String(item?.name || '').trim();
    if (!name) throw fail('Item name is required');
    const price = Number(item.price);
    const gstRate = Number(item.gstRate);
    const quantity = Number(item.quantity);
    if (!Number.isFinite(price) || price < 0) throw fail(`Invalid price for ${name}`);
    if (!Number.isFinite(gstRate) || gstRate < 0) throw fail(`Invalid GST rate for ${name}`);
    if (!Number.isFinite(quantity) || quantity < 1) throw fail(`Invalid quantity for ${name}`);
    const lineTotal = round2(price * quantity);
    const gstAmount = round2(lineTotal * (gstRate / 100));
    return {
      productId: String(item.productId || ''),
      sku: String(item.sku || ''),
      hsnCode: String(item.hsnCode || ''),
      unit: String(item.unit || ''),
      name,
      price,
      gstRate,
      quantity,
      lineTotal,
      gstAmount,
    };
  });
};

const computeTotals = (items, customerState, businessState) => {
  const subtotal = round2(items.reduce((s, i) => s + i.lineTotal, 0));
  const totalGst = round2(items.reduce((s, i) => s + i.gstAmount, 0));
  const norm = (s) => String(s || '').trim().toLowerCase();
  const isInterState = !customerState || !businessState
    ? false
    : norm(customerState) !== norm(businessState);
  let cgst = 0, sgst = 0, igst = 0;
  if (isInterState) {
    igst = totalGst;
  } else {
    cgst = round2(totalGst / 2);
    sgst = round2(totalGst - cgst);
  }
  return { subtotal, cgst, sgst, igst, totalGst, total: round2(subtotal + totalGst), isInterState };
};

const handleListOrders = async () => {
  const me = requireAuth();
  return read(STORAGE.orders(me.business), []);
};

const handleGetOrder = async (id) => {
  const me = requireAuth();
  const order = read(STORAGE.orders(me.business), []).find((o) => o._id === id);
  if (!order) throw fail('Order not found', 404);
  return order;
};

const handleCreateOrder = async (body) => {
  const me = requireAuth();
  const customers = read(STORAGE.customers(me.business), []);
  const businesses = read(STORAGE.BUSINESSES, []);
  const business = businesses.find((b) => b.id === me.business);

  const customer = customers.find((c) => c._id === body?.customerId);
  if (!body?.customerId) throw fail('Customer is required');
  if (!customer) throw fail('Customer not found', 404);

  const orderItems = buildOrderItems(body.items);
  const totals = computeTotals(orderItems, customer.state, business?.state);
  const now = new Date();
  const orderNumber = nextOrderNumber(me.business, now);
  const status = body.status === 'Confirmed' ? 'Confirmed' : 'Draft';

  const order = {
    _id: uid(),
    business: me.business,
    orderNumber,
    customer: customer._id,
    customerName: customer.name,
    customerState: customer.state || '',
    items: orderItems,
    ...totals,
    status,
    paymentStatus: 'Unpaid',
    notes: String(body.notes || '').trim(),
    invoice: null,
    createdBy: me.id,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  const orders = read(STORAGE.orders(me.business), []);
  orders.unshift(order);
  write(STORAGE.orders(me.business), orders);
  return order;
};

const handleUpdateOrderStatus = async (id, body) => {
  const me = requireAuth();
  requireRole(me, 'Owner', 'Manager');
  const status = body?.status;
  if (!ORDER_STATUSES.includes(status)) throw fail('Invalid status');
  const orders = read(STORAGE.orders(me.business), []);
  const order = orders.find((o) => o._id === id);
  if (!order) throw fail('Order not found', 404);
  if (order.status === status) return order;
  const allowed = ALLOWED_TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) {
    throw fail(`Cannot change order from ${order.status} to ${status}`);
  }
  order.status = status;
  order.updatedAt = new Date().toISOString();
  write(STORAGE.orders(me.business), orders);
  return order;
};

const handleUpdateOrderPayment = async (id, body) => {
  const me = requireAuth();
  requireRole(me, 'Owner', 'Manager');
  const paymentStatus = body?.paymentStatus;
  if (!PAYMENT_STATUSES.includes(paymentStatus)) throw fail('Invalid payment status');
  const orders = read(STORAGE.orders(me.business), []);
  const order = orders.find((o) => o._id === id);
  if (!order) throw fail('Order not found', 404);
  order.paymentStatus = paymentStatus;
  order.updatedAt = new Date().toISOString();
  write(STORAGE.orders(me.business), orders);
  return order;
};

const handleDeleteOrder = async (id) => {
  const me = requireAuth();
  requireRole(me, 'Owner', 'Manager');
  const orders = read(STORAGE.orders(me.business), []);
  if (!orders.some((o) => o._id === id)) throw fail('Order not found', 404);
  write(STORAGE.orders(me.business), orders.filter((o) => o._id !== id));
  return { message: 'Order deleted' };
};

const handleGenerateInvoice = async (id) => {
  const me = requireAuth();
  requireRole(me, 'Owner', 'Manager');
  const orders = read(STORAGE.orders(me.business), []);
  const order = orders.find((o) => o._id === id);
  if (!order) throw fail('Order not found', 404);
  if (!['Confirmed', 'Delivered'].includes(order.status)) {
    throw fail('Only Confirmed or Delivered orders can be invoiced');
  }
  if (order.invoice && order.invoice.number) {
    throw fail('An invoice has already been generated for this order');
  }

  const business = read(STORAGE.BUSINESSES, []).find((b) => b.id === me.business);
  const customer = read(STORAGE.customers(me.business), []).find((c) => c._id === order.customer);
  if (!business) throw fail('Business not found', 404);

  const number = nextInvoiceNumber(me.business);
  order.invoice = {
    number,
    date: new Date().toISOString(),
    placeOfSupply: customer?.state || order.customerState || '',
    business: {
      name: business.name || '',
      gstNumber: business.gstNumber || '',
      phone: business.phone || '',
      state: business.state || '',
      address: business.address || '',
    },
    customer: {
      name: customer?.name || order.customerName || '',
      phone: customer?.phone || '',
      email: customer?.email || '',
      address: customer?.address || '',
      city: customer?.city || '',
      state: customer?.state || order.customerState || '',
      gstin: customer?.gstin || '',
    },
  };
  order.updatedAt = new Date().toISOString();
  write(STORAGE.orders(me.business), orders);
  return order;
};

const handleOrdersSummary = async () => {
  const me = requireAuth();
  const orders = read(STORAGE.orders(me.business), []);
  const customers = read(STORAGE.customers(me.business), []);

  const totalOrders = orders.length;
  const billable = orders.filter((o) => o.status !== 'Cancelled' && o.status !== 'Draft');
  const totalRevenue = round2(billable.reduce((s, o) => s + o.total, 0));
  const draftOrders = orders.filter((o) => o.status === 'Draft').length;
  const confirmedOrders = orders.filter((o) => o.status === 'Confirmed').length;
  const unpaidAmount = round2(
    billable.filter((o) => o.paymentStatus !== 'Paid').reduce((s, o) => s + o.total, 0)
  );

  const todayKey = new Date().toISOString().slice(0, 10);
  const monthKey = new Date().toISOString().slice(0, 7);
  const todaySales = round2(
    billable.filter((o) => o.createdAt.startsWith(todayKey)).reduce((s, o) => s + o.total, 0)
  );
  const monthSales = round2(
    billable.filter((o) => o.createdAt.startsWith(monthKey)).reduce((s, o) => s + o.total, 0)
  );

  // last 30 days daily
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const salesLast30Days = days.map((date) => {
    const total = round2(
      billable.filter((o) => o.createdAt.startsWith(date)).reduce((s, o) => s + o.total, 0)
    );
    return { date, total };
  });

  // top customers in last 30 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const recent = billable.filter((o) => new Date(o.createdAt) >= cutoff);
  const customerTotals = new Map();
  for (const o of recent) {
    const prev = customerTotals.get(o.customer) || { customerId: o.customer, name: o.customerName, total: 0, orderCount: 0 };
    prev.total = round2(prev.total + o.total);
    prev.orderCount += 1;
    customerTotals.set(o.customer, prev);
  }
  const topCustomersLast30Days = [...customerTotals.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // top products in last 30 days
  const productTotals = new Map();
  for (const o of recent) {
    for (const it of o.items) {
      const key = it.productId || it.name;
      const prev = productTotals.get(key) || { name: it.name, quantity: 0, total: 0 };
      prev.quantity += it.quantity;
      prev.total = round2(prev.total + it.lineTotal);
      productTotals.set(key, prev);
    }
  }
  const topProductsLast30Days = [...productTotals.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    totalOrders,
    totalRevenue,
    draftOrders,
    confirmedOrders,
    unpaidAmount,
    todaySales,
    monthSales,
    customerCount: customers.length,
    salesLast30Days,
    topCustomersLast30Days,
    topProductsLast30Days,
  };
};

// REPORTS

const dailyReportRange = (orders, query) => {
  const startDate = (query.startDate || query.from || '').slice(0, 10);
  const endDate = (query.endDate || query.to || '').slice(0, 10);
  const inRange = (o) => {
    const d = o.createdAt.slice(0, 10);
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };
  return { startDate, endDate, filtered: orders.filter(inRange) };
};

const handleSalesReport = async (query) => {
  const me = requireAuth();
  const orders = read(STORAGE.orders(me.business), []).filter(
    (o) => o.status !== 'Cancelled' && o.status !== 'Draft'
  );
  const { startDate, endDate, filtered } = dailyReportRange(orders, query);
  const byDay = new Map();
  for (const o of filtered) {
    const d = o.createdAt.slice(0, 10);
    const prev = byDay.get(d) || { date: d, orderCount: 0, totalSales: 0 };
    prev.orderCount += 1;
    prev.totalSales = round2(prev.totalSales + o.total);
    byDay.set(d, prev);
  }
  const dailyBreakdown = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  return {
    startDate,
    endDate,
    orderCount: filtered.length,
    totalSales: round2(filtered.reduce((s, o) => s + o.total, 0)),
    dailyBreakdown,
  };
};

const handleGstReport = async (query) => {
  const me = requireAuth();
  const orders = read(STORAGE.orders(me.business), []).filter(
    (o) => o.status !== 'Cancelled' && o.status !== 'Draft'
  );
  const { startDate, endDate, filtered } = dailyReportRange(orders, query);
  const byDay = new Map();
  for (const o of filtered) {
    const d = o.createdAt.slice(0, 10);
    const prev = byDay.get(d) || {
      date: d, orderCount: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, total: 0,
    };
    prev.orderCount += 1;
    prev.taxableValue = round2(prev.taxableValue + o.subtotal);
    prev.cgst = round2(prev.cgst + (o.cgst || 0));
    prev.sgst = round2(prev.sgst + (o.sgst || 0));
    prev.igst = round2(prev.igst + (o.igst || 0));
    prev.total = round2(prev.total + o.total);
    byDay.set(d, prev);
  }
  const dailyBreakdown = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  return {
    startDate,
    endDate,
    totalTaxableValue: round2(filtered.reduce((s, o) => s + o.subtotal, 0)),
    totalCgst: round2(filtered.reduce((s, o) => s + (o.cgst || 0), 0)),
    totalSgst: round2(filtered.reduce((s, o) => s + (o.sgst || 0), 0)),
    totalIgst: round2(filtered.reduce((s, o) => s + (o.igst || 0), 0)),
    dailyBreakdown,
  };
};

// ---------- dispatcher ----------

const parseQuery = (qs) => {
  const out = {};
  if (!qs) return out;
  for (const part of qs.split('&')) {
    const [k, v = ''] = part.split('=');
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return out;
};

const dispatch = async (method, url, body, config) => {
  // Strip leading "/api" if anything still passes it; routes here are already
  // unprefixed because the original axios client used baseURL '/api'.
  const stripped = url.replace(/^\/api/, '');
  const [path, qs] = stripped.split('?');
  const query = { ...parseQuery(qs), ...(config?.params || {}) };

  // matchers in order
  if (method === 'POST' && path === '/auth/register') return handleRegister(body);
  if (method === 'POST' && path === '/auth/login') return handleLogin(body);
  if (method === 'POST' && path === '/auth/logout') return handleLogout();
  if (method === 'POST' && path === '/auth/forgot-password') return handleForgotPassword(body);
  if (method === 'POST' && path === '/auth/reset-password') return handleResetPassword(body);
  if (method === 'GET' && path === '/auth/me') return handleMe();

  if (method === 'GET' && path === '/users') return handleListUsers();
  if (method === 'POST' && path === '/users') return handleCreateUser(body);
  let m = path.match(/^\/users\/([^/]+)$/);
  if (m && method === 'DELETE') return handleDeleteUser(m[1]);

  if (method === 'GET' && path === '/business') return handleGetBusiness();
  if (method === 'PUT' && path === '/business') return handleUpdateBusiness(body);

  if (method === 'GET' && path === '/customers') return handleListCustomers();
  if (method === 'POST' && path === '/customers') return handleCreateCustomer(body);
  m = path.match(/^\/customers\/([^/]+)$/);
  if (m && method === 'PUT') return handleUpdateCustomer(m[1], body);
  if (m && method === 'DELETE') return handleDeleteCustomer(m[1]);

  if (method === 'GET' && path === '/orders') return handleListOrders();
  if (method === 'GET' && path === '/orders/summary') return handleOrdersSummary();
  if (method === 'GET' && path === '/orders/reports/sales') return handleSalesReport(query);
  if (method === 'GET' && path === '/orders/reports/gst') return handleGstReport(query);
  if (method === 'POST' && path === '/orders') return handleCreateOrder(body);
  m = path.match(/^\/orders\/([^/]+)$/);
  if (m && method === 'GET') return handleGetOrder(m[1]);
  if (m && method === 'DELETE') return handleDeleteOrder(m[1]);
  m = path.match(/^\/orders\/([^/]+)\/status$/);
  if (m && method === 'PATCH') return handleUpdateOrderStatus(m[1], body);
  m = path.match(/^\/orders\/([^/]+)\/payment$/);
  if (m && method === 'PATCH') return handleUpdateOrderPayment(m[1], body);
  m = path.match(/^\/orders\/([^/]+)\/invoice$/);
  if (m && method === 'POST') return handleGenerateInvoice(m[1]);

  // products endpoints aren't used by the app (ProductsContext owns them
  // directly via localStorage), but legacy callers expect a 200 list.
  if (method === 'GET' && path === '/products') {
    const me = requireAuth();
    return read(STORAGE.products(me.business), []);
  }

  throw fail(`No handler for ${method} ${path}`, 404);
};

const wrap = (method) => async (url, ...rest) => {
  // axios signatures:
  //   get(url, config) / delete(url, config)
  //   post(url, body, config) / put(url, body, config) / patch(url, body, config)
  let body, config;
  if (method === 'GET' || method === 'DELETE') {
    config = rest[0];
  } else {
    body = rest[0];
    config = rest[1];
  }
  try {
    const data = await dispatch(method, url, body, config);
    return { data };
  } catch (err) {
    // Preserve message for the existing error path: pages read err.message.
    if (err instanceof Error) throw err;
    throw new Error(String(err));
  }
};

const api = {
  get: wrap('GET'),
  post: wrap('POST'),
  put: wrap('PUT'),
  patch: wrap('PATCH'),
  delete: wrap('DELETE'),
};

export default api;
