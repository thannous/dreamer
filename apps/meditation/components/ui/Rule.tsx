import React from 'react';
import { View } from 'react-native';

/** The short centred champagne rule that sits under section headers. */
export function Rule({ className }: { className?: string }) {
  return (
    <View
      className={`h-[2.5px] w-9 self-center rounded-full bg-champagne opacity-85 ${className ?? ''}`}
    />
  );
}
