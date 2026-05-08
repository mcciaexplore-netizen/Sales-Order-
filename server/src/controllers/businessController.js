const Business = require('../models/Business');

const normalize = (body) => ({
  name: String(body.name || '').trim(),
  gstNumber: String(body.gstNumber || '').trim(),
  address: String(body.address || '').trim(),
  phone: String(body.phone || '').trim(),
  email: String(body.email || '').trim().toLowerCase(),
  state: String(body.state || '').trim(),
  logo: String(body.logo || '').trim(),
});

const validate = (data) => {
  if (!data.name) return 'Business name is required';
  if (!data.phone) return 'Phone number is required';
  if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) return 'Please enter a valid email address';
  if (!data.state) return 'Business home state is required';
  if (!data.address) return 'Business address is required';
  if (data.logo && !data.logo.startsWith('data:image/')) return 'Logo must be an image file';
  if (data.logo.length > 750000) return 'Logo file is too large. Please upload an image under 500 KB.';
  return null;
};

const toResponse = (business) => ({
  id: String(business._id),
  name: business.name,
  gstNumber: business.gstNumber || '',
  address: business.address || '',
  phone: business.phone || '',
  email: business.email || '',
  state: business.state || '',
  logo: business.logo || '',
});

exports.get = async (req, res, next) => {
  try {
    const business = await Business.findById(req.user.business).lean();
    if (!business) return res.status(404).json({ error: 'Business not found' });
    res.json(toResponse(business));
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const data = normalize(req.body);
    const error = validate(data);
    if (error) return res.status(400).json({ error });

    const business = await Business.findByIdAndUpdate(req.user.business, data, { new: true });
    if (!business) return res.status(404).json({ error: 'Business not found' });
    res.json(toResponse(business));
  } catch (err) { next(err); }
};
