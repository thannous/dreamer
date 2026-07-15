type GlobalLayout = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export const fullWidthNativeModifiers = undefined;
export const shouldGateHostedRNInteraction = false;

export function getSelectableModifiers(
  _selected: boolean,
  _onSelect: () => void,
) {
  return undefined;
}

export function getGlobalPositionModifiers(
  _handler: (layout: GlobalLayout) => void,
) {
  return undefined;
}
