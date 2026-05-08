const mongoose = require('mongoose');

const ORDER_STATUSES = ['Draft', 'Confirmed', 'Delivered', 'Cancelled'];
const PAYMENT_STATUSES = ['Unpaid', 'Partial', 'Paid'];

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, default: '' },
    sku: { type: String, default: '' },
    hsnCode: { type: String, default: '' },
    unit: { type: String, default: '' },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    gstRate: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
    gstAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    number: { type: String, default: '' },
    date: { type: Date },
    placeOfSupply: { type: String, default: '' },
    business: {
      name: { type: String, default: '' },
      gstNumber: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      state: { type: String, default: '' },
      address: { type: String, default: '' },
      logo: { type: String, default: '' },
    },
    customer: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      address: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      gstin: { type: String, default: '' },
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    orderNumber: { type: String, required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: { type: String, required: true },
    customerState: { type: String, default: '' },
    items: { type: [orderItemSchema], required: true, validate: v => v.length > 0 },
    subtotal: { type: Number, required: true, min: 0 },
    cgst: { type: Number, default: 0, min: 0 },
    sgst: { type: Number, default: 0, min: 0 },
    igst: { type: Number, default: 0, min: 0 },
    totalGst: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    isInterState: { type: Boolean, default: false },
    status: { type: String, enum: ORDER_STATUSES, default: 'Draft' },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'Unpaid' },
    notes: { type: String, default: '' },
    invoice: { type: invoiceSchema, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

orderSchema.index({ business: 1, orderNumber: 1 }, { unique: true });

const Order = mongoose.model('Order', orderSchema);
Order.STATUSES = ORDER_STATUSES;
Order.PAYMENT_STATUSES = PAYMENT_STATUSES;

module.exports = Order;
