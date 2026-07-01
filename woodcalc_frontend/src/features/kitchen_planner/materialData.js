// Shared material data used by MaterialLibrary, CountertopPicker, and KitchenPlanner3D.
// Kept in one place to avoid circular imports (CabinetCatalog imports MaterialLibrary).

export const MATERIAL_DB = {
  egger: {
    label: 'Egger', logo: '🇦🇹',
    materials: [
      { code: 'W908 ST2',  name: 'Basic White',             hex: '#F8F6F2', finish: 'matt',  category: 'solid' },
      { code: 'W911 ST2',  name: 'Cream White',             hex: '#F5F1E8', finish: 'matt',  category: 'solid' },
      { code: 'W980 ST2',  name: 'Platinum White',          hex: '#F2F2F0', finish: 'matt',  category: 'solid' },
      { code: 'W980 SM',   name: 'Platinum White',          hex: '#F2F2F0', finish: 'gloss', category: 'solid' },
      { code: 'W1000 ST9', name: 'Premium White',           hex: '#EFEDE8', finish: 'matt',  category: 'solid' },
      { code: 'W1100 ST9', name: 'Alpine White',            hex: '#ECEAE5', finish: 'matt',  category: 'solid' },
      { code: 'W1200 ST9', name: 'Porcelain White',         hex: '#E8E6E2', finish: 'matt',  category: 'solid' },
      { code: 'U708 ST9',  name: 'Light Grey',              hex: '#C8C6C2', finish: 'matt',  category: 'solid' },
      { code: 'U732 ST9',  name: 'Dust Grey',               hex: '#A8A6A2', finish: 'matt',  category: 'solid' },
      { code: 'U750 ST9',  name: 'Taupe Grey',              hex: '#9A8E82', finish: 'matt',  category: 'solid' },
      { code: 'U763 ST9',  name: 'Pearl Grey',              hex: '#B8B4AE', finish: 'matt',  category: 'solid' },
      { code: 'U775 ST9',  name: 'White Grey',              hex: '#D8D6D2', finish: 'matt',  category: 'solid' },
      { code: 'U788 ST9',  name: 'Arctic Grey',             hex: '#D0CEC8', finish: 'matt',  category: 'solid' },
      { code: 'U960 ST9',  name: 'Onyx Grey',               hex: '#686664', finish: 'matt',  category: 'solid' },
      { code: 'U963 ST9',  name: 'Diamond Grey',            hex: '#787674', finish: 'matt',  category: 'solid' },
      { code: 'U961 ST7',  name: 'Graphite Grey',           hex: '#4A4846', finish: 'matt',  category: 'solid' },
      { code: 'U999 ST2',  name: 'Black',                   hex: '#1A1A1A', finish: 'matt',  category: 'solid' },
      { code: 'U999 SM',   name: 'Black Gloss',             hex: '#1A1A1A', finish: 'gloss', category: 'solid' },
      { code: 'U104 ST9',  name: 'Alabaster White',         hex: '#E8E0D0', finish: 'matt',  category: 'solid' },
      { code: 'U156 ST9',  name: 'Sand Beige',              hex: '#D4C4A8', finish: 'matt',  category: 'solid' },
      { code: 'U222 ST15', name: 'Crema',                   hex: '#E2D4B8', finish: 'matt',  category: 'solid' },
      { code: 'U702 ST9',  name: 'Cashmere Grey',           hex: '#B8AEA2', finish: 'matt',  category: 'solid' },
      { code: 'U540 ST9',  name: 'Denim Blue',              hex: '#5A7A9A', finish: 'matt',  category: 'solid' },
      { code: 'U599 ST9',  name: 'Indigo Blue',             hex: '#3A4A6A', finish: 'matt',  category: 'solid' },
      { code: 'U604 ST9',  name: 'Reed Green',              hex: '#6A8A6A', finish: 'matt',  category: 'solid' },
      { code: 'U699 ST9',  name: 'Fir Green',               hex: '#3A5A3A', finish: 'matt',  category: 'solid' },
      { code: 'H1145 ST10', name: 'Natural Bardolino Oak',  hex: '#C4904A', finish: 'wood',  category: 'wood' },
      { code: 'H1303 ST12', name: 'Brown Belmont Oak',      hex: '#8A6040', finish: 'wood',  category: 'wood' },
      { code: 'H3157 ST12', name: 'Vicenza Oak',            hex: '#B8924E', finish: 'wood',  category: 'wood' },
      { code: 'H1223 ST19', name: 'Sevilla Ash',            hex: '#A87848', finish: 'wood',  category: 'wood' },
      { code: 'H3840 ST9',  name: 'Natural Sheffield Acacia',hex: '#C0904A', finish: 'wood', category: 'wood' },
      { code: 'H1242 ST10', name: 'Natural Mandal Maple',   hex: '#D4AA6A', finish: 'wood',  category: 'wood' },
      { code: 'H3325 ST28', name: 'Tobacco Gladstone Oak',  hex: '#6A4830', finish: 'wood',  category: 'wood' },
      { code: 'H1346 ST32', name: 'Anthracite Sherman Oak', hex: '#4A4440', finish: 'wood',  category: 'wood' },
      { code: 'H3176 ST37', name: 'Pewter Halifax Oak',     hex: '#787068', finish: 'wood',  category: 'wood' },
      { code: 'H1710 ST10', name: 'Sand Kentucky Chestnut', hex: '#C8A070', finish: 'wood',  category: 'wood' },
      { code: 'H3195 ST19', name: 'White Fineline',         hex: '#E8E0D4', finish: 'wood',  category: 'wood' },
      { code: 'H1732 ST9',  name: 'Sand Birch',             hex: '#D4C090', finish: 'wood',  category: 'wood' },
    ]
  },
  kronospan: {
    label: 'Kronospan', logo: '🇨🇿',
    materials: [
      { code: '0101 SM',  name: 'Front White',       hex: '#F8F6F2', finish: 'gloss', category: 'solid' },
      { code: '0101 PE',  name: 'Front White',       hex: '#F8F6F2', finish: 'matt',  category: 'solid' },
      { code: 'K101',     name: 'Front White',       hex: '#F5F3EE', finish: 'matt',  category: 'solid' },
      { code: '0150',     name: 'Super White',       hex: '#FAFAFA', finish: 'gloss', category: 'solid' },
      { code: '8627 SM',  name: 'Anthracite',        hex: '#3A3A3A', finish: 'gloss', category: 'solid' },
      { code: '8823',     name: 'Agate Grey',        hex: '#8A8682', finish: 'matt',  category: 'solid' },
      { code: '8929',     name: 'Cream',             hex: '#F0E8D8', finish: 'matt',  category: 'solid' },
      { code: '8748',     name: 'Light Grey',        hex: '#C8C4BE', finish: 'matt',  category: 'solid' },
      { code: '8681',     name: 'Dust Grey',         hex: '#A4A09A', finish: 'matt',  category: 'solid' },
      { code: '0999',     name: 'Black',             hex: '#1C1C1C', finish: 'matt',  category: 'solid' },
      { code: '0999 SM',  name: 'Black Gloss',       hex: '#1C1C1C', finish: 'gloss', category: 'solid' },
      { code: '8673',     name: 'Cashmere',          hex: '#C0B4A4', finish: 'matt',  category: 'solid' },
      { code: '8578',     name: 'Sand Beige',        hex: '#D4C4A0', finish: 'matt',  category: 'solid' },
      { code: '8420 SM',  name: 'White Artisan Oak', hex: '#E0D4C0', finish: 'wood',  category: 'wood' },
      { code: '8929 SM',  name: 'Natural Artisan Oak',hex: '#C4A870', finish: 'wood', category: 'wood' },
      { code: '8697',     name: 'Tobacco Oak',       hex: '#7A5838', finish: 'wood',  category: 'wood' },
      { code: '8517',     name: 'Dark Walnut',       hex: '#5A3A22', finish: 'wood',  category: 'wood' },
      { code: '8866',     name: 'Light Bardolino',   hex: '#C89858', finish: 'wood',  category: 'wood' },
      { code: '8214',     name: 'Sonoma Oak',        hex: '#C0944A', finish: 'wood',  category: 'wood' },
      { code: '5981',     name: 'Vintage Oak',       hex: '#A87848', finish: 'wood',  category: 'wood' },
    ]
  },
  sonae: {
    label: 'Sonae Arauco', logo: '🇵🇹',
    materials: [
      { code: 'W001 PM',  name: 'White',       hex: '#F8F6F2', finish: 'matt',  category: 'solid' },
      { code: 'W001 BRI', name: 'White Gloss', hex: '#F8F6F2', finish: 'gloss', category: 'solid' },
      { code: 'W002 PM',  name: 'Off White',   hex: '#F2EEE6', finish: 'matt',  category: 'solid' },
      { code: 'G002 PM',  name: 'Light Grey',  hex: '#C8C4BE', finish: 'matt',  category: 'solid' },
      { code: 'G006 PM',  name: 'Dust Grey',   hex: '#9A9692', finish: 'matt',  category: 'solid' },
      { code: 'G010 PM',  name: 'Anthracite',  hex: '#3C3A38', finish: 'matt',  category: 'solid' },
      { code: 'P001 PM',  name: 'Black',       hex: '#1A1A1A', finish: 'matt',  category: 'solid' },
      { code: 'B002 PM',  name: 'Cream',       hex: '#EEE4CC', finish: 'matt',  category: 'solid' },
      { code: 'P366 PM',  name: 'Cashmere',    hex: '#C0B0A0', finish: 'matt',  category: 'solid' },
      { code: 'H1487 PM', name: 'Natural Oak', hex: '#C49858', finish: 'wood',  category: 'wood' },
      { code: 'H3490 PM', name: 'White Oak',   hex: '#DDD0B8', finish: 'wood',  category: 'wood' },
      { code: 'H3500 PM', name: 'Nordic Oak',  hex: '#C8B890', finish: 'wood',  category: 'wood' },
      { code: 'H3680 PM', name: 'Dark Walnut', hex: '#5C3C22', finish: 'wood',  category: 'wood' },
      { code: 'H1680 PM', name: 'Teak',        hex: '#9A7040', finish: 'wood',  category: 'wood' },
    ]
  },
  finsa: {
    label: 'Finsa', logo: '🇪🇸',
    materials: [
      { code: 'F043',    name: 'White',       hex: '#F8F6F2', finish: 'matt',  category: 'solid' },
      { code: 'F043 GL', name: 'White Gloss', hex: '#F8F6F2', finish: 'gloss', category: 'solid' },
      { code: 'F218',    name: 'Cream',       hex: '#F0E8D8', finish: 'matt',  category: 'solid' },
      { code: 'F290',    name: 'Light Grey',  hex: '#C8C4BE', finish: 'matt',  category: 'solid' },
      { code: 'F295',    name: 'Silver Grey', hex: '#B0ACA6', finish: 'matt',  category: 'solid' },
      { code: 'F300',    name: 'Anthracite',  hex: '#3C3A38', finish: 'matt',  category: 'solid' },
      { code: 'F099',    name: 'Black',       hex: '#1A1A1A', finish: 'matt',  category: 'solid' },
      { code: 'F099 GL', name: 'Black Gloss', hex: '#1A1A1A', finish: 'gloss', category: 'solid' },
      { code: 'F701',    name: 'Natural Oak', hex: '#C49858', finish: 'wood',  category: 'wood' },
      { code: 'F708',    name: 'White Oak',   hex: '#DDD0B8', finish: 'wood',  category: 'wood' },
      { code: 'F720',    name: 'Dark Walnut', hex: '#5C3C22', finish: 'wood',  category: 'wood' },
      { code: 'F730',    name: 'Light Ash',   hex: '#D4C8B0', finish: 'wood',  category: 'wood' },
      { code: 'F750',    name: 'Smoked Oak',  hex: '#7A6448', finish: 'wood',  category: 'wood' },
    ]
  },
  cleaf: {
    label: 'Cleaf', logo: '🇮🇹',
    materials: [
      { code: 'S003 RM', name: 'Ice White',       hex: '#F8F8F6', finish: 'matt',  category: 'solid' },
      { code: 'S007 RM', name: 'Bianco Assoluto',  hex: '#F5F3EE', finish: 'matt',  category: 'solid' },
      { code: 'S007 GL', name: 'Bianco Assoluto',  hex: '#F5F3EE', finish: 'gloss', category: 'solid' },
      { code: 'S009 RM', name: 'Cotton White',     hex: '#F0EDE6', finish: 'matt',  category: 'solid' },
      { code: 'S168 RM', name: 'Grigio Perla',     hex: '#C0BCB6', finish: 'matt',  category: 'solid' },
      { code: 'S170 RM', name: 'Grigio Pietra',    hex: '#A09C96', finish: 'matt',  category: 'solid' },
      { code: 'S172 RM', name: 'Grigio Lava',      hex: '#6A6664', finish: 'matt',  category: 'solid' },
      { code: 'S178 RM', name: 'Antracite',        hex: '#3A3836', finish: 'matt',  category: 'solid' },
      { code: 'S250 RM', name: 'Nero Assoluto',    hex: '#1A1A1A', finish: 'matt',  category: 'solid' },
      { code: 'S250 GL', name: 'Nero Assoluto',    hex: '#1A1A1A', finish: 'gloss', category: 'solid' },
      { code: 'F028 RM', name: 'Rovere Naturale',  hex: '#C49858', finish: 'wood',  category: 'wood' },
      { code: 'F029 RM', name: 'Rovere Bianco',    hex: '#DDD0B8', finish: 'wood',  category: 'wood' },
      { code: 'F045 RM', name: 'Noce Canaletto',   hex: '#6A4830', finish: 'wood',  category: 'wood' },
      { code: 'F062 RM', name: 'Frassino Grigio',  hex: '#A89880', finish: 'wood',  category: 'wood' },
      { code: 'F080 RM', name: 'Rovere Fumè',      hex: '#786858', finish: 'wood',  category: 'wood' },
    ]
  },
  atg: {
    label: 'ATG', logo: '🇯🇴',
    materials: [
      { code: 'ATG-W01',   name: 'Super White Matt',  hex: '#F8F6F2', finish: 'matt',  category: 'solid' },
      { code: 'ATG-W01G',  name: 'Super White Gloss', hex: '#F8F6F2', finish: 'gloss', category: 'solid' },
      { code: 'ATG-W02',   name: 'Cream White',       hex: '#F2EAD8', finish: 'matt',  category: 'solid' },
      { code: 'ATG-G01',   name: 'Light Grey',        hex: '#C8C4BE', finish: 'matt',  category: 'solid' },
      { code: 'ATG-G02',   name: 'Silver Grey',       hex: '#A8A4A0', finish: 'matt',  category: 'solid' },
      { code: 'ATG-G03',   name: 'Anthracite',        hex: '#3C3A38', finish: 'matt',  category: 'solid' },
      { code: 'ATG-B01',   name: 'Black Matt',        hex: '#1A1A1A', finish: 'matt',  category: 'solid' },
      { code: 'ATG-B01G',  name: 'Black Gloss',       hex: '#1A1A1A', finish: 'gloss', category: 'solid' },
      { code: 'ATG-C01',   name: 'Cashmere',          hex: '#C8B8A8', finish: 'matt',  category: 'solid' },
      { code: 'ATG-C02',   name: 'Beige Sand',        hex: '#D4C4A0', finish: 'matt',  category: 'solid' },
      { code: 'ATG-OAK01', name: 'Natural Oak',       hex: '#C49858', finish: 'wood',  category: 'wood' },
      { code: 'ATG-OAK02', name: 'White Oak',         hex: '#DDD0B8', finish: 'wood',  category: 'wood' },
      { code: 'ATG-WAL01', name: 'Dark Walnut',       hex: '#5C3C22', finish: 'wood',  category: 'wood' },
      { code: 'ATG-WAL02', name: 'Light Walnut',      hex: '#9A7040', finish: 'wood',  category: 'wood' },
    ]
  },
}

export const COUNTERTOP_MATERIALS = [
  { id: 'sil_eternal_calacatta', brand: 'Silestone',   code: 'ET-C',     name: 'Eternal Calacatta Gold',  color: '#F5F0E8', roughness: 0.08, metalness: 0.02, category: 'marble'   },
  { id: 'sil_white_storm',       brand: 'Silestone',   code: 'WS-1',     name: 'White Storm',             color: '#F0EEE9', roughness: 0.10, metalness: 0.02, category: 'quartz'   },
  { id: 'sil_cemento_spa',       brand: 'Silestone',   code: 'CS-1',     name: 'Cemento Spa',             color: '#A8A49E', roughness: 0.55, metalness: 0.00, category: 'concrete' },
  { id: 'sil_negro_tebas',       brand: 'Silestone',   code: 'NT-1',     name: 'Negro Tebas',             color: '#1E1E1E', roughness: 0.12, metalness: 0.03, category: 'dark'     },
  { id: 'sil_charcoal_soapstone',brand: 'Silestone',   code: 'CH-S',     name: 'Charcoal Soapstone',      color: '#4A4846', roughness: 0.45, metalness: 0.00, category: 'dark'     },
  { id: 'sil_bianco_river',      brand: 'Silestone',   code: 'BR-1',     name: 'Bianco River',            color: '#E8E4DC', roughness: 0.09, metalness: 0.02, category: 'marble'   },
  { id: 'sil_cala_blue',         brand: 'Silestone',   code: 'CB-1',     name: 'Cala Blue',               color: '#6A7A8A', roughness: 0.12, metalness: 0.02, category: 'marble'   },
  { id: 'cae_fresh_concrete',    brand: 'Caesarstone', code: '4044',     name: 'Fresh Concrete',          color: '#C8C4BC', roughness: 0.60, metalness: 0.00, category: 'concrete' },
  { id: 'cae_cloudburst',        brand: 'Caesarstone', code: '4011',     name: 'Cloudburst Concrete',     color: '#A0A09A', roughness: 0.55, metalness: 0.00, category: 'concrete' },
  { id: 'cae_white_attica',      brand: 'Caesarstone', code: '5031',     name: 'White Attica',            color: '#F2EEE8', roughness: 0.08, metalness: 0.02, category: 'marble'   },
  { id: 'cae_statuario',         brand: 'Caesarstone', code: '5003',     name: 'Piatra Grey',             color: '#C0BCB4', roughness: 0.15, metalness: 0.01, category: 'marble'   },
  { id: 'cae_vanilla_noir',      brand: 'Caesarstone', code: '6600',     name: 'Vanilla Noir',            color: '#3A3530', roughness: 0.10, metalness: 0.02, category: 'dark'     },
  { id: 'cae_oxidian',           brand: 'Caesarstone', code: '0046',     name: 'Oxidian',                 color: '#1A1A1A', roughness: 0.05, metalness: 0.08, category: 'dark'     },
  { id: 'cae_wooland_brown',     brand: 'Caesarstone', code: '6310',     name: 'Coastal Grey',            color: '#888480', roughness: 0.25, metalness: 0.01, category: 'quartz'   },
  { id: 'dek_kelya',             brand: 'Dekton',      code: 'DK-KL',    name: 'Kelya',                   color: '#2A2A28', roughness: 0.08, metalness: 0.05, category: 'dark'     },
  { id: 'dek_sirius',            brand: 'Dekton',      code: 'DK-SR',    name: 'Sirius',                  color: '#E8E4DC', roughness: 0.06, metalness: 0.02, category: 'marble'   },
  { id: 'dek_kreta',             brand: 'Dekton',      code: 'DK-KR',    name: 'Kreta',                   color: '#D0C8BC', roughness: 0.40, metalness: 0.00, category: 'concrete' },
  { id: 'dek_opera',             brand: 'Dekton',      code: 'DK-OP',    name: 'Opera',                   color: '#F8F4EE', roughness: 0.07, metalness: 0.02, category: 'marble'   },
  { id: 'dek_zenith',            brand: 'Dekton',      code: 'DK-ZN',    name: 'Zenith',                  color: '#F0F0EE', roughness: 0.05, metalness: 0.03, category: 'quartz'   },
  { id: 'dek_domoos',            brand: 'Dekton',      code: 'DK-DM',    name: 'Domoos',                  color: '#4A4640', roughness: 0.35, metalness: 0.00, category: 'dark'     },
  { id: 'egg_white_levanto',     brand: 'Egger',       code: 'F812 ST10',name: 'White Levanto Marble',    color: '#F0EBE4', roughness: 0.10, metalness: 0.01, category: 'marble'   },
  { id: 'egg_anthracite_stein',  brand: 'Egger',       code: 'F246 ST10',name: 'Anthracite Stein',        color: '#4A4846', roughness: 0.45, metalness: 0.00, category: 'concrete' },
  { id: 'egg_natural_hamilton',  brand: 'Egger',       code: 'H010 ST10',name: 'Natural Hamilton Oak',    color: '#C8A060', roughness: 0.70, metalness: 0.00, category: 'wood'     },
  { id: 'egg_dark_cromwell',     brand: 'Egger',       code: 'H022 ST10',name: 'Dark Cromwell Oak',       color: '#6A4830', roughness: 0.72, metalness: 0.00, category: 'wood'     },
  { id: 'egg_black_marquina',    brand: 'Egger',       code: 'F028 ST89',name: 'Black Marquina',          color: '#1A1818', roughness: 0.08, metalness: 0.03, category: 'dark'     },
]

export const COUNTERTOP_CATEGORIES = ['all', 'marble', 'quartz', 'concrete', 'dark', 'wood']
export const COUNTERTOP_BRANDS     = ['All', 'Silestone', 'Caesarstone', 'Dekton', 'Egger']

// Convert a MATERIAL_DB entry to CountertopPicker format
const FINISH_TO_ROUGHNESS = { matt: 0.85, gloss: 0.05, wood: 0.70, metal: 0.20, other: 0.40 }
const FINISH_TO_METALNESS = { matt: 0.00, gloss: 0.05, wood: 0.00, metal: 0.80, other: 0.00 }

export function lamToCt(mat, brandLabel) {
  return {
    id:        mat.code,
    name:      mat.name,
    brand:     brandLabel,
    code:      mat.code,
    color:     mat.hex,
    roughness: FINISH_TO_ROUGHNESS[mat.finish] ?? 0.4,
    metalness: FINISH_TO_METALNESS[mat.finish] ?? 0.0,
    category:  mat.category, // 'solid' | 'wood', matching MATERIAL_DB
  }
}

// Convert a COUNTERTOP_MATERIALS entry to MaterialLibrary format
export function ctToLam(mat) {
  const finish = mat.category === 'wood' ? 'wood'
    : mat.roughness < 0.15 ? 'gloss'
    : 'matt'
  return {
    code:     mat.id,
    name:     mat.name,
    hex:      mat.color,
    finish,
    category: mat.category,
    roughness: mat.roughness,
    metalness: mat.metalness,
  }
}
