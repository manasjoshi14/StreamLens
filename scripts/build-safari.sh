#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT_DIR="$(pwd)"

APP_NAME="StreamLens"
BUNDLE_ID="com.manas.StreamLens"
XCODE_DIR="$ROOT_DIR/StreamLens"
PROJ="$XCODE_DIR/$APP_NAME.xcodeproj"

# 1. Build web extension for Safari
echo "==> Building safari-mv3..."
pnpm build:safari

# 2. Remove previous Xcode project if it exists
if [ -d "$XCODE_DIR" ]; then
  echo "==> Removing previous Xcode project..."
  rm -rf "$XCODE_DIR"
fi

# 3. Convert to Xcode project
echo "==> Converting to Xcode project..."
xcrun safari-web-extension-converter "$ROOT_DIR/.output/safari-mv3" \
  --app-name "$APP_NAME" \
  --bundle-identifier "$BUNDLE_ID" \
  --macos-only \
  --no-open

# 4. Fix bundle identifier casing mismatch
#    The converter lowercases the bundle ID for the extension, but macOS
#    requires the extension ID to be prefixed with the parent app's exact ID.
echo "==> Fixing bundle identifier casing..."
PBXPROJ="$PROJ/project.pbxproj"
sed -i '' "s/com\.manas\.streamlens\.Extension/${BUNDLE_ID}.Extension/g" "$PBXPROJ"

# 5. Detect code signing identity and inject into project
SIGNED=false

IDENTITY=$(security find-identity -v -p codesigning 2>/dev/null \
  | grep "Apple Development" | head -1 \
  | sed 's/.*"\(.*\)".*/\1/' || true)

if [ -n "$IDENTITY" ]; then
  TEAM_ID=$(security find-certificate -a -c "Apple Development" -p ~/Library/Keychains/login.keychain-db 2>/dev/null \
    | openssl x509 -noout -subject 2>/dev/null \
    | sed 's/.*OU=\([A-Z0-9]*\).*/\1/')
  if [ -n "$TEAM_ID" ]; then
    echo "==> Signing with: $IDENTITY (Team: $TEAM_ID)"
    sed -i '' "s/CODE_SIGN_STYLE = Automatic;/CODE_SIGN_STYLE = Automatic;\\
				CODE_SIGN_IDENTITY = \"Apple Development\";\\
				DEVELOPMENT_TEAM = $TEAM_ID;/g" "$PBXPROJ"
    SIGNED=true
  fi
fi

if [ "$SIGNED" = false ]; then
  echo "==> No signing identity found — building unsigned."
  echo "    To sign (removes 'Allow unsigned extensions' requirement):"
  echo "    Xcode > Settings > Accounts > + > Apple ID > Manage Certificates > + > Apple Development"
fi

# 6. Build
echo "==> Building with xcodebuild..."
BUILD_OUTPUT=$(xcodebuild \
  -project "$PROJ" \
  -scheme "$APP_NAME" \
  -configuration Debug \
  build 2>&1)

echo "$BUILD_OUTPUT" | grep -E "^(\*\*|error:)" || true

if echo "$BUILD_OUTPUT" | grep -q "BUILD FAILED"; then
  echo ""
  echo "ERROR: Build failed. Run xcodebuild manually for full output:"
  echo "  xcodebuild -project \"$PROJ\" -scheme \"$APP_NAME\" -configuration Debug build"
  exit 1
fi

BUILD_DIR=$(xcodebuild \
  -project "$PROJ" \
  -scheme "$APP_NAME" \
  -configuration Debug \
  -showBuildSettings 2>/dev/null \
  | grep -m1 'BUILT_PRODUCTS_DIR' | awk '{print $3}')

APP_PATH="$BUILD_DIR/$APP_NAME.app"

echo ""
echo "==> Build succeeded!"
echo ""
if [ "$SIGNED" = true ]; then
  echo "Launching app (signed — no 'Allow unsigned extensions' needed)..."
  echo "  1. Safari > Settings > Extensions > Enable '$APP_NAME'"
  echo "  2. Grant permissions for netflix.com when prompted"
else
  echo "Launching app... After it opens:"
  echo "  1. Safari > Settings > Advanced > 'Show features for web developers'"
  echo "  2. Develop > Allow Unsigned Extensions"
  echo "  3. Safari > Settings > Extensions > Enable '$APP_NAME'"
  echo "  4. Grant permissions for netflix.com when prompted"
fi
echo ""

open "$APP_PATH"
