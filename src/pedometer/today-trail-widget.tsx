import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { localeByLanguageCode, type ThemeColors } from 'src/pedometer/constants';
import type { AppSettings, HistoryPoint, WalkingMetrics } from 'src/pedometer/types';

const ringDotCount = 64;
const ringSize = 220;
const ringCenter = ringSize / 2;
const ringRadius = 94;
const ringDotSize = 5;
const markerSize = 18;

type TodayTrailWidgetProps = {
  currentTime: Date;
  formattedActiveMinutes: string;
  formattedCalories: string;
  formattedDistance: string;
  formattedGoalSteps: string;
  formattedSteps: string;
  isRefreshing: boolean;
  onRefresh: () => void | Promise<void>;
  settings: AppSettings;
  themeColors: ThemeColors;
  walkingMetrics: WalkingMetrics;
  weekHistoryPoints: HistoryPoint[];
};

type RingDot = {
  isFilled: boolean;
  left: number;
  top: number;
};

const clampRatio = (ratio: number): number => Math.max(0, Math.min(1, ratio));

const getCompactDateLabel = (date: Date, settings: AppSettings): string => {
  return new Intl.DateTimeFormat(localeByLanguageCode[settings.languageCode], {
    day: 'numeric',
    month: 'short',
    timeZone: settings.timeZone,
    weekday: 'short',
  })
    .format(date)
    .replace('.', '')
    .toUpperCase();
};

export const TodayTrailWidget = ({
  currentTime,
  formattedActiveMinutes,
  formattedCalories,
  formattedDistance,
  formattedGoalSteps,
  formattedSteps,
  isRefreshing,
  onRefresh,
  settings,
  themeColors,
  walkingMetrics,
  weekHistoryPoints,
}: TodayTrailWidgetProps) => {
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const progressRatio = clampRatio(walkingMetrics.progressRatio);
  const ringDots = useMemo<RingDot[]>(() => {
    const dots: RingDot[] = [];

    for (let dotIndex = 0; dotIndex < ringDotCount; dotIndex += 1) {
      const dotRatio = dotIndex / ringDotCount;
      const angleRadians = (-90 + 360 * dotRatio) * (Math.PI / 180);

      dots.push({
        isFilled: progressRatio > 0 && dotRatio <= progressRatio,
        left: ringCenter + ringRadius * Math.cos(angleRadians) - ringDotSize / 2,
        top: ringCenter + ringRadius * Math.sin(angleRadians) - ringDotSize / 2,
      });
    }

    return dots;
  }, [progressRatio]);
  const markerAngleRadians = (-90 + 360 * progressRatio) * (Math.PI / 180);
  const markerLeft = ringCenter + ringRadius * Math.cos(markerAngleRadians) - markerSize / 2;
  const markerTop = ringCenter + ringRadius * Math.sin(markerAngleRadians) - markerSize / 2;
  const weekMaximumSteps = Math.max(settings.dailyGoalSteps, ...weekHistoryPoints.map((historyPoint) => historyPoint.steps), 1);

  return (
    <View style={styles.widget}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.brandMark}>
            <View style={styles.brandMarkAmber} />
            <View style={styles.brandMarkSage} />
          </View>
          <Text style={styles.brandText}>ШАГРИТМ</Text>
        </View>
        <Text style={styles.dateText}>{getCompactDateLabel(currentTime, settings)}</Text>
      </View>

      <View accessibilityLabel={`${formattedSteps} шагов сегодня`} style={styles.ringWrap}>
        <View style={styles.ringSoftGlow} />
        <View style={styles.ringTrackCircle} />
        {ringDots.map((ringDot, ringDotIndex) => (
          <View
            key={ringDotIndex}
            style={[
              styles.ringDot,
              ringDot.isFilled ? styles.ringDotFilled : null,
              {
                left: ringDot.left,
                top: ringDot.top,
              },
            ]}
          />
        ))}
        <View
          style={[
            styles.marker,
            {
              left: markerLeft,
              top: markerTop,
            },
          ]}
        >
          <View style={styles.markerCore} />
        </View>
        <View style={styles.ringCenter}>
          <Text style={styles.stepsValue} numberOfLines={1} adjustsFontSizeToFit>
            {formattedSteps}
          </Text>
          <Text style={styles.stepsLabel}>шагов сегодня</Text>
          <Text style={styles.goalText}>цель {formattedGoalSteps}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
            {formattedDistance}
          </Text>
          <Text style={styles.statLabel}>Дистанция</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
            {formattedActiveMinutes}
          </Text>
          <Text style={styles.statLabel}>Активность</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
            {formattedCalories}
          </Text>
          <Text style={styles.statLabel}>Калории</Text>
        </View>
      </View>

      <View style={styles.week}>
        <Text style={styles.weekTitle}>Неделя</Text>
        <View style={styles.weekBars}>
          {weekHistoryPoints.map((historyPoint) => {
            const barHeight = Math.max(8, Math.round((historyPoint.steps / weekMaximumSteps) * 100));
            const label = historyPoint.label.replace('.', '').toUpperCase();

            return (
              <View key={historyPoint.key} style={styles.day}>
                <View style={[styles.weekBar, { height: `${barHeight}%` }, historyPoint.isCurrent ? styles.currentWeekBar : null]} />
                <Text style={[styles.dayLabel, historyPoint.isCurrent ? styles.currentDayLabel : null]} numberOfLines={1} adjustsFontSizeToFit>
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <Pressable
        accessibilityLabel={isRefreshing ? 'Обновляю шаги' : 'Обновить шаги'}
        accessibilityRole="button"
        disabled={isRefreshing}
        onPress={onRefresh}
        style={({ pressed }) => [
          styles.syncButton,
          pressed && !isRefreshing ? styles.syncButtonPressed : null,
          isRefreshing ? styles.syncButtonDisabled : null,
        ]}
      >
        <Ionicons name="refresh" size={17} color={themeColors.primary} />
        <Text style={styles.syncButtonText}>{isRefreshing ? 'Обновляю...' : 'Обновить шаги'}</Text>
      </Pressable>
    </View>
  );
};

const createStyles = (themeColors: ThemeColors) => StyleSheet.create({
  widget: {
    alignSelf: 'center',
    backgroundColor: themeColors.surface,
    borderColor: themeColors.borderSubtle,
    borderRadius: 28,
    borderWidth: 1,
    gap: 0,
    maxWidth: 352,
    paddingBottom: 20,
    paddingHorizontal: 22,
    paddingTop: 22,
    shadowColor: themeColors.shadow,
    shadowOffset: { width: 0, height: 26 },
    shadowOpacity: 0.52,
    shadowRadius: 34,
    width: '100%',
    elevation: 12,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  brand: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  brandMark: {
    height: 18,
    position: 'relative',
    width: 18,
  },
  brandMarkAmber: {
    backgroundColor: themeColors.primary,
    borderRadius: 7,
    height: 14,
    left: 1,
    position: 'absolute',
    top: 0,
    transform: [{ rotate: '-14deg' }],
    width: 11,
  },
  brandMarkSage: {
    backgroundColor: themeColors.blue,
    borderRadius: 7,
    height: 13,
    left: 8,
    position: 'absolute',
    top: 6,
    transform: [{ rotate: '10deg' }],
    width: 10,
  },
  brandText: {
    color: themeColors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  dateText: {
    color: themeColors.textMuted,
    fontFamily: Platform.select({ android: 'monospace', web: 'monospace' }),
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  ringWrap: {
    alignSelf: 'center',
    height: ringSize,
    justifyContent: 'center',
    marginBottom: 8,
    marginTop: 10,
    position: 'relative',
    width: ringSize,
  },
  ringSoftGlow: {
    backgroundColor: themeColors.primaryMuted,
    borderRadius: 82,
    height: 164,
    left: 28,
    opacity: 0.24,
    position: 'absolute',
    top: 28,
    width: 164,
  },
  ringTrackCircle: {
    borderColor: themeColors.borderSubtle,
    borderRadius: 96,
    borderWidth: 1,
    height: 192,
    left: 14,
    opacity: 0.72,
    position: 'absolute',
    top: 14,
    width: 192,
  },
  ringDot: {
    backgroundColor: themeColors.borderSubtle,
    borderRadius: ringDotSize / 2,
    height: ringDotSize,
    opacity: 0.74,
    position: 'absolute',
    width: ringDotSize,
  },
  ringDotFilled: {
    backgroundColor: themeColors.primary,
    opacity: 1,
  },
  marker: {
    alignItems: 'center',
    backgroundColor: themeColors.background,
    borderColor: themeColors.primary,
    borderRadius: markerSize / 2,
    borderWidth: 2,
    height: markerSize,
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: themeColors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    width: markerSize,
    elevation: 4,
  },
  markerCore: {
    backgroundColor: themeColors.primary,
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  ringCenter: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: 3,
    justifyContent: 'center',
    maxWidth: 142,
  },
  stepsValue: {
    color: themeColors.textPrimary,
    fontFamily: Platform.select({ android: 'monospace', web: 'monospace' }),
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 43,
    maxWidth: '100%',
  },
  stepsLabel: {
    color: themeColors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  goalText: {
    color: themeColors.blue,
    fontFamily: Platform.select({ android: 'monospace', web: 'monospace' }),
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: 4,
  },
  statsRow: {
    alignItems: 'center',
    borderBottomColor: themeColors.borderSubtle,
    borderBottomWidth: 1,
    borderTopColor: themeColors.borderSubtle,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 2,
    paddingVertical: 16,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  statValue: {
    color: themeColors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  statLabel: {
    color: themeColors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  statDivider: {
    backgroundColor: themeColors.borderSubtle,
    height: 28,
    width: 1,
  },
  week: {
    gap: 10,
    marginTop: 16,
  },
  weekTitle: {
    color: themeColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  weekBars: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 7,
    height: 58,
    justifyContent: 'space-between',
  },
  day: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
    height: '100%',
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  weekBar: {
    backgroundColor: themeColors.blueMuted,
    borderRadius: 5,
    maxWidth: 22,
    minHeight: 8,
    width: '100%',
  },
  currentWeekBar: {
    backgroundColor: themeColors.primary,
  },
  dayLabel: {
    color: themeColors.textMuted,
    fontFamily: Platform.select({ android: 'monospace', web: 'monospace' }),
    fontSize: 9,
    fontWeight: '700',
    maxWidth: '100%',
  },
  currentDayLabel: {
    color: themeColors.primary,
  },
  syncButton: {
    alignItems: 'center',
    backgroundColor: themeColors.surfaceMuted,
    borderColor: themeColors.borderSubtle,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  syncButtonPressed: {
    backgroundColor: themeColors.surfacePressed,
    transform: [{ scale: 0.985 }],
  },
  syncButtonDisabled: {
    opacity: 0.58,
  },
  syncButtonText: {
    color: themeColors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
});
