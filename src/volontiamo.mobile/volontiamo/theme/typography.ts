import { TextStyle } from 'react-native';

// Le dimensioni e i lineHeight sono pensati per la leggibilità di utenti anziani/ipovedenti.
// I lineHeight hanno un rapporto generoso (~1.25-1.45) e vengono riscalati a runtime con il
// font di sistema dal componente AppText, così le righe non si sovrappongono mai quando i font
// sono ingranditi dalle impostazioni del telefono.
export const typography = {
  displayLarge: {
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: 0,
  } satisfies TextStyle,

  displayMedium: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    letterSpacing: 0,
  } satisfies TextStyle,

  titleLarge: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: 0,
  } satisfies TextStyle,

  titleMedium: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    letterSpacing: 0,
  } satisfies TextStyle,

  body: {
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 26,
    letterSpacing: 0.1,
  } satisfies TextStyle,

  bodySmall: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    letterSpacing: 0.1,
  } satisfies TextStyle,

  caption: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  } satisfies TextStyle,
} as const;

export type TypographyVariant = keyof typeof typography;
