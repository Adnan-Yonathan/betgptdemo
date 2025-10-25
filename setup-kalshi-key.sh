#!/bin/bash

echo "============================================"
echo "Kalshi Private Key Setup Helper"
echo "============================================"
echo ""
echo "This script will help you securely store your Kalshi private key."
echo ""

# Create a temporary file for the key
TEMP_KEY_FILE="/tmp/kalshi-private-key-temp.pem"
ENCODED_FILE="/tmp/kalshi-key-encoded.txt"

echo "Step 1: Please paste your Kalshi private key below."
echo "Paste the ENTIRE key including the BEGIN and END lines."
echo "Press Ctrl+D when done."
echo ""
echo "-----BEGIN PRIVATE KEY-----"
echo "(paste your key here)"
echo "-----END PRIVATE KEY-----"
echo ""

# Read the key from stdin
cat > "$TEMP_KEY_FILE"

echo ""
echo "Step 2: Encoding your key to base64..."

# Encode to base64
base64 -w 0 "$TEMP_KEY_FILE" > "$ENCODED_FILE"

echo "Done!"
echo ""
echo "Step 3: Adding to your .env file..."

# Add to .env file
if grep -q "KALSHI_PRIVATE_KEY_BASE64" .env 2>/dev/null; then
    echo "Updating existing KALSHI_PRIVATE_KEY_BASE64 in .env..."
    sed -i "/KALSHI_PRIVATE_KEY_BASE64/d" .env
fi

echo "KALSHI_PRIVATE_KEY_BASE64=$(cat $ENCODED_FILE)" >> .env

echo ""
echo "✓ Success! Your private key has been securely stored in .env"
echo ""
echo "Cleaning up temporary files..."
rm -f "$TEMP_KEY_FILE" "$ENCODED_FILE"

echo ""
echo "============================================"
echo "Setup Complete!"
echo "============================================"
echo ""
echo "Your Kalshi private key is now stored as KALSHI_PRIVATE_KEY_BASE64 in your .env file."
echo "The key is base64 encoded and will be decoded automatically by the API client."
echo ""
