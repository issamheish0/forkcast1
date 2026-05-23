// components/waitlist/notification-dialog.tsx

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { 
  Phone,
  Mail,
  MessageSquare,
  Bell,
  Send,
  Loader2,
  CheckCircle
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatTimeRange } from '@/lib/utils/time-utils'
import type { WaitlistEntry } from '@/types'

interface NotificationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  waitlistEntry: WaitlistEntry
  onNotificationSent?: (method: string) => void
}

const NOTIFICATION_TEMPLATES = {
  table_ready: {
    sms: "Hi {name}! Your table for {party_size} is ready at {restaurant}. Please arrive within 15 minutes to secure your spot. Thanks!",
    email: {
      subject: "Your Table is Ready!",
      body: "Dear {name},\n\nGreat news! Your table for {party_size} guests is now ready at {restaurant}.\n\nPlease arrive within the next 15 minutes to secure your reservation.\n\nDate: {date}\nTime: {time}\n\nThank you for choosing {restaurant}!"
    }
  },
  table_available_soon: {
    sms: "Hi {name}! Your table for {party_size} at {restaurant} will be ready in about 10-15 minutes. Please be prepared to arrive shortly!",
    email: {
      subject: "Your Table Will Be Ready Soon",
      body: "Dear {name},\n\nYour table for {party_size} guests at {restaurant} will be ready in approximately 10-15 minutes.\n\nPlease be prepared to arrive shortly to secure your reservation.\n\nDate: {date}\nTime: {time}\n\nThank you for your patience!"
    }
  },
  custom: {
    sms: "",
    email: {
      subject: "",
      body: ""
    }
  }
}

export function NotificationDialog({
  open,
  onOpenChange,
  waitlistEntry,
  onNotificationSent
}: NotificationDialogProps) {
  const supabase = createClient()
  const [selectedMethod, setSelectedMethod] = useState<'sms' | 'email' | 'push'>('sms')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('table_ready')
  const [customMessage, setCustomMessage] = useState('')
  const [customSubject, setCustomSubject] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [notificationSent, setNotificationSent] = useState(false)

  const getTemplateContent = (template: string, method: 'sms' | 'email' | 'push') => {
    const templateData = NOTIFICATION_TEMPLATES[template as keyof typeof NOTIFICATION_TEMPLATES]
    if (!templateData) return ''

    // For push notifications, use SMS template as fallback
    const content = method === 'sms' || method === 'push' ? templateData.sms : templateData.email?.body || ''
    
    // Replace placeholders
    return content
      .replace('{name}', waitlistEntry.user?.full_name || 'Guest')
      .replace('{party_size}', waitlistEntry.party_size.toString())
      .replace('{restaurant}', 'Your Restaurant') // You might want to fetch this from context
      .replace('{date}', format(parseISO(waitlistEntry.desired_date), 'EEEE, MMM dd, yyyy'))
      .replace('{time}', formatTimeRange(waitlistEntry.desired_time_range))
  }

  const getTemplateSubject = (template: string) => {
    const templateData = NOTIFICATION_TEMPLATES[template as keyof typeof NOTIFICATION_TEMPLATES]
    return templateData?.email?.subject || ''
  }

  const handleSendNotification = async () => {
    setIsLoading(true)
    try {
      let message = customMessage
      let subject = customSubject

      if (selectedTemplate !== 'custom') {
        message = getTemplateContent(selectedTemplate, selectedMethod)
        if (selectedMethod === 'email') {
          subject = getTemplateSubject(selectedTemplate)
        }
      }

      if (!message.trim()) {
        toast.error('Please enter a message')
        return
      }

      if (selectedMethod === 'email' && !subject.trim()) {
        toast.error('Please enter an email subject')
        return
      }

      // Here you would integrate with your notification service
      // For now, we'll simulate the API call
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Update waitlist status to 'notified'
      const { error: updateError } = await supabase
        .from('waitlist')
        .update({ status: 'notified' })
        .eq('id', waitlistEntry.id)

      if (updateError) throw updateError

      // Log the notification (you might want to create a notifications table)
      const { error: logError } = await supabase
        .from('waitlist_notifications')
        .insert({
          waitlist_entry_id: waitlistEntry.id,
          notification_method: selectedMethod,
          message: message,
          subject: selectedMethod === 'email' ? subject : null,
          sent_at: new Date().toISOString(),
          sent_by: (await supabase.auth.getUser()).data.user?.id
        })

      // Don't fail if logging fails, just warn
      if (logError) {
        console.warn('Failed to log notification:', logError)
      }

      setNotificationSent(true)
      toast.success(`${selectedMethod.toUpperCase()} notification sent successfully!`)
      
      setTimeout(() => {
        onNotificationSent?.(selectedMethod)
        setNotificationSent(false)
      }, 2000)

    } catch (error) {
      console.error('Error sending notification:', error)
      toast.error('Failed to send notification')
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setSelectedMethod('sms')
    setSelectedTemplate('table_ready')
    setCustomMessage('')
    setCustomSubject('')
    setNotificationSent(false)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open)
      if (!open) resetForm()
    }}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Send Notification</DialogTitle>
          <DialogDescription>
            Notify {waitlistEntry.user?.full_name || 'Guest'} about their table status
          </DialogDescription>
        </DialogHeader>

        {notificationSent ? (
          <div className="flex items-center justify-center py-4">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Notification Sent!</h3>
              <p className="text-muted-foreground text-sm">The customer has been notified via {selectedMethod.toUpperCase()}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Customer Info */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">Customer Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Name:</span> {waitlistEntry.user?.full_name || 'Guest'}
                  </div>
                  <div>
                    <span className="font-medium">Party Size:</span> {waitlistEntry.party_size}
                  </div>
                  {waitlistEntry.user?.phone_number && (
                    <div>
                      <span className="font-medium">Phone:</span> {waitlistEntry.user.phone_number}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Requested:</span> {format(parseISO(waitlistEntry.desired_date), 'MMM dd')} at {formatTimeRange(waitlistEntry.desired_time_range)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notification Method */}
            <div className="space-y-3">
              <h3 className="font-semibold">Notification Method</h3>
              <Tabs value={selectedMethod} onValueChange={(value) => setSelectedMethod(value as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="sms" className="flex items-center">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    SMS
                  </TabsTrigger>
                  <TabsTrigger value="email" className="flex items-center">
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </TabsTrigger>
                  <TabsTrigger value="push" className="flex items-center">
                    <Bell className="h-4 w-4 mr-2" />
                    Push
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Template Selection */}
            <div className="space-y-3">
              <h3 className="font-semibold">Message Template</h3>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="table_ready">Table is Ready</SelectItem>
                  <SelectItem value="table_available_soon">Table Available Soon</SelectItem>
                  <SelectItem value="custom">Custom Message</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Message Content */}
            <div className="space-y-3">
              {selectedMethod === 'email' && selectedTemplate !== 'custom' && (
                <div>
                  <label className="font-semibold text-sm">Subject</label>
                  <Input
                    value={getTemplateSubject(selectedTemplate)}
                    readOnly
                    className="mt-1"
                  />
                </div>
              )}

              {selectedMethod === 'email' && selectedTemplate === 'custom' && (
                <div>
                  <label className="font-semibold text-sm">Subject</label>
                  <Input
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="Enter email subject..."
                    className="mt-1"
                  />
                </div>
              )}

              <div>
                <label className="font-semibold text-sm">Message</label>
                {selectedTemplate === 'custom' ? (
                  <Textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder={`Enter your ${selectedMethod} message...`}
                    rows={selectedMethod === 'email' ? 6 : 4}
                    className="mt-1"
                  />
                ) : (
                  <Textarea
                    value={getTemplateContent(selectedTemplate, selectedMethod)}
                    readOnly
                    rows={selectedMethod === 'email' ? 6 : 4}
                    className="mt-1 bg-muted"
                  />
                )}
              </div>
            </div>

            {/* Preview */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <h4 className="font-semibold text-sm mb-2 text-blue-800">Preview</h4>
                <div className="text-sm text-blue-700">
                  <div className="flex items-center mb-2">
                    {selectedMethod === 'sms' && <MessageSquare className="h-4 w-4 mr-2" />}
                    {selectedMethod === 'email' && <Mail className="h-4 w-4 mr-2" />}
                    {selectedMethod === 'push' && <Bell className="h-4 w-4 mr-2" />}
                    <span className="font-medium">
                      {selectedMethod.toUpperCase()} to {waitlistEntry.user?.full_name || 'Guest'}
                    </span>
                  </div>
                  {selectedMethod === 'email' && (
                    <div className="mb-2">
                      <span className="font-medium">Subject: </span>
                      {selectedTemplate === 'custom' ? customSubject : getTemplateSubject(selectedTemplate)}
                    </div>
                  )}
                  <div className="border-l-2 border-blue-300 pl-3">
                    {selectedTemplate === 'custom' 
                      ? customMessage 
                      : getTemplateContent(selectedTemplate, selectedMethod)
                    }
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {notificationSent ? 'Close' : 'Cancel'}
          </Button>
          {!notificationSent && (
            <Button 
              onClick={handleSendNotification}
              disabled={isLoading || (selectedTemplate === 'custom' && !customMessage.trim())}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 motion-safe:animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send {selectedMethod.toUpperCase()}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
