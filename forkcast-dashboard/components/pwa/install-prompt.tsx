'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Download, Smartphone, Check, Info, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Module-level capture: the beforeinstallprompt event fires ONCE early in page load.
// We capture it globally so ANY InstallPrompt instance on ANY page can use it,
// even if it mounts after the event fired.
let deferredPrompt: BeforeInstallPromptEvent | null = null
const promptListeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    promptListeners.forEach(fn => fn())
  })
}

interface InstallPromptProps {
  variant?: 'button' | 'card'
}

export function InstallPrompt({ variant = 'button' }: InstallPromptProps) {
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isInstallable, setIsInstallable] = useState(!!deferredPrompt)
  const [showPopover, setShowPopover] = useState(false)
  const [showCard, setShowCard] = useState(true)

  useEffect(() => {
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    setIsIOS(iOS)

    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                      (navigator as any).standalone === true
    setIsStandalone(standalone)

    // If the event already fired before this component mounted, sync state
    if (deferredPrompt) setIsInstallable(true)

    // Listen for future events (e.g., if user dismisses and prompt re-fires)
    // Check if user dismissed recently (within 7 days)
    const dismissedTime = localStorage.getItem('installPromptDismissed')
    if (dismissedTime) {
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
      if (parseInt(dismissedTime) > sevenDaysAgo) {
        setShowCard(false)
      }
    }

    const onPromptAvailable = () => setIsInstallable(!!deferredPrompt)
    promptListeners.add(onPromptAvailable)
    return () => { promptListeners.delete(onPromptAvailable) }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt()
        const choiceResult = await deferredPrompt.userChoice

        if (choiceResult.outcome === 'accepted') {
          toast.success('App installed successfully!')
          setShowPopover(false)
          setShowCard(false)
        } else {
          toast.info('App installation cancelled')
        }

        deferredPrompt = null
        setIsInstallable(false)
      } catch (error) {
        console.error('Error installing app:', error)
        toast.error('Failed to install app')
      }
    } else if (isIOS) {
      if (variant === 'button') {
        setShowPopover(true)
      }
    }
  }

  const dismissCard = () => {
    setShowCard(false)
    localStorage.setItem('installPromptDismissed', Date.now().toString())
  }

  // Get button state and content
  const getButtonState = () => {
    if (isStandalone) {
      return {
        icon: Check,
        text: 'App Installed',
        variant: 'secondary' as const,
        disabled: true,
        className: 'text-green-600 border-green-200 bg-green-50 hover:bg-green-50'
      }
    } else if (isInstallable) {
      return {
        icon: Download,
        text: 'Install App',
        variant: 'outline' as const,
        disabled: false,
        className: 'border-blue-200 text-blue-700 hover:bg-blue-50'
      }
    } else if (isIOS) {
      return {
        icon: Smartphone,
        text: 'Add to Home',
        variant: 'outline' as const,
        disabled: false,
        className: 'border-blue-200 text-blue-700 hover:bg-blue-50'
      }
    } else {
      return {
        icon: Info,
        text: 'PWA Info',
        variant: 'outline' as const,
        disabled: false,
        className: 'border-gray-200 text-gray-600 hover:bg-gray-50'
      }
    }
  }

  const buttonState = getButtonState()
  const IconComponent = buttonState.icon

  // Card variant for settings page
  if (variant === 'card') {
    // Don't show card if already installed or dismissed
    if (isStandalone) {
      return (
        <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-lg text-green-800">App Installed</CardTitle>
                <CardDescription className="text-green-600">
                  Plate Management App is installed and ready to use
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-green-700 bg-green-100 p-3 rounded-lg">
              Your app is running in standalone mode with full PWA capabilities including offline support and push notifications.
            </div>
          </CardContent>
        </Card>
      )
    }

    // Dismissal check moved to useEffect to avoid setState during render

    if (!showCard) {
      return (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-100 p-2">
                  <Download className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Install App</CardTitle>
                  <CardDescription>
                    Get the full app experience
                  </CardDescription>
                </div>
              </div>
              <Button
                onClick={() => setShowCard(true)}
                variant="outline"
                size="sm"
                className="border-blue-200 text-blue-700 hover:bg-blue-100"
              >
                Show Options
              </Button>
            </div>
          </CardHeader>
        </Card>
      )
    }

    return (
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Install Plate Management App</CardTitle>
                <CardDescription>
                  Get quick access to your restaurant management tools
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={dismissCard}
              className="h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground text-sm">Install the app for faster access, offline support, and push notifications.
          </div>
          
          {isInstallable ? (
            <Button onClick={handleInstall} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Install App Now
            </Button>
          ) : isIOS ? (
            <div className="space-y-3">
              <div className="text-sm bg-blue-50 p-4 rounded-lg">
                <p className="font-medium mb-2 text-blue-900">To install on iOS:</p>
                <ol className="space-y-1 text-blue-800 text-sm">
                  <li>1. Tap the share button <span className="font-mono bg-blue-100 px-1 rounded">⎋</span> in Safari</li>
                  <li>2. Select "Add to Home Screen" <span className="font-mono bg-blue-100 px-1 rounded">➕</span></li>
                  <li>3. Tap "Add" to install the app</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Button disabled className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Install Not Available
              </Button>
              <div className="text-sm bg-gray-50 p-3 rounded-lg text-gray-600">
                Try using Chrome, Edge, or Safari for the best PWA experience.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Button variant for header - don't show if already installed
  if (variant === 'button' && isStandalone) {
    return null
  }

  const PopoverContentComponent = () => (
    <PopoverContent className="w-80 p-4" align="start">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2">
            <Download className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h4 className="font-semibold">Install Plate Management App</h4>
            <p className="text-sm text-muted-foreground text-sm">Get faster access and offline support
            </p>
          </div>
        </div>
        
        {isStandalone ? (
          <div className="text-sm text-green-700 bg-green-50 p-3 rounded-lg flex items-center gap-2">
            <Check className="h-4 w-4" />
            App is already installed and ready to use!
          </div>
        ) : isInstallable ? (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground text-sm">Install for faster access, offline support, and push notifications.
            </div>
            <Button onClick={handleInstall} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Install Now
            </Button>
          </div>
        ) : isIOS ? (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground text-sm">Add to your home screen for app-like experience.
            </div>
            <div className="text-sm bg-blue-50 p-3 rounded-lg">
              <p className="font-medium mb-2 text-blue-900">To install on iOS:</p>
              <ol className="space-y-1 text-blue-800 text-xs">
                <li>1. Tap the share button <span className="font-mono bg-blue-100 px-1 rounded">⎋</span> in Safari</li>
                <li>2. Select "Add to Home Screen" <span className="font-mono bg-blue-100 px-1 rounded">➕</span></li>
                <li>3. Tap "Add" to install the app</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground text-sm">PWA installation not available on this browser/device.
            </div>
            <div className="text-xs bg-gray-50 p-3 rounded-lg text-gray-600">
              Try using Chrome, Edge, or Safari for the best PWA experience.
            </div>
          </div>
        )}
      </div>
    </PopoverContent>
  )

  return (
    <Popover open={showPopover} onOpenChange={setShowPopover}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant={buttonState.variant}
          disabled={buttonState.disabled && !isStandalone}
          onClick={isInstallable ? handleInstall : isIOS ? () => setShowPopover(!showPopover) : () => setShowPopover(!showPopover)}
          className={cn(
            "px-2 py-1 h-6 text-xs font-medium rounded-md transition-all duration-300",
            buttonState.className
          )}
        >
          <IconComponent className="h-3 w-3 mr-1" />
          <span className="hidden sm:inline">{buttonState.text}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContentComponent />
    </Popover>
  )
}
