import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Tone = 'default' | 'good' | 'warn' | 'bad';

type ActionButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

export function ActionButton({ title, onPress, disabled = false, destructive = false }: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        destructive && styles.destructiveButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}>
      <Text style={[styles.buttonText, disabled && styles.disabledButtonText]}>{title}</Text>
    </Pressable>
  );
}

type SectionProps = {
  title: string;
  detail?: string;
  children: React.ReactNode;
};

export function Section({ title, detail, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

type StatusPillProps = {
  label: string;
  value: string;
  tone?: Tone;
};

export function StatusPill({ label, value, tone = 'default' }: StatusPillProps) {
  return (
    <View style={[styles.pill, toneStyles[tone]]}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={styles.pillValue} selectable>
        {value}
      </Text>
    </View>
  );
}

type DataBlockProps = {
  label: string;
  value: string;
  tone?: Tone;
};

export function DataBlock({ label, value, tone = 'default' }: DataBlockProps) {
  return (
    <View style={[styles.dataBlock, tone === 'bad' && styles.badDataBlock]}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue} selectable>
        {value}
      </Text>
    </View>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'number-pad';
  secureTextEntry?: boolean;
};

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  secureTextEntry = false,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize="characters"
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

type SegmentedChoiceProps<T extends string> = {
  value: T;
  options: T[];
  onChange: (value: T) => void;
};

export function SegmentedChoice<T extends string>({ value, options, onChange }: SegmentedChoiceProps<T>) {
  return (
    <View style={styles.segmentedControl}>
      {options.map((option) => {
        const selected = option === value;

        return (
          <Pressable
            accessibilityRole="button"
            key={option}
            onPress={() => onChange(option)}
            style={[styles.segment, selected && styles.selectedSegment]}>
            <Text style={[styles.segmentText, selected && styles.selectedSegmentText]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ButtonRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.buttonRow}>{children}</View>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <Text style={styles.emptyState}>{children}</Text>;
}

const toneStyles = StyleSheet.create({
  default: {
    backgroundColor: '#e5e7eb',
  },
  good: {
    backgroundColor: '#dcfce7',
  },
  warn: {
    backgroundColor: '#fef3c7',
  },
  bad: {
    backgroundColor: '#fee2e2',
  },
});

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
  },
  sectionDetail: {
    color: '#6b7280',
    fontSize: 14,
    lineHeight: 20,
  },
  sectionBody: {
    gap: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderCurve: 'continuous',
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  destructiveButton: {
    backgroundColor: '#991b1b',
  },
  disabledButton: {
    backgroundColor: '#d1d5db',
  },
  pressedButton: {
    opacity: 0.72,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  disabledButtonText: {
    color: '#6b7280',
  },
  pill: {
    alignSelf: 'flex-start',
    borderCurve: 'continuous',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillLabel: {
    color: '#4b5563',
    fontSize: 13,
    fontWeight: '600',
  },
  pillValue: {
    color: '#111827',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  dataBlock: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
    borderCurve: 'continuous',
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  badDataBlock: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  dataLabel: {
    color: '#4b5563',
    fontSize: 13,
    fontWeight: '700',
  },
  dataValue: {
    color: '#111827',
    fontSize: 14,
    lineHeight: 20,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#d1d5db',
    borderCurve: 'continuous',
    borderRadius: 10,
    borderWidth: 1,
    color: '#111827',
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  segmentedControl: {
    alignSelf: 'flex-start',
    backgroundColor: '#e5e7eb',
    borderCurve: 'continuous',
    borderRadius: 10,
    flexDirection: 'row',
    padding: 3,
  },
  segment: {
    borderCurve: 'continuous',
    borderRadius: 8,
    minWidth: 56,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedSegment: {
    backgroundColor: '#ffffff',
  },
  segmentText: {
    color: '#4b5563',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  selectedSegmentText: {
    color: '#111827',
  },
  emptyState: {
    color: '#6b7280',
    fontSize: 14,
    lineHeight: 20,
  },
});
