const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[2] || root);
const envFile = path.join(root, '.env.local');

if (fs.existsSync(envFile)) {
  const contents = fs.readFileSync(envFile, 'utf8');
  contents.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]] !== undefined) return;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  });
}

const fields = {
  apiKey: 'FIREBASE_API_KEY',
  authDomain: 'FIREBASE_AUTH_DOMAIN',
  projectId: 'FIREBASE_PROJECT_ID',
  storageBucket: 'FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'FIREBASE_MESSAGING_SENDER_ID',
  appId: 'FIREBASE_APP_ID',
  measurementId: 'FIREBASE_MEASUREMENT_ID'
};
const config = {};
const missing = [];

Object.entries(fields).forEach(([field, envName]) => {
  const value = process.env[envName];
  if (field !== 'measurementId' && !value) missing.push(envName);
  if (value) config[field] = value;
});

if (missing.length) {
  console.error('Missing Firebase configuration values: ' + missing.join(', '));
  process.exit(1);
}

const siteFiles = [
  'index.html',
  'manifest.json',
  'service-worker.js',
  'abclogo.svg',
  'app-icon-180.png',
  'app-icon-192.png',
  'app-icon-512.png',
  'QR.PNG'
];

fs.mkdirSync(output, { recursive: true });
siteFiles.forEach(file => {
  const source = path.join(root, file);
  const destination = path.join(output, file);
  if (path.resolve(source) !== path.resolve(destination)) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
});

fs.writeFileSync(
  path.join(output, 'firebase-config.js'),
  'window.FIREBASE_CONFIG = ' + JSON.stringify(config) + ';\n',
  { mode: 0o600 }
);
console.log('Built site files with Firebase config for project "' + config.projectId + '".');
