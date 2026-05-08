const router = require('express').Router();
const c = require('../controllers/orderController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

router.get('/summary', c.summary);
router.get('/reports/sales', c.salesReport);
router.get('/reports/gst', c.gstReport);
router.get('/', c.list);
router.get('/:id', c.getOne);
router.post('/', c.create);
router.patch('/:id/status', requireRole('Owner', 'Manager'), c.updateStatus);
router.patch('/:id/payment', requireRole('Owner', 'Manager'), c.updatePayment);
router.post('/:id/invoice', requireRole('Owner', 'Manager'), c.generateInvoice);
router.delete('/:id', requireRole('Owner', 'Manager'), c.remove);

module.exports = router;
