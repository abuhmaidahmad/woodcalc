import React from 'react'
import { LanguageCtx } from '../i18n/LanguageContext'

export default class ErrorBoundary extends React.Component {
  static contextType = LanguageCtx

  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      const t = this.context?.t || (key => key)
      return this.props.fallback || (
        <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
          {t('errorBoundary.message')}
        </div>
      )
    }
    return this.props.children
  }
}
