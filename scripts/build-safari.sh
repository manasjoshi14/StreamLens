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

# 5. Build
echo "==> Building with xcodebuild..."
xcodebuild \
  -project "$PROJ" \
  -scheme "$APP_NAME" \
  -configuration Debug \
  build 2>&1 | grep -E "^(\*\*|error:)" || true

# Check if build succeeded
BUILD_DIR=$(xcodebuild \
  -project "$PROJ" \
  -scheme "$APP_NAME" \
  -configuration Debug \
  -showBuildSettings 2>/dev/null \
  | grep -m1 'BUILT_PRODUCTS_DIR' | awk '{print $3}')

APP_PATH="$BUILD_DIR/$APP_NAME.app"

if [ ! -d "$APP_PATH" ]; then
  echo "ERROR: Build failed. Run xcodebuild manually for full output:"
  echo "  xcodebuild -project \"$PROJ\" -scheme \"$APP_NAME\" -configuration Debug build"
  exit 1
fi

echo ""
echo "==> Build succeeded!"
echo ""
echo "Launching app... After it opens:"
echo "  1. Safari > Settings > Advanced > 'Show features for web developers'"
echo "  2. Develop > Allow Unsigned Extensions"
echo "  3. Safari > Settings > Extensions > Enable '$APP_NAME'"
echo "  4. Grant permissions for netflix.com when prompted"
echo ""

open "$APP_PATH"
