import React from 'react';

export const LinearGradient = ({ children, ...props }: any) =>
  React.createElement('div', { ...props }, children);

export default {
  LinearGradient,
};

