import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.englischbuecher.app',
  appName: 'EnglischBücher',
  webDir: 'dist',
  server: {
    url: 'https://englischbuecher.de',  // loads live website
    cleartext: false,
  },
  android: {
    backgroundColor: '#f6f3ff',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false, // set true during dev
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: '#f6f3ff',
      showSpinner: false,
    },
  },
};

export default config;
