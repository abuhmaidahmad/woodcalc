// The text of the dialog shown before a room is confirmed (confirm_lock or
// submit_revision), from GET rooms/<id>/confirm_preview/:
//  - warnings: metal-sided drawer systems with no bottom/back sizes in the
//    catalog -- the room is cut with the default bottom and no back;
//  - changes: what re-confirming changes versus the construction settings the
//    room was confirmed with before (back construction and panel, drawer
//    materials, drawer system sizes).
// null when there's nothing to say, so no dialog is shown.
export function confirmPreviewText(preview, t) {
  const warnings = preview?.warnings || []
  const changes = preview?.changes || []
  if (!warnings.length && !changes.length) return null
  const show = (v) => (v === null || v === undefined || v === '' ? '—' : String(v))
  const lines = []
  if (warnings.length) {
    lines.push(t('confirmPreview.warningsTitle'))
    warnings.forEach(w => lines.push(`• ${w.system}: ${w.missing.map(m => t(`confirmPreview.missing_${m}`)).join(', ')}`))
    lines.push(t('confirmPreview.warningsNote'))
  }
  if (changes.length) {
    if (lines.length) lines.push('')
    lines.push(t('confirmPreview.changesTitle'))
    changes.forEach(c => {
      if (c.setting !== 'drawer_systems') {
        lines.push(`• ${t(`confirmPreview.setting_${c.setting}`)}: ${show(c.old)} → ${show(c.new)}`)
      } else if (!c.field) {
        lines.push(`• ${c.system}: ${t(`confirmPreview.system_${c.change}`)}`)
      } else {
        lines.push(`• ${c.system} — ${t(`confirmPreview.field_${c.field}`)}: ${show(c.old)} → ${show(c.new)}`)
      }
    })
  }
  lines.push('', t('confirmPreview.confirmAnyway'))
  return lines.join('\n')
}
