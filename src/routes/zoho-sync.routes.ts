import { Router } from 'express';
import { zohoSyncController } from '../controllers/zoho-sync.controller.js';
import { requireAdminAuth } from '../middleware/auth.js';

const router = Router();

// Require administrative authentication for all sync actions
router.use(requireAdminAuth);

router.post('/users', (req, res) => zohoSyncController.syncUsers(req, res));
router.post('/quotes', (req, res) => zohoSyncController.syncQuotes(req, res));
router.post('/orders', (req, res) => zohoSyncController.syncOrders(req, res));
router.post('/bom', (req, res) => zohoSyncController.syncBom(req, res));
router.post('/all', (req, res) => zohoSyncController.syncAll(req, res));
router.get('/status', (req, res) => zohoSyncController.getStatus(req, res));

export const zohoSyncRouter = router;

