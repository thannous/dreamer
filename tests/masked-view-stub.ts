import React from 'react';

export default function MaskedView({ children }: { children?: React.ReactNode }) {
  return React.createElement('div', null, children);
}
