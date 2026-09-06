# App Store Readiness Checklist — WorkoutVision

## 1. Wrapping the PWA as a native app

### Option A — PWABuilder (Microsoft, recommended for speed)

1. Go to https://www.pwabuilder.com and enter the deployed URL.
2. PWABuilder scores the manifest and service worker, then generates a ready-to-submit package.
3. For iOS: download the Xcode project, open in Xcode 15+, sign with your Apple Developer account, archive, and upload via Xcode Organizer.
4. For Android: download the AAB, sign with your upload key, submit via Google Play Console.

### Option B — Capacitor (recommended for IAP and native APIs)

```bash
npm install @capacitor/core @capacitor/cli
npx cap init WorkoutVision com.yourcompany.workoutvision --web-dir dist
npm run build
npx cap add ios
npx cap add android
npx cap sync
npx cap open ios      # opens Xcode
npx cap open android  # opens Android Studio
```

Add StoreKit IAP via `@capacitor-community/in-app-purchases` or `@revenuecat/purchases-capacitor`.

---

## 2. Required App Store assets

### iOS (App Store Connect)

| Asset | Size |
|---|---|
| App icon (no alpha) | 1024 × 1024 px PNG |
| iPhone 6.7" screenshots | 1290 × 2796 px (min 3, max 10) |
| iPhone 6.5" screenshots | 1242 × 2688 px |
| iPhone 5.5" screenshots | 1242 × 2208 px |
| iPad Pro 12.9" screenshots | 2048 × 2732 px (if iPad supported) |
| Preview video (optional) | 15–30 s, H.264, 1080p |

### Android (Google Play)

| Asset | Size |
|---|---|
| App icon | 512 × 512 px PNG |
| Feature graphic | 1024 × 500 px |
| Phone screenshots | min 1080 × 1920 px (min 2, max 8) |
| 7" tablet screenshots | optional |
| 10" tablet screenshots | optional |

---

## 3. StoreKit IAP product IDs to create

Create these in App Store Connect > App > In-App Purchases:

| Product ID | Type | Price |
|---|---|---|
| `com.yourcompany.workoutvision.pro_monthly` | Auto-Renewable Subscription | €3.99/month |
| `com.yourcompany.workoutvision.pro_annual` | Auto-Renewable Subscription | €29.99/year |

Subscription group: `WorkoutVision Pro`
Free trial (optional): 7 days on annual plan.

For Google Play: create equivalent subscription products in Play Console > Monetise > Subscriptions, matching the same product IDs or mapped via RevenueCat.

If using RevenueCat:
- Create an Offering named `default` with two Packages: `$rc_monthly` and `$rc_annual`.
- RevenueCat handles receipt validation, cross-platform entitlements, and webhook to your backend.

---

## 4. App Store description draft

**Name:** WorkoutVision — AI Form Coach

**Subtitle:** Analyze your reps, perfect your form

**Keywords:** workout tracker, exercise form, squat form, AI coach, rep counter, fitness analyzer, form check, biomechanics, gym tracker, pose detection

---

**Description:**

WorkoutVision uses on-device AI to analyze your workout videos and give you real-time form feedback — no camera uploads, no cloud processing, no privacy trade-offs.

**What it does:**

Record or upload a workout video. WorkoutVision detects your pose frame by frame, counts your reps, measures joint angles, and scores your form — entirely on your device.

**Key features:**

- AI pose detection powered by MediaPipe (runs fully offline)
- Automatic exercise detection — squat, deadlift, bench press, and 20+ more
- Rep counter with per-rep form scores
- Joint angle charts and range-of-motion tracking
- Form baseline tracking — see if you improve over time
- Voice coaching during playback
- Workout history and progression charts
- PDF export (Pro)
- English and French

**Privacy first:**

No account required. No video ever leaves your device. No data is collected, sold, or shared. Everything runs on-device using Apple's Neural Engine and WebAssembly.

**Free plan:** 3 analyses per day.
**Pro plan:** Unlimited analyses, advanced charts, PDF reports.

---

**Promotional text (170 chars, can be updated without resubmission):**

Analyze your squat, deadlift, or bench press in seconds. On-device AI counts your reps and scores your form — no camera access to any server, ever.

---

## 5. Privacy policy requirements

Because WorkoutVision processes video locally and collects no user data, the privacy policy should explicitly state:

- **No data collected.** The app does not collect, transmit, or store any personal data on external servers.
- **Everything on-device.** Video analysis runs entirely on the user's device using on-device AI models (MediaPipe via WebAssembly). No video frames are ever uploaded.
- **No account required.** No email, phone number, or identity is collected at any point.
- **Local storage only.** Workout history and preferences are stored in the browser's IndexedDB on the user's device and never synced externally.
- **No analytics, no ads, no tracking.** No third-party SDKs that collect behavioral data are included.
- **Crash reporting.** If crash reporting is added in future, this section must be updated and consent obtained.
- **Payment data.** Subscription payments are processed by Stripe or Apple/Google. WorkoutVision never sees raw payment card data.

App Store Connect Privacy Nutrition Labels to declare:

- Data Not Collected (select if no analytics SDK is added)
- If RevenueCat is added: declare "Purchases" under "Financial Info" — "Used to Track You: No"

Host the privacy policy at a stable public URL (e.g., `https://yoursite.com/privacy`) and link it in App Store Connect and in the app's Profile or Settings screen.

---

## 6. Pre-submission checklist

- [ ] Bundle identifier set and unique (e.g., `com.yourcompany.workoutvision`)
- [ ] Version and build number incremented
- [ ] Icons exported at all required sizes, no alpha channel on iOS
- [ ] Screenshots captured on real device or Simulator at correct resolutions
- [ ] App tested on iOS 16+ and Android 10+
- [ ] Camera permission usage description added to Info.plist: "WorkoutVision uses the camera to record workout videos for on-device pose analysis."
- [ ] Photo Library permission added if video picker is used: "WorkoutVision reads video files from your library for on-device analysis. No video is uploaded."
- [ ] StoreKit sandbox tested end-to-end (purchase, restore, expiry)
- [ ] Privacy policy URL live and accessible
- [ ] Age rating completed (likely 4+ or 12+)
- [ ] Export compliance: MediaPipe uses no encryption — select "No" on export compliance questions
- [ ] App Review notes drafted (explain that camera/video access is processed on-device only)
