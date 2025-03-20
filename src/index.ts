import express from 'express';
import cors from 'cors';
import quoteRoutes from './routes/quoteRoutes';
import config from './config/config';
import logger from './utils/logger';

// Create Express application
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api', quoteRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Documentation endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'Uniswap Smart Order Router API',
    version: '1.0.0',
    description: 'API for getting quotes from Uniswap Smart Order Router',
    endpoints: [
      {
        path: '/api/quote',
        method: 'GET',
        description: 'Get a quote for a swap',
        parameters: {
          chainId: 'The chain ID to use (e.g., 1 for Ethereum Mainnet)',
          tokenIn: 'The address of the input token',
          tokenOut: 'The address of the output token',
          amount: 'The amount of the input token to swap',
          type: '(Optional) The type of the swap: "exactIn" (default) or "exactOut"',
          slippageTolerance: '(Optional) The slippage tolerance in percentage (e.g., 0.5 for 0.5%)',
          recipient: '(Optional) The address of the recipient',
          deadline: '(Optional) The deadline for the swap in Unix timestamp'
        }
      },
      {
        path: '/health',
        method: 'GET',
        description: 'Health check endpoint'
      }
    ]
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err });
  res.status(500).json({
    error: 'An unexpected error occurred',
    message: err.message
  });
});

// Start the server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info('Supported chains:');
  
  // List all supported chains
  Object.values(config.chains).forEach(chain => {
    logger.info(`  - ${chain.name} (ID: ${chain.chainId})`);
  });
}); 