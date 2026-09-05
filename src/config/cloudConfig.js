// Centralized Cloud Backend Configuration for Prasobh's Gallery
// Configure your Supabase or Firebase credentials below.
// If left as default, the built-in serverless cloud storage will be used automatically.

export const CLOUD_CONFIG = {
  // Option 1: Supabase Configuration (Optional - Paste your project details here)
  supabase: {
    enabled: false, // Set to true once you fill in your Supabase details
    url: 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co',
    anonKey: 'YOUR_SUPABASE_ANON_PUBLIC_KEY',
    storageBucket: 'gallery-photos', // Name of your Supabase Storage bucket
    albumsTable: 'albums',
    mediaTable: 'media'
  },

  // Option 2: Firebase Configuration (Optional - Paste your Firebase details here)
  firebase: {
    enabled: false, // Set to true once you fill in your Firebase details
    apiKey: 'YOUR_FIREBASE_API_KEY',
    authDomain: 'YOUR_FIREBASE_PROJECT.firebaseapp.com',
    projectId: 'YOUR_FIREBASE_PROJECT_ID',
    storageBucket: 'YOUR_FIREBASE_PROJECT.appspot.com',
    messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
    appId: 'YOUR_FIREBASE_APP_ID'
  },

  // Built-in High-Performance Serverless Cloud Backend (Active by Default)
  serverless: {
    syncEndpoint: '/api/sync',
    uploadEndpoint: '/api/upload',
    cloudVaultId: 'bdbddaa'
  }
};

export default CLOUD_CONFIG;
