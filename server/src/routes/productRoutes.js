const router = require('express').Router();
const c = require('../controllers/productController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', c.list);
router.post('/', requireRole('Owner', 'Manager'), c.create);
router.put('/:id', requireRole('Owner', 'Manager'), c.update);
router.delete('/:id', requireRole('Owner', 'Manager'), c.remove);

module.exports = router;
