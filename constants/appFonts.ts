// The app's text faces, cut down to the Latin ranges of its six languages by
// scripts/subset-app-fonts.py (see assets/fonts/README.md). Text outside those
// ranges, such as a dream typed in Cyrillic, falls back to the system font.
// The keys are the family names global.css and constants/theme.ts refer to.
export const APP_FONTS = {
  Outfit_400Regular: require('@/assets/fonts/Outfit_400Regular.ttf'),
  Outfit_500Medium: require('@/assets/fonts/Outfit_500Medium.ttf'),
  Outfit_700Bold: require('@/assets/fonts/Outfit_700Bold.ttf'),
  Lora_400Regular: require('@/assets/fonts/Lora_400Regular.ttf'),
  Lora_400Regular_Italic: require('@/assets/fonts/Lora_400Regular_Italic.ttf'),
  Lora_700Bold: require('@/assets/fonts/Lora_700Bold.ttf'),
  Lora_700Bold_Italic: require('@/assets/fonts/Lora_700Bold_Italic.ttf'),
  Fraunces_400Regular: require('@/assets/fonts/Fraunces_400Regular.ttf'),
  Fraunces_500Medium: require('@/assets/fonts/Fraunces_500Medium.ttf'),
  Fraunces_600SemiBold: require('@/assets/fonts/Fraunces_600SemiBold.ttf'),
  Fraunces_700Bold: require('@/assets/fonts/Fraunces_700Bold.ttf'),
} as const;
