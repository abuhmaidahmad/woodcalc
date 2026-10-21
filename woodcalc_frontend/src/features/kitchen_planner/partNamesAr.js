// Arabic names for cabinet parts, shown beside the English name in the BOM and
// carried into the cutting optimizer's labels (and so its CSV/Excel/PDF files).
// The English names stay the source of truth -- the formula engine and edge
// banding match on them -- so this only ever adds a translation for display.
const PART_NAMES_AR = {
  'Side panel': 'جانب',
  'Top panel': 'سقف',
  'Bottom panel': 'قاعدة',
  'Fixed panel': 'لوح ثابت',
  'Front rail': 'عارضة أمامية',
  'Back rail': 'عارضة خلفية',
  'Bottom rail': 'عارضة سفلية',
  'Back panel (HDF)': 'ظهر (HDF)',
  'Back panel (box board)': 'ظهر (من لوح الهيكل)',
  'Blind panel': 'لوح العمى',
  'Blind stile': 'قائم العمى',
  'Blind filler': 'سدة جزء الميت',
  'Shelf (18mm)': 'رف (18مم)',
  'Drawer side (12mm)': 'جانب درج (12مم)',
  'Drawer back/front (12mm)': 'ظهر/وجه علبة الدرج (12مم)',
  'Drawer base (8mm HDF)': 'قاعدة درج (HDF 8مم)',
  'Drawer bottom panel (8mm HDF)': 'قاعدة درج (HDF 8مم)',
  'Door': 'باب',
  'Door/Front': 'باب/واجهة',
  'Drawer Front': 'وجه درج',
  'Drawer front': 'وجه درج',
  'Aluminium Glass Door (supplier)': 'باب ألمنيوم وزجاج (من المورد)',
  'Filler Fixing Cleat': 'قطعة تثبيت السدة',
  // Flat pieces are named after their cabinet subtype.
  'Filler': 'سدة',
  'Panel': 'لوح',
  'Side Panel': 'لوح جانبي',
  'Top Panel': 'لوح علوي',
  'Toe Kick': 'بانيل',
  'Shelf': 'رف',
  'Open Shelf': 'رف مفتوح',
  'Piece': 'قطعة',
}

export function partNameAr(name) {
  if (typeof name !== 'string') return ''
  if (PART_NAMES_AR[name]) return PART_NAMES_AR[name]
  const glass = name.match(/^Glass Shelf \((.+)mm Tempered\)$/)
  if (glass) return `رف زجاج (${glass[1]}مم مقسّى)`
  return ''
}

// "Side panel / جانب" -- the label the optimizer stores and exports. A name
// with no translation is left as it is.
export function bilingualPartName(name) {
  const ar = partNameAr(name)
  return ar ? `${name} / ${ar}` : name
}
