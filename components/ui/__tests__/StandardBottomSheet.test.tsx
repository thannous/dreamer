/* @jest-environment jsdom */

import { act, cleanup, render } from '@testing-library/react';
import React from 'react';

import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';

let mockScrollProps: any;
let mockFooterLayout: ((event: unknown) => void) | undefined;
let mockSheetStyle: any;
let mockViewStyles: any[] = [];

jest.mock('react-native', () => {
  const stub = require('../../../tests/react-native-stub');
  return {
    ...stub,
    ScrollView: (props: any) => {
      mockScrollProps = props;
      return stub.ScrollView(props);
    },
    // The only view measured here is the footer's.
    View: (props: any) => {
      if (props.onLayout) mockFooterLayout = props.onLayout;
      mockViewStyles.push(props.style);
      return stub.View(props);
    },
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 16, bottom: 34, left: 0, right: 84 }) }));
jest.mock('@/components/ui/BottomSheet', () => ({
  getBottomSheetMaximumHeight: jest.requireActual('@/components/ui/BottomSheet').getBottomSheetMaximumHeight,
  BottomSheet: ({ children, style }: any) => {
    mockSheetStyle = style;
    return <div>{children}</div>;
  },
}));
jest.mock('@/components/ui/BottomSheetActions', () => ({
  BottomSheetActions: ({ children }: any) => <div>{children}</div>,
  BottomSheetLinkAction: () => null,
  BottomSheetPrimaryAction: () => null,
  BottomSheetSecondaryAction: () => null,
}));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'dark', shadows: { xl: { boxShadow: 'xl' } } }),
}));
jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({ surface: { overlay: '#000' }, accent: { soft: '#fff' } }),
}));

afterEach(cleanup);

const actions = { primaryLabel: 'Share the card', onPrimary: () => {} };
const sheet = (props: Partial<React.ComponentProps<typeof StandardBottomSheet>> = {}) => (
  <StandardBottomSheet visible onClose={() => {}} title="Share" actions={actions} {...props}>
    <div />
  </StandardBottomSheet>
);
const layout = (y: number, height: number) => ({ nativeEvent: { layout: { x: 0, y, width: 300, height } } });

beforeEach(() => {
  mockScrollProps = undefined;
  mockFooterLayout = undefined;
  mockViewStyles = [];
});

describe('StandardBottomSheet', () => {
  // The test window is 812 points tall with insets 16 and 34: the sheet's content may take
  // 812 - 16 - 34 - 72 = 690 points, less its 16 point bottom margin on iOS.
  it('tells its body the room left between its header and its footer', () => {
    const onBodyRoom = jest.fn();
    render(sheet({ onBodyRoom }));
    expect(onBodyRoom).not.toHaveBeenCalled();
    act(() => mockScrollProps.onLayout(layout(8, 400)));
    expect(onBodyRoom).toHaveBeenLastCalledWith(690 - 16 - 8);
    act(() => mockFooterLayout?.(layout(408, 74)));
    expect(onBodyRoom).toHaveBeenLastCalledWith(690 - 16 - 8 - 74);
    // The body's own height never moves its room.
    onBodyRoom.mockClear();
    act(() => mockScrollProps.onLayout(layout(8, 520)));
    expect(onBodyRoom).not.toHaveBeenCalled();
  });

  it('leaves the body and the footer unmeasured when nothing asks', () => {
    render(sheet());
    expect(mockScrollProps.onLayout).toBeUndefined();
    expect(mockFooterLayout).toBeUndefined();
  });

  // A body with its own scroller (the e-mail account sheet) shares a bounded height: inside a
  // scroll view's content its scroller kept its full height and ran under the footer.
  it('gives a body that scrolls on its own a height it can shrink to', () => {
    render(sheet({ bodyScrollEnabled: false }));
    expect(mockScrollProps).toBeUndefined();
    expect(mockViewStyles).toContainEqual({ flexGrow: 1, flexShrink: 1, minHeight: 0 });
  });

  // The iOS sheet holds its content above the home indicator and draws its own edge, so the
  // content adds neither the inset nor a shadow (the Expo test preset compiles for iOS).
  it('on iOS keeps only its own margin below the actions, and no content shadow', () => {
    render(sheet());
    const style = Object.assign({}, ...mockSheetStyle.flat().filter(Boolean));
    expect(style.paddingBottom).toBe(16);
    expect(style.boxShadow).toBeUndefined();
  });
});
