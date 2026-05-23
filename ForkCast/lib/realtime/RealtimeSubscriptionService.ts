// lib/realtime/RealtimeSubscriptionService.ts
import { supabase } from "@/config/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE";
export type TableName = keyof Database["public"]["Tables"];

interface SubscriptionOptions {
  event?: RealtimeEvent | "*";
  filter?: string;
  debounceMs?: number;
  enableLogging?: boolean;
}

interface SubscriptionHandler<T = any> {
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: { old: T; new: T }) => void;
  onDelete?: (payload: T) => void;
  onAny?: (payload: { eventType: RealtimeEvent; old?: T; new?: T }) => void;
}

interface ActiveSubscription {
  channel: RealtimeChannel;
  handlers: Set<SubscriptionHandler>;
  debounceTimeout?: NodeJS.Timeout;
  options: SubscriptionOptions;
}

/**
 * Centralized real-time subscription service that handles all Supabase subscriptions
 * with proper cleanup, error handling, and optimization
 */
export class RealtimeSubscriptionService {
  private subscriptions = new Map<string, ActiveSubscription>();
  private isInitialized = false;
  private cleanupTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (this.isInitialized) return;

    // Listen for app lifecycle events
    if (typeof global !== "undefined" && global.addEventListener) {
      global.addEventListener("beforeunload", this.cleanup.bind(this));
    }

    this.isInitialized = true;
  }

  /**
   * Subscribe to table changes with typed payload
   */
  subscribe<T = any>(
    table: TableName,
    handler: SubscriptionHandler<T>,
    options: SubscriptionOptions = {},
  ): () => void {
    const {
      event = "*",
      filter,
      debounceMs = 500,
      enableLogging = false,
    } = options;

    // Create unique subscription key
    const subscriptionKey = this.createSubscriptionKey(table, event, filter);

    if (enableLogging) {
    }

    // Get or create subscription
    let subscription = this.subscriptions.get(subscriptionKey);

    if (!subscription) {
      subscription = this.createSubscription(
        table,
        subscriptionKey,
        event,
        filter,
        { ...options, debounceMs, enableLogging },
      );
      this.subscriptions.set(subscriptionKey, subscription);
    }

    // Add handler to existing subscription
    subscription.handlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.unsubscribeHandler(subscriptionKey, handler);
    };
  }

  /**
   * Subscribe to user-specific data changes
   */
  subscribeToUser<T = any>(
    table: TableName,
    userId: string,
    handler: SubscriptionHandler<T>,
    options: Omit<SubscriptionOptions, "filter"> = {},
  ): () => void {
    return this.subscribe(table, handler, {
      ...options,
      filter: `user_id=eq.${userId}`,
    });
  }

  /**
   * Subscribe to restaurant-specific data changes
   */
  subscribeToRestaurant<T = any>(
    table: TableName,
    restaurantId: string,
    handler: SubscriptionHandler<T>,
    options: Omit<SubscriptionOptions, "filter"> = {},
  ): () => void {
    return this.subscribe(table, handler, {
      ...options,
      filter: `restaurant_id=eq.${restaurantId}`,
    });
  }

  /**
   * Subscribe to booking-related changes for a user
   */
  subscribeToUserBookings(
    userId: string,
    handler: SubscriptionHandler<
      Database["public"]["Tables"]["bookings"]["Row"]
    >,
    options: SubscriptionOptions = {},
  ): () => void {
    return this.subscribeToUser("bookings", userId, handler, options);
  }

  /**
   * Subscribe to waitlist changes for a user
   */
  subscribeToUserWaitlist(
    userId: string,
    handler: SubscriptionHandler<
      Database["public"]["Tables"]["waitlist"]["Row"]
    >,
    options: SubscriptionOptions = {},
  ): () => void {
    return this.subscribeToUser("waitlist", userId, handler, options);
  }

  /**
   * Subscribe to availability changes for a restaurant
   */
  subscribeToRestaurantAvailability(
    restaurantId: string,
    handler: SubscriptionHandler,
    options: SubscriptionOptions = {},
  ): () => void {
    // Subscribe to multiple tables that affect availability
    const unsubscribers = [
      this.subscribeToRestaurant("bookings", restaurantId, handler, options),
      this.subscribeToRestaurant(
        "restaurant_tables",
        restaurantId,
        handler,
        options,
      ),
      this.subscribe(
        "booking_tables",
        {
          onAny: async (payload) => {
            // Check if this booking affects the restaurant
            await this.checkBookingRestaurant(payload, restaurantId, handler);
          },
        },
        options,
      ),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }

  /**
   * Subscribe to notification changes for a user
   */
  subscribeToUserNotifications(
    userId: string,
    handler: SubscriptionHandler<
      Database["public"]["Tables"]["notifications"]["Row"]
    >,
    options: SubscriptionOptions = {},
  ): () => void {
    return this.subscribeToUser("notifications", userId, handler, options);
  }

  /**
   * Subscribe to booking invitation changes for a user
   */
  subscribeToUserInvitations(
    userId: string,
    handler: SubscriptionHandler<
      Database["public"]["Tables"]["booking_invites"]["Row"]
    >,
    options: SubscriptionOptions = {},
  ): () => void {
    // Subscribe to both sent and received invitations
    const unsubscribers = [
      this.subscribe("booking_invites", handler, {
        ...options,
        filter: `from_user_id=eq.${userId}`,
      }),
      this.subscribe("booking_invites", handler, {
        ...options,
        filter: `to_user_id=eq.${userId}`,
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }

  /**
   * Subscribe to friend request changes for a user
   */
  subscribeToUserFriendRequests(
    userId: string,
    handler: SubscriptionHandler<
      Database["public"]["Tables"]["friend_requests"]["Row"]
    >,
    options: SubscriptionOptions = {},
  ): () => void {
    const unsubscribers = [
      this.subscribe("friend_requests", handler, {
        ...options,
        filter: `from_user_id=eq.${userId}`,
      }),
      this.subscribe("friend_requests", handler, {
        ...options,
        filter: `to_user_id=eq.${userId}`,
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }

  private createSubscription(
    table: TableName,
    subscriptionKey: string,
    event: RealtimeEvent | "*",
    filter: string | undefined,
    options: SubscriptionOptions,
  ): ActiveSubscription {
    const { enableLogging } = options;

    const channel = supabase
      .channel(subscriptionKey)
      .on(
        "postgres_changes" as any,
        {
          event: event as any,
          schema: "public",
          table,
          ...(filter && { filter }),
        },
        (payload: any) => {
          if (enableLogging) {
          }
          this.handleRealtimeChange(subscriptionKey, payload);
        },
      )
      .subscribe((status) => {
        this.handleSubscriptionStatus(subscriptionKey, status, enableLogging);
      });

    return {
      channel,
      handlers: new Set(),
      options,
    };
  }

  private createSubscriptionKey(
    table: TableName,
    event: RealtimeEvent | "*",
    filter?: string,
  ): string {
    return `${table}:${event}${filter ? `:${filter}` : ""}`;
  }

  private handleRealtimeChange(subscriptionKey: string, payload: any): void {
    const subscription = this.subscriptions.get(subscriptionKey);
    if (!subscription) return;

    const { debounceMs = 500 } = subscription.options;

    // Clear existing debounce timeout
    if (subscription.debounceTimeout) {
      clearTimeout(subscription.debounceTimeout);
    }

    // Debounce the notifications
    subscription.debounceTimeout = setTimeout(() => {
      this.notifyHandlers(subscription, payload);
    }, debounceMs) as any;
  }

  private notifyHandlers(subscription: ActiveSubscription, payload: any): void {
    const { eventType, old, new: newData } = payload;

    subscription.handlers.forEach((handler) => {
      try {
        // Call specific event handler
        switch (eventType) {
          case "INSERT":
            handler.onInsert?.(newData);
            break;
          case "UPDATE":
            handler.onUpdate?.({ old, new: newData });
            break;
          case "DELETE":
            handler.onDelete?.(old);
            break;
        }

        // Call generic handler
        handler.onAny?.({ eventType, old, new: newData });
      } catch (error) {
        console.error("Error in real-time handler:", error);
      }
    });
  }

  private handleSubscriptionStatus(
    subscriptionKey: string,
    status: string,
    enableLogging?: boolean,
  ): void {
    if (enableLogging) {
    }

    switch (status) {
      case "SUBSCRIBED":
        // Successfully connected
        break;
      case "CHANNEL_ERROR":
        console.error(`Subscription error for ${subscriptionKey}`);
        this.retrySubscription(subscriptionKey);
        break;
      case "TIMED_OUT":
        console.warn(`Subscription timeout for ${subscriptionKey}`);
        this.retrySubscription(subscriptionKey);
        break;
      case "CLOSED":
        this.subscriptions.delete(subscriptionKey);
        break;
    }
  }

  private retrySubscription(subscriptionKey: string): void {
    // Implement exponential backoff retry logic
    const retryTimeout = setTimeout(() => {
      const subscription = this.subscriptions.get(subscriptionKey);
      if (subscription && subscription.handlers.size > 0) {
        // Recreate the subscription
        subscription.channel.unsubscribe();
        // The subscription will be recreated when handlers are still active
      }
    }, 2000);

    this.cleanupTimeouts.set(subscriptionKey, retryTimeout);
  }

  private unsubscribeHandler(
    subscriptionKey: string,
    handler: SubscriptionHandler,
  ): void {
    const subscription = this.subscriptions.get(subscriptionKey);
    if (!subscription) return;

    subscription.handlers.delete(handler);

    // If no more handlers, schedule cleanup
    if (subscription.handlers.size === 0) {
      const cleanupTimeout = setTimeout(() => {
        const currentSubscription = this.subscriptions.get(subscriptionKey);
        if (currentSubscription && currentSubscription.handlers.size === 0) {
          currentSubscription.channel.unsubscribe();
          this.subscriptions.delete(subscriptionKey);
        }
      }, 5000); // 5 second delay before cleanup

      this.cleanupTimeouts.set(subscriptionKey, cleanupTimeout);
    }
  }

  private async checkBookingRestaurant(
    payload: any,
    restaurantId: string,
    handler: SubscriptionHandler,
  ): Promise<void> {
    try {
      const bookingId = payload.new?.booking_id || payload.old?.booking_id;
      if (!bookingId) return;

      const { data, error } = await supabase
        .from("bookings")
        .select("restaurant_id")
        .eq("id", bookingId)
        .single();

      if (error) {
        console.error("Error checking booking restaurant:", error);
        return;
      }

      if (data?.restaurant_id === restaurantId) {
        handler.onAny?.(payload);
      }
    } catch (error) {
      console.error("Error in checkBookingRestaurant:", error);
    }
  }

  /**
   * Get subscription status
   */
  getSubscriptionStatus(subscriptionKey: string): string {
    const subscription = this.subscriptions.get(subscriptionKey);
    if (!subscription) return "unsubscribed";

    const state = (subscription.channel as any).state;
    if (state === "joined") return "subscribed";
    if (state === "joining" || state === "leaving") return "subscribing";
    return "unsubscribed";
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Cleanup all subscriptions
   */
  cleanup(): void {
    // Clear all pending timeouts
    this.cleanupTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.cleanupTimeouts.clear();

    // Clear all subscription debounce timeouts
    this.subscriptions.forEach((subscription) => {
      if (subscription.debounceTimeout) {
        clearTimeout(subscription.debounceTimeout);
      }
      try {
        subscription.channel.unsubscribe();
      } catch (error) {
        console.error("Error unsubscribing channel:", error);
      }
    });

    this.subscriptions.clear();
  }

  /**
   * Pause all subscriptions (useful for background states)
   */
  pauseAll(): void {
    this.subscriptions.forEach((subscription) => {
      subscription.channel.unsubscribe();
    });
  }

  /**
   * Resume all subscriptions
   */
  resumeAll(): void {
    // This would need to be implemented based on stored subscription data
    // For now, cleanup and let components re-subscribe
    this.cleanup();
  }
}

// Singleton instance
export const realtimeService = new RealtimeSubscriptionService();

// Export types for use in components
export type { SubscriptionHandler, SubscriptionOptions };
