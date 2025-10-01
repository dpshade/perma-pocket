#!/bin/bash
# Patch arconnect types to add signMessage() method

ARCONNECT_TYPES="node_modules/arconnect/index.d.ts"

if [ -f "$ARCONNECT_TYPES" ]; then
  # Check if signMessage is already in the file
  if ! grep -q "signMessage(" "$ARCONNECT_TYPES"; then
    echo "Patching arconnect types to add signMessage() method..."

    # Use sed to add signMessage after signature method
    sed -i.bak '/signature(/,/): Promise<Uint8Array>;/{
      /): Promise<Uint8Array>;/a\
\
      /**\
       * Sign a message using the wallet (replaces deprecated signature() method)\
       *\
       * @param data Message data to sign\
       * @param options Hash algorithm options\
       *\
       * @returns Promise of the signature\
       */\
      signMessage(\
        data: Uint8Array | ArrayBuffer,\
        options?: {\
          hashAlgorithm?: '"'"'SHA-256'"'"' | '"'"'SHA-384'"'"' | '"'"'SHA-512'"'"';\
        }\
      ): Promise<Uint8Array>;
    }' "$ARCONNECT_TYPES"

    # Also mark signature as deprecated
    sed -i.bak 's|\(.*Get the signature for data array\)|\1\n       *\n       * @deprecated Use signMessage() instead|' "$ARCONNECT_TYPES"

    echo "✓ arconnect types patched successfully"
  else
    echo "✓ arconnect types already patched"
  fi
else
  echo "⚠ arconnect not installed, skipping patch"
fi
