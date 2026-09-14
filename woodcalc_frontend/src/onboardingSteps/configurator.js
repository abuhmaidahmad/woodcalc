export default function configuratorSteps(t) {
  return [
    {
      target: '#onboarding-configurator-project',
      title: t('onboarding.configuratorStep1Title'),
      content: t('onboarding.configuratorStep1Content'),
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '#onboarding-configurator-tabs',
      title: t('onboarding.configuratorStep2Title'),
      content: t('onboarding.configuratorStep2Content'),
      placement: 'bottom',
    },
  ]
}
