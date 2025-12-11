/**
 * OITH Service Worker
 * Handles push notifications and offline caching
 */

const CACHE_NAME = 'oith-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/app.js',
    '/styles.css'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
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

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
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
