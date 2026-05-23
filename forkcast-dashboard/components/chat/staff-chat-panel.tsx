'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useStaffChat } from '@/lib/contexts/staff-chat-context'
import { X, Send, RotateCcw, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ConversationMessage } from '@/lib/services/conversation-memory'
import { createClient } from '@/lib/supabase/client'

type MessageRole = 'user' | 'assistant' | 'system'

interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  ts: number
}

export default function StaffChatPanel() {
  const { 
    isOpen, 
    close, 
    restaurantId, 
    sessionId, 
    setSessionId,
    addMessage,
    getConversationHistory,
    clearConversation,
    resetConversation,
    isSessionExpired,
    getSessionInfo
  } = useStaffChat()
  
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState<string>('')
  const [isSending, setIsSending] = useState<boolean>(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Load conversation history when component mounts or session changes
  useEffect(() => {
    const history = getConversationHistory()
    const chatMessages: ChatMessage[] = history.map((msg, index) => ({
      id: `${sessionId}_${index}_${msg.timestamp}`,
      role: msg.role,
      content: msg.content,
      ts: msg.timestamp
    }))
    setMessages(chatMessages)
  }, [sessionId, getConversationHistory])

  // Check for session expiration
  useEffect(() => {
    if (isSessionExpired()) {
      clearConversation()
    }
  }, [isSessionExpired, clearConversation])

  useEffect(() => {
    if (!sessionId) {
      setSessionId('staff_default')
    }
  }, [sessionId, setSessionId])

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [isOpen, messages])

  const handleStaffChatError = (error: any, response?: Response) => {
    if (response?.status === 403) {
      console.error('Request blocked - check User-Agent header')
      return 'Request was blocked. Please contact support.'
    }
    
    if (response?.status === 429) {
      const retryAfter = response.headers?.get('retry-after') || '60'
      console.error(`Rate limited. Retry after ${retryAfter} seconds`)
      return `Too many requests. Please wait ${retryAfter} seconds before trying again.`
    }
    
    if (response?.status === 400) {
      console.error('Bad request:', error)
      return 'Invalid request. Please check your input.'
    }
    
    if (response?.status === 503) {
      console.error('Service unavailable')
      return 'AI service is temporarily unavailable. Please try again later.'
    }
    
    console.error('Unexpected error:', error)
    return 'An unexpected error occurred. Please try again.'
  }

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending])

  const sessionInfo = getSessionInfo()

  const handleSend = async () => {
    const text = input.trim()
    if (!text) return
    setInput('')

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      ts: Date.now(),
    }
    
    // Add to local state for immediate UI update
    setMessages(prev => [...prev, userMsg])
    
    // Add to conversation memory
    addMessage('user', text)
    
    setIsSending(true)
    try {
      // Get conversation history for API request
      const conversationHistory = getConversationHistory()
      const formattedHistory = conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      const payload = {
        message: text,
        conversation_history: formattedHistory,
        restaurant_id: restaurantId,
        session_id: sessionId ?? 'staff_default',
      }
      
      // Get JWT token from Supabase session
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const response = await fetch('/api/staff-ai', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (typeof data?.session_id === 'string') {
        setSessionId(data.session_id)
      }
      
      const assistantResponse = data?.response ?? 'No response'
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: assistantResponse,
        ts: Date.now(),
      }
      
      // Add to local state for immediate UI update
      setMessages(prev => [...prev, assistantMsg])
      
      // Add to conversation memory
      addMessage('assistant', assistantResponse)
      
    } catch (error: any) {
      console.error('[StaffChat] Error sending message', error)
      
      let errorMessage = 'An error occurred. Please try again.'
      if (error.message?.includes('401')) {
        errorMessage = 'Authentication required. Please refresh the page and log in.'
      } else if (error.message?.includes('403')) {
        errorMessage = 'Access denied. Please check your permissions.'
      }
      
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'system',
        content: errorMessage,
        ts: Date.now(),
      }
      setMessages(prev => [...prev, errMsg])
      
      // Add error to conversation memory
      addMessage('system', errorMessage)
    } finally {
      setIsSending(false)
    }
  }

  const handleClearConversation = () => {
    clearConversation()
    setMessages([])
  }

  const handleResetConversation = () => {
    resetConversation()
    setMessages([])
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-end p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/30" onClick={close} />

      <Card className="relative z-[90] w-full sm:w-[420px] h-[65vh] sm:h-[70vh] shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold">Staff Assistant</p>
              {sessionInfo && (
                <span className="text-xs bg-muted px-2 py-1 rounded-full">
                  {sessionInfo.messageCount} msgs
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-sm">Restaurant: {restaurantId?.slice(0, 8)}… | Session: {sessionId?.slice(-6)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleResetConversation}
              title="Reset conversation (keep session)"
              className="h-6 w-6"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleClearConversation}
              title="Start new session"
              className="h-6 w-6"
            >
              <Clock className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" onClick={close} aria-label="Close chat">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-muted/20">
          {messages.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-4 space-y-3">
              <div>
                <p className="mb-2">👋 Welcome to Staff Assistant!</p>
                <p className="text-xs">Ask about bookings, capacity, customers, or anything restaurant-related.</p>
                <p className="text-xs mt-1">Your conversation will be remembered during your shift.</p>
              </div>
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
              <div className={
                'inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm ' +
                (m.role === 'user' ? 'bg-primary text-primary-foreground' : m.role === 'assistant' ? 'bg-muted' : 'bg-destructive/10 text-destructive')
              }>
                {m.content}
              </div>
              <div className="text-xs text-muted-foreground text-sm px-1">
                {new Date(m.ts).toLocaleTimeString()}
              </div>
            </div>
          ))}
          {isSending && (
            <div className="text-left">
              <div className="inline-block bg-muted rounded-lg px-3 py-2 text-sm">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full motion-safe:animate-pulse" />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full motion-safe:animate-pulse delay-75" />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full motion-safe:animate-pulse delay-150" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Ask about covers, availability, customers, etc."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSend) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              disabled={isSending}
            />
            <Button onClick={handleSend} disabled={!canSend} aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {sessionInfo && (
            <div className="text-xs text-muted-foreground mt-2 flex justify-between">
              <span>Session expires in ~{Math.max(0, Math.round((8 * 60 * 60 * 1000 - (Date.now() - (sessionInfo as any).lastActivity || 0)) / (60 * 1000)))} min</span>
              <span>{sessionInfo.messageCount}/{20} messages</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}


