const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const appConfigPath = path.join(projectRoot, 'app.json');
const rawAppConfig = fs.readFileSync(appConfigPath, 'utf8');
const appConfig = JSON.parse(rawAppConfig);

const configuredUpdateUrl = String(process.env.EXPO_UPDATES_URL || appConfig.expo?.updates?.url || '').trim();
const configuredRequestHeaders = appConfig.expo?.updates?.requestHeaders || {};
const configuredChannel = String(configuredRequestHeaders['expo-channel-name'] || process.env.EXPO_UPDATE_CHANNEL || '').trim();

if (!configuredUpdateUrl) {
  console.error(
    [
      'EAS Update URL is not configured.',
      'Run `npx eas-cli login` and `npm run updates:configure`, or set EXPO_UPDATES_URL before a production build/update.',
      'Without this URL, installed Android APKs cannot receive OTA JavaScript/assets updates.',
    ].join('\n'),
  );
  process.exit(1);
}

let parsedUpdateUrl;

try {
  parsedUpdateUrl = new URL(configuredUpdateUrl);
} catch (error) {
  console.error('EXPO_UPDATES_URL / expo.updates.url must be a valid URL.');
  process.exit(1);
}

if (parsedUpdateUrl.protocol !== 'https:') {
  console.error('EXPO_UPDATES_URL / expo.updates.url must use https for production updates.');
  process.exit(1);
}

if (!configuredChannel) {
  console.error('expo.updates.requestHeaders["expo-channel-name"] must be configured for the production update channel.');
  process.exit(1);
}
