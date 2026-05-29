/**
 * VexFlow 5 paints noteheads/clefs/rests as Bravura font glyphs while positioning
 * stems and beams with Bravura's metrics. If we draw before the (bundled, async-
 * loaded) font is ready, the browser falls back to a default font and the glyphs
 * land at the wrong place — most visibly, a chord's stem detaches from its
 * noteheads. Load the font once and gate every render on it. Shared by Staff and
 * RhythmStaff.
 */
let musicFontReady: Promise<void> | undefined

export function ensureMusicFont(): Promise<void> {
  musicFontReady ??= (async () => {
    if (typeof document === 'undefined' || !document.fonts) return
    try {
      // Importing vexflow has already registered the bundled Bravura face;
      // force it to load and wait for the whole set to settle before drawing.
      await document.fonts.load('30pt "Bravura"')
    } catch {
      /* ignore — the ready wait below still gates on in-flight loads */
    }
    await document.fonts.ready
  })()
  return musicFontReady
}
