const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    gstNumber: { type: String, trim: true, default: '' },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    logo: { type: String, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Business', businessSchema);
