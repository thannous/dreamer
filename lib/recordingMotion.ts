export type MicButtonMotionStatus = 'idle' | 'preparing' | 'recording';

export const shouldAnimateMicButtonSurface = (status: MicButtonMotionStatus): boolean =>
  status !== 'idle';
