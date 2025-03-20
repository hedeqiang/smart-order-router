import { Router } from 'express';
import { QuoteController } from '../controllers/quoteController';

const router = Router();
const quoteController = new QuoteController();

// GET /api/quote - Get a quote for a swap
router.get('/quote', (req, res) => quoteController.getQuote(req, res));

export default router; 