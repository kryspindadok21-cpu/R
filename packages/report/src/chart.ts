import { escapeHtml } from './html.js'

export interface ChartPoint { readonly label: string; readonly value: number }

/** Wykres slupkowy jako inline SVG. Zero zaleznosci, zero zadan sieciowych (AC11). */
export function barChartSvg(points: readonly ChartPoint[], width = 960, height = 220): string {
  if (points.length === 0) return '<p class="pusto">Brak danych</p>'
  const max = Math.max(...points.map((p) => p.value), 1)
  const gap = 2
  const barWidth = Math.max(1, width / points.length - gap)
  const bars = points
    .map((p, i) => {
      const h = Math.max(1, (p.value / max) * (height - 24))
      const x = i * (barWidth + gap)
      // Etykieta pochodzi z danych — eskejpowana, bo trafia do tresci <title>.
      const title = `${escapeHtml(p.label)}: ${escapeHtml(String(p.value))}`
      return `<rect x="${x.toFixed(2)}" y="${(height - h).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${h.toFixed(2)}"><title>${title}</title></rect>`
    })
    .join('')
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Wykres slupkowy" preserveAspectRatio="none">${bars}</svg>`
}
