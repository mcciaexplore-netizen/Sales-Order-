const router = require('express').Router();
const c = require('../controllers/userController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('Owner'));

router.get('/', c.list);
router.post('/', c.create);
router.delete('/:id', c.remove);

module.exports = router;
