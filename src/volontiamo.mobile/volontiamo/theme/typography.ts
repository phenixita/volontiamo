import { TextStyle } from 'react-native';

export const typography = {
  displayLarge: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
    letterSpacing: -0.3,
  } satisfies TextStyle,

  displayMedium: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: -0.2,
  } satisfies TextStyle,

  titleLarge: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    letterSpacing: 0,
  } satisfies TextStyle,

  titleMedium: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    letterSpacing: 0,
  } satisfies TextStyle,

  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    letterSpacing: 0.1,
  } satisfies TextStyle,

  bodySmall: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    letterSpacing: 0.1,
  } satisfies TextStyle,

  caption: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  } satisfies TextStyle,
} as const;
