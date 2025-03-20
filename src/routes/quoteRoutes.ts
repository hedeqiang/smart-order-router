import { Router } from 'express';
import { QuoteController } from '../controllers/quoteController';

const router = Router();
const quoteController = new QuoteController();

// GET /api/quote - Get a quote for a swap
router.get('/quote', (req, res) => quoteController.getQuote(req, res));

// GET /api/chains - Get all supported chains
router.get('/chains', (req, res) => quoteController.getSupportedChains(req, res));

// GET /api/chains/:chainId - Get information for a specific chain
router.get('/chains/:chainId', (req, res) => quoteController.getChainInfo(req, res));

export default router; 