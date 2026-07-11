# Zynd Mobile (Phase 3)

Expo scaffold for iOS/Android push notifications using the existing Zynd backend.

## What is included

- FCM/APNs native token registration via `expo-notifications`
- Device registration against `POST /api/v1/notifications/devices`
- Device revoke on logout against `DELETE /api/v1/notifications/devices/{id}`
- Shared deep-link routing from `@zynd/shared/notifications`
- Foreground/background push listeners

## Setup

1. Install dependencies from repo root:

```bash
npm install
```

2. Add Firebase native config for Android:

- Place `google-services.json` in `Mobile/google-services.json`

3. Configure API URL:

```bash
export EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1
```

4. Enable backend FCM:

```env
FCM_ENABLED=true
FIREBASE_PROJECT_ID=your-project
FIREBASE_SERVICE_ACCOUNT_FILE=./firebase-service-account.json
```

5. Start the app:

```bash
npm run start --workspace=zynd-mobile
```

## Integration checklist for production mobile

- Replace the simulated login token in `App.tsx` with the real Zynd auth flow
- Map `resolvePushDeepLink()` results to React Navigation routes
- Call `registerMobilePushDevice()` after successful login
- Call `revokeMobilePushDevice()` before clearing the session on logout
- Keep notification history and read state in the Zynd API, not Firebase
