const crypto = require('crypto');
const User = require('../models/User');
const Business = require('../models/Business');
const { signToken, setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const { sendMail } = require('../utils/email');

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

const validateRegister = (body) => {
  const { name, email, password, businessName, phone, state, address } = body;
  if (!name || !name.trim()) return 'Full name is required';
  if (!email || !email.trim()) return 'Email is required';
  if (!/^\S+@\S+\.\S+$/.test(email)) return 'Please enter a valid email address';
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters long';
  if (!businessName || !businessName.trim()) return 'Business name is required';
  if (!phone || !phone.trim()) return 'Phone number is required';
  if (!state || !state.trim()) return 'Business state is required';
  if (!address || !address.trim()) return 'Business address is required';
  return null;
};

function businessResponse(business) {
  if (!business) return null;
  return {
    id: String(business._id),
    name: business.name,
    gstNumber: business.gstNumber || '',
    phone: business.phone || '',
    email: business.email || '',
    state: business.state || '',
    address: business.address || '',
    logo: business.logo || '',
  };
}

async function buildUserResponse(user) {
  const business = await Business.findById(user.business).lean();
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    business: businessResponse(business),
  };
}

exports.register = async (req, res, next) => {
  try {
    const error = validateRegister(req.body);
    if (error) return res.status(400).json({ error });

    const {
      name,
      email,
      password,
      businessName,
      gstNumber = '',
      phone,
      state,
      address,
    } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' });
    }

    const business = await Business.create({
      name: businessName.trim(),
      gstNumber: gstNumber.trim(),
      phone: phone.trim(),
      email: normalizedEmail,
      state: state.trim(),
      address: address.trim(),
    });

    let user;
    try {
      user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password,
        role: 'Owner',
        business: business._id,
      });
    } catch (err) {
      await Business.findByIdAndDelete(business._id).catch(() => {});
      if (err.code === 11000) {
        return res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' });
      }
      throw err;
    }

    business.owner = user._id;
    await business.save();

    const token = signToken(user);
    setAuthCookie(res, token);
    res.status(201).json({ user: await buildUserResponse(user) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' });
    }
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !email.trim()) return res.status(400).json({ error: 'Email is required' });
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Incorrect email or password. Please try again.' });
    }

    const ok = await user.comparePassword(password);
    if (!ok) {
      return res.status(401).json({ error: 'Incorrect email or password. Please try again.' });
    }

    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ user: await buildUserResponse(user) });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res) => {
  clearAuthCookie(res);
  res.json({ message: 'Logged out successfully' });
};

exports.me = async (req, res) => {
  res.json({ user: await buildUserResponse(req.user) });
};

// Always return a neutral success message to avoid leaking which emails exist.
exports.requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body || {};
    const neutralResponse = {
      message: "If an account exists for that email, we've sent password reset instructions.",
    };
    if (!email || !email.trim()) return res.status(200).json(neutralResponse);

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(200).json(neutralResponse);

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = hashToken(rawToken);
    user.passwordResetExpiry = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetLink = `${clientUrl}/reset-password?token=${rawToken}`;

    console.log('\n========================================');
    console.log(`[password-reset] Reset link for ${user.email}:`);
    console.log(`  ${resetLink}`);
    console.log('  (expires in 1 hour)');
    console.log('========================================\n');

    await sendMail({
      to: user.email,
      subject: 'Reset your Sales Order Manager password',
      text:
        `Hello ${user.name},\n\n` +
        `Someone requested a password reset for your account. ` +
        `If this was you, open the link below within the next hour to choose a new password:\n\n` +
        `${resetLink}\n\n` +
        `If you didn't request this, you can safely ignore this email — your password won't change.\n`,
    });

    res.json(neutralResponse);
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !String(token).trim()) {
      return res.status(400).json({ error: 'Reset token is required' });
    }
    if (!password) return res.status(400).json({ error: 'Please choose a new password' });
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const hashed = hashToken(String(token).trim());
    const user = await User.findOne({
      passwordResetToken: hashed,
      passwordResetExpiry: { $gt: new Date() },
    }).select('+password +passwordResetToken +passwordResetExpiry');

    if (!user) {
      return res.status(400).json({
        error: 'This reset link is invalid or has expired. Please request a new one.',
      });
    }

    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetExpiry = null;
    await user.save();

    res.json({ message: 'Password updated. You can now log in with your new password.' });
  } catch (err) {
    next(err);
  }
};
