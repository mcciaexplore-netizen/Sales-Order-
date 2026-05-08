const User = require('../models/User');

exports.list = async (req, res, next) => {
  try {
    const users = await User.find({ business: req.user.business }).sort({ createdAt: -1 });
    res.json(users.map((u) => u.toSafeJSON()));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ error: 'Full name is required' });
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address' });
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    if (!['Manager', 'Staff'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either Manager or Staff' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role,
      business: req.user.business,
    });

    res.status(201).json(user.toSafeJSON());
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: "You can't delete your own account" });
    }
    const user = await User.findOne({ _id: req.params.id, business: req.user.business });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'Owner') {
      return res.status(400).json({ error: "You can't delete the business owner" });
    }
    await user.deleteOne();
    res.json({ message: 'User removed' });
  } catch (err) { next(err); }
};
