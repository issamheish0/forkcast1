// Stub: conversation memory is not used in ForkCast

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number
}

class ConversationMemory {
  private messages: ConversationMessage[] = []
  private sessionId: string | null = null
  private restaurantId: string | null = null

  initSession(restaurantId: string, existingSessionId?: string): string {
    this.restaurantId = restaurantId
    if (!this.sessionId || (existingSessionId && existingSessionId !== this.sessionId)) {
      this.sessionId = existingSessionId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))
      this.messages = []
    }
    return this.sessionId
  }

  addMessage(role: 'user' | 'assistant' | 'system', content: string): void {
    this.messages.push({ role, content, timestamp: Date.now() })
  }

  getConversationHistory(): ConversationMessage[] {
    return [...this.messages]
  }

  clearSession(): void {
    this.messages = []
    this.sessionId = null
  }

  resetConversation(): void {
    this.messages = []
  }

  isSessionExpired(): boolean {
    return false
  }

  getSessionInfo(): { sessionId: string; restaurantId: string; messageCount: number } | null {
    if (!this.sessionId || !this.restaurantId) return null
    return {
      sessionId: this.sessionId,
      restaurantId: this.restaurantId,
      messageCount: this.messages.length,
    }
  }
}

export const conversationMemory = new ConversationMemory()
