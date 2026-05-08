const jwt = require('jsonwebtoken');
const User = require('../models/User');

const COOKIE_NAME = 'sales_token';

const signToken = (user) => {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, business: user.business.toString() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
};

const setAuthCookie = (res, token) => {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
};

const clearAuthCookie = (res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
};

const requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'Please log in to continue' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user) {
      clearAuthCookie(res);
      return res.status(401).json({ error: 'Your session is no longer valid. Please log in again.' });
    }

    req.user = user;
    next();
  } catch (err) {
    clearAuthCookie(res);
    return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }
};

const requireRole = (...allowed) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue' });
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ error: "You don't have permission to perform this action" });
  }
  next();
};

module.exports = {
  COOKIE_NAME,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  requireRole,
};
