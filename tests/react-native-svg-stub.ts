import React from 'react';

const createSvgElement = (tagName: string) => {
  const SvgElement = ({ children, ...props }: any) => React.createElement(tagName, props, children);
  SvgElement.displayName = `Svg${tagName}`;
  return SvgElement;
};

const Svg = createSvgElement('svg');

export default Svg;
export const Circle = createSvgElement('circle');
export const Defs = createSvgElement('defs');
export const Ellipse = createSvgElement('ellipse');
export const G = createSvgElement('g');
export const Line = createSvgElement('line');
export const LinearGradient = createSvgElement('linearGradient');
export const Path = createSvgElement('path');
export const RadialGradient = createSvgElement('radialGradient');
export const Rect = createSvgElement('rect');
export const Stop = createSvgElement('stop');
export const Text = createSvgElement('text');
