import { PixelRatio, StyleSheet, Text, TextProps, TextStyle } from 'react-native';

import { typography, TypographyVariant } from '../theme';

/**
 * Tetto al moltiplicatore dei font di sistema.
 *
 * Gli utenti anziani/ipovedenti ingrandiscono i caratteri dalle impostazioni del telefono.
 * Vogliamo assecondarli, ma oltre questa soglia le card e i pulsanti si romperebbero: con 1.6
 * il testo diventa molto più grande pur restando dentro il layout esistente.
 */
export const MAX_FONT_SCALE = 1.6;

type AppTextProps = TextProps & {
  /** Variante tipografica del tema. Se omessa si usano solo gli stili passati via `style`. */
  variant?: TypographyVariant;
};

/**
 * Testo accessibile: unico seam dell'app per la leggibilità.
 *
 * Nasconde dietro un'interfaccia minima (come `Text`, più `variant`) due dettagli che React
 * Native non gestisce da solo per chi ingrandisce i font di sistema:
 *  - applica un tetto al moltiplicatore (`maxFontSizeMultiplier`) così la UI non si rompe;
 *  - riscala il `lineHeight` con il font di sistema. RN scala il `fontSize` ma NON il
 *    `lineHeight` esplicito: senza questa correzione, a font grandi le righe si sovrappongono.
 */
export function AppText({ variant, style, maxFontSizeMultiplier, ...rest }: AppTextProps) {
  const base: TextStyle | undefined = variant ? typography[variant] : undefined;
  const flattened = StyleSheet.flatten([base, style]) as TextStyle | undefined;

  const cap = maxFontSizeMultiplier ?? MAX_FONT_SCALE;
  const effectiveScale = Math.min(PixelRatio.getFontScale(), cap);

  const scaledLineHeight =
    flattened?.lineHeight !== undefined
      ? { lineHeight: flattened.lineHeight * effectiveScale }
      : undefined;

  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={cap}
      style={[flattened, scaledLineHeight]}
    />
  );
}
