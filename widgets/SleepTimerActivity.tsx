import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  multilineTextAlignment,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

export type SleepTimerActivityProps = {
  /** The sound playing, in the app's language. */
  sound: string;
  /** « Le son s'éteint dans », or its pause wording while the sound is paused. */
  caption: string;
  /** The countdown, as two instants (ms): it runs from `from` down to `to`. */
  from: number;
  to: number;
  /** Paused, the countdown holds the time left at `from`. */
  paused: boolean;
};

/**
 * The sleep sound's countdown on the lock screen and in the Dynamic Island, so the time
 * left shows without opening the app. The system counts it down by itself; the app only
 * sends a new interval when the sound pauses or resumes. Once the sound should be over and
 * the app could not end the activity (it was closed), the system marks it stale and only the
 * sound's name stays. Colours are the palette's night (constants/noctaliaPalette.ts): the
 * activity is a night one in either theme.
 */
const SleepTimerActivity = (props: SleepTimerActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const ink = '#FFF9EF';
  const accent = environment.isLuminanceReduced ? '#B7AEC9' : '#EAD4B4';
  const muted = '#B7AEC9';
  const over = environment.isStale === true;
  const interval = { lower: new Date(props.from), upper: new Date(props.to) };
  const pauseTime = props.paused ? new Date(props.from) : undefined;
  const timer = (size: number, width?: number) => (
    <Text
      timerInterval={interval}
      countsDown
      pauseTime={pauseTime}
      modifiers={[
        font({ size, weight: 'semibold' }),
        monospacedDigit(),
        foregroundStyle(ink),
        multilineTextAlignment('trailing'),
        ...(width ? [frame({ width })] : []),
      ]}
    />
  );
  const moon = (size: number) => (
    <Image systemName="moon.zzz.fill" modifiers={[font({ size, weight: 'semibold' }), foregroundStyle(accent)]} />
  );

  return {
    banner: (
      <HStack spacing={12} modifiers={[padding({ all: 16 }), activityBackgroundTint('#03040D')]}>
        {moon(24)}
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 16, weight: 'semibold' }), foregroundStyle(over ? muted : ink), lineLimit(1)]}>{props.sound}</Text>
          {over ? null : <Text modifiers={[font({ size: 13 }), foregroundStyle(muted), lineLimit(1)]}>{props.caption}</Text>}
        </VStack>
        <Spacer />
        {over ? null : timer(28, 96)}
      </HStack>
    ),
    compactLeading: moon(15),
    // A fixed width keeps the island from stretching to the timer's widest text.
    compactTrailing: over ? <Text modifiers={[frame({ width: 46 })]}>{''}</Text> : timer(15, 46),
    minimal: moon(14),
    expandedLeading: (
      <HStack spacing={8} modifiers={[padding({ leading: 4 })]}>
        {moon(20)}
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(ink), lineLimit(1)]}>{props.sound}</Text>
      </HStack>
    ),
    expandedTrailing: over ? <Text modifiers={[frame({ width: 80 })]}>{''}</Text> : timer(22, 80),
    expandedBottom: over ? <Text>{''}</Text> : (
      <Text modifiers={[font({ size: 13 }), foregroundStyle(muted), lineLimit(1)]}>{props.caption}</Text>
    ),
  };
};

export default createLiveActivity<SleepTimerActivityProps>('SleepTimer', SleepTimerActivity);
