import { Ionicons } from '@expo/vector-icons';
import { useMemo, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ThemeColors } from 'src/pedometer/constants';
import type { ChoiceOption, HistoryPoint } from 'src/pedometer/types';

type ThemeAwareProps = {
  themeColors: ThemeColors;
};

type ActionButtonProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void | Promise<void>;
  tone?: 'primary' | 'neutral' | 'danger';
  disabled?: boolean;
} & ThemeAwareProps;

export const ActionButton = ({ icon, label, onPress, themeColors, tone = 'primary', disabled = false }: ActionButtonProps) => {
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const iconColor = tone === 'neutral' ? themeColors.primary : themeColors.surface;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'neutral' ? styles.neutralButton : tone === 'danger' ? styles.dangerButton : styles.primaryButton,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text style={[styles.buttonText, tone === 'neutral' ? styles.neutralButtonText : styles.primaryButtonText]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
};

type SegmentControlProps<TValue extends string> = {
  options: ChoiceOption<TValue>[];
  selectedValue: TValue;
  onSelect: (value: TValue) => void;
} & ThemeAwareProps;

export const SegmentControl = <TValue extends string>({
  options,
  selectedValue,
  onSelect,
  themeColors,
}: SegmentControlProps<TValue>) => {
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  return (
    <View accessibilityRole="tablist" style={styles.segmentControl}>
      {options.map((option) => {
        const isSelected = option.value === selectedValue;

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            key={option.value}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => [styles.segment, isSelected ? styles.activeSegment : null, pressed ? styles.pressed : null]}
          >
            <Text style={[styles.segmentText, isSelected ? styles.activeSegmentText : null]} numberOfLines={1} adjustsFontSizeToFit>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

type ChoiceGroupProps<TValue extends string> = {
  label: string;
  options: ChoiceOption<TValue>[];
  selectedValue: TValue;
  onSelect: (value: TValue) => void;
} & ThemeAwareProps;

export const ChoiceGroup = <TValue extends string>({ label, options, selectedValue, onSelect, themeColors }: ChoiceGroupProps<TValue>) => {
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  return (
    <View style={styles.choiceGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.choiceGrid}>
        {options.map((option) => {
          const isSelected = option.value === selectedValue;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={({ pressed }) => [
                styles.choice,
                isSelected ? styles.activeChoice : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={[styles.choiceLabel, isSelected ? styles.activeChoiceLabel : null]}>{option.label}</Text>
              {option.description ? <Text style={styles.choiceDescription}>{option.description}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

type MetricCardProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  tone?: 'green' | 'blue' | 'warm';
} & ThemeAwareProps;

export const MetricCard = ({ icon, label, value, themeColors, tone = 'green' }: MetricCardProps) => {
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  return (
    <View style={styles.metric}>
      <View style={[styles.metricIcon, tone === 'blue' ? styles.blueIcon : tone === 'warm' ? styles.warmIcon : null]}>
        <Ionicons name={icon} size={20} color={themeColors.surface} />
      </View>
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
};

type SettingsFieldProps = {
  label: string;
  suffix?: string;
  value: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
  onChangeText: (value: string) => void;
} & ThemeAwareProps;

export const SettingsField = ({ label, suffix, value, keyboardType = 'default', onChangeText, themeColors }: SettingsFieldProps) => {
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          accessibilityLabel={label}
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          selectionColor={themeColors.primary}
          placeholderTextColor={themeColors.textMuted}
          style={styles.input}
          value={value}
        />
        {suffix ? <Text style={styles.inputSuffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
};

type HistoryChartProps = {
  points: HistoryPoint[];
  formatSteps: (steps: number) => string;
} & ThemeAwareProps;

export const HistoryChart = ({ points, formatSteps, themeColors }: HistoryChartProps) => {
  const maximumSteps = Math.max(1, ...points.map((point) => point.steps));
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  return (
    <View style={styles.chart}>
      {points.map((point) => {
        const barHeight = Math.max(7, Math.round((point.steps / maximumSteps) * 100));

        return (
          <View key={point.key} style={styles.dayColumn}>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { height: `${barHeight}%` }, point.isCurrent ? styles.currentBarFill : null]} />
            </View>
            <Text style={[styles.chartLabel, point.isCurrent ? styles.currentText : null]} numberOfLines={1} adjustsFontSizeToFit>
              {point.label}
            </Text>
            <Text style={styles.chartValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatSteps(point.steps)}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const createStyles = (themeColors: ThemeColors) => StyleSheet.create({
  button: {
    alignItems: 'center',
    borderColor: themeColors.highlight,
    borderLeftWidth: 1,
    borderRadius: 18,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
    shadowColor: themeColors.shadow,
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 0.36,
    shadowRadius: 18,
    elevation: 7,
  },
  primaryButton: {
    backgroundColor: themeColors.primary,
  },
  neutralButton: {
    backgroundColor: themeColors.surface,
  },
  dangerButton: {
    backgroundColor: themeColors.danger,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButtonText: {
    color: themeColors.surface,
  },
  neutralButtonText: {
    color: themeColors.textPrimary,
  },
  pressed: {
    backgroundColor: themeColors.surfacePressed,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 9,
    elevation: 2,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.5,
  },
  segmentControl: {
    backgroundColor: themeColors.surfaceInset,
    borderColor: themeColors.shadow,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 4,
    shadowColor: themeColors.shadow,
    shadowOffset: { width: -3, height: -3 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  activeSegment: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.highlight,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    shadowColor: themeColors.shadow,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.34,
    shadowRadius: 12,
    elevation: 5,
  },
  segmentText: {
    color: themeColors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  activeSegmentText: {
    color: themeColors.textPrimary,
  },
  choiceGroup: {
    gap: 8,
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choice: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.highlight,
    borderLeftWidth: 1,
    borderRadius: 16,
    borderTopWidth: 1,
    borderWidth: 1,
    flexGrow: 1,
    gap: 3,
    minHeight: 54,
    minWidth: '30%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: themeColors.shadow,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 5,
  },
  activeChoice: {
    backgroundColor: themeColors.primaryMuted,
    borderColor: themeColors.primary,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  choiceLabel: {
    color: themeColors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  activeChoiceLabel: {
    color: themeColors.primary,
  },
  choiceDescription: {
    color: themeColors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  metric: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.highlight,
    borderLeftWidth: 1,
    borderRadius: 18,
    borderTopWidth: 1,
    flex: 1,
    gap: 8,
    minHeight: 126,
    minWidth: 0,
    padding: 16,
    shadowColor: themeColors.shadow,
    shadowOffset: { width: 9, height: 9 },
    shadowOpacity: 0.36,
    shadowRadius: 20,
    elevation: 7,
  },
  metricIcon: {
    alignItems: 'center',
    backgroundColor: themeColors.primary,
    borderColor: themeColors.highlight,
    borderLeftWidth: 1,
    borderRadius: 12,
    borderTopWidth: 1,
    height: 34,
    justifyContent: 'center',
    shadowColor: themeColors.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    width: 34,
  },
  blueIcon: {
    backgroundColor: themeColors.blue,
  },
  warmIcon: {
    backgroundColor: themeColors.warning,
  },
  metricValue: {
    color: themeColors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
  },
  metricLabel: {
    color: themeColors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    color: themeColors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  inputRow: {
    alignItems: 'center',
    backgroundColor: themeColors.surfaceInset,
    borderColor: themeColors.shadow,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 50,
    paddingHorizontal: 12,
    shadowColor: themeColors.highlight,
    shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
  },
  input: {
    color: themeColors.textPrimary,
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    minWidth: 0,
    paddingVertical: 12,
  },
  inputSuffix: {
    color: themeColors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  chart: {
    alignItems: 'flex-end',
    backgroundColor: themeColors.surface,
    borderColor: themeColors.highlight,
    borderLeftWidth: 1,
    borderRadius: 18,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 5,
    minHeight: 254,
    padding: 12,
    shadowColor: themeColors.shadow,
    shadowOffset: { width: 9, height: 9 },
    shadowOpacity: 0.36,
    shadowRadius: 20,
    elevation: 7,
  },
  dayColumn: {
    alignItems: 'center',
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  barTrack: {
    backgroundColor: themeColors.surfaceInset,
    borderColor: themeColors.shadow,
    borderRadius: 10,
    borderWidth: 1,
    height: 156,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: '100%',
  },
  barFill: {
    backgroundColor: themeColors.blue,
    borderRadius: 9,
    minHeight: 7,
    width: '100%',
  },
  currentBarFill: {
    backgroundColor: themeColors.primary,
  },
  chartLabel: {
    color: themeColors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    maxWidth: '100%',
    textTransform: 'capitalize',
  },
  currentText: {
    color: themeColors.primary,
  },
  chartValue: {
    color: themeColors.textPrimary,
    fontSize: 10,
    fontWeight: '700',
    maxWidth: '100%',
  },
});
