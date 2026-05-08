const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Business = require('../models/Business');
const Counter = require('../models/Counter');

const INVOICEABLE_STATUSES = ['Confirmed', 'Delivered'];
const SALE_STATUSES = ['Confirmed', 'Delivered'];

const round2 = (n) => Math.round(n * 100) / 100;

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const dateKey = (date) => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseRange = (query) => {
  const now = new Date();
  const start = query.startDate ? new Date(query.startDate) : addDays(now, -29);
  const end = query.endDate ? new Date(query.endDate) : now;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw Object.assign(new Error('Invalid date range'), { status: 400 });
  }

  const from = startOfDay(start);
  const to = endOfDay(end);
  if (from > to) {
    throw Object.assign(new Error('Start date must be before end date'), { status: 400 });
  }

  return { from, to };
};

const saleMatch = (business, from, to) => ({
  business,
  status: { $in: SALE_STATUSES },
  createdAt: { $gte: from, $lte: to },
});

const emptyDailyRows = (from, to) => {
  const rows = [];
  for (let d = startOfDay(from); d <= to; d = addDays(d, 1)) {
    rows.push({
      date: dateKey(d),
      totalSales: 0,
      orderCount: 0,
      taxableValue: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
    });
  }
  return rows;
};

const ALLOWED_TRANSITIONS = {
  Draft: ['Confirmed', 'Cancelled'],
  Confirmed: ['Delivered', 'Cancelled'],
  Delivered: ['Cancelled'],
  Cancelled: [],
};

exports.list = async (req, res, next) => {
  try {
    const orders = await Order.find({ business: req.user.business }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, business: req.user.business });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) { next(err); }
};

const buildOrderItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw Object.assign(new Error('At least one item is required'), { status: 400 });
  }
  return items.map((item) => {
    const name = String(item.name || '').trim();
    if (!name) throw Object.assign(new Error('Item name is required'), { status: 400 });

    const price = Number(item.price);
    const gstRate = Number(item.gstRate);
    const quantity = Number(item.quantity);

    if (!Number.isFinite(price) || price < 0) {
      throw Object.assign(new Error(`Invalid price for ${name}`), { status: 400 });
    }
    if (!Number.isFinite(gstRate) || gstRate < 0) {
      throw Object.assign(new Error(`Invalid GST rate for ${name}`), { status: 400 });
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw Object.assign(new Error(`Invalid quantity for ${name}`), { status: 400 });
    }

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

const computeTotals = (orderItems, customerState, businessState) => {
  const subtotal = round2(orderItems.reduce((sum, i) => sum + i.lineTotal, 0));
  const totalGst = round2(orderItems.reduce((sum, i) => sum + i.gstAmount, 0));

  const normalize = (s) => String(s || '').trim().toLowerCase();
  const isInterState = !customerState || !businessState
    ? false
    : normalize(customerState) !== normalize(businessState);

  let cgst = 0, sgst = 0, igst = 0;
  if (isInterState) {
    igst = totalGst;
  } else {
    cgst = round2(totalGst / 2);
    sgst = round2(totalGst - cgst);
  }

  const total = round2(subtotal + totalGst);
  return { subtotal, cgst, sgst, igst, totalGst, total, isInterState };
};

exports.create = async (req, res, next) => {
  try {
    const { customerId, items, notes = '', status } = req.body;

    const requestedStatus = status === 'Confirmed' ? 'Confirmed' : 'Draft';

    if (!customerId) return res.status(400).json({ error: 'Customer is required' });

    const [customer, business] = await Promise.all([
      Customer.findOne({ _id: customerId, business: req.user.business }),
      Business.findById(req.user.business),
    ]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    let orderItems;
    try {
      orderItems = buildOrderItems(items);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }

    const totals = computeTotals(orderItems, customer.state, business?.state);
    const orderNumber = await Counter.nextOrderNumber(req.user.business);

    const order = await Order.create({
      business: req.user.business,
      orderNumber,
      customer: customer._id,
      customerName: customer.name,
      customerState: customer.state || '',
      items: orderItems,
      ...totals,
      status: requestedStatus,
      notes: String(notes || '').trim(),
      createdBy: req.user._id,
    });

    res.status(201).json(order);
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!Order.STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await Order.findOne({ _id: req.params.id, business: req.user.business });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status === status) {
      return res.json(order);
    }

    const allowed = ALLOWED_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `Cannot change order from ${order.status} to ${status}`,
      });
    }

    order.status = status;
    await order.save();
    res.json(order);
  } catch (err) { next(err); }
};

exports.updatePayment = async (req, res, next) => {
  try {
    const { paymentStatus } = req.body;
    if (!Order.PAYMENT_STATUSES.includes(paymentStatus)) {
      return res.status(400).json({ error: 'Invalid payment status' });
    }
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, business: req.user.business },
      { paymentStatus },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const order = await Order.findOneAndDelete({ _id: req.params.id, business: req.user.business });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order deleted' });
  } catch (err) { next(err); }
};

exports.generateInvoice = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, business: req.user.business });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (!INVOICEABLE_STATUSES.includes(order.status)) {
      return res.status(400).json({
        error: 'Only Confirmed or Delivered orders can be invoiced',
      });
    }

    if (order.invoice && order.invoice.number) {
      return res.status(400).json({ error: 'An invoice has already been generated for this order' });
    }

    const [business, customer] = await Promise.all([
      Business.findById(req.user.business).lean(),
      Customer.findOne({ _id: order.customer, business: req.user.business }).lean(),
    ]);

    if (!business) return res.status(404).json({ error: 'Business not found' });

    const invoiceNumber = await Counter.nextInvoiceNumber(req.user.business);

    order.invoice = {
      number: invoiceNumber,
      date: new Date(),
      placeOfSupply: customer?.state || order.customerState || '',
      business: {
        name: business.name || '',
        gstNumber: business.gstNumber || '',
        phone: business.phone || '',
        email: business.email || '',
        state: business.state || '',
        address: business.address || '',
        logo: business.logo || '',
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

    await order.save();
    res.status(201).json(order);
  } catch (err) { next(err); }
};

exports.summary = async (req, res, next) => {
  try {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const monthStart = startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const last30Start = startOfDay(addDays(new Date(), -29));

    const orders = await Order.find({ business: req.user.business }).sort({ createdAt: -1 }).lean();
    const totalOrders = orders.length;
    const totalRevenue = orders
      .filter((o) => o.status !== 'Cancelled' && o.status !== 'Draft')
      .reduce((sum, o) => sum + o.total, 0);
    const draftOrders = orders.filter((o) => o.status === 'Draft').length;
    const confirmedOrders = orders.filter((o) => o.status === 'Confirmed').length;
    const unpaidAmount = orders
      .filter((o) => o.status !== 'Cancelled' && o.status !== 'Draft' && o.paymentStatus !== 'Paid')
      .reduce((sum, o) => sum + o.total, 0);

    const customerCount = await Customer.countDocuments({ business: req.user.business });
    const activeOrders = orders.filter((o) => SALE_STATUSES.includes(o.status));
    const todaySales = activeOrders
      .filter((o) => new Date(o.createdAt) >= todayStart && new Date(o.createdAt) <= todayEnd)
      .reduce((sum, o) => sum + o.total, 0);
    const monthSales = activeOrders
      .filter((o) => new Date(o.createdAt) >= monthStart)
      .reduce((sum, o) => sum + o.total, 0);

    const dailyMap = new Map(emptyDailyRows(last30Start, todayEnd).map((row) => [row.date, row]));
    const customerMap = new Map();
    const productMap = new Map();

    activeOrders
      .filter((o) => new Date(o.createdAt) >= last30Start && new Date(o.createdAt) <= todayEnd)
      .forEach((order) => {
        const key = dateKey(order.createdAt);
        const row = dailyMap.get(key);
        if (row) {
          row.totalSales = round2(row.totalSales + order.total);
          row.orderCount += 1;
        }

        const customerKey = String(order.customer || order.customerName);
        const existingCustomer = customerMap.get(customerKey) || {
          customerId: customerKey,
          customerName: order.customerName,
          totalPurchase: 0,
          orderCount: 0,
        };
        existingCustomer.totalPurchase = round2(existingCustomer.totalPurchase + order.total);
        existingCustomer.orderCount += 1;
        customerMap.set(customerKey, existingCustomer);

        order.items.forEach((item) => {
          const productKey = item.productId || item.sku || item.name;
          const existingProduct = productMap.get(productKey) || {
            productId: productKey,
            name: item.name,
            sku: item.sku || '',
            quantity: 0,
            totalSales: 0,
          };
          existingProduct.quantity += item.quantity;
          existingProduct.totalSales = round2(existingProduct.totalSales + item.lineTotal + item.gstAmount);
          productMap.set(productKey, existingProduct);
        });
      });

    res.json({
      totalOrders,
      totalRevenue: round2(totalRevenue),
      draftOrders,
      confirmedOrders,
      unpaidAmount: round2(unpaidAmount),
      customerCount,
      todaySales: round2(todaySales),
      monthSales: round2(monthSales),
      salesLast30Days: Array.from(dailyMap.values()),
      topCustomersLast30Days: Array.from(customerMap.values())
        .sort((a, b) => b.totalPurchase - a.totalPurchase)
        .slice(0, 5),
      topProductsLast30Days: Array.from(productMap.values())
        .sort((a, b) => b.quantity - a.quantity || b.totalSales - a.totalSales)
        .slice(0, 5),
    });
  } catch (err) { next(err); }
};

exports.salesReport = async (req, res, next) => {
  try {
    const { from, to } = parseRange(req.query);
    const orders = await Order.find(saleMatch(req.user.business, from, to)).lean();
    const dailyMap = new Map(emptyDailyRows(from, to).map((row) => [row.date, row]));

    orders.forEach((order) => {
      const row = dailyMap.get(dateKey(order.createdAt));
      if (!row) return;
      row.totalSales = round2(row.totalSales + order.total);
      row.orderCount += 1;
    });

    res.json({
      startDate: dateKey(from),
      endDate: dateKey(to),
      totalSales: round2(orders.reduce((sum, order) => sum + order.total, 0)),
      orderCount: orders.length,
      dailyBreakdown: Array.from(dailyMap.values()).map((row) => ({
        date: row.date,
        totalSales: row.totalSales,
        orderCount: row.orderCount,
      })),
    });
  } catch (err) { next(err); }
};

exports.gstReport = async (req, res, next) => {
  try {
    const { from, to } = parseRange(req.query);
    const orders = await Order.find(saleMatch(req.user.business, from, to)).lean();
    const dailyMap = new Map(emptyDailyRows(from, to).map((row) => [row.date, row]));

    orders.forEach((order) => {
      const row = dailyMap.get(dateKey(order.createdAt));
      if (!row) return;
      row.taxableValue = round2(row.taxableValue + order.subtotal);
      row.cgst = round2(row.cgst + order.cgst);
      row.sgst = round2(row.sgst + order.sgst);
      row.igst = round2(row.igst + order.igst);
      row.orderCount += 1;
    });

    res.json({
      startDate: dateKey(from),
      endDate: dateKey(to),
      totalTaxableValue: round2(orders.reduce((sum, order) => sum + order.subtotal, 0)),
      totalCgst: round2(orders.reduce((sum, order) => sum + order.cgst, 0)),
      totalSgst: round2(orders.reduce((sum, order) => sum + order.sgst, 0)),
      totalIgst: round2(orders.reduce((sum, order) => sum + order.igst, 0)),
      dailyBreakdown: Array.from(dailyMap.values()).map((row) => ({
        date: row.date,
        taxableValue: row.taxableValue,
        cgst: row.cgst,
        sgst: row.sgst,
        igst: row.igst,
        orderCount: row.orderCount,
      })),
    });
  } catch (err) { next(err); }
};
