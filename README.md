# Uniswap Smart Order Router API

A production-ready web service that provides quoting functionality using Uniswap's Smart Order Router across all supported chains.

## Features

- Get quotes for swaps across all Uniswap-supported chains
- Support for both exact input and exact output swaps
- Configurable slippage tolerance
- Production-ready Docker setup
- Complete error handling and logging

## Supported Chains

- Ethereum Mainnet (Chain ID: 1)
- Optimism (Chain ID: 10)
- Arbitrum One (Chain ID: 42161)
- Polygon (Chain ID: 137)
- Base (Chain ID: 8453)
- BNB Chain (Chain ID: 56)
- Avalanche (Chain ID: 43114)
- Celo (Chain ID: 42220)
- And more

## Prerequisites

- Node.js 16+ or Docker
- Access to RPC URLs for each chain (Infura, Alchemy, or others)

## Installation

### Using Docker

1. Clone the repository
   ```bash
   git clone <repository-url>
   cd uniswap-router-api
   ```

2. Configure your `.env` file
   ```bash
   cp .env.example .env
   # Edit .env to add your RPC URLs
   ```

3. Start the container
   ```bash
   docker-compose up -d
   ```

### Manual Installation

1. Clone the repository
   ```bash
   git clone <repository-url>
   cd uniswap-router-api
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Configure your `.env` file
   ```bash
   cp .env.example .env
   # Edit .env to add your RPC URLs
   ```

4. Build and start the application
   ```bash
   npm run build
   npm start
   ```

## Environment Configuration

Create a `.env` file in the root directory with the following variables:

```
# Server Configuration
PORT=3000
LOG_LEVEL=info

# Ethereum Mainnet
ETH_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_API_KEY

# Optimism
OPTIMISM_RPC_URL=https://optimism-mainnet.infura.io/v3/YOUR_INFURA_API_KEY

# Add other chain RPC URLs as needed
```

Replace `YOUR_INFURA_API_KEY` with your actual API key.

## API Endpoints

### Get Quote

```http
GET /api/quote
```

#### Query Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `chainId` | `number` | **Required**. The chain ID to use (e.g., 1 for Ethereum Mainnet) |
| `tokenIn` | `string` | **Required**. The address of the input token |
| `tokenOut` | `string` | **Required**. The address of the output token |
| `amount` | `string` | **Required**. The amount of the input token to swap |
| `type` | `string` | The type of the swap: "exactIn" (default) or "exactOut" |
| `slippageTolerance` | `number` | The slippage tolerance in percentage (e.g., 0.5 for 0.5%) |
| `recipient` | `string` | The address of the recipient |
| `deadline` | `number` | The deadline for the swap in Unix timestamp |

#### Example Request

```http
GET /api/quote?chainId=1&tokenIn=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2&tokenOut=0x6B175474E89094C44Da98b954EedeAC495271d0F&amount=1&type=exactIn
```

#### Example Response

```json
{
  "chainId": 1,
  "quoteId": "q-1623456789-123456",
  "quoteAmount": "1985.123456789",
  "gasEstimate": "150000",
  "gasPrice": "10000000000",
  "simulationStatus": "SUCCESS",
  "route": {
    "routeString": "ETH-0.3%-USDC-0.05%-DAI",
    "paths": [
      {
        "protocol": "V3",
        "path": [
          "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
          "0x5777d92f208679DB4b9778590Fa3CAB3aC9e2168"
        ]
      }
    ]
  },
  "methodParameters": {
    "calldata": "0x...",
    "value": "0",
    "to": "0x..."
  }
}
```

### Health Check

```http
GET /health
```

#### Example Response

```json
{
  "status": "ok",
  "timestamp": "2023-06-12T12:34:56.789Z"
}
```

## Docker Commands

### Start Services

```bash
docker-compose up -d
```

### Stop Services

```bash
docker-compose down
```

### View Logs

```bash
docker-compose logs -f
```

## License

[MIT](LICENSE)

## Acknowledgements

- [Uniswap](https://uniswap.org/)
- [Uniswap Smart Order Router](https://github.com/Uniswap/smart-order-router)
- [Uniswap SDK](https://docs.uniswap.org/sdk/v3/guides/swaps/routing) 