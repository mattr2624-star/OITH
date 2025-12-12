/**
 * OITH Service Worker
 * Handles push notifications and offline caching
 */

const CACHE_NAME = 'oith-v2';
const ASSETS_TO_CACHE = [
    'index.html',
    'styles.css'
];

// Install event - cache assets (with graceful failure handling)
self.addEventListener('install', (event) => {
    console.log('OITH SW: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Cache assets individually to avoid failing on missing files
            return Promise.allSettled(
                ASSETS_TO_CACHE.map(url => 
                    cache.add(url).catch(err => {
                        console.log(`OITH SW: Could not cache ${url}:`, err.message);
                    })
                )
            );
        })
    );
    self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('OITH SW: Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch event - network first, with cache fallback for static assets only
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // NEVER intercept API requests - let them go directly to network
    if (url.pathname.includes('/api/') || 
        url.hostname.includes('amazonaws.com') ||
        url.hostname.includes('execute-api') ||
        url.hostname !== self.location.hostname) {
        // Don't intercept - let the browser handle it normally
        return;
    }
    
    // For same-origin static assets: network first, cache fallback
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Cache successful responses for static assets
                if (response.ok && event.request.method === 'GET') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) {
                        console.log('OITH SW: Serving from cache:', event.request.url);
                        return cachedResponse;
                    }
                    // No cache available
                    console.log('OITH SW: Network failed, no cache:', event.request.url);
                    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
                });
            })
    );
});

// Push notification event
self.addEventListener('push', (event) => {
    console.log('Push notification received');
    
    let data = { title: 'OITH', body: 'You have a new notification' };
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }
    
    const options = {
        body: data.body || data.message,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        vibrate: [100, 50, 100],
        data: {
            type: data.type,
            ...data.data
        },
        actions: getActionsForType(data.type),
        requireInteraction: shouldRequireInteraction(data.type)
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event.notification.data);
    
    event.notification.close();
    
    const data = event.notification.data || {};
    let url = '/';
    
    // Route based on notification type
    switch (data.type) {
        case 'new_message':
        case 'mutual_match':
            url = '/?screen=chat';
            break;
        case 'unmatched':
        case 'connection_expired':
        case 'decision_expired':
        case 'new_user_nearby':
            url = '/?screen=match';
            break;
        case 'payment_failed':
            url = '/?screen=settings&section=subscription';
            break;
        default:
            url = '/';
    }
    
    // Handle action button clicks
    if (event.action === 'reply') {
        url = '/?screen=chat';
    } else if (event.action === 'view') {
        url = '/?screen=match';
    }
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Check if there's already a window open
            for (let client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.postMessage({ type: 'notification_click', data });
                    return client.focus();
                }
            }
            // Open new window
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});

// Get notification actions based on type
function getActionsForType(type) {
    switch (type) {
        case 'new_message':
            return [
                { action: 'reply', title: '💬 Reply' }
            ];
        case 'mutual_match':
            return [
                { action: 'reply', title: '💬 Say Hi' }
            ];
        case 'connection_warning':
        case 'decision_warning':
            return [
                { action: 'view', title: '👀 View' }
            ];
        default:
            return [];
    }
}

// Determine if notification should stay until user interacts
function shouldRequireInteraction(type) {
    const requireInteraction = [
        'mutual_match',
        'connection_warning',
        'payment_failed'
    ];
    return requireInteraction.includes(type);
}

// Handle messages from the main app
self.addEventListener('message', (event) => {
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
