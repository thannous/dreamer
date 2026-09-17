import type { BottomSheetProps } from '@expo/ui';

export type BottomSheetSurfaceProps = BottomSheetProps & {
  dismissible: boolean;
  containerColor?: string;
};
