const Product = require('../models/Product');

exports.list = async (req, res, next) => {
  try {
    const products = await Product.find({ business: req.user.business }).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const product = await Product.create({ ...req.body, business: req.user.business });
    res.status(201).json(product);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, business: req.user.business },
      req.body,
      { new: true }
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.id, business: req.user.business });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) { next(err); }
};
