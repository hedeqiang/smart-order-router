#!/bin/bash

# Check if the API is running
echo "Checking if the API is running..."
response=$(curl -s http://localhost:3000/health)
status=$(echo $response | grep -o '"status":"ok"')

if [ -z "$status" ]; then
  echo "Error: API is not running. Please start the API first."
  exit 1
fi

echo "API is running."
echo

# Test getting a quote for ETH -> USDC on Ethereum Mainnet
echo "Testing quote endpoint (ETH -> USDC on Ethereum Mainnet)..."
curl -s "http://localhost:3000/api/quote?chainId=1&tokenIn=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2&tokenOut=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&amount=1&type=exactIn" | jq .
echo

echo "Test completed." 