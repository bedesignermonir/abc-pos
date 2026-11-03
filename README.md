# ABC COMPUTER - Multi-Tenant Cloud POS System

A production-ready, Multi-Tenant Point of Sale (POS) and Financial Ledger application for **ABC COMPUTER**, refactored from legacy Google Apps Script / Google Sheets to **Google Firebase** (Cloud Firestore & Firebase Google Authentication).

---

## 🚀 Key Upgrades & Features

1. **Multi-Tenant Cloud Data Architecture:**
   - Isolated merchant accounts: Every merchant or store owner authenticates securely with their own Google account.
   - Complete partition of business records under the authenticated user's UID (`users/{user_uid}/`):
     - `users/{user_uid}/sales/` (Invoices & Billing)
     - `users/{user_uid}/expenses/` (Expense Records & Source Deductions)
     - `users/{user_uid}/creditors/` (Creditors, Borrowings & Dues)
     - `users/{user_uid}/cash_register/` (Daily Cash Denominations & MFS/Bank Balances)
     - `users/{user_uid}/settings/doc` (Preset items, pricing catalog, expense categories)

2. **Zero-Trust Multi-Tenant Security Rules (`firestore.rules`):**
   - Strictly enforced Firestore security rules ensure that users can only read and write their own documents under `/users/$(request.auth.uid)`.

3. **Dynamic Net Assets & Real-Time Financials:**
   - Computes: `(Total Liquid Cash + Digital Balances) - Total Creditor Due`.
   - Real-time Firestore snapshot listeners for instant multi-device synchronization.
   - Full offline support with Firestore offline persistence.

4. **100% UI & Feature Parity Preserved:**
   - Responsive Bengali POS interface, custom thermal printing, WhatsApp invoice sharing (`wa.me` & native intent), daily cash register, and global date period filtering.

---

## 🔑 Firebase Configuration

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDhcpQ8qv9110uYVHqXa4o1hiimgmzzegU",
  authDomain: "gen-lang-client-0772095030.firebaseapp.com",
  projectId: "gen-lang-client-0772095030",
  storageBucket: "gen-lang-client-0772095030.firebasestorage.app",
  messagingSenderId: "362558772104",
  appId: "1:362558772104:web:abcpos"
};
```

### Google Authentication setup

In Firebase Console, open **Authentication → Settings → Authorized domains** and add the HTTPS domain used to access the web app. The APK currently loads its UI from `file:///android_asset/index.html`; a `file://` origin cannot be added as an authorized domain, and redirect sign-in cannot make that origin valid. The APK therefore keeps local POS use available and explains that Google sign-in requires either an HTTPS-hosted app opened in a supported browser or a separately configured native Android Google Sign-In integration. On authorized HTTPS origins, the web app falls back from popup to redirect when the popup is blocked, unsupported, or reports an unauthorized domain.

---

## 🛡️ Firestore Security Rules (`firestore.rules`)

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Multi-tenant isolation: Each merchant's data is strictly partitioned by their authenticated Google UID.
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /sales/{saleId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /expenses/{expenseId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /creditors/{creditorId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /cash_register/{cashId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /settings/{settingId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

---

## 📱 Platforms Supported

- **Web & PWA**: Run directly in modern web browsers or install as a Progressive Web App (PWA).
- **Android APK**: Native Android application wrapper with hardware accelerated WebView, system PrintManager integration, and WhatsApp intent dispatch.

Pushes to `main` build a debug APK with GitHub Actions and publish it as a prerelease on GitHub Releases.
