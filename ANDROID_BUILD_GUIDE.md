# Pilates Passport — Android TWA Build Guide

This app uses a **Trusted Web Activity (TWA)** — Chrome displays your Netlify
web app inside a native Android shell. Google Play accepts these apps fully.

---

## Prerequisites (install once)

1. **Android Studio** → download from https://developer.android.com/studio
2. **Java JDK 17** → bundled with Android Studio (use its built-in JDK)
3. Your app must be live at `https://pilatespassport.netlify.app`

---

## Step 1 — Open the project in Android Studio

1. Open Android Studio
2. Click **"Open"** → navigate to the `android/` folder inside this project
3. Let Gradle sync finish (takes ~2 minutes first time)

---

## Step 2 — Generate your signing keystore (do this once)

You need a keystore to sign your APK for Google Play.

In Android Studio → **Build → Generate Signed Bundle/APK**:
1. Choose **Android App Bundle (.aab)** → Next
2. Click **Create new keystore**
3. Fill in:
   - **Key store path:** choose a safe location (e.g. `~/pilates-passport.jks`)
   - **Password:** choose a strong password — **SAVE THIS, you can never recover it**
   - **Key alias:** `pilatespassport`
   - **Key password:** same or different strong password
   - **Validity:** 25 years
   - **First and Last Name:** your name
   - **Organization:** Pilates Passport
   - **Country Code:** US
4. Click OK → Next → choose **release** → Finish

---

## Step 3 — Get your SHA-256 fingerprint

After creating the keystore, get the SHA-256 fingerprint:

```bash
keytool -list -v -keystore ~/pilates-passport.jks -alias pilatespassport
```

Copy the **SHA-256** line — it looks like:
```
AB:CD:12:34:...
```

---

## Step 4 — Update assetlinks.json

Open `public/.well-known/assetlinks.json` and replace:
```
"REPLACE_WITH_YOUR_SHA256_FINGERPRINT"
```
with your actual fingerprint (keep the quotes, remove the colons):
```
"ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234"
```

Then push to GitHub so it deploys to Netlify:
```bash
git add public/.well-known/assetlinks.json
git commit -m "Add Digital Asset Links for TWA"
git push
```

Verify it's live at:
https://pilatespassport.netlify.app/.well-known/assetlinks.json

---

## Step 5 — Build the release AAB

In Android Studio:
1. **Build → Generate Signed Bundle/APK**
2. Choose **Android App Bundle**
3. Select your keystore → enter passwords → Next
4. Choose **release** → **Finish**

The `.aab` file will be at:
```
android/app/release/app-release.aab
```

---

## Step 6 — Upload to Google Play

1. Go to https://play.google.com/console
2. Create a new app → **"Pilates Passport"**
3. Fill in store listing:
   - **Short description:** Log every Pilates class. Discover studios worldwide.
   - **Full description:** Your Pilates practice, beautifully documented. Track classes, discover studios, earn badges, and connect with the global Pilates community.
   - **Category:** Health & Fitness
   - **Icon:** use `android/store_assets/icon_512.png`
4. Go to **Production → Create new release**
5. Upload your `app-release.aab`
6. Submit for review

Google typically reviews in 3-7 days.

---

## Important: TWA verification

For the TWA to work without showing the browser URL bar, your
`assetlinks.json` must be:
- Served at exactly: `https://pilatespassport.netlify.app/.well-known/assetlinks.json`
- Content-Type: `application/json`
- Contains your exact SHA-256 fingerprint

Test with Google's tool:
https://developers.google.com/digital-asset-links/tools/generator

---

## Package name
`com.pilatespassport.app`

This is your permanent app identifier — it cannot be changed after publishing.

---

## Troubleshooting

**"URL bar is visible in the app"**
→ assetlinks.json fingerprint doesn't match your keystore. Re-check Step 4.

**"App crashes on launch"**
→ Make sure `https://pilatespassport.netlify.app` is live and loading correctly.

**"Gradle sync failed"**
→ Go to File → Project Structure → SDK Location → make sure Android SDK path is set.
