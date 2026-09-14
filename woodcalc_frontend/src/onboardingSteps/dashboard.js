export default function dashboardSteps(t) {
  return [
    {
      target: '#onboarding-dashboard-greeting',
      title: t('onboarding.dashboardStep1Title'),
      content: t('onboarding.dashboardStep1Content'),
      placement: 'auto',
      skipBeacon: true,
    },
    {
      target: '#onboarding-dashboard-grid',
      title: t('onboarding.dashboardStep2Title'),
      content: t('onboarding.dashboardStep2Content'),
      placement: 'auto',
    },
  ]
}
