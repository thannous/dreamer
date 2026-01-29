import React from 'react';

export const BlurView = ({ children }: { children?: React.ReactNode }) => {
  return React.createElement('div', null, children);
};

export default {
  BlurView,
};
