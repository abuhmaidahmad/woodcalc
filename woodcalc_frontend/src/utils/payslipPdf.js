// Payslip PDF export — reuses the same window.open + document.write + window.print()
// mechanic as features/kitchen_planner/ProposalTab.jsx's exportPDF(), RTL-aware with
// logical CSS properties and translated labels passed in from the caller.
export function exportPayslipPDF({ employee, payroll, companyName, t, dir, locale }) {
  const fmt = n => Number(n || 0).toFixed(2)

  const html = `<!DOCTYPE html><html dir="${dir || 'ltr'}"><head><meta charset="UTF-8">
  <title>${t('payslipPdf.title')} - ${employee.first_name} ${employee.last_name}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box }
    body { font-family: 'Inter', Arial, sans-serif; font-size: 13px; color: #1A1A1A; padding: 32px }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #C8902A }
    .logo { font-size: 20px; font-weight: 800; color: #C8902A }
    h1 { font-size: 18px; font-weight: 800; margin-top: 4px }
    .meta { font-size: 12px; color: #666; margin-top: 2px }
    .info-block { background: #F7F4F0; padding: 14px 16px; border-radius: 8px; margin-bottom: 20px }
    .info-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px }
    .info-label { color: #888 }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px }
    td { padding: 10px 14px; border-bottom: 1px solid #F0EBE5; font-size: 13px }
    .amount { text-align: end; font-weight: 600 }
    .grand { background: #FDF6EC; border: 2px solid #C8902A33; border-radius: 8px; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; margin-top: 4px }
    .grand-label { font-size: 14px; font-weight: 800 }
    .grand-amount { font-size: 22px; font-weight: 800; color: #C8902A }
    .notes { margin-top: 16px; padding: 10px 12px; background: #FAFAFA; border-radius: 6px; font-size: 12px; color: #666; font-style: italic }
    @media print { body { padding: 16px } }
  </style></head><body>
    <div class="header">
      <div>
        <div class="logo">${companyName || 'WoodCalc'}</div>
        <h1>${t('payslipPdf.title')}</h1>
        <div class="meta">${t('payslipPdf.period')} ${payroll.period}</div>
      </div>
    </div>

    <div class="info-block">
      <div class="info-row"><span class="info-label">${t('payslipPdf.employee')}</span><strong>${employee.first_name} ${employee.last_name}</strong></div>
      ${employee.job_title ? `<div class="info-row"><span class="info-label">${t('payslipPdf.jobTitle')}</span><span>${employee.job_title}</span></div>` : ''}
    </div>

    <table>
      <tbody>
        <tr><td>${t('payslipPdf.baseSalary')}</td><td class="amount">${fmt(payroll.base_salary)} JD</td></tr>
        <tr><td>${t('payslipPdf.bonuses')}</td><td class="amount">+${fmt(payroll.bonuses)} JD</td></tr>
        <tr><td>${t('payslipPdf.deductions')}</td><td class="amount">-${fmt(payroll.deductions)} JD</td></tr>
      </tbody>
    </table>

    <div class="grand">
      <div class="grand-label">${t('payslipPdf.netPay')}</div>
      <div class="grand-amount">${fmt(payroll.net_pay)} JD</div>
    </div>

    ${payroll.notes ? `<div class="notes">${t('payslipPdf.notes')}: ${payroll.notes}</div>` : ''}

    <script>window.onload = () => window.print()</script>
  </body></html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
}
