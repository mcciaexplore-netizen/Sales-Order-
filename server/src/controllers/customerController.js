const Customer = require('../models/Customer');

const normalize = (body) => ({
  name: String(body.name || '').trim(),
  phone: String(body.phone || '').trim(),
  email: String(body.email || '').trim().toLowerCase(),
  address: String(body.address || '').trim(),
  city: String(body.city || '').trim(),
  state: String(body.state || '').trim(),
  gstin: String(body.gstin || '').trim().toUpperCase(),
});

const validate = (data) => {
  if (!data.name) return 'Customer name is required';
  if (!data.phone) return 'Phone number is required';
  if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) return 'Please enter a valid email address';
  return null;
};

exports.list = async (req, res, next) => {
  try {
    const customers = await Customer.find({ business: req.user.business }).sort({ createdAt: -1 });
    res.json(customers);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const data = normalize(req.body);
    const error = validate(data);
    if (error) return res.status(400).json({ error });
    const customer = await Customer.create({ ...data, business: req.user.business });
    res.status(201).json(customer);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const data = normalize(req.body);
    const error = validate(data);
    if (error) return res.status(400).json({ error });
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, business: req.user.business },
      data,
      { new: true }
    );
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const customer = await Customer.findOneAndDelete({ _id: req.params.id, business: req.user.business });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer deleted' });
  } catch (err) { next(err); }
};
