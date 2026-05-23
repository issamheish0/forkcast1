// Service Worker v3.4 - Fix: skip Supabase storage interception
const CACHE_NAME = 'restaurant-pwa-v3.4';
const NOTIFICATION_CHECK_INTERVAL = 120000; // Check every 2 minutes (push handles real-time)
const HEARTBEAT_INTERVAL = 300000; // Heartbeat every 5 minutes (browser keeps SW alive for push)
const SUBSCRIPTION_REFRESH_INTERVAL = 3600000; // Refresh subscription every hour
const KEEP_ALIVE_INTERVAL = 300000; // Keep-alive every 5 minutes (not needed with push)
const CRITICAL_SYNC_INTERVAL = 120000; // Critical data sync every 2 minutes

// Keep track of active intervals
let notificationCheckInterval = null;
let heartbeatInterval = null;
let subscriptionRefreshInterval = null;
let keepAliveInterval = null;
let criticalSyncInterval = null;
let lastNotificationCheck = Date.now();
let isCheckingNotifications = false;
let lastActivity = Date.now();
let isAppVisible = true;

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v3.4...');
  self.skipWaiting(); // Force immediate activation
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v3.4...');
  event.waitUntil(
    // Delete old caches from previous SW versions first
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log('[SW] Deleting old cache:', k);
        return caches.delete(k);
      }))
    ).then(() => Promise.all([
      self.clients.claim(),
      startBackgroundTasks(),
      checkForPendingNotifications()
    ]))
  );
});

// Start all background tasks
async function startBackgroundTasks() {
  console.log('[SW] Starting background tasks...');

  // Clear any existing intervals
  stopBackgroundTasks();

  // Start notification checking
  notificationCheckInterval = setInterval(async () => {
    if (!isCheckingNotifications) {
      await checkForPendingNotifications();
    }
  }, NOTIFICATION_CHECK_INTERVAL);

  // Start heartbeat
  heartbeatInterval = setInterval(async () => {
    await sendHeartbeat();
  }, HEARTBEAT_INTERVAL);

  // Start subscription refresh
  subscriptionRefreshInterval = setInterval(async () => {
    await refreshSubscription();
  }, SUBSCRIPTION_REFRESH_INTERVAL);

  // AGGRESSIVE KEEP-ALIVE: Ultra frequent pings to prevent service worker termination
  keepAliveInterval = setInterval(async () => {
    await keepServiceWorkerAlive();
  }, KEEP_ALIVE_INTERVAL);

  // CRITICAL DATA SYNC: Frequent syncing of essential restaurant data
  criticalSyncInterval = setInterval(async () => {
    await performCriticalDataSync();
  }, CRITICAL_SYNC_INTERVAL);

  // Initial checks
  await checkForPendingNotifications();
  await sendHeartbeat();
  await keepServiceWorkerAlive();
}

// Stop all background tasks
function stopBackgroundTasks() {
  if (notificationCheckInterval) clearInterval(notificationCheckInterval);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (subscriptionRefreshInterval) clearInterval(subscriptionRefreshInterval);
  if (keepAliveInterval) clearInterval(keepAliveInterval);
  if (criticalSyncInterval) clearInterval(criticalSyncInterval);
}

// Check for pending notifications from server
async function checkForPendingNotifications() {
  if (isCheckingNotifications) return;

  isCheckingNotifications = true;
  const now = Date.now();

  // Don't check too frequently
  if (now - lastNotificationCheck < 10000) {
    isCheckingNotifications = false;
    return;
  }

  lastNotificationCheck = now;

  try {
    console.log('[SW] Checking for pending notifications...');

    // Fetch pending notifications from the server
    try {
      const response = await fetch('/api/notifications/check-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.notifications && result.notifications.length > 0) {
          for (const notification of result.notifications) {
            await showNotification(notification);
          }
        }
      }
    } catch (fetchError) {
      // Fallback: wake up the main thread to check for updates
      broadcastToClients({
        type: 'FORCE_DATA_REFRESH',
        reason: 'notification_check'
      });
    }

  } catch (error) {
    console.error('[SW] Error checking notifications:', error);
  } finally {
    isCheckingNotifications = false;
  }
}

// Send heartbeat to keep connection alive
async function sendHeartbeat() {
  try {
    console.log('[SW] Heartbeat - keeping service worker alive');

    // Wake up main thread to ensure it's responsive
    broadcastToClients({
      type: 'SERVICE_WORKER_HEARTBEAT',
      timestamp: Date.now(),
      sw_version: '3.3'
    });

    // Force data refresh to ensure real-time connection is active
    broadcastToClients({
      type: 'FORCE_DATA_REFRESH',
      reason: 'heartbeat_keepalive'
    });

  } catch (error) {
    console.error('[SW] Heartbeat error:', error);
  }
}

// Refresh push subscription
async function refreshSubscription() {
  try {
    console.log('[SW] Refreshing push subscription...');

    const subscription = await self.registration.pushManager.getSubscription();

    if (subscription) {
      console.log('[SW] Current subscription exists, notifying main thread');

      // Notify main thread about subscription status
      broadcastToClients({
        type: 'PUSH_SUBSCRIPTION_STATUS',
        hasSubscription: true,
        timestamp: Date.now()
      });

      // Re-validate subscription with the server
      try {
        const serialized = subscription.toJSON();
        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serialized),
          signal: AbortSignal.timeout(5000)
        });
        console.log('[SW] Subscription refreshed with server');
      } catch (refreshError) {
        console.log('[SW] Subscription refresh failed, will retry later');
      }
    } else {
      console.log('[SW] No active subscription found');

      // Notify main thread that subscription is missing
      broadcastToClients({
        type: 'PUSH_SUBSCRIPTION_STATUS',
        hasSubscription: false,
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.error('[SW] Failed to refresh subscription:', error);
  }
}

// KEEP-ALIVE: Lightweight ping to verify SW is responsive
async function keepServiceWorkerAlive() {
  try {
    lastActivity = Date.now();

    // Broadcast to all clients to confirm SW is alive
    broadcastToClients({
      type: 'SERVICE_WORKER_KEEP_ALIVE',
      timestamp: lastActivity,
      sw_version: '3.3'
    });

  } catch (error) {
    console.error('[SW] Keep-alive error:', error);
  }
}

// CRITICAL DATA SYNC: Essential restaurant operations data
async function performCriticalDataSync() {
  try {
    const now = Date.now();

    // Only sync if we have restaurant data
    if (!connectionHealthData.restaurantId) {
      console.log('[SW] No restaurant ID for critical sync');
      return;
    }

    console.log('[SW] CRITICAL SYNC: Checking for urgent updates...');

    // Force main thread to refresh critical data
    broadcastToClients({
      type: 'CRITICAL_DATA_SYNC',
      timestamp: now,
      reason: 'prevent_numb_state',
      priority: 'HIGH'
    });

    // If connection has been unhealthy, trigger booking sync
    if (connectionHealthData.unhealthyMinutes >= 1) {
      await syncBookingsData(connectionHealthData.restaurantId);
    }

    // Update activity timestamp
    lastActivity = now;

  } catch (error) {
    console.error('[SW] Critical sync error:', error);
  }
}

// Show notification helper
async function showNotification(data) {
  try {
    const options = {
      body: data.body || 'You have a new notification',
      icon: data.icon || '/icon-192x192.png',
      badge: '/icon-192x192.png',
      vibrate: [200, 100, 200],
      data: {
        dateOfArrival: Date.now(),
        url: data.url || '/dashboard',
        notification_id: data.notification_id,
        booking_id: data.booking_id,
        ...data.data
      },
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      tag: data.tag || `notification-${Date.now()}`,
      renotify: true,
      requireInteraction: true, // Force interaction
      silent: false,
      timestamp: Date.now()
    };
    
    await self.registration.showNotification(
      data.title || 'New Notification',
      options
    );

    // Mark notification as delivered in the backend
    if (data.notification_id) {
      try {
        await fetch('/api/notifications/check-pending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delivered_id: data.notification_id }),
          signal: AbortSignal.timeout(3000)
        });
      } catch (deliveryError) {
        console.log('[SW] Could not mark notification as delivered, will retry');
      }
    }
    console.log('[SW] Notification shown:', data.title || 'New Notification');
  } catch (error) {
    console.error('[SW] Error showing notification:', error);
  }
}

// Push event - handle incoming push notifications
self.addEventListener('push', async (event) => {
  console.log('[SW] Push notification received');
  
  // Reset background tasks on push
  startBackgroundTasks();
  
  let data = {};
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.error('[SW] Failed to parse push data:', e);
    data = {
      title: 'New Notification',
      body: event.data ? event.data.text() : 'You have a new notification'
    };
  }

  // All async work must be inside event.waitUntil to prevent SW termination
  event.waitUntil(
    Promise.all([
      // Broadcast alarm to all open client windows
      broadcastToClients({ type: 'PLAY_ALARM', data: data, timestamp: Date.now() }),
      showNotification(data),
      checkForPendingNotifications()
    ])
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  const urlToOpen = event.notification.data?.url || '/dashboard';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({
            type: 'NAVIGATE_TO',
            url: urlToOpen
          });
          return client.focus();
        }
      }
      
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'check-notifications') {
    event.waitUntil(checkForPendingNotifications());
  } else if (event.tag.startsWith('sync-bookings-')) {
    const restaurantId = event.tag.replace('sync-bookings-', '');
    event.waitUntil(syncBookingsData(restaurantId));
  }
});

// Periodic background sync
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync triggered:', event.tag);
  
  if (event.tag === 'check-notifications') {
    event.waitUntil(checkForPendingNotifications());
  }
});

// Message event for client communication - removed duplicate, using enhanced version below

// Fetch event - network-first with offline fallback for navigation
self.addEventListener('fetch', (event) => {
  // Track notification-related requests
  if (event.request.url.includes('/api/notifications/')) {
    lastNotificationCheck = Date.now() - NOTIFICATION_CHECK_INTERVAL + 5000;
  }

  // Never intercept Supabase storage requests (uploads, image serving, etc.)
  if (event.request.url.includes('supabase.co/storage/')) {
    return;
  }

  // Network-first strategy for navigation requests (pages)
  // This satisfies Chrome's installability requirement for a functional fetch handler
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Offline fallback — return cached page if available
        return caches.match(event.request).then(cached => {
          return cached || caches.match('/dashboard') || new Response(
            '<html><body><h1>Offline</h1><p>Please check your connection and try again.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        });
      })
    );
    return;
  }

  // Helper to create transparent 1x1 PNG
  const getTransparentPixel = () => new Response(
    new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]),
    { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' } }
  );

  // Only cache GET requests for images/fonts — never intercept uploads (POST/PUT)
  if (event.request.method !== 'GET') return;

  // Check if URL is for image or font asset
  const isImageOrFont = event.request.url.match(/\.(png|jpg|jpeg|svg|gif|webp|ttf|woff2?)(\?|$)/);
  if (!isImageOrFont) return;

  // Detect external resources (not same origin)
  try {
    const requestUrl = new URL(event.request.url);
    const selfUrl = new URL(self.location);
    const isExternalResource = requestUrl.hostname !== selfUrl.hostname;

    if (isExternalResource) {
      // For external resources (CDN, Supabase storage, etc.), use network-first with graceful fallback
      event.respondWith(
        fetch(event.request, { cache: 'no-cache' })
          .then(response => {
            // Only return successful responses
            if (response && response.ok) {
              return response;
            }
            // Return transparent pixel for non-OK responses
            console.warn('[SW] External resource returned non-OK status:', event.request.url, response?.status);
            return getTransparentPixel();
          })
          .catch((error) => {
            // Network error - return transparent pixel silently
            console.warn('[SW] Failed to fetch external resource:', event.request.url, error?.message);
            return getTransparentPixel();
          })
      );
      return;
    }

    // For local resources (/_next/static/), use cache-first strategy
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;

        return fetch(event.request).then(response => {
          // Only cache successful responses
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            return response;
          }
          return getTransparentPixel();
        }).catch(() => {
          // Network error - return fallback
          return getTransparentPixel();
        });
      })
    );
  } catch (error) {
    console.warn('[SW] Error processing fetch event:', event.request.url, error?.message);
    event.respondWith(getTransparentPixel());
  }
});

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = self.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Connection Health Tracking
let connectionHealthData = {};
let lastHealthUpdate = 0;
let connectionRecoveryInterval = null;

// Handle connection health updates from main thread
function handleConnectionHealthUpdate(data) {
  connectionHealthData = data;
  lastHealthUpdate = Date.now();

  console.log('[SW] Connection health update:', {
    healthy: data.healthStatus?.isHealthy,
    unhealthyMinutes: data.unhealthyMinutes,
    restaurantId: data.restaurantId
  });

  // If connection is unhealthy for more than 3 minutes, start aggressive background sync
  if (data.unhealthyMinutes >= 3) {
    startConnectionRecovery(data.restaurantId);
  } else {
    stopConnectionRecovery();
  }
}

// Start aggressive connection recovery
function startConnectionRecovery(restaurantId) {
  if (connectionRecoveryInterval) return; // Already running

  console.log('[SW] Starting connection recovery mode');

  connectionRecoveryInterval = setInterval(async () => {
    console.log('[SW] Attempting background data sync...');

    try {
      // Fetch critical booking data directly
      const response = await fetch(`/api/background-sync/bookings?restaurantId=${restaurantId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();

        // Notify main thread of new data
        broadcastToClients({
          type: 'BACKGROUND_SYNC_COMPLETE',
          data: {
            bookings: data.bookings,
            timestamp: Date.now()
          }
        });

        console.log('[SW] Background sync successful');
      }
    } catch (error) {
      console.error('[SW] Background sync failed:', error);
    }

    // Force main thread to attempt reconnection
    broadcastToClients({
      type: 'FORCE_DATA_REFRESH',
      reason: 'connection_recovery'
    });

  }, 10000); // Every 10 seconds in recovery mode
}

// Stop connection recovery
function stopConnectionRecovery() {
  if (connectionRecoveryInterval) {
    clearInterval(connectionRecoveryInterval);
    connectionRecoveryInterval = null;
    console.log('[SW] Stopped connection recovery mode');
  }
}

// Broadcast message to all clients
async function broadcastToClients(message) {
  try {
    const clients = await self.clients.matchAll({
      includeUncontrolled: true,
      type: 'window'
    });

    for (const client of clients) {
      client.postMessage(message);
    }
  } catch (error) {
    console.error('[SW] Error broadcasting to clients:', error);
  }
}

// Enhanced background sync for bookings
async function syncBookingsData(restaurantId) {
  try {
    console.log('[SW] Syncing bookings data for restaurant:', restaurantId);

    const response = await fetch(`/api/background-sync/bookings?restaurantId=${restaurantId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (response.ok) {
      const data = await response.json();

      // Check for new bookings since last sync
      if (data.newBookingsCount > 0) {
        console.log(`[SW] Found ${data.newBookingsCount} new bookings`);

        // Show notification for new bookings
        await showNotification({
          title: 'New Booking Request',
          body: `${data.newBookingsCount} new booking${data.newBookingsCount > 1 ? 's' : ''} require your attention`,
          tag: 'new-bookings',
          data: { bookings: data.newBookings },
          requireInteraction: true
        });
      }

      // Notify main thread
      broadcastToClients({
        type: 'BACKGROUND_SYNC_COMPLETE',
        data: {
          bookings: data.bookings,
          newBookingsCount: data.newBookingsCount,
          timestamp: Date.now()
        }
      });

      return true;
    }
  } catch (error) {
    console.error('[SW] Error syncing bookings:', error);
  }

  return false;
}

// Enhanced message handling
self.addEventListener('message', async (event) => {
  console.log('[SW] Message received:', event.data?.type);

  const { type, data } = event.data || {};

  switch (type) {
    case 'CHECK_NOTIFICATIONS':
      await checkForPendingNotifications();
      break;

    case 'START_BACKGROUND_TASKS':
      await startBackgroundTasks();
      break;

    case 'REFRESH_SUBSCRIPTION':
      await refreshSubscription();
      break;

    case 'CONNECTION_HEALTH_UPDATE':
      handleConnectionHealthUpdate(data);
      break;

    case 'FORCE_BACKGROUND_SYNC':
      if (data?.restaurantId) {
        await syncBookingsData(data.restaurantId);
      }
      break;

    case 'STOP_CONNECTION_RECOVERY':
      stopConnectionRecovery();
      break;

    // ANTI-NUMB MECHANISMS
    case 'PING_REQUEST':
      // Respond to ping to prove service worker is alive
      broadcastToClients({
        type: 'PONG_RESPONSE',
        timestamp: Date.now(),
        originalPing: data?.timestamp
      });
      lastActivity = Date.now();
      break;

    case 'APP_VISIBILITY_CHANGE':
      // Track app visibility to adjust sync frequency
      isAppVisible = data?.isVisible || false;
      console.log('[SW] App visibility changed:', isAppVisible ? 'visible' : 'hidden');

      if (isAppVisible) {
        // App became visible - restart all tasks aggressively
        await startBackgroundTasks();
        await keepServiceWorkerAlive();
        await performCriticalDataSync();
      }
      break;

    case 'EMERGENCY_WAKE_UP':
      // Emergency wake-up call from main thread
      console.log('[SW] EMERGENCY WAKE-UP received');
      lastActivity = Date.now();
      await startBackgroundTasks();
      await keepServiceWorkerAlive();
      break;

    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// Note: Enhanced sync handler is at the top-level sync event listener above

// Periodic check for stale connections
setInterval(() => {
  const now = Date.now();
  const timeSinceLastUpdate = now - lastHealthUpdate;

  // If no health updates for 2 minutes and we have connection data
  if (timeSinceLastUpdate > 120000 && connectionHealthData.restaurantId) {
    console.log('[SW] No health updates for 2 minutes, forcing recovery');
    startConnectionRecovery(connectionHealthData.restaurantId);

    // Wake up main thread
    broadcastToClients({
      type: 'FORCE_DATA_REFRESH',
      reason: 'stale_connection_check'
    });
  }
}, 60000); // Check every minute

// Start background tasks immediately
startBackgroundTasks();

// Safety net: fallback check for dormant state
setInterval(async () => {
  try {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivity;

    // If no activity for 60 seconds, trigger revival
    if (timeSinceLastActivity > 60000) {
      console.log('[SW] No activity for 60s, triggering revival');

      await startBackgroundTasks();

      broadcastToClients({
        type: 'SERVICE_WORKER_EMERGENCY_REVIVAL',
        timeSinceLastActivity,
        timestamp: now
      });

      lastActivity = now;
    }
  } catch (error) {
    console.error('[SW] Fallback interval error:', error);
  }
}, 60000); // Every 60 seconds

console.log('[SW] Service Worker v3.3 loaded');