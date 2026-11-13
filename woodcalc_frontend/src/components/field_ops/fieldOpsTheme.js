import { useTranslation } from '../../i18n/LanguageContext'

export const ACCENT = '#C8902A'
export const DARK = '#1A1A1A'
export const BG = '#F7F4F0'
export const BORDER = '#E0DAD4'

export const STATUSES = ['scheduled', 'in_progress', 'issue', 'completed']
export const STATUS_COLORS = { scheduled: '#2A7AC8', in_progress: '#C8902A', issue: '#E74C3C', completed: '#2E7D32' }

export function useDir() {
  const { language } = useTranslation()
  return language === 'ar' ? 'rtl' : 'ltr'
}

export function formatDate(value, language) {
  if (!value) return null
  const date = new Date(value + 'T00:00:00')
  return date.toLocaleDateString(language === 'ar' ? 'ar' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function dims(item) {
  const parts = [item?.width, item?.height, item?.depth].filter(v => v !== null && v !== undefined && v !== '')
  return parts.length ? parts.join(' × ') + ' mm' : ''
}
