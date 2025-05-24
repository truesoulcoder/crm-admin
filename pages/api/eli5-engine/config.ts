// Shared configuration for Chromium and other settings

// Chromium arguments for serverless environments
export const CHROMIUM_ARGS: string[] = [
  '--disable-dev-shm-usage',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-gpu',
  '--single-process',
  '--no-zygote',
  '--disable-accelerated-2d-canvas',
  '--disable-dev-profile',
  '--no-first-run',
  '--no-zygote-sandbox',
  '--disable-notifications',
  '--disable-web-security',
  '--disable-extensions'
];

// Default Chrome/Chromium paths
export const getChromePath = () => 
  process.env.CHROME_PATH || 
  (process.platform === 'win32' 
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' 
    : '/usr/bin/google-chrome');
