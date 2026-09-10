import { PermissionsAndroid, Platform } from 'react-native';

export type AndroidStepCounterPermissionStatus = {
  isActivityRecognitionGranted: boolean;
  isNotificationGranted: boolean;
};

const androidActivityRecognitionSdkVersion = 29;
const androidNotificationPermissionSdkVersion = 33;

type AndroidPermission = Parameters<typeof PermissionsAndroid.check>[0];

const getAndroidSdkVersion = (): number => {
  if (Platform.OS !== 'android') {
    throw new Error('Android step counter permissions can only be requested on Android.');
  }

  const sdkVersion = typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);

  if (!Number.isFinite(sdkVersion)) {
    throw new Error('Android SDK version is unavailable.');
  }

  return sdkVersion;
};

const requestPermissionIfNeeded = async (permission: AndroidPermission): Promise<boolean> => {
  const isAlreadyGranted = await PermissionsAndroid.check(permission);

  if (isAlreadyGranted) {
    return true;
  }

  const permissionResult = await PermissionsAndroid.request(permission);
  return permissionResult === PermissionsAndroid.RESULTS.GRANTED;
};

export const requestAndroidStepCounterPermissions = async (): Promise<AndroidStepCounterPermissionStatus> => {
  const androidSdkVersion = getAndroidSdkVersion();
  const isActivityRecognitionGranted = androidSdkVersion < androidActivityRecognitionSdkVersion
    ? true
    : await requestPermissionIfNeeded(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION);

  if (!isActivityRecognitionGranted) {
    return {
      isActivityRecognitionGranted: false,
      isNotificationGranted: androidSdkVersion < androidNotificationPermissionSdkVersion,
    };
  }

  const isNotificationGranted = androidSdkVersion < androidNotificationPermissionSdkVersion
    ? true
    : await requestPermissionIfNeeded(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);

  return {
    isActivityRecognitionGranted,
    isNotificationGranted,
  };
};
