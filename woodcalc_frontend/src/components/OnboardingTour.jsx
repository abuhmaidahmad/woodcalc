import React, { useEffect, useState } from 'react'
import { Joyride, STATUS } from 'react-joyride'
import { fetchOnboardingProgress, markOnboardingComplete } from '../api/auth'

export default function OnboardingTour({ moduleKey, steps }) {
  const [run, setRun] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function check() {
      const replayKey = `replay_tour_${moduleKey}`
      if (sessionStorage.getItem(replayKey)) {
        sessionStorage.removeItem(replayKey)
        if (!cancelled) setRun(true)
        return
      }
      try {
        const progress = await fetchOnboardingProgress()
        if (!cancelled && !progress[moduleKey]) setRun(true)
      } catch {}
    }

    check()
    return () => { cancelled = true }
  }, [moduleKey])

  const handleEvent = (data) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      setRun(false)
      markOnboardingComplete(moduleKey)
    }
  }

  if (!steps || steps.length === 0) return null

  return (
    <Joyride
      run={run}
      steps={steps}
      continuous
      onEvent={handleEvent}
      options={{ primaryColor: '#C8902A', showProgress: true, zIndex: 10000, closeButtonAction: 'skip' }}
    />
  )
}
