const router = require('express').Router();
const c = require('../controllers/businessController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', c.get);
router.put('/', requireRole('Owner'), c.update);

module.exports = router;
