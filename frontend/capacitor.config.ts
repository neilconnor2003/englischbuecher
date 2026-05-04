
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.englischbuecher.app',
  appName: 'EnglischBuecher',
  webDir: 'dist',
  //bundledWebRuntime: false,
  server: {
    url: 'https://www.englischbuecher.de',
    cleartext: false
  }
};

export default config;
