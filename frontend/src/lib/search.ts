export function normalize(s: string | undefined | null): string {
  if (!s) return ''
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/·/g, '')
    .replace(/ª/g, 'a')
    .toLowerCase()
}