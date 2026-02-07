# Capacitor 7 Upgrade Complete

This plugin has been upgraded to be compatible with Capacitor 7.

## Changes Made

### Package Dependencies
- Updated `@capacitor/core`, `@capacitor/android`, `@capacitor/ios` from `^5.3.0` to `^7.0.0`
- Updated TypeScript from `^4.9.4` to `^5.3.3`
- Updated peer dependency for `@capacitor/core` to `^7.0.0`

### Android Updates
- **compileSdk**: 33 → 35
- **minSdk**: 22 → 23
- **targetSdk**: 33 → 35
- **Gradle Plugin**: 8.0.2 → 8.7.2
- **Gradle Wrapper**: 8.0.2 → 8.11.1
- **Kotlin**: 1.9.10 → 1.9.25
- **Core KTX**: 1.9.0 → 1.13.1

### iOS Updates
- **Deployment Target**: 13.0 → 14.0 (in both Podfile and Podspec)

## Next Steps

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Verify Android Build** (requires Android Studio Ladybug 2024.2.1+ and Java JDK 21):
   ```bash
   npm run verify:android
   ```

3. **Verify iOS Build** (requires Xcode 16.0+):
   ```bash
   npm run verify:ios
   ```

4. **Test the Plugin**:
   - Test in a Capacitor 7 app
   - Verify all native methods work correctly
   - Test on both Android and iOS devices

## Requirements for Development

- **Node.js**: 20 or greater (LTS recommended)
- **Android Studio**: Ladybug | 2024.2.1 or newer
- **Java**: JDK 21 (ships with Android Studio Ladybug)
- **Xcode**: 16.0 or newer
- **iOS**: Minimum deployment target is now iOS 14.0
- **Android**: Minimum SDK is now API 23 (Android 6.0)

## Breaking Changes to Note

If you have custom plugin registration code, note that Capacitor 6+ requires manual plugin registration for local plugins. However, since this is an npm-distributed plugin, the CLI will handle registration automatically.

## Version Bump

Consider updating the package version in `package.json` from `0.0.1` to `1.0.0` or `0.1.0` to reflect this major upgrade.
