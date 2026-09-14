function switchTab(setTab, tabId) {
  return () => new Promise(resolve => {
    setTab(tabId)
    setTimeout(resolve, 120)
  })
}

function switchTabWithSetup(setTab, tabId, ensureSetup) {
  return () => new Promise(resolve => {
    ensureSetup()
    setTab(tabId)
    setTimeout(resolve, 150)
  })
}

export default function configuratorSteps(t, setTab, ensureConfiguratorSetup) {
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
    {
      target: '#onboarding-configurator-room-size',
      title: t('onboarding.configuratorStep3Title'),
      content: t('onboarding.configuratorStep3Content'),
      placement: 'auto',
      before: switchTab(setTab, 'room'),
    },
    {
      target: '#onboarding-configurator-room-elements',
      title: t('onboarding.configuratorStep4Title'),
      content: t('onboarding.configuratorStep4Content'),
      placement: 'auto',
      before: switchTab(setTab, 'room'),
    },
    {
      target: '#onboarding-configurator-floor-tiles',
      title: t('onboarding.configuratorStep5Title'),
      content: t('onboarding.configuratorStep5Content'),
      placement: 'auto',
      before: switchTab(setTab, 'room'),
    },
    {
      target: '#onboarding-configurator-countertop',
      title: t('onboarding.configuratorStep6Title'),
      content: t('onboarding.configuratorStep6Content'),
      placement: 'auto',
      before: switchTab(setTab, 'room'),
    },
    {
      target: '#onboarding-configurator-room-canvas',
      title: t('onboarding.configuratorStep7Title'),
      content: t('onboarding.configuratorStep7Content'),
      placement: 'top',
      before: switchTab(setTab, 'room'),
    },
    {
      target: '#onboarding-configurator-room-properties',
      title: t('onboarding.configuratorStep8Title'),
      content: t('onboarding.configuratorStep8Content'),
      placement: 'auto',
      before: switchTab(setTab, 'room'),
    },
    {
      target: '#onboarding-configurator-catalog',
      title: t('onboarding.configuratorStep9Title'),
      content: t('onboarding.configuratorStep9Content'),
      placement: 'auto',
      before: switchTabWithSetup(setTab, 'planner', ensureConfiguratorSetup),
    },
    {
      target: '#onboarding-configurator-cabinets-canvas',
      title: t('onboarding.configuratorStep10Title'),
      content: t('onboarding.configuratorStep10Content'),
      placement: 'top',
      before: switchTabWithSetup(setTab, 'planner', ensureConfiguratorSetup),
    },
    {
      target: '#onboarding-configurator-cabinets-properties',
      title: t('onboarding.configuratorStep11Title'),
      content: t('onboarding.configuratorStep11Content'),
      placement: 'auto',
      before: switchTabWithSetup(setTab, 'planner', ensureConfiguratorSetup),
    },
  ]
}
