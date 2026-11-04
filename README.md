# এবিসি কম্পিউটার পস

## অ্যাপ সম্পর্কে

এবিসি কম্পিউটার পস (ABC Computer POS) একটি ক্লাউড-বেসড মাল্টি-টেন্যান্ট হিসাব রক্ষণ সফটওয়্যার। বিক্রয়, খরচ, দেনা-পাওনা ও ব্যবসার হিসাব সহজে পরিচালনা করুন এবং আপনার গুগল অ্যাকাউন্ট দিয়ে সাইন ইন করে ক্লাউডে ডেটা সিঙ্ক করুন।

## ব্যবহার ও ইনস্টল করার নির্দেশিকা

১. আপনার মোবাইলের গুগল ক্রোম (Google Chrome) ব্রাউজারে এই লিংকে প্রবেশ করুন: https://bedesignermonir.github.io/abc-pos/

২. আপনার জিমেইল অ্যাকাউন্ট দিয়ে খুব সহজে লগইন করুন। আপনার ডেটা আপনার অ্যাকাউন্টের অধীনে ক্লাউডে সংরক্ষিত ও সিঙ্ক হবে।

৩. ব্রাউজারের ওপরের থ্রি-ডট (...) মেনু থেকে **“Add to Home Screen”** বা **“Install App”** অপশনে ক্লিক করুন। ব্যস! এটি আপনার ফোনের হোম স্ক্রিনে একটি অ্যাপের মতো ইনস্টল হয়ে যাবে।

আইফোন বা আইপ্যাডে Safari ব্যবহার করলে **Share** মেনু থেকে **“Add to Home Screen”** নির্বাচন করুন।

## Firebase কনফিগারেশন

Firebase Web config ব্রাউজারে ব্যবহারের জন্য তৈরি এবং প্রকাশিত JavaScript-এ দেখা যাবে; `.env.local` বা GitHub Actions secrets কেবল কনফিগারেশনটি source control-এ না রাখার জন্য, browser থেকে গোপন করার জন্য নয়। নিরাপত্তার জন্য Firebase/Google Cloud Console-এ API key-তে website referrer ও API restrictions দিন এবং Firestore Security Rules ঠিক রাখুন।

স্থানীয়ভাবে চালাতে `.env.example` কপি করে `.env.local` তৈরি করুন, Firebase Web App-এর মানগুলো পূরণ করুন, তারপর চালান:

```sh
node scripts/build-site.js .
```

GitHub Pages-এর জন্য repository **Settings → Secrets and variables → Actions**-এ `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`, এবং `FIREBASE_MEASUREMENT_ID` secrets যোগ করুন। এরপর **Settings → Pages → Build and deployment → Source**-এ **GitHub Actions** নির্বাচন করুন। `main` branch-এ push হলে workflow কনফিগারেশনসহ site তৈরি ও deploy করবে। প্রকাশিত `firebase-config.js`-এ config থাকবে—এটি Firebase Web SDK-এর স্বাভাবিক আচরণ।

## সুবিধাসমূহ

- বিক্রয়, খরচ, ক্যাশ/ব্যালেন্স, পাওনাদার এবং ড্যাশবোর্ডের জন্য আলাদা ট্যাব।
- প্রোফাইল মেনু থেকে Firebase সিঙ্কের অবস্থা দেখা ও ম্যানুয়ালি সিঙ্ক করা।
- বিক্রয় চালান তৈরি, সম্পাদনা ও প্রিন্ট করা।
- বিক্রয়, খরচ, নগদ টাকা এবং দেনা-পাওনার হিসাব রাখা।
- পণ্য, মূল্য ও ব্যবসার তথ্য পরিচালনা করা।
- WhatsApp-এ চালান শেয়ার করা।
- ইন্টারনেট সংযোগ না থাকলেও অ্যাপ খোলা এবং স্থানীয় ডেটা ব্যবহার করা।
- গুগল অ্যাকাউন্ট দিয়ে সাইন ইন করে একাধিক ডিভাইসে ক্লাউড ডেটা সিঙ্ক করা।
