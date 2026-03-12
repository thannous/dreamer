import React, { forwardRef, memo } from 'react';
import { TextInput } from 'react-native';

type Props = { value: string };
const Inner = forwardRef<TextInput, Props>(function Inner(props, ref) {
  return null;
});
const Wrapped = memo(Inner);
const ref = React.createRef<TextInput>();
const ok = <Wrapped ref={ref} value="x" />;
