import React from 'react';

export function MaskedView({ children }: { children?: React.ReactNode }) {
  return React.createElement('div', null, children);
}

export default MaskedView;
