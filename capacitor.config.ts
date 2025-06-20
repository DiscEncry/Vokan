import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'vokan.vercel.app',
  appName: 'Vokan',
  webDir: 'public',
  server: {
    url: 'https://vokan.vercel.app', // Replace with your actual Vercel deployment URL
    cleartext: true
  },
  plugins: {
    FirebaseAuthentication: {
      providers: ["google.com"]
    }
  }
};

export default config;
