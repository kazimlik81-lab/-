import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Pedometer } from 'expo-sensors';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, PermissionsAndroid, Platform, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  appUpdateCheckIntervalMilliseconds,
  defaultSettings,
  designVariantOptions,
  historyPeriodOptions,
  languageOptions,
  slideOptions,
  statusBarStyleByDesignVariant,
  timeFormatOptions,
  themeColorsByDesignVariant,
} from 'src/pedometer/constants';
import type { ThemeColors } from 'src/pedometer/constants';
import {
  ActionButton,
  ChoiceGroup,
  HistoryChart,
  MetricCard,
  SegmentControl,
  SettingsField,
} from 'src/pedometer/components';
import { synchronizeAppUpdates } from 'src/pedometer/app-updates';
import { FoodCameraSlide } from 'src/pedometer/food-camera';
import { formatDate, formatDecimal, formatInteger, formatTime } from 'src/pedometer/formatting';
import { calculateWalkingMetrics, createDailyRecord, getDateKey, getHistoryPoints, getHistorySummary, getStartOfDay } from 'src/pedometer/history';
import {
  getAndroidNativeStepCounterStatus,
  isAndroidNativeStepCounterAvailable,
  startAndroidNativeStepCounter,
} from 'src/pedometer/native-step-counter';
import { createSettingsDraft, parseSettingsDraft } from 'src/pedometer/settings';
import { clearRecords, loadRecords, loadSettings, saveRecord, saveSettings as saveSettingsToStorage } from 'src/pedometer/storage';
import { getDeviceTimeZone } from 'src/pedometer/time-zone';
import { TodayTrailWidget } from 'src/pedometer/today-trail-widget';
import type { AppSettings, DesignVariant, HistoryPeriod, RecordsByDateKey, SettingsDraft, TrackingStatus, ViewMode } from 'src/pedometer/types';

const getStatusMessage = (trackingStatus: TrackingStatus): string => {
  switch (trackingStatus) {
    case 'available':
      return Platform.OS === 'android'
        ? 'Фоновый Android-сервис активен. Шаги считаются датчиком телефона.'
        : 'Датчик активен. Шаги за сегодня обновляются через системный датчик.';
    case 'permission-denied':
      return 'Разрешите доступ к движению/фитнесу, чтобы приложение считало шаги.';
    case 'unavailable':
      return 'Датчик шагов недоступен здесь. В браузере это preview, на телефоне работает через Android APK.';
    case 'error':
      return 'Шагомер остановлен из-за ошибки.';
    case 'checking':
      return 'Проверяю датчик шагов...';
  }
};

export default function App() {
  const subscriptionReference = useRef<{ remove: () => void } | null>(null);
  const androidPollingIntervalReference = useRef<ReturnType<typeof setInterval> | null>(null);
  const baseStepCountReference = useRef(0);
  const refreshPromiseReference = useRef<Promise<void> | null>(null);
  const recordsReference = useRef<RecordsByDateKey>({});
  const settingsReference = useRef<AppSettings>(defaultSettings);

  const [selectedViewMode, setSelectedViewMode] = useState<ViewMode>('today');
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>('week');
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>(() => createSettingsDraft(defaultSettings));
  const [recordsByDateKey, setRecordsByDateKey] = useState<RecordsByDateKey>({});
  const [todaySteps, setTodaySteps] = useState(0);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>('checking');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const themeColors = useMemo(() => themeColorsByDesignVariant[settings.designVariant], [settings.designVariant]);
  const appStyles = useMemo(() => createAppStyles(themeColors), [themeColors]);

  useEffect(() => {
    recordsReference.current = recordsByDateKey;
  }, [recordsByDateKey]);

  useEffect(() => {
    settingsReference.current = settings;
  }, [settings]);

  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timerId);
  }, []);

  const walkingMetrics = useMemo(() => calculateWalkingMetrics(todaySteps, settings), [settings, todaySteps]);
  const historyPoints = useMemo(
    () => getHistoryPoints(historyPeriod, recordsByDateKey, settings),
    [historyPeriod, recordsByDateKey, settings],
  );
  const weekHistoryPoints = useMemo(
    () => getHistoryPoints('week', recordsByDateKey, settings),
    [recordsByDateKey, settings],
  );
  const historySummary = useMemo(() => getHistorySummary(historyPoints), [historyPoints]);

  const stopTracking = useCallback((): void => {
    subscriptionReference.current?.remove();
    subscriptionReference.current = null;

    if (androidPollingIntervalReference.current) {
      clearInterval(androidPollingIntervalReference.current);
      androidPollingIntervalReference.current = null;
    }
  }, []);

  const persistToday = useCallback(async (steps: number, activeSettings = settingsReference.current): Promise<void> => {
    const record = createDailyRecord(steps, activeSettings);
    const nextRecords = await saveRecord(recordsReference.current, record);
    recordsReference.current = nextRecords;
    setRecordsByDateKey(nextRecords);
  }, []);

  const startTracking = useCallback(
    async (activeSettings: AppSettings, activeRecords: RecordsByDateKey): Promise<void> => {
      stopTracking();
      setTrackingStatus('checking');
      setErrorMessage(null);

      if (Platform.OS === 'web') {
        setTrackingStatus('unavailable');
        setErrorMessage('В браузере нет датчика шагов. Для реального подсчета установите Android APK на телефон.');
        return;
      }

      if (isAndroidNativeStepCounterAvailable()) {
        const activityPermission = await PermissionsAndroid.request('android.permission.ACTIVITY_RECOGNITION');

        if (activityPermission !== PermissionsAndroid.RESULTS.GRANTED) {
          setTrackingStatus('permission-denied');
          return;
        }

        const androidVersion = typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);

        if (androidVersion >= 33) {
          await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS');
        }

        const syncNativeSteps = async (): Promise<void> => {
          try {
            let status = await getAndroidNativeStepCounterStatus();

            if (!status.isSensorAvailable) {
              setTrackingStatus('unavailable');
              return;
            }

            if (!status.isRunning) {
              status = await startAndroidNativeStepCounter();
            }

            if (!status.isSensorAvailable) {
              setTrackingStatus('unavailable');
              return;
            }

            setTodaySteps(status.todaySteps);
            await persistToday(status.todaySteps, activeSettings);
            setTrackingStatus('available');
          } catch (error) {
            setTrackingStatus('error');
            setErrorMessage(error instanceof Error ? error.message : 'Не удалось синхронизировать шагомер.');
          }
        };

        const status = await startAndroidNativeStepCounter();

        if (!status.isSensorAvailable) {
          setTrackingStatus('unavailable');
          return;
        }

        setTodaySteps(status.todaySteps);
        await persistToday(status.todaySteps, activeSettings);
        androidPollingIntervalReference.current = setInterval(() => {
          void syncNativeSteps();
        }, 3000);
        setTrackingStatus('available');
        return;
      }

      const isAvailable = await Pedometer.isAvailableAsync();
      if (!isAvailable) {
        setTrackingStatus('unavailable');
        return;
      }

      const existingPermission = await Pedometer.getPermissionsAsync();
      const permission = existingPermission.granted ? existingPermission : await Pedometer.requestPermissionsAsync();
      if (!permission.granted) {
        setTrackingStatus('permission-denied');
        return;
      }

      const today = new Date();
      const todayKey = getDateKey(today);
      let baseStepCount = activeRecords[todayKey]?.steps ?? 0;

      if (Platform.OS === 'ios') {
        const result = await Pedometer.getStepCountAsync(getStartOfDay(today), today);
        baseStepCount = result.steps;
      }

      baseStepCountReference.current = baseStepCount;
      setTodaySteps(baseStepCount);
      await persistToday(baseStepCount, activeSettings);

      subscriptionReference.current = Pedometer.watchStepCount((result) => {
        const nextSteps = baseStepCountReference.current + result.steps;
        setTodaySteps(nextSteps);
        void persistToday(nextSteps, activeSettings);
      });

      setTrackingStatus('available');
    },
    [persistToday, stopTracking],
  );

  const refresh = useCallback(async (): Promise<void> => {
    if (refreshPromiseReference.current) {
      return await refreshPromiseReference.current;
    }

    const refreshPromise = (async (): Promise<void> => {
      setIsRefreshing(true);

      try {
        const loadedSettings = await loadSettings();
        const loadedRecords = await loadRecords();
        const todayKey = getDateKey(new Date());

        settingsReference.current = loadedSettings;
        recordsReference.current = loadedRecords;
        setSettings(loadedSettings);
        setSettingsDraft(createSettingsDraft(loadedSettings));
        setRecordsByDateKey(loadedRecords);
        setTodaySteps(loadedRecords[todayKey]?.steps ?? 0);
        await startTracking(loadedSettings, loadedRecords);
      } catch (error) {
        setTrackingStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Не удалось запустить шагомер.');
      } finally {
        setIsRefreshing(false);
        refreshPromiseReference.current = null;
      }
    })();

    refreshPromiseReference.current = refreshPromise;
    return await refreshPromise;
  }, [startTracking]);

  const synchronizeInstalledApp = useCallback(async (): Promise<void> => {
    const updateSynchronizationResult = await synchronizeAppUpdates();

    if (updateSynchronizationResult.status === 'error') {
      console.warn(updateSynchronizationResult.message);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void synchronizeInstalledApp();

    if (Platform.OS === 'web') {
      return () => {
        stopTracking();
      };
    }

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refresh();
        void synchronizeInstalledApp();
      }
    });
    const appUpdateInterval = setInterval(() => {
      void synchronizeInstalledApp();
    }, appUpdateCheckIntervalMilliseconds);

    return () => {
      stopTracking();
      appStateSubscription.remove();
      clearInterval(appUpdateInterval);
    };
  }, [refresh, stopTracking, synchronizeInstalledApp]);

  const saveSettings = async (): Promise<void> => {
    try {
      const nextSettings = parseSettingsDraft(settingsDraft);
      await saveSettingsToStorage(nextSettings);
      settingsReference.current = nextSettings;
      setSettings(nextSettings);
      setSettingsDraft(createSettingsDraft(nextSettings));
      await persistToday(todaySteps, nextSettings);
      setErrorMessage(null);
      setSelectedViewMode('today');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось сохранить настройки.');
      setSelectedViewMode('settings');
    }
  };

  const clearHistory = async (): Promise<void> => {
    await clearRecords();
    recordsReference.current = {};
    baseStepCountReference.current = 0;
    setRecordsByDateKey({});
    setTodaySteps(0);
    await refresh();
  };

  const selectDesignVariant = async (designVariant: DesignVariant): Promise<void> => {
    const nextSettings: AppSettings = {
      ...settingsReference.current,
      designVariant,
      timeZone: getDeviceTimeZone(),
    };

    settingsReference.current = nextSettings;
    setSettings(nextSettings);
    setSettingsDraft((previousDraft) => ({
      ...previousDraft,
      designVariant,
    }));

    try {
      await saveSettingsToStorage(nextSettings);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось сохранить дизайн.');
      setSelectedViewMode('settings');
    }
  };

  const renderTodaySlide = () => (
    <View style={appStyles.section}>
      <TodayTrailWidget
        currentTime={currentTime}
        formattedActiveMinutes={`${formatInteger(walkingMetrics.activeMinutes, settings)} мин`}
        formattedCalories={`${formatInteger(walkingMetrics.calories, settings)} ккал`}
        formattedDistance={`${formatDecimal(walkingMetrics.distanceKilometers, settings, 1)} км`}
        formattedGoalSteps={formatInteger(settings.dailyGoalSteps, settings)}
        formattedSteps={formatInteger(todaySteps, settings)}
        isRefreshing={isRefreshing}
        onRefresh={refresh}
        settings={settings}
        themeColors={themeColors}
        walkingMetrics={walkingMetrics}
        weekHistoryPoints={weekHistoryPoints}
      />
    </View>
  );

  const renderActivitySlide = () => (
    <View style={appStyles.section}>
      <View style={appStyles.infoPanel}>
        <View style={appStyles.infoHeader}>
          <Ionicons name="location" color={themeColors.primary} size={22} />
          <View style={appStyles.infoCopy}>
            <Text style={appStyles.sectionTitle}>Местное время</Text>
            <Text style={appStyles.sectionSubtitle}>
              {formatTime(currentTime, settings)} · {settings.timeZone}
            </Text>
          </View>
        </View>
        <View style={appStyles.statusLine}>
          <Ionicons
            name={trackingStatus === 'available' ? 'checkmark-circle' : 'alert-circle'}
            color={trackingStatus === 'available' ? themeColors.primary : themeColors.warning}
            size={20}
          />
          <Text style={appStyles.statusText}>{errorMessage ?? getStatusMessage(trackingStatus)}</Text>
        </View>
      </View>

      <View style={appStyles.metricGrid}>
        <MetricCard icon="walk" value={formatInteger(todaySteps, settings)} label="Текущий счетчик" themeColors={themeColors} />
        <MetricCard icon="analytics" value={`${historySummary.goalCompletionPercent}%`} label="План за период" themeColors={themeColors} tone="blue" />
      </View>
      <ActionButton icon="refresh" label={isRefreshing ? 'Синхронизация...' : 'Синхронизировать датчик'} onPress={refresh} themeColors={themeColors} disabled={isRefreshing} />
    </View>
  );

  const renderHistorySlide = () => (
    <View style={appStyles.section}>
      <View style={appStyles.sectionHeading}>
        <Text style={appStyles.sectionTitle}>История и статистика</Text>
        <Text style={appStyles.sectionSubtitle}>Выберите период: 3 дня, неделя, месяц или год.</Text>
      </View>
      <SegmentControl options={historyPeriodOptions} selectedValue={historyPeriod} onSelect={setHistoryPeriod} themeColors={themeColors} />
      <View style={appStyles.metricGrid}>
        <MetricCard icon="footsteps" value={formatInteger(historySummary.totalSteps, settings)} label="Всего шагов" themeColors={themeColors} />
        <MetricCard icon="trending-up" value={formatInteger(historySummary.averageSteps, settings)} label="Среднее" themeColors={themeColors} tone="blue" />
      </View>
      <View style={appStyles.metricGrid}>
        <MetricCard icon="trophy" value={formatInteger(historySummary.bestSteps, settings)} label="Лучший день" themeColors={themeColors} tone="warm" />
        <MetricCard icon="checkmark-done" value={`${historySummary.goalCompletionPercent}%`} label="Выполнение" themeColors={themeColors} />
      </View>
      <HistoryChart points={historyPoints} formatSteps={(steps) => formatInteger(steps, settings)} themeColors={themeColors} />
    </View>
  );

  const renderSettingsSlide = () => (
    <View style={appStyles.section}>
      <View style={appStyles.sectionHeading}>
        <Text style={appStyles.sectionTitle}>Настройки</Text>
        <Text style={appStyles.sectionSubtitle}>Настройте цель, язык, дизайн, формат времени и параметры шагомера.</Text>
      </View>
      <SettingsField
        keyboardType="number-pad"
        label="Цель на день"
        suffix="шагов"
        value={settingsDraft.dailyGoalSteps}
        themeColors={themeColors}
        onChangeText={(value) => setSettingsDraft({ ...settingsDraft, dailyGoalSteps: value })}
      />
      <SettingsField
        keyboardType="decimal-pad"
        label="Длина шага"
        suffix="см"
        value={settingsDraft.strideLengthCentimeters}
        themeColors={themeColors}
        onChangeText={(value) => setSettingsDraft({ ...settingsDraft, strideLengthCentimeters: value })}
      />
      <SettingsField
        keyboardType="decimal-pad"
        label="Вес"
        suffix="кг"
        value={settingsDraft.bodyWeightKilograms}
        themeColors={themeColors}
        onChangeText={(value) => setSettingsDraft({ ...settingsDraft, bodyWeightKilograms: value })}
      />
      <ChoiceGroup label="Язык" options={languageOptions} selectedValue={settingsDraft.languageCode} onSelect={(value) => setSettingsDraft({ ...settingsDraft, languageCode: value })} themeColors={themeColors} />
      <ChoiceGroup label="Дизайн" options={designVariantOptions} selectedValue={settingsDraft.designVariant} onSelect={(value) => { void selectDesignVariant(value); }} themeColors={themeColors} />
      <ChoiceGroup label="Формат времени" options={timeFormatOptions} selectedValue={settingsDraft.timeFormat} onSelect={(value) => setSettingsDraft({ ...settingsDraft, timeFormat: value })} themeColors={themeColors} />
      <ActionButton icon="save" label="Сохранить настройки" onPress={saveSettings} themeColors={themeColors} />
      <ActionButton icon="trash" label="Очистить историю" onPress={clearHistory} themeColors={themeColors} tone="neutral" />
    </View>
  );

  return (
    <SafeAreaView style={appStyles.safeArea}>
      <StatusBar style={statusBarStyleByDesignVariant[settings.designVariant]} />
      <View style={appStyles.contours}>
        <View style={[appStyles.contourLine, appStyles.contourLineTop]} />
        <View style={[appStyles.contourLine, appStyles.contourLineMiddle]} />
        <View style={[appStyles.contourLine, appStyles.contourLineBottom]} />
      </View>
      <ScrollView
        contentContainerStyle={appStyles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={themeColors.primary} colors={[themeColors.primary]} progressBackgroundColor={themeColors.surface} />}
      >
        <View style={appStyles.header}>
          <View style={appStyles.titleBlock}>
            <Text style={appStyles.title}>ШагРитм</Text>
            <Text style={appStyles.subtitle}>{formatDate(currentTime, settings)} · {formatTime(currentTime, settings)}</Text>
          </View>
          <View style={appStyles.statusPill}>
            <Ionicons
              name={trackingStatus === 'available' ? 'pulse' : 'warning'}
              size={18}
              color={trackingStatus === 'available' ? themeColors.primary : themeColors.warning}
            />
            <Text style={appStyles.statusPillText}>{trackingStatus === 'available' ? 'Датчик' : 'Статус'}</Text>
          </View>
        </View>

        <View style={[appStyles.banner, trackingStatus === 'available' ? appStyles.successBanner : trackingStatus === 'error' ? appStyles.errorBanner : appStyles.warningBanner]}>
          <Ionicons
            name={trackingStatus === 'available' ? 'checkmark-circle' : 'alert-circle'}
            size={22}
            color={trackingStatus === 'available' ? themeColors.primary : themeColors.warning}
          />
          <Text style={appStyles.bannerText}>{errorMessage ?? getStatusMessage(trackingStatus)}</Text>
        </View>

        <SegmentControl options={slideOptions} selectedValue={selectedViewMode} onSelect={setSelectedViewMode} themeColors={themeColors} />

        {selectedViewMode === 'today' ? renderTodaySlide() : null}
        {selectedViewMode === 'activity' ? renderActivitySlide() : null}
        {selectedViewMode === 'history' ? renderHistorySlide() : null}
        {selectedViewMode === 'food' ? <FoodCameraSlide settings={settings} themeColors={themeColors} /> : null}
        {selectedViewMode === 'settings' ? renderSettingsSlide() : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const createAppStyles = (themeColors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: themeColors.background,
    overflow: 'hidden',
  },
  contours: {
    bottom: 0,
    left: 0,
    opacity: 0.5,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  contourLine: {
    borderColor: themeColors.borderSubtle,
    borderRadius: 320,
    borderWidth: 1,
    height: 180,
    position: 'absolute',
    width: 720,
  },
  contourLineTop: {
    left: -120,
    top: 26,
    transform: [{ rotate: '-6deg' }],
  },
  contourLineMiddle: {
    right: -180,
    top: 230,
    transform: [{ rotate: '8deg' }],
  },
  contourLineBottom: {
    bottom: 40,
    left: -210,
    transform: [{ rotate: '-4deg' }],
  },
  content: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 430,
    padding: 20,
    paddingBottom: 36,
    width: '100%',
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  title: {
    color: themeColors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    color: themeColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textTransform: 'capitalize',
  },
  statusPill: {
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    borderColor: themeColors.borderSubtle,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 38,
    paddingHorizontal: 12,
    shadowColor: themeColors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 3,
  },
  statusPillText: {
    color: themeColors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  banner: {
    alignItems: 'flex-start',
    borderColor: themeColors.borderSubtle,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    shadowColor: themeColors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 4,
  },
  successBanner: {
    backgroundColor: themeColors.surface,
  },
  warningBanner: {
    backgroundColor: themeColors.surface,
  },
  errorBanner: {
    backgroundColor: themeColors.dangerMuted,
  },
  bannerText: {
    color: themeColors.textPrimary,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  section: {
    gap: 16,
  },
  sectionHeading: {
    gap: 6,
  },
  sectionTitle: {
    color: themeColors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: themeColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  hero: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.highlight,
    borderLeftWidth: 1,
    borderRadius: 22,
    borderTopWidth: 1,
    gap: 12,
    padding: 20,
    shadowColor: themeColors.shadow,
    shadowOffset: { width: 10, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 24,
    elevation: 9,
  },
  heroLabel: {
    color: themeColors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  stepsValue: {
    color: themeColors.primary,
    fontSize: 56,
    fontWeight: '900',
  },
  goalText: {
    color: themeColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  progressTrack: {
    backgroundColor: themeColors.surfaceInset,
    borderColor: themeColors.shadow,
    borderRadius: 10,
    borderWidth: 1,
    height: 14,
    overflow: 'hidden',
    shadowColor: themeColors.highlight,
    shadowOffset: { width: -3, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  progressFill: {
    backgroundColor: themeColors.primary,
    borderRadius: 9,
    height: '100%',
  },
  progressText: {
    color: themeColors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  infoPanel: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.borderSubtle,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
    padding: 16,
    shadowColor: themeColors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 4,
  },
  infoHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  infoCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  statusLine: {
    alignItems: 'flex-start',
    backgroundColor: themeColors.surfaceInset,
    borderColor: themeColors.borderSubtle,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    shadowColor: themeColors.highlight,
    shadowOffset: { width: -3, height: -3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  statusText: {
    color: themeColors.textPrimary,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
});
