import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type JsonObject = Record<string, unknown>;

class UpdatePublicationError extends Error {}

const projectRoot = process.cwd();
const manifestPath = 'android/app/src/main/AndroidManifest.xml';
const stringsPath = 'android/app/src/main/res/values/strings.xml';

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function object(value: unknown, label: string): JsonObject {
  if (!isObject(value)) {
    throw new UpdatePublicationError(`${label} must be an object.`);
  }
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new UpdatePublicationError(`${label} must be a nonempty string.`);
  }
  return value;
}

function json(source: string, label: string): JsonObject {
  try {
    return object(JSON.parse(source), label);
  } catch {
    throw new UpdatePublicationError(`${label} must contain a JSON object.`);
  }
}

function read(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), 'utf8');
}

function git(argumentsList: string[]): string {
  return execFileSync('git', argumentsList, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function same(actual: unknown, expected: unknown, label: string): void {
  if (!isDeepStrictEqual(actual, expected)) {
    throw new UpdatePublicationError(`${label} differs from the installed Android runtime. Build and distribute a new APK before publishing this change.`);
  }
}

function decodeXml(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function attributes(tag: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const match of tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    const name = match[1];
    if (result.has(name)) {
      throw new UpdatePublicationError(`Duplicate XML attribute ${name}.`);
    }
    result.set(name, decodeXml(match[2] ?? match[3]));
  }
  return result;
}

function nativeMetadata(manifest: string, name: string): string {
  const matches: string[] = [];
  for (const tag of manifest.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<meta-data\b[^>]*>/g)) {
    const values = attributes(tag[0]);
    if (values.get('android:name') === `expo.modules.updates.${name}`) {
      matches.push(text(values.get('android:value'), `Android metadata ${name}`));
    }
  }
  if (matches.length !== 1) {
    throw new UpdatePublicationError(`Android metadata ${name} must appear exactly once.`);
  }
  return matches[0];
}

function nativeRuntime(manifest: string, strings: string): string {
  const runtime = nativeMetadata(manifest, 'EXPO_RUNTIME_VERSION');
  if (!runtime.startsWith('@string/')) return runtime;
  const name = runtime.slice('@string/'.length);
  const matches: string[] = [];
  for (const entry of strings.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<string\b([^>]*)>([^<]*)<\/string>/g)) {
    if (attributes(entry[1]).get('name') === name) matches.push(decodeXml(entry[2]));
  }
  if (matches.length !== 1) {
    throw new UpdatePublicationError(`Android runtime string ${name} must appear exactly once.`);
  }
  return matches[0];
}

function verifyNativeConfiguration(expo: JsonObject, manifest: string, strings: string): void {
  const updates = object(expo.updates, 'expo.updates');
  same(updates.enabled ?? true, true, 'expo.updates.enabled');
  same(nativeMetadata(manifest, 'ENABLED'), 'true', 'Android updates enabled flag');
  same(nativeMetadata(manifest, 'EXPO_UPDATE_URL'), updates.url, 'Android update URL');
  same(nativeRuntime(manifest, strings), expo.runtimeVersion, 'Android runtime version');
  same(json(nativeMetadata(manifest, 'UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY'), 'Android update headers'),
    object(updates.requestHeaders, 'expo.updates.requestHeaders'), 'Android update request headers');
}

function verifyEnvironment(updates: JsonObject, runtimeVersion: string, channel: string): void {
  const expectedValues: Record<string, string> = {
    EXPO_UPDATES_URL: text(updates.url, 'expo.updates.url'),
    EXPO_UPDATES_ENABLED: 'true',
    EXPO_RUNTIME_VERSION: runtimeVersion,
    EXPO_UPDATES_RUNTIME_VERSION: runtimeVersion,
    EXPO_UPDATE_CHANNEL: channel,
  };
  for (const [name, expected] of Object.entries(expectedValues)) {
    if (process.env[name] !== undefined && process.env[name] !== expected) {
      throw new UpdatePublicationError(`${name} conflicts with the installed Android configuration. Remove the override.`);
    }
  }
  if (process.env.EXPO_UPDATES_REQUEST_HEADERS !== undefined) {
    same(json(process.env.EXPO_UPDATES_REQUEST_HEADERS, 'EXPO_UPDATES_REQUEST_HEADERS'),
      updates.requestHeaders, 'EXPO_UPDATES_REQUEST_HEADERS');
  }
}

function validate(): void {
  if (process.argv.slice(2).some((argument) => argument !== '--native-build')) {
    throw new UpdatePublicationError('Only --native-build is supported. Omit it when publishing an OTA update.');
  }
  const nativeBuild = process.argv.includes('--native-build');
  const production = json(read('updates/production.json'), 'updates/production.json');
  same(production.systemVersion, 1, 'Publication configuration schema');
  same(production.platform, 'android', 'Publication platform');
  const nativeSourceRef = text(production.nativeSourceRef, 'nativeSourceRef');
  const nativeSourceCommit = text(production.nativeSourceCommit, 'nativeSourceCommit');
  const channel = text(production.channel, 'channel');
  if (!/^[\da-f]{40}$/.test(nativeSourceCommit) || nativeSourceRef.startsWith('-')) {
    throw new UpdatePublicationError('The native baseline must name a Git ref and its full commit hash.');
  }

  for (const filename of ['app.config.js', 'app.config.ts']) {
    if (existsSync(resolve(projectRoot, filename))) {
      throw new UpdatePublicationError(`Dynamic ${filename} is not supported by the production publication guard. Keep the installed configuration in app.json.`);
    }
  }

  const expo = object(json(read('app.json'), 'app.json').expo, 'expo');
  const runtimeVersion = text(expo.runtimeVersion, 'expo.runtimeVersion');
  const updates = object(expo.updates, 'expo.updates');
  const updateUrl = text(updates.url, 'expo.updates.url');
  const projectId = text(object(object(expo.extra, 'expo.extra').eas, 'expo.extra.eas').projectId, 'EAS project ID');
  same(updateUrl, `https://u.expo.dev/${projectId}`, 'EAS Update URL');
  if (!nativeBuild) same(runtimeVersion, production.runtimeVersion, 'Publication runtime version');
  same(object(updates.requestHeaders, 'expo.updates.requestHeaders')['expo-channel-name'], channel, 'Publication channel');
  const eas = json(read('eas.json'), 'eas.json');
  same(object(object(eas.build, 'eas.build').production, 'eas.build.production').channel, channel, 'EAS build channel');
  verifyNativeConfiguration(expo, read(manifestPath), read(stringsPath));
  verifyEnvironment(updates, runtimeVersion, channel);

  if (nativeBuild) {
    console.log(`Android build configuration verified (runtime ${runtimeVersion}). After distributing the APK, pin its release tag, commit, and runtime in updates/production.json before publishing OTA updates.`);
    return;
  }

  same(git(['rev-parse', '--verify', `${nativeSourceRef}^{commit}`]).trim(), nativeSourceCommit, 'Native source tag');

  const baselineExpo = object(json(git(['show', `${nativeSourceCommit}:app.json`]), 'Baseline app.json').expo, 'Baseline expo');
  verifyNativeConfiguration(baselineExpo, git(['show', `${nativeSourceCommit}:${manifestPath}`]), git(['show', `${nativeSourceCommit}:${stringsPath}`]));
  same(baselineExpo.runtimeVersion, runtimeVersion, 'Native baseline runtime version');
  same(expo, baselineExpo, 'app.json');
  const currentPackage = json(read('package.json'), 'package.json');
  const baselinePackage = json(git(['show', `${nativeSourceCommit}:package.json`]), 'Baseline package.json');
  same(object(currentPackage.dependencies, 'package.dependencies'), object(baselinePackage.dependencies, 'Baseline dependencies'), 'Runtime dependencies');
  same(json(read('package-lock.json'), 'package-lock.json'), json(git(['show', `${nativeSourceCommit}:package-lock.json`]), 'Baseline package-lock.json'), 'Locked dependencies');

  const nativeChanges = git(['diff', '--name-only', '-z', nativeSourceCommit, '--', 'android']).split('\0').filter(Boolean);
  const untrackedNative = git(['ls-files', '--others', '--exclude-standard', '-z', '--', 'android']).split('\0').filter(Boolean);
  if (nativeChanges.length || untrackedNative.length) {
    throw new UpdatePublicationError(`Native Android files changed: ${[...nativeChanges, ...untrackedNative].join(', ')}. Build and distribute a new APK with a new runtime version first.`);
  }
  console.log(`Production OTA configuration verified (${production.platform}, ${channel}, runtime ${runtimeVersion}).`);
}

try {
  validate();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Production update validation failed.');
  process.exitCode = 1;
}
