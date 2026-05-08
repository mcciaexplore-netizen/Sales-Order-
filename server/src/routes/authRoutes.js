const router = require('express').Router();
const auth = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/logout', auth.logout);
router.post('/forgot-password', auth.requestPasswordReset);
router.post('/reset-password', auth.resetPassword);
router.get('/me', requireAuth, auth.me);

module.exports = router;
