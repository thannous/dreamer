/** The story's star glyph: a four-pointed sparkle of radius `size` centred on (cx, cy). */
export const sparklePath = (cx: number, cy: number, size: number) =>
  `M${cx} ${cy - size} Q${cx} ${cy} ${cx + size} ${cy} Q${cx} ${cy} ${cx} ${cy + size} ` +
  `Q${cx} ${cy} ${cx - size} ${cy} Q${cx} ${cy} ${cx} ${cy - size} Z`;
