import React from 'react';

const flattenStyle = (style: any) => {
  if (Array.isArray(style)) {
    return style.reduce((acc, item) => {
      if (item && typeof item === 'object') {
        return { ...acc, ...item };
      }
      return acc;
    }, {});
  }
  return style && typeof style === 'object' ? style : undefined;
};

export const LinearGradient = ({ children, style, ...props }: any) =>
  React.createElement('div', { ...props, style: flattenStyle(style) }, children);

export default {
  LinearGradient,
};
