const TRANSLIT: Record<string, string> = {
  ä: 'ae', ö: 'oe', ü: 'ue',
  Ä: 'ae', Ö: 'oe', Ü: 'ue',
  ß: 'ss', à: 'a', á: 'a', â: 'a', ã: 'a',
  è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i',
  ò: 'o', ó: 'o', ô: 'o', õ: 'o',
  ù: 'u', ú: 'u', û: 'u',
  ç: 'c', ñ: 'n',
};

export function toSlug(input: string): string {
  const transliterated = Array.from(input)
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('');
  const slug = transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug.length === 0 ? 'tenant' : slug;
}
