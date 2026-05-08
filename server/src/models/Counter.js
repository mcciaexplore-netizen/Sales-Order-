const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);

Counter.nextOrderNumber = async function (businessId, date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const id = `${businessId}:${year}-${month}`;
  const counter = await Counter.findByIdAndUpdate(
    id,
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return `ORD-${year}-${month}-${String(counter.seq).padStart(4, '0')}`;
};

// Indian financial year runs April 1 -> March 31.
// Format: INV-<FY-start>-<FY-end-2-digits>-<NNNN>, resets every April 1.
// e.g. May 2025 -> INV-2025-26-0001; April 2026 -> INV-2026-27-0001.
Counter.financialYear = function (date = new Date()) {
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();
  const start = month >= 4 ? year : year - 1;
  return { start, end: start + 1 };
};

Counter.nextInvoiceNumber = async function (businessId, date = new Date()) {
  const { start, end } = Counter.financialYear(date);
  const id = `${businessId}:invoice:${start}`;
  const counter = await Counter.findByIdAndUpdate(
    id,
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  const yy = String(end % 100).padStart(2, '0');
  return `INV-${start}-${yy}-${String(counter.seq).padStart(4, '0')}`;
};

module.exports = Counter;
