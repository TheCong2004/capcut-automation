import { useState } from 'react'
import { Toaster } from 'sonner'
import { Sidebar } from '@mediacrawler/components/layout/Sidebar'
import { MainContent } from '@mediacrawler/components/layout/MainContent'
import { AuthorFooter } from '@mediacrawler/components/layout/AuthorFooter'
import { CrawlerConfigPanel } from '@mediacrawler/components/config/CrawlerConfigPanel'
import { EnvironmentCheck, isEnvChecked } from '@mediacrawler/components/env/EnvironmentCheck'
import { LicenseDisclaimer, isLicenseAccepted } from '@mediacrawler/components/license/LicenseDisclaimer'
import { useThemeStore } from '@mediacrawler/store/themeStore'

function App() {
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme)
  // Initialize by checking localStorage if license has been accepted
  const [licenseAccepted, setLicenseAccepted] = useState(() => isLicenseAccepted())
  // Initialize by checking localStorage if env check has passed
  const [envChecked, setEnvChecked] = useState(() => isEnvChecked())
  // State for showing disclaimer manually
  const [showDisclaimer, setShowDisclaimer] = useState(false)

  const handleEnvCheckComplete = () => {
    setEnvChecked(true)
  }

  const handleLicenseAccept = () => {
    setLicenseAccepted(true)
    setShowDisclaimer(false)
  }

  const handleShowDisclaimer = () => {
    setShowDisclaimer(true)
  }

  return (
    <div
      className={`mediacrawler-scope ${resolvedTheme} flex h-full min-h-0 flex-col overflow-hidden cyber-grid relative`}
    >
      {/* License Disclaimer Modal - Shows first or when triggered */}
      {(!licenseAccepted || showDisclaimer) && (
        <LicenseDisclaimer onAccept={handleLicenseAccept} />
      )}

      {/* Environment Check Modal - Shows after license accepted */}
      {licenseAccepted && !showDisclaimer && !envChecked && (
        <EnvironmentCheck onCheckComplete={handleEnvCheckComplete} />
      )}

      {/* Header Bar */}
      <Sidebar onShowDisclaimer={handleShowDisclaimer} />

      {/* Main Area */}
      <div className="flex-1 flex flex-col gap-4 p-4 overflow-hidden min-h-0">
        {/* Config Panel - Primary Action Area (Always Expanded) */}
        <div className="flex-shrink-0">
          <CrawlerConfigPanel />
        </div>

        {/* Console - Collapsible Terminal */}
        <MainContent />
      </div>

      {/* Author Footer */}
      <AuthorFooter />

      {/* Toast notifications - Theme-aware style */}
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'glass-panel font-mono text-cyber-text-primary',
          style: {
            fontFamily: 'JetBrains Mono, monospace',
          },
        }}
      />
    </div>
  )
}

export default App
