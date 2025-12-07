/* ==========================================
   OITH - One In The Hand
   Dating App Prototype JavaScript
   
   CORE PHILOSOPHY: One Match at a Time
   - Users receive exactly ONE match
   - Must make a decision before seeing anyone else
   - No browsing, no endless swiping
   - Focus on the person in front of you
   ========================================== */

// ==========================================
// Cache/Storage System - Remembers Users
// ==========================================
const STORAGE_VERSION = '1.0';

// ==========================================
// Geolocation & Distance System
// ==========================================

/**
 * Common city coordinates lookup table
 * Format: 'city, state' or 'city' => { lat, lng }
 */
const CITY_COORDINATES = {
    // Major US Cities
    'new york': { lat: 40.7128, lng: -74.0060 },
    'new york, ny': { lat: 40.7128, lng: -74.0060 },
    'los angeles': { lat: 34.0522, lng: -118.2437 },
    'los angeles, ca': { lat: 34.0522, lng: -118.2437 },
    'chicago': { lat: 41.8781, lng: -87.6298 },
    'chicago, il': { lat: 41.8781, lng: -87.6298 },
    'houston': { lat: 29.7604, lng: -95.3698 },
    'houston, tx': { lat: 29.7604, lng: -95.3698 },
    'phoenix': { lat: 33.4484, lng: -112.0740 },
    'phoenix, az': { lat: 33.4484, lng: -112.0740 },
    'philadelphia': { lat: 39.9526, lng: -75.1652 },
    'philadelphia, pa': { lat: 39.9526, lng: -75.1652 },
    'san antonio': { lat: 29.4241, lng: -98.4936 },
    'san antonio, tx': { lat: 29.4241, lng: -98.4936 },
    'san diego': { lat: 32.7157, lng: -117.1611 },
    'san diego, ca': { lat: 32.7157, lng: -117.1611 },
    'dallas': { lat: 32.7767, lng: -96.7970 },
    'dallas, tx': { lat: 32.7767, lng: -96.7970 },
    'san jose': { lat: 37.3382, lng: -121.8863 },
    'san jose, ca': { lat: 37.3382, lng: -121.8863 },
    'austin': { lat: 30.2672, lng: -97.7431 },
    'austin, tx': { lat: 30.2672, lng: -97.7431 },
    'jacksonville': { lat: 30.3322, lng: -81.6557 },
    'jacksonville, fl': { lat: 30.3322, lng: -81.6557 },
    'san francisco': { lat: 37.7749, lng: -122.4194 },
    'san francisco, ca': { lat: 37.7749, lng: -122.4194 },
    'columbus': { lat: 39.9612, lng: -82.9988 },
    'columbus, oh': { lat: 39.9612, lng: -82.9988 },
    'fort worth': { lat: 32.7555, lng: -97.3308 },
    'fort worth, tx': { lat: 32.7555, lng: -97.3308 },
    'indianapolis': { lat: 39.7684, lng: -86.1581 },
    'indianapolis, in': { lat: 39.7684, lng: -86.1581 },
    'charlotte': { lat: 35.2271, lng: -80.8431 },
    'charlotte, nc': { lat: 35.2271, lng: -80.8431 },
    'seattle': { lat: 47.6062, lng: -122.3321 },
    'seattle, wa': { lat: 47.6062, lng: -122.3321 },
    'denver': { lat: 39.7392, lng: -104.9903 },
    'denver, co': { lat: 39.7392, lng: -104.9903 },
    'washington': { lat: 38.9072, lng: -77.0369 },
    'washington, dc': { lat: 38.9072, lng: -77.0369 },
    'boston': { lat: 42.3601, lng: -71.0589 },
    'boston, ma': { lat: 42.3601, lng: -71.0589 },
    'nashville': { lat: 36.1627, lng: -86.7816 },
    'nashville, tn': { lat: 36.1627, lng: -86.7816 },
    'detroit': { lat: 42.3314, lng: -83.0458 },
    'detroit, mi': { lat: 42.3314, lng: -83.0458 },
    'portland': { lat: 45.5051, lng: -122.6750 },
    'portland, or': { lat: 45.5051, lng: -122.6750 },
    'las vegas': { lat: 36.1699, lng: -115.1398 },
    'las vegas, nv': { lat: 36.1699, lng: -115.1398 },
    'memphis': { lat: 35.1495, lng: -90.0490 },
    'memphis, tn': { lat: 35.1495, lng: -90.0490 },
    'louisville': { lat: 38.2527, lng: -85.7585 },
    'louisville, ky': { lat: 38.2527, lng: -85.7585 },
    'baltimore': { lat: 39.2904, lng: -76.6122 },
    'baltimore, md': { lat: 39.2904, lng: -76.6122 },
    'milwaukee': { lat: 43.0389, lng: -87.9065 },
    'milwaukee, wi': { lat: 43.0389, lng: -87.9065 },
    'albuquerque': { lat: 35.0844, lng: -106.6504 },
    'albuquerque, nm': { lat: 35.0844, lng: -106.6504 },
    'tucson': { lat: 32.2226, lng: -110.9747 },
    'tucson, az': { lat: 32.2226, lng: -110.9747 },
    'fresno': { lat: 36.7378, lng: -119.7871 },
    'fresno, ca': { lat: 36.7378, lng: -119.7871 },
    'sacramento': { lat: 38.5816, lng: -121.4944 },
    'sacramento, ca': { lat: 38.5816, lng: -121.4944 },
    'atlanta': { lat: 33.7490, lng: -84.3880 },
    'atlanta, ga': { lat: 33.7490, lng: -84.3880 },
    'miami': { lat: 25.7617, lng: -80.1918 },
    'miami, fl': { lat: 25.7617, lng: -80.1918 },
    'oakland': { lat: 37.8044, lng: -122.2712 },
    'oakland, ca': { lat: 37.8044, lng: -122.2712 },
    'minneapolis': { lat: 44.9778, lng: -93.2650 },
    'minneapolis, mn': { lat: 44.9778, lng: -93.2650 },
    'tampa': { lat: 27.9506, lng: -82.4572 },
    'tampa, fl': { lat: 27.9506, lng: -82.4572 },
    'new orleans': { lat: 29.9511, lng: -90.0715 },
    'new orleans, la': { lat: 29.9511, lng: -90.0715 },
    'cleveland': { lat: 41.4993, lng: -81.6944 },
    'cleveland, oh': { lat: 41.4993, lng: -81.6944 },
    'pittsburgh': { lat: 40.4406, lng: -79.9959 },
    'pittsburgh, pa': { lat: 40.4406, lng: -79.9959 },
    'orlando': { lat: 28.5383, lng: -81.3792 },
    'orlando, fl': { lat: 28.5383, lng: -81.3792 },
    'st. louis': { lat: 38.6270, lng: -90.1994 },
    'st. louis, mo': { lat: 38.6270, lng: -90.1994 },
    'brooklyn': { lat: 40.6782, lng: -73.9442 },
    'brooklyn, ny': { lat: 40.6782, lng: -73.9442 },
    'manhattan': { lat: 40.7831, lng: -73.9712 },
    'manhattan, ny': { lat: 40.7831, lng: -73.9712 },
    'queens': { lat: 40.7282, lng: -73.7949 },
    'queens, ny': { lat: 40.7282, lng: -73.7949 },
    'bronx': { lat: 40.8448, lng: -73.8648 },
    'bronx, ny': { lat: 40.8448, lng: -73.8648 },
    'jersey city': { lat: 40.7178, lng: -74.0431 },
    'jersey city, nj': { lat: 40.7178, lng: -74.0431 },
    'hoboken': { lat: 40.7440, lng: -74.0324 },
    'hoboken, nj': { lat: 40.7440, lng: -74.0324 },
    'long island': { lat: 40.7891, lng: -73.1350 },
    'long island, ny': { lat: 40.7891, lng: -73.1350 },
    // Add more cities as needed
};

/**
 * Get coordinates for a location string
 * @param {string} location - City name or "City, State" format
 * @returns {object|null} - { lat, lng } or null if not found
 */
function getCoordinates(location) {
    if (!location) return null;
    
    // Normalize the location string
    const normalized = location.toLowerCase().trim();
    
    // Try exact match first
    if (CITY_COORDINATES[normalized]) {
        return CITY_COORDINATES[normalized];
    }
    
    // Try without state abbreviation
    const cityOnly = normalized.split(',')[0].trim();
    if (CITY_COORDINATES[cityOnly]) {
        return CITY_COORDINATES[cityOnly];
    }
    
    // Try partial match (for "New York City" -> "new york")
    for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
        if (normalized.includes(city) || city.includes(cityOnly)) {
            return coords;
        }
    }
    
    console.log(`📍 Location not found in database: ${location}`);
    return null;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} - Distance in miles
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 3959; // Earth's radius in miles
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}

/**
 * Convert degrees to radians
 */
function toRad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Get distance between current user and a profile
 * @param {object} profile - Profile with location
 * @returns {number} - Distance in miles, or random fallback if can't calculate
 */
function getDistanceToProfile(profile) {
    const userLocation = appState.user?.location;
    const profileLocation = profile.location;
    
    // Get coordinates for both
    const userCoords = appState.user?.coordinates || getCoordinates(userLocation);
    const profileCoords = profile.coordinates || getCoordinates(profileLocation);
    
    // Store user coordinates for future use
    if (userCoords && !appState.user?.coordinates) {
        appState.user.coordinates = userCoords;
    }
    
    // If we have both coordinates, calculate real distance
    if (userCoords && profileCoords) {
        const distance = calculateDistance(
            userCoords.lat, userCoords.lng,
            profileCoords.lat, profileCoords.lng
        );
        console.log(`📍 Distance from ${userLocation} to ${profileLocation}: ${distance} miles`);
        return distance;
    }
    
    // Fallback to random distance if we can't calculate
    return Math.floor(Math.random() * 25) + 1;
}

/**
 * Update user's coordinates when their location changes
 * Call this when saving profile
 */
function updateUserCoordinates() {
    if (appState.user?.location) {
        const coords = getCoordinates(appState.user.location);
        if (coords) {
            appState.user.coordinates = coords;
            console.log(`📍 Updated user coordinates for ${appState.user.location}:`, coords);
        }
    }
}

/**
 * Get user-specific storage key based on email
 */
function getUserStorageKey(email) {
    if (!email) return null;
    // Create a unique key for each user based on their email
    return `oith_user_${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

/**
 * Save current state to localStorage
 * Call this whenever important state changes
 * Data is stored per-user based on their email
 */
// API Server URL for syncing (adjust based on deployment)
// AWS API Gateway URL - Hardcoded for automatic cloud sync
const AWS_API_URL = localStorage.getItem('oith_aws_api_url') || 'https://emeapbgbui.execute-api.us-east-1.amazonaws.com';

const API_BASE_URL = AWS_API_URL || 'http://localhost:3001/api';

/**
 * Sync user data to the backend server
 * This allows admin dashboard to see users regardless of domain
 */
async function syncToServer(email, userData, registeredUserData) {
    try {
        // Check if AWS API is configured
        const apiUrl = AWS_API_URL || API_BASE_URL;
        
        if (!apiUrl) {
            console.log('⚠️ No API configured, skipping cloud sync');
            return false;
        }
        
        const endpoint = `${apiUrl}/users`;
        
        // Only send essential profile data to avoid DynamoDB 400KB limit
        const user = userData?.user || {};
        const prefs = user.matchPreferences || user.preferences || {};
        const minimalPayload = {
            email: email,
            name: user.firstName || registeredUserData?.firstName || '',
            password: registeredUserData?.password || '',
            userData: {
                user: {
                    email: email,
                    firstName: user.firstName || '',
                    age: user.age || null,
                    birthday: user.birthday || '',
                    gender: user.gender || '',
                    location: user.location || '',
                    occupation: user.occupation || '',
                    education: user.education || '',
                    bio: (user.bio || '').substring(0, 500),
                    photo: user.photos?.[0] || '',
                    height: user.height || '',
                    bodyType: user.bodyType || '',
                    // Include preferences for auto-matching
                    preferences: {
                        interestedIn: prefs.interestedIn || 'everyone',
                        ageMin: prefs.ageMin || 18,
                        ageMax: prefs.ageMax || 99,
                        maxDistance: prefs.maxDistance || 100
                    }
                }
            }
        };
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(minimalPayload)
        });
        
        if (response.ok) {
            console.log('☁️ User synced to AWS:', email);
            return true;
        } else {
            console.log('⚠️ AWS sync failed:', response.status);
            return false;
        }
    } catch (error) {
        console.log('⚠️ Cloud sync unavailable:', error.message);
        return false;
    }
}

/**
 * Configure AWS API URL for cloud sync
 * Call this from browser console: setAWSApiUrl('https://xxx.execute-api.us-east-1.amazonaws.com/prod')
 */
function setAWSApiUrl(url) {
    if (url) {
        localStorage.setItem('oith_aws_api_url', url);
        console.log('✅ AWS API URL configured:', url);
        showToast('AWS API configured!', 'success');
    } else {
        localStorage.removeItem('oith_aws_api_url');
        console.log('🗑️ AWS API URL removed');
    }
    // Reload to apply
    window.location.reload();
}

function saveUserData() {
    try {
        const email = appState.user?.email;
        if (!email) {
            console.log('⚠️ Cannot save - no user email set');
            return false;
        }
        
        const storageKey = getUserStorageKey(email);
        
        const dataToSave = {
            version: STORAGE_VERSION,
            savedAt: new Date().toISOString(),
            user: appState.user,
            oneMatch: {
                current: appState.oneMatch.current,
                status: appState.oneMatch.status,
                nextMatchTime: appState.oneMatch.nextMatchTime ? appState.oneMatch.nextMatchTime.toISOString() : null,
                decisionMade: appState.oneMatch.decisionMade,
                isMutual: appState.oneMatch.isMutual,
                connectionExpiresAt: appState.oneMatch.connectionExpiresAt ? appState.oneMatch.connectionExpiresAt.toISOString() : null
            },
            activeConnection: appState.activeConnection,
            connectionMetrics: appState.connectionMetrics,
            conversation: appState.conversation,
            connections: appState.connections,
            passedMatches: appState.passedMatches,
            matchHistory: appState.matchHistory || [],
            preferencesChanged: appState.preferencesChanged,
            isLoggedIn: appState.isLoggedIn || false,
            profileComplete: appState.profileComplete || false,
            profileVisibility: appState.profileVisibility,
            feedbackReceived: appState.feedbackReceived || [],
            feedbackGiven: appState.feedbackGiven || []
        };
        
        // Save to localStorage
        localStorage.setItem(storageKey, JSON.stringify(dataToSave));
        console.log('💾 User data saved for:', email);
        console.log('   Age:', dataToSave.user?.age);
        console.log('   Birthday:', dataToSave.user?.birthday);
        console.log('   Location:', dataToSave.user?.location);
        console.log('   Occupation:', dataToSave.user?.occupation);
        console.log('   Bio:', dataToSave.user?.bio?.substring(0, 50));
        console.log('   Photos:', dataToSave.user?.photos?.filter(p => p)?.length || 0, 'photos');
        console.log('   ProfileComplete:', dataToSave.profileComplete);
        
        // Broadcast to other tabs (admin dashboard)
        if (typeof broadcastSync === 'function') {
            broadcastSync('user_updated', { email });
        }
        
        // Also sync to server for cross-domain access (async, don't wait)
        const registeredUsers = JSON.parse(localStorage.getItem('oith_registered_users') || '{}');
        syncToServer(email, dataToSave, registeredUsers[email]);
        
        return true;
    } catch (error) {
        console.error('Failed to save user data:', error);
        return false;
    }
}

/**
 * Load saved state from localStorage for a specific user
 * @param {string} email - User's email to load data for (optional, uses appState.user.email if not provided)
 * Returns true if data was loaded, false otherwise
 */
function loadUserData(email) {
    try {
        // Use provided email or current user's email
        const userEmail = email || appState.user?.email;
        
        if (!userEmail) {
            console.log('📭 No email provided - cannot load user data');
            return false;
        }
        
        const storageKey = getUserStorageKey(userEmail);
        const savedData = localStorage.getItem(storageKey);
        
        if (!savedData) {
            console.log('📭 No saved data found for:', userEmail);
            return false;
        }
        
        const data = JSON.parse(savedData);
        
        // Check version compatibility
        if (data.version !== STORAGE_VERSION) {
            console.log('⚠️ Cache version mismatch - clearing old data');
            clearUserData(userEmail);
            return false;
        }
        
        console.log('📂 Loading data for user:', userEmail);
        console.log('   Loaded age:', data.user?.age);
        console.log('   Loaded birthday:', data.user?.birthday);
        console.log('   Loaded photos:', data.user?.photos?.filter(p => p)?.length || 0, 'photos');
        console.log('   Loaded profileComplete:', data.profileComplete);
        
        // Restore user profile & preferences
        if (data.user) {
            appState.user = { ...appState.user, ...data.user };
        }
        
        // IMPORTANT: Restore profileComplete flag
        appState.profileComplete = data.profileComplete || false;
        
        // Restore match state
        if (data.oneMatch) {
            appState.oneMatch.current = data.oneMatch.current;
            appState.oneMatch.status = data.oneMatch.status;
            appState.oneMatch.nextMatchTime = data.oneMatch.nextMatchTime ? new Date(data.oneMatch.nextMatchTime) : null;
            appState.oneMatch.decisionMade = data.oneMatch.decisionMade;
            appState.oneMatch.isMutual = data.oneMatch.isMutual;
            appState.oneMatch.connectionExpiresAt = data.oneMatch.connectionExpiresAt ? new Date(data.oneMatch.connectionExpiresAt) : null;
        }
        
        // Restore active connection
        if (data.activeConnection) {
            appState.activeConnection = data.activeConnection;
            // Restore Date objects
            if (appState.activeConnection.connectedAt) {
                appState.activeConnection.connectedAt = new Date(appState.activeConnection.connectedAt);
            }
        }
        
        // Restore metrics
        if (data.connectionMetrics) {
            appState.connectionMetrics = { ...appState.connectionMetrics, ...data.connectionMetrics };
            if (appState.connectionMetrics.connectedAt) {
                appState.connectionMetrics.connectedAt = new Date(appState.connectionMetrics.connectedAt);
            }
        }
        
        // Restore conversation
        if (data.conversation) {
            appState.conversation = data.conversation;
        }
        
        // Restore connections history
        if (data.connections) {
            appState.connections = data.connections;
        }
        
        // Restore passed matches
        if (data.passedMatches) {
            appState.passedMatches = data.passedMatches;
        }
        
        // Restore match history
        if (data.matchHistory) {
            appState.matchHistory = data.matchHistory;
        }
        
        // Restore flags
        appState.preferencesChanged = data.preferencesChanged || false;
        appState.isLoggedIn = data.isLoggedIn || false;
        // profileComplete already restored above
        
        // Restore profile visibility
        if (data.profileVisibility && typeof data.profileVisibility === 'object') {
            appState.profileVisibility = {
                isHidden: data.profileVisibility.isHidden || false,
                hiddenAt: data.profileVisibility.hiddenAt ? new Date(data.profileVisibility.hiddenAt) : null,
                reason: data.profileVisibility.reason || null
            };
        }
        
        // Restore feedback arrays
        appState.feedbackReceived = data.feedbackReceived || [];
        appState.feedbackGiven = data.feedbackGiven || [];
        
        console.log('📂 User data restored from cache');
        console.log(`   Last saved: ${data.savedAt}`);
        console.log(`   User: ${appState.user.firstName || 'Not set'}`);
        
        return true;
    } catch (error) {
        console.error('Failed to load user data:', error);
        clearUserData(); // Clear corrupted data
        return false;
    }
}

/**
 * Clear all saved user data
 */
/**
 * Clear user data from localStorage
 * @param {string} email - User's email to clear data for (optional, uses appState.user.email if not provided)
 */
function clearUserData(email) {
    try {
        const userEmail = email || appState.user?.email;
        
        if (!userEmail) {
            console.log('⚠️ No email provided - cannot clear user data');
            return false;
        }
        
        const storageKey = getUserStorageKey(userEmail);
        localStorage.removeItem(storageKey);
        console.log('🗑️ User data cleared for:', userEmail);
        return true;
    } catch (error) {
        console.error('Failed to clear user data:', error);
        return false;
    }
}

/**
 * Check if user has saved session
 */
function hasExistingSession() {
    try {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (!savedData) return false;
        
        const data = JSON.parse(savedData);
        return data.isLoggedIn === true && data.user && data.user.email;
    } catch {
        return false;
    }
}

/**
 * Auto-save on important state changes
 * Debounced to prevent too frequent saves
 */
let saveTimeout = null;
function autoSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveUserData();
    }, 500); // Save 500ms after last change
}

/**
 * Refresh user data from localStorage (syncs with admin dashboard changes)
 * This allows changes made in admin dashboard to be reflected in the app
 */
function refreshUserDataFromStorage() {
    const email = appState.user?.email;
    if (!email) return;
    
    try {
        const storageKey = getUserStorageKey(email);
        const savedData = localStorage.getItem(storageKey);
        
        if (savedData) {
            const data = JSON.parse(savedData);
            if (data.user) {
                // Merge saved user data into appState, preserving current session info
                const currentUser = appState.user;
                appState.user = { 
                    ...currentUser, 
                    ...data.user,
                    // Keep session-specific info
                    email: currentUser.email
                };
                console.log('🔄 User data refreshed from storage (synced with admin)');
            }
        }
    } catch (error) {
        console.error('Failed to refresh user data:', error);
    }
}

// ==========================================
// State Management
// ==========================================
const appState = {
    currentScreen: 'splash',
    user: {
        firstName: '',
        email: '',
        birthday: '',
        photos: [],
        preferences: {
            interestedIn: 'women',
            lookingFor: 'relationship',
            ageMin: 25,
            ageMax: 35,
            distance: 25
        },
        matchPreferences: {
            interestedIn: 'women',
            ageMin: 25,
            ageMax: 35,
            maxDistance: 25,
            heightMin: '',
            heightMax: '',
            bodyType: [],
            ethnicity: '',
            education: '',
            smoking: [],
            drinking: [],
            exercise: '',
            children: '',
            religion: '',
            lookingFor: []
        }
    },
    
    // ONE MATCH AT A TIME SYSTEM
    oneMatch: {
        // The current active match (only ONE allowed)
        current: null,
        // Status: 'waiting' | 'presented' | 'connected' | 'passed'
        status: 'waiting',
        // When the next match will be available
        nextMatchTime: null,
        // Has the user made a decision on current match?
        decisionMade: false,
        // Is this match mutual (both liked)?
        isMutual: false,
        // 24 HOUR TIME LIMIT - connection expires after 24 hours
        connectionExpiresAt: null,
        // Time limit in milliseconds (24 hours)
        TIME_LIMIT_MS: 24 * 60 * 60 * 1000
    },
    
    // Active connection (after mutual match) - ONE CONNECTION ONLY
    activeConnection: null,
    
    // Connection metrics
    connectionMetrics: {
        messageCount: 12,
        avgResponseTime: '8m',
        compatibility: 92,
        dateReadiness: 85, // 0-100
        connectedAt: null
    },
    
    // Match pool (simulated - in production this comes from AI matching)
    // ==========================================
    // DIVERSE TEST PROFILES FOR MATCH PREFERENCE TESTING
    // Covers all filter criteria combinations
    // ==========================================
    matchPool: [
        // === PROFILE 1: Sarah - Athletic, White, 28, 3mi, Bachelors, Wants kids ===
        {
            id: 1,
            name: 'Sarah',
            age: 28,
            distance: 3,
            distanceText: '3 miles',
            compatibility: 92,
            occupation: 'Product Designer',
            education: 'bachelors',
            height: "5'6\"",
            heightInches: 66,
            bodyType: 'Athletic',
            ethnicity: 'white',
            smoking: 'Never',
            drinking: 'Socially',
            exercise: 'regularly',
            children: 'no-want',
            religion: 'spiritual',
            bio: '"Looking for someone to explore new restaurants with and have deep conversations over coffee."',
            interests: ['Photography', 'Hiking', 'Coffee', 'Reading', 'Cooking', 'Travel'],
            lookingFor: 'relationship',
            photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop',
            photos: [],
            online: true,
            lastActive: 'Now'
        },
        // === PROFILE 2: Emma - Slim, White, 26, 5mi, Masters, No kids ===
        {
            id: 2,
            name: 'Emma',
            age: 26,
            distance: 5,
            distanceText: '5 miles',
            compatibility: 88,
            occupation: 'Marketing Manager',
            education: 'masters',
            height: "5'4\"",
            heightInches: 64,
            bodyType: 'Slim',
            ethnicity: 'white',
            smoking: 'Never',
            drinking: 'Socially',
            exercise: 'sometimes',
            children: 'no-dont-want',
            religion: 'agnostic',
            bio: '"Adventure seeker looking for a partner in crime. Love spontaneous road trips!"',
            interests: ['Travel', 'Music', 'Yoga', 'Dancing', 'Food'],
            lookingFor: 'relationship',
            photo: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=500&fit=crop',
            photos: [],
            online: false,
            lastActive: '2 hours ago'
        },
        // === PROFILE 3: Maya - Average, Asian, 30, 7mi, Masters, Buddhist ===
        {
            id: 3,
            name: 'Maya',
            age: 30,
            distance: 7,
            distanceText: '7 miles',
            compatibility: 85,
            occupation: 'Software Engineer',
            education: 'masters',
            height: "5'8\"",
            heightInches: 68,
            bodyType: 'Average',
            ethnicity: 'asian',
            smoking: 'Never',
            drinking: 'Socially',
            exercise: 'regularly',
            children: 'no-want',
            religion: 'buddhist',
            bio: '"Tech by day, artist by night. Looking for someone who appreciates both worlds."',
            interests: ['Art', 'Technology', 'Museums', 'Wine', 'Board Games'],
            lookingFor: 'relationship',
            photo: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=500&fit=crop',
            photos: [],
            online: true,
            lastActive: 'Now'
        },
        // === PROFILE 4: Jessica - Curvy, Hispanic, 32, 12mi, Has kids, Catholic ===
        {
            id: 4,
            name: 'Jessica',
            age: 32,
            distance: 12,
            distanceText: '12 miles',
            compatibility: 82,
            occupation: 'Nurse',
            education: 'bachelors',
            height: "5'5\"",
            heightInches: 65,
            bodyType: 'Curvy',
            ethnicity: 'hispanic',
            smoking: 'Never',
            drinking: 'Never',
            exercise: 'sometimes',
            children: 'has',
            religion: 'catholic',
            bio: '"Single mom looking for something real. Family comes first, but ready for love."',
            interests: ['Family', 'Cooking', 'Movies', 'Beach', 'Reading'],
            lookingFor: 'relationship',
            photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=500&fit=crop',
            photos: [],
            online: false,
            lastActive: '1 hour ago'
        },
        // === PROFILE 5: Olivia - Slim, Black, 24, 8mi, Some college, Smoker, Casual ===
        {
            id: 5,
            name: 'Olivia',
            age: 24,
            distance: 8,
            distanceText: '8 miles',
            compatibility: 79,
            occupation: 'Graduate Student',
            education: 'some-college',
            height: "5'3\"",
            heightInches: 63,
            bodyType: 'Slim',
            ethnicity: 'black',
            smoking: 'Sometimes',
            drinking: 'Socially',
            exercise: 'regularly',
            children: 'no-dont-want',
            religion: 'christian',
            bio: '"Studying psychology, love deep conversations and spontaneous adventures."',
            interests: ['Psychology', 'Music', 'Running', 'Coffee', 'Art'],
            lookingFor: 'casual',
            photo: 'https://images.unsplash.com/photo-1534751516642-a1af1ef26a56?w=400&h=500&fit=crop',
            photos: [],
            online: true,
            lastActive: 'Now'
        },
        // === PROFILE 6: Rachel - Athletic, White, 35, 15mi, Doctorate, Jewish, Regular drinker ===
        {
            id: 6,
            name: 'Rachel',
            age: 35,
            distance: 15,
            distanceText: '15 miles',
            compatibility: 76,
            occupation: 'Lawyer',
            education: 'doctorate',
            height: "5'7\"",
            heightInches: 67,
            bodyType: 'Athletic',
            ethnicity: 'white',
            smoking: 'Never',
            drinking: 'Regularly',
            exercise: 'regularly',
            children: 'no-want',
            religion: 'jewish',
            bio: '"Ambitious professional who knows what she wants. Looking for an equal partner."',
            interests: ['Fitness', 'Wine', 'Travel', 'Politics', 'Fine Dining'],
            lookingFor: 'relationship',
            photo: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=500&fit=crop',
            photos: [],
            online: false,
            lastActive: '30 min ago'
        },
        // === PROFILE 7: Aisha - Plus-size, Middle Eastern, 29, 20mi, Masters, Muslim ===
        {
            id: 7,
            name: 'Aisha',
            age: 29,
            distance: 20,
            distanceText: '20 miles',
            compatibility: 84,
            occupation: 'Data Scientist',
            education: 'masters',
            height: "5'5\"",
            heightInches: 65,
            bodyType: 'Plus-size',
            ethnicity: 'middle-eastern',
            smoking: 'Never',
            drinking: 'Never',
            exercise: 'sometimes',
            children: 'no-want',
            religion: 'muslim',
            bio: '"Looking for something meaningful. Love cooking, reading, and deep conversations."',
            interests: ['Cooking', 'Reading', 'Science', 'Nature', 'Photography'],
            lookingFor: 'marriage',
            photo: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=400&h=500&fit=crop',
            photos: [],
            online: true,
            lastActive: 'Now'
        },
        // === PROFILE 8: Zoe - Slim, Mixed, 22, 2mi, Some college, Regular smoker ===
        {
            id: 8,
            name: 'Zoe',
            age: 22,
            distance: 2,
            distanceText: '2 miles',
            compatibility: 73,
            occupation: 'Barista',
            education: 'some-college',
            height: "5'2\"",
            heightInches: 62,
            bodyType: 'Slim',
            ethnicity: 'mixed',
            smoking: 'Regularly',
            drinking: 'Socially',
            exercise: 'never',
            children: 'no-dont-want',
            religion: 'atheist',
            bio: '"Artist soul in a coffee-stained apron. Let\'s get weird together."',
            interests: ['Art', 'Music', 'Tattoos', 'Vintage', 'Coffee'],
            lookingFor: 'casual',
            photo: 'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400&h=500&fit=crop',
            photos: [],
            online: true,
            lastActive: 'Now'
        },
        // === PROFILE 9: Linda - Average, White, 45, 25mi, Bachelors, Has kids, Divorced ===
        {
            id: 9,
            name: 'Linda',
            age: 45,
            distance: 25,
            distanceText: '25 miles',
            compatibility: 71,
            occupation: 'Real Estate Agent',
            education: 'bachelors',
            height: "5'6\"",
            heightInches: 66,
            bodyType: 'Average',
            ethnicity: 'white',
            smoking: 'Never',
            drinking: 'Socially',
            exercise: 'sometimes',
            children: 'has',
            religion: 'christian',
            bio: '"Kids are grown, ready for my next chapter. Looking for a travel partner."',
            interests: ['Travel', 'Wine', 'Gardening', 'Golf', 'Cooking'],
            lookingFor: 'relationship',
            photo: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=400&h=500&fit=crop',
            photos: [],
            online: false,
            lastActive: '3 hours ago'
        },
        // === PROFILE 10: Priya - Athletic, Asian (Indian), 27, 10mi, Doctorate, Hindu ===
        {
            id: 10,
            name: 'Priya',
            age: 27,
            distance: 10,
            distanceText: '10 miles',
            compatibility: 89,
            occupation: 'Doctor',
            education: 'doctorate',
            height: "5'4\"",
            heightInches: 64,
            bodyType: 'Athletic',
            ethnicity: 'asian',
            smoking: 'Never',
            drinking: 'Never',
            exercise: 'regularly',
            children: 'no-want',
            religion: 'hindu',
            bio: '"Healer by profession, foodie by passion. Looking for my person."',
            interests: ['Medicine', 'Yoga', 'Cooking', 'Dancing', 'Movies'],
            lookingFor: 'marriage',
            photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=500&fit=crop',
            photos: [],
            online: true,
            lastActive: 'Now'
        },
        // === PROFILE 11: Brittany - Curvy, Black, 31, 6mi, High school, Regular drinker ===
        {
            id: 11,
            name: 'Brittany',
            age: 31,
            distance: 6,
            distanceText: '6 miles',
            compatibility: 77,
            occupation: 'Hairstylist',
            education: 'high-school',
            height: "5'7\"",
            heightInches: 67,
            bodyType: 'Curvy',
            ethnicity: 'black',
            smoking: 'Sometimes',
            drinking: 'Regularly',
            exercise: 'never',
            children: 'has-want-more',
            religion: 'christian',
            bio: '"Life of the party! Looking for someone who can keep up."',
            interests: ['Music', 'Dancing', 'Fashion', 'Brunch', 'Reality TV'],
            lookingFor: 'relationship',
            photo: 'https://images.unsplash.com/photo-1523824921871-d6f1a15151f1?w=400&h=500&fit=crop',
            photos: [],
            online: false,
            lastActive: '45 min ago'
        },
        // === PROFILE 12: Mei - Slim, Asian, 25, 4mi, Masters, Buddhist, Never drinks ===
        {
            id: 12,
            name: 'Mei',
            age: 25,
            distance: 4,
            distanceText: '4 miles',
            compatibility: 86,
            occupation: 'Architect',
            education: 'masters',
            height: "5'3\"",
            heightInches: 63,
            bodyType: 'Slim',
            ethnicity: 'asian',
            smoking: 'Never',
            drinking: 'Never',
            exercise: 'regularly',
            children: 'no-want',
            religion: 'buddhist',
            bio: '"Designing buildings by day, exploring the city by night."',
            interests: ['Architecture', 'Art', 'Photography', 'Travel', 'Tea'],
            lookingFor: 'relationship',
            photo: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=500&fit=crop',
            photos: [],
            online: true,
            lastActive: 'Now'
        },
        // === PROFILE 13: Carmen - Athletic, Hispanic, 33, 18mi, Bachelors, Catholic ===
        {
            id: 13,
            name: 'Carmen',
            age: 33,
            distance: 18,
            distanceText: '18 miles',
            compatibility: 81,
            occupation: 'Physical Therapist',
            education: 'bachelors',
            height: "5'6\"",
            heightInches: 66,
            bodyType: 'Athletic',
            ethnicity: 'hispanic',
            smoking: 'Never',
            drinking: 'Socially',
            exercise: 'regularly',
            children: 'no-want',
            religion: 'catholic',
            bio: '"Fitness enthusiast who believes in balance. Work hard, play harder."',
            interests: ['Fitness', 'Soccer', 'Dancing', 'Beach', 'Family'],
            lookingFor: 'relationship',
            photo: 'https://images.unsplash.com/photo-1499557354967-2b2d8910bcca?w=400&h=500&fit=crop',
            photos: [],
            online: false,
            lastActive: '1 hour ago'
        },
        // === PROFILE 14: Nicole - Plus-size, White, 38, 30mi, Some college, Friendship ===
        {
            id: 14,
            name: 'Nicole',
            age: 38,
            distance: 30,
            distanceText: '30 miles',
            compatibility: 69,
            occupation: 'Office Manager',
            education: 'some-college',
            height: "5'8\"",
            heightInches: 68,
            bodyType: 'Plus-size',
            ethnicity: 'white',
            smoking: 'Sometimes',
            drinking: 'Socially',
            exercise: 'sometimes',
            children: 'has',
            religion: 'spiritual',
            bio: '"Just looking to meet new people and see what happens."',
            interests: ['Movies', 'Books', 'Crafts', 'Pets', 'Gardening'],
            lookingFor: 'friendship',
            photo: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&h=500&fit=crop',
            photos: [],
            online: false,
            lastActive: '5 hours ago'
        },
        // === PROFILE 15: Keisha - Average, Black, 29, 9mi, Masters, Never smokes/drinks ===
        {
            id: 15,
            name: 'Keisha',
            age: 29,
            distance: 9,
            distanceText: '9 miles',
            compatibility: 87,
            occupation: 'Financial Analyst',
            education: 'masters',
            height: "5'5\"",
            heightInches: 65,
            bodyType: 'Average',
            ethnicity: 'black',
            smoking: 'Never',
            drinking: 'Never',
            exercise: 'regularly',
            children: 'no-want',
            religion: 'christian',
            bio: '"God-fearing woman looking for a man with purpose."',
            interests: ['Church', 'Finance', 'Travel', 'Cooking', 'Self-improvement'],
            lookingFor: 'marriage',
            photo: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&h=500&fit=crop',
            photos: [],
            online: true,
            lastActive: 'Now'
        },
        // === PROFILE 16: Sophia - Slim, White, 21, 1mi, Some college, Casual ===
        {
            id: 16,
            name: 'Sophia',
            age: 21,
            distance: 1,
            distanceText: '1 mile',
            compatibility: 74,
            occupation: 'College Student',
            education: 'some-college',
            height: "5'4\"",
            heightInches: 64,
            bodyType: 'Slim',
            ethnicity: 'white',
            smoking: 'Never',
            drinking: 'Socially',
            exercise: 'sometimes',
            children: 'no-dont-want',
            religion: 'agnostic',
            bio: '"Living my best college life. Not looking for anything serious rn."',
            interests: ['Parties', 'Music', 'Fashion', 'TikTok', 'Friends'],
            lookingFor: 'casual',
            photo: 'https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?w=400&h=500&fit=crop',
            photos: [],
            online: true,
            lastActive: 'Now'
        },
        // === PROFILE 17: Diana - Athletic, Mixed, 34, 14mi, Doctorate, Agnostic ===
        {
            id: 17,
            name: 'Diana',
            age: 34,
            distance: 14,
            distanceText: '14 miles',
            compatibility: 83,
            occupation: 'Professor',
            education: 'doctorate',
            height: "5'9\"",
            heightInches: 69,
            bodyType: 'Athletic',
            ethnicity: 'mixed',
            smoking: 'Never',
            drinking: 'Socially',
            exercise: 'regularly',
            children: 'no-want',
            religion: 'agnostic',
            bio: '"Academic by day, adventure seeker on weekends. Looking for intellectual connection."',
            interests: ['Literature', 'Hiking', 'Wine', 'Philosophy', 'Travel'],
            lookingFor: 'relationship',
            photo: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=500&fit=crop',
            photos: [],
            online: false,
            lastActive: '2 hours ago'
        },
        // === PROFILE 18: Fatima - Average, Middle Eastern, 26, 11mi, Bachelors, Muslim ===
        {
            id: 18,
            name: 'Fatima',
            age: 26,
            distance: 11,
            distanceText: '11 miles',
            compatibility: 80,
            occupation: 'Pharmacist',
            education: 'bachelors',
            height: "5'4\"",
            heightInches: 64,
            bodyType: 'Average',
            ethnicity: 'middle-eastern',
            smoking: 'Never',
            drinking: 'Never',
            exercise: 'sometimes',
            children: 'no-want',
            religion: 'muslim',
            bio: '"Traditional values, modern mindset. Looking for my forever person."',
            interests: ['Family', 'Cooking', 'Reading', 'Travel', 'Nature'],
            lookingFor: 'marriage',
            photo: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&h=500&fit=crop',
            photos: [],
            online: true,
            lastActive: 'Now'
        },
        // === PROFILE 19: Taylor - Curvy, White, 28, 22mi, Bachelors, Regular smoker ===
        {
            id: 19,
            name: 'Taylor',
            age: 28,
            distance: 22,
            distanceText: '22 miles',
            compatibility: 72,
            occupation: 'Graphic Designer',
            education: 'bachelors',
            height: "5'5\"",
            heightInches: 65,
            bodyType: 'Curvy',
            ethnicity: 'white',
            smoking: 'Regularly',
            drinking: 'Regularly',
            exercise: 'never',
            children: 'no-dont-want',
            religion: 'atheist',
            bio: '"Creative mind, chaotic energy. 420 friendly."',
            interests: ['Art', 'Music', 'Gaming', 'Tattoos', 'Cannabis'],
            lookingFor: 'casual',
            photo: 'https://images.unsplash.com/photo-1502767089025-6572583495f9?w=400&h=500&fit=crop',
            photos: [],
            online: false,
            lastActive: '4 hours ago'
        },
        // === PROFILE 20: Grace - Slim, Asian, 40, 16mi, Masters, Christian, Has kids ===
        {
            id: 20,
            name: 'Grace',
            age: 40,
            distance: 16,
            distanceText: '16 miles',
            compatibility: 78,
            occupation: 'Business Consultant',
            education: 'masters',
            height: "5'5\"",
            heightInches: 65,
            bodyType: 'Slim',
            ethnicity: 'asian',
            smoking: 'Never',
            drinking: 'Socially',
            exercise: 'regularly',
            children: 'has',
            religion: 'christian',
            bio: '"Divorced, not defeated. Ready to find love again."',
            interests: ['Business', 'Golf', 'Wine', 'Travel', 'Church'],
            lookingFor: 'relationship',
            photo: 'https://images.unsplash.com/photo-1546961342-ea1f71fa5728?w=400&h=500&fit=crop',
            photos: [],
            online: true,
            lastActive: 'Now'
        },
        // === PROFILE 21: Jasmine - Plus-size, Black, 36, 35mi, High school ===
        {
            id: 21,
            name: 'Jasmine',
            age: 36,
            distance: 35,
            distanceText: '35 miles',
            compatibility: 68,
            occupation: 'Chef',
            education: 'high-school',
            height: "5'6\"",
            heightInches: 66,
            bodyType: 'Plus-size',
            ethnicity: 'black',
            smoking: 'Never',
            drinking: 'Socially',
            exercise: 'sometimes',
            children: 'has-want-more',
            religion: 'christian',
            bio: '"Feed your soul through food. Looking for someone to cook for."',
            interests: ['Cooking', 'Food', 'Music', 'Family', 'Church'],
            lookingFor: 'relationship',
            photo: 'https://images.unsplash.com/photo-1589156280159-27698a70f29e?w=400&h=500&fit=crop',
            photos: [],
            online: false,
            lastActive: '6 hours ago'
        },
        // === PROFILE 22: Elena - Athletic, Hispanic, 23, 3mi, Some college ===
        {
            id: 22,
            name: 'Elena',
            age: 23,
            distance: 3,
            distanceText: '3 miles',
            compatibility: 85,
            occupation: 'Personal Trainer',
            education: 'some-college',
            height: "5'7\"",
            heightInches: 67,
            bodyType: 'Athletic',
            ethnicity: 'hispanic',
            smoking: 'Never',
            drinking: 'Socially',
            exercise: 'regularly',
            children: 'no-dont-want',
            religion: 'catholic',
            bio: '"Fitness is my life. Looking for a gym partner and life partner."',
            interests: ['Fitness', 'Nutrition', 'Dance', 'Beach', 'Dogs'],
            lookingFor: 'relationship',
            photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=500&fit=crop',
            photos: [],
            online: true,
            lastActive: 'Now'
        },
        // === PROFILE 23: Amanda - Average, White, 42, 40mi, Bachelors, Divorced ===
        {
            id: 23,
            name: 'Amanda',
            age: 42,
            distance: 40,
            distanceText: '40 miles',
            compatibility: 66,
            occupation: 'Teacher',
            education: 'bachelors',
            height: "5'4\"",
            heightInches: 64,
            bodyType: 'Average',
            ethnicity: 'white',
            smoking: 'Never',
            drinking: 'Socially',
            exercise: 'sometimes',
            children: 'has',
            religion: 'spiritual',
            bio: '"Teacher by day, wine enthusiast by night. Looking for someone genuine."',
            interests: ['Education', 'Reading', 'Wine', 'Hiking', 'Dogs'],
            lookingFor: 'relationship',
            photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=500&fit=crop',
            photos: [],
            online: false,
            lastActive: '1 day ago'
        },
        // === PROFILE 24: Yuki - Slim, Asian, 24, 5mi, Masters, Buddhist ===
        {
            id: 24,
            name: 'Yuki',
            age: 24,
            distance: 5,
            distanceText: '5 miles',
            compatibility: 90,
            occupation: 'UX Designer',
            education: 'masters',
            height: "5'2\"",
            heightInches: 62,
            bodyType: 'Slim',
            ethnicity: 'asian',
            smoking: 'Never',
            drinking: 'Socially',
            exercise: 'sometimes',
            children: 'no-want',
            religion: 'buddhist',
            bio: '"Design nerd who loves anime and cats. Seeking fellow introvert."',
            interests: ['Design', 'Anime', 'Gaming', 'Cats', 'Art'],
            lookingFor: 'relationship',
            photo: 'https://images.unsplash.com/photo-1514315384763-ba401779410f?w=400&h=500&fit=crop',
            photos: [],
            online: true,
            lastActive: 'Now'
        },
        // === PROFILE 25: Morgan - Curvy, Mixed, 30, 8mi, Bachelors, Non-binary friendly ===
        {
            id: 25,
            name: 'Morgan',
            age: 30,
            distance: 8,
            distanceText: '8 miles',
            compatibility: 82,
            occupation: 'Social Worker',
            education: 'bachelors',
            height: "5'6\"",
            heightInches: 66,
            bodyType: 'Curvy',
            ethnicity: 'mixed',
            smoking: 'Sometimes',
            drinking: 'Socially',
            exercise: 'sometimes',
            children: 'no-want',
            religion: 'spiritual',
            bio: '"Passionate about helping others. Looking for someone with a big heart."',
            interests: ['Social Justice', 'Art', 'Music', 'Nature', 'Volunteering'],
            lookingFor: 'relationship',
            photo: 'https://images.unsplash.com/photo-1507152927562-c18a0bbf3272?w=400&h=500&fit=crop',
            photos: [],
            online: true,
            lastActive: 'Now'
        }
    ],
    
    // Conversation state for AI date suggestions
    conversation: {
        messages: [],
        dateReadiness: 0, // 0-100 score
        suggestedDate: null,
        datePlanned: false
    },
    
    // Past connections
    connections: [],
    
    // Passed matches (declined) - tracked for one-at-a-time logic
    passedMatches: [],
    
    // Flag to indicate preferences were changed
    preferencesChanged: false,
    
    // Is the user logged in?
    isLoggedIn: false,
    
    // Has user completed their profile setup?
    profileComplete: false,
    
    // Profile visibility - hidden when matched
    profileVisibility: {
        isHidden: false,
        hiddenAt: null,
        reason: null // 'matched' | 'paused' | 'manual'
    },
    
    // Feedback received from matches who ended connections
    feedbackReceived: [],
    
    // Feedback given when user ends connections
    feedbackGiven: [],
    
    screenHistory: [],
    
    // Active experiment assignments for this user
    experimentAssignments: []
};

// ==========================================
// EXPERIMENT TREATMENT SYSTEM
// ==========================================

/**
 * Check if current user is enrolled in any active experiments
 * and apply appropriate treatments
 */
function checkAndApplyExperiments() {
    const userEmail = appState.user?.email?.toLowerCase();
    if (!userEmail) return;
    
    try {
        const activeExperiments = JSON.parse(localStorage.getItem('oith_active_experiments') || '[]');
        const activeTreatments = [];
        
        activeExperiments.forEach(exp => {
            if (exp.status !== 'active') return;
            
            const participant = exp.participants.find(p => 
                p.email.toLowerCase() === userEmail
            );
            
            if (participant) {
                // User is in this experiment
                if (participant.group === 'treatment') {
                    // Apply treatment
                    applyExperimentTreatment(exp.treatment);
                    activeTreatments.push({
                        experimentId: exp.id,
                        experimentName: exp.name,
                        treatment: exp.treatment,
                        group: 'treatment'
                    });
                    
                    // Mark user as having seen the treatment
                    if (!participant.hasSeenTreatment) {
                        markExperimentExposure(exp.id, userEmail);
                    }
                } else {
                    // Control group - no treatment applied
                    activeTreatments.push({
                        experimentId: exp.id,
                        experimentName: exp.name,
                        treatment: exp.treatment,
                        group: 'control'
                    });
                }
            }
        });
        
        // Store assignments in appState for reference
        appState.experimentAssignments = activeTreatments;
        
        if (activeTreatments.length > 0) {
            console.log('🧪 Experiment assignments:', activeTreatments);
        }
        
    } catch (e) {
        console.error('Error checking experiments:', e);
    }
}

/**
 * Mark a user as having been exposed to the treatment
 */
function markExperimentExposure(experimentId, userEmail) {
    try {
        const activeExperiments = JSON.parse(localStorage.getItem('oith_active_experiments') || '[]');
        const expIndex = activeExperiments.findIndex(e => e.id === experimentId);
        
        if (expIndex !== -1) {
            const participantIndex = activeExperiments[expIndex].participants.findIndex(
                p => p.email.toLowerCase() === userEmail.toLowerCase()
            );
            
            if (participantIndex !== -1) {
                activeExperiments[expIndex].participants[participantIndex].hasSeenTreatment = true;
                activeExperiments[expIndex].participants[participantIndex].firstExposure = new Date().toISOString();
                localStorage.setItem('oith_active_experiments', JSON.stringify(activeExperiments));
                console.log(`🧪 Marked exposure for ${userEmail} in experiment ${experimentId}`);
            }
        }
    } catch (e) {
        console.error('Error marking experiment exposure:', e);
    }
}

/**
 * Apply a specific treatment to the user's app experience
 */
function applyExperimentTreatment(treatment) {
    console.log(`🧪 Applying treatment: ${treatment}`);
    
    switch(treatment) {
        case 'premium_subscription':
            // Grant premium features
            if (appState.user.subscription) {
                appState.user.subscription.type = 'premium';
                appState.user.subscription.status = 'active';
                appState.user.subscription.experimentGranted = true;
            } else {
                appState.user.subscription = {
                    type: 'premium',
                    status: 'active',
                    experimentGranted: true
                };
            }
            console.log('  ✓ Premium subscription granted via experiment');
            break;
            
        case 'profile_boost':
            // Enable profile boost
            appState.user.profileBoost = {
                active: true,
                experimentGranted: true,
                boostMultiplier: 3
            };
            console.log('  ✓ Profile boost enabled via experiment');
            break;
            
        case 'ai_suggestions':
            // Enable AI suggestions
            appState.user.aiSuggestions = {
                enabled: true,
                experimentGranted: true
            };
            console.log('  ✓ AI suggestions enabled via experiment');
            break;
            
        case 'photo_verification':
            // Grant verified badge
            appState.user.verified = true;
            appState.user.verificationExperiment = true;
            updateVerificationBadge();
            console.log('  ✓ Photo verification badge granted via experiment');
            break;
            
        case 'date_planner':
            // Unlock date planner
            appState.user.datePlannerUnlocked = true;
            appState.user.datePlannerExperiment = true;
            console.log('  ✓ Date planner unlocked via experiment');
            break;
            
        case 'read_receipts':
            // Enable read receipts
            appState.user.readReceipts = {
                enabled: true,
                experimentGranted: true
            };
            console.log('  ✓ Read receipts enabled via experiment');
            break;
            
        case 'push_notifications':
            // Enhanced notifications
            appState.user.enhancedNotifications = {
                enabled: true,
                experimentGranted: true
            };
            console.log('  ✓ Enhanced push notifications enabled via experiment');
            break;
            
        case 'email_reminders':
            // Email reminders
            appState.user.emailReminders = {
                enabled: true,
                experimentGranted: true
            };
            console.log('  ✓ Email reminders enabled via experiment');
            break;
            
        default:
            console.log(`  ⚠ Unknown treatment: ${treatment}`);
    }
    
    // Save the state
    saveUserData();
}

/**
 * Update UI to show verification badge if user has it
 */
function updateVerificationBadge() {
    if (appState.user.verified) {
        // Add verified badge to profile displays
        document.querySelectorAll('.profile-name, .user-name').forEach(el => {
            if (!el.querySelector('.verified-badge')) {
                const badge = document.createElement('span');
                badge.className = 'verified-badge';
                badge.innerHTML = '✓';
                badge.title = 'Verified';
                badge.style.cssText = 'display: inline-block; background: #3b82f6; color: white; border-radius: 50%; width: 16px; height: 16px; font-size: 10px; line-height: 16px; text-align: center; margin-left: 4px;';
                el.appendChild(badge);
            }
        });
    }
}

/**
 * Check if current user has a specific experiment feature
 */
function hasExperimentFeature(feature) {
    const assignment = appState.experimentAssignments?.find(a => 
        a.treatment === feature && a.group === 'treatment'
    );
    return !!assignment;
}

/**
 * Get experiment info for current user
 */
function getExperimentInfo() {
    return appState.experimentAssignments || [];
}

// ==========================================
// One Match at a Time - Core Logic
// ==========================================

/**
 * Present the user's ONE match
 * This is the core of the "one match at a time" system
 */
function presentMatch() {
    console.log('🎯 presentMatch called');
    
    // Check if user already has an active connection
    if (appState.activeConnection) {
        console.log('   -> Going to accepted view (active connection)');
        showAcceptedMatchView();
        showScreen('match');
        return;
    }
    
    // Check if user has already received today's match and accepted
    if (appState.oneMatch.current && appState.oneMatch.decisionMade && appState.oneMatch.isMutual) {
        showAcceptedMatchView();
        showScreen('match');
        return;
    }
    
    // Check if current match is still valid (bot might have been deactivated)
    if (appState.oneMatch.current && !appState.oneMatch.decisionMade) {
        const testBots = JSON.parse(localStorage.getItem('oith_test_bots') || '[]');
        const activeBots = testBots.filter(bot => bot.active);
        const activeBotNames = new Set(activeBots.map(bot => bot.name.toLowerCase()));
        const currentMatchName = appState.oneMatch.current.name?.toLowerCase();
        
        // If current match is no longer an active bot, clear it and get new match
        if (activeBots.length > 0 && !activeBotNames.has(currentMatchName)) {
            console.log(`🔄 Current match "${appState.oneMatch.current.name}" is no longer active, getting new match...`);
            appState.oneMatch.current = null;
            appState.oneMatch.status = null;
            appState.oneMatch.decisionMade = false;
        } else {
            // They have a valid match waiting - show pending view
            console.log(`   -> Showing pending match: ${appState.oneMatch.current.name}`);
            renderCurrentMatch();
            showPendingMatchView();
            showScreen('match');
            return;
        }
    }
    
    // Check if waiting for next match
    if (appState.oneMatch.status === 'passed' && appState.oneMatch.nextMatchTime) {
        const now = new Date();
        if (now < appState.oneMatch.nextMatchTime) {
            showWaitingScreen();
            return;
        }
    }
    
    // Get next match from pool
    console.log('   -> Getting next match from pool...');
    const nextMatch = getNextMatch();
    console.log('   -> Next match:', nextMatch ? nextMatch.name : 'NONE');
    
    if (nextMatch) {
        appState.oneMatch.current = nextMatch;
        appState.oneMatch.status = 'presented';
        appState.oneMatch.decisionMade = false;
        appState.oneMatch.isMutual = false;
        
        // HIDE PROFILE - Profile is hidden while you have a pending match
        hideProfile('pending_match');
        
        // Set 24-hour decision deadline
        const decisionDeadline = new Date();
        decisionDeadline.setHours(decisionDeadline.getHours() + 24);
        appState.oneMatch.decisionDeadline = decisionDeadline;
        appState.oneMatch.decisionOneHourWarned = false; // Reset 1-hour warning flag
        appState.oneMatch.presentedAt = new Date(); // Track when match was presented
        
        // Start the decision timer
        startDecisionTimer();
        
        console.log('   -> Rendering match and showing screen');
        renderCurrentMatch();
        showPendingMatchView();
        showScreen('match');
        console.log('   -> Done! Current screen should be: match');
    } else {
        // No matches available
        console.log('   -> No matches available, showing no-matches screen');
        showScreen('no-matches');
    }
}

/**
 * Show the pending match view (accept/decline)
 */
function showPendingMatchView() {
    const pendingView = document.getElementById('matchPendingView');
    const acceptedView = document.getElementById('matchAcceptedView');
    
    if (pendingView) {
        pendingView.style.display = 'block';
        pendingView.style.opacity = '1';
        pendingView.style.transform = 'scale(1)';
    }
    if (acceptedView) {
        acceptedView.style.display = 'none';
    }
}

/**
 * Show the accepted match view with stats
 * @param {boolean} compact - If true, show a compact version for mutual matches
 */
function showAcceptedMatchView(compact = false) {
    const pendingView = document.getElementById('matchPendingView');
    const acceptedView = document.getElementById('matchAcceptedView');
    const waitingView = document.getElementById('matchWaitingView');
    
    if (pendingView) {
        pendingView.style.display = 'none';
    }
    if (waitingView) {
        waitingView.style.display = 'none';
    }
    if (acceptedView) {
        acceptedView.style.display = 'block';
        acceptedView.style.opacity = '1';
        acceptedView.style.transform = 'scale(1)';
        
        // Add compact class for mutual matches
        if (compact) {
            acceptedView.classList.add('compact');
        } else {
            acceptedView.classList.remove('compact');
        }
    }
}

/**
 * Show active connection screen (redirect to chat list)
 */
function showActiveConnectionScreen() {
    showAcceptedMatchView();
    showScreen('match');
}

/**
 * Sync all users from database to match pool
 * Includes real registered users AND active test bots
 * Excludes the currently logged-in user
 */
function syncUsersToMatchPool() {
    const currentUserEmail = appState.user?.email?.toLowerCase();
    console.log('🔄 Syncing users to match pool. Current user:', currentUserEmail);
    
    // Get registered users
    const registeredUsers = JSON.parse(localStorage.getItem('oith_registered_users') || '{}');
    
    // Get test bots
    const testBots = JSON.parse(localStorage.getItem('oith_test_bots') || '[]');
    const activeBots = testBots.filter(bot => bot.active);
    
    // Track which profiles we've added
    const addedEmails = new Set();
    const addedBotIds = new Set();
    
    // Sync real users from database
    Object.keys(registeredUsers).forEach(email => {
        // Skip current logged-in user
        if (email.toLowerCase() === currentUserEmail) {
            console.log(`  ⏭️ Skipping self: ${email}`);
            return;
        }
        
        const regUser = registeredUsers[email];
        
        // Get full user data from storage
        const storageKey = getUserStorageKey(email);
        const userData = JSON.parse(localStorage.getItem(storageKey) || '{}');
        const user = userData.user || {};
        
        // Skip users without basic profile info
        if (!user.firstName && !regUser.firstName) {
            console.log(`  ⏭️ Skipping incomplete profile: ${email}`);
            return;
        }
        
        // Create profile from user data
        const userProfile = {
            id: `user_${email.replace(/[^a-z0-9]/gi, '_')}`,
            email: email,
            name: user.firstName || regUser.firstName || 'User',
            age: user.age || calculateAgeFromBirthday(user.birthday || regUser.birthday) || 25,
            photo: user.photos?.[0] || 'https://i.pravatar.cc/400?u=' + email,
            photos: user.photos || [],
            occupation: user.occupation || 'Professional',
            location: user.location || regUser.location || 'Unknown',
            bio: user.bio || 'Looking to meet new people!',
            distance: Math.floor(Math.random() * 15) + 1,
            distanceText: `${Math.floor(Math.random() * 15) + 1} miles`,
            compatibility: Math.floor(Math.random() * 25) + 70,
            gender: (user.gender || regUser.gender || 'female').toLowerCase(),
            ethnicity: user.ethnicity || 'not specified',
            bodyType: user.bodyType || 'Average',
            height: user.height || "5'6\"",
            education: user.education || 'bachelors',
            children: user.children || 'not specified',
            drinking: user.drinking || 'socially',
            smoking: user.smoking || 'never',
            exercise: user.exercise || 'sometimes',
            religion: user.religion || 'not specified',
            interests: user.interests || ['Movies', 'Travel', 'Dining'],
            lookingFor: user.lookingFor || 'relationship',
            isRealUser: true,
            isTestBot: false,
            online: true,
            lastActive: 'Recently'
        };
        
        // Check if already in pool
        const existingIndex = appState.matchPool.findIndex(m => 
            m.email === email || m.id === userProfile.id
        );
        
        if (existingIndex >= 0) {
            appState.matchPool[existingIndex] = { ...appState.matchPool[existingIndex], ...userProfile };
            console.log(`  📝 Updated real user in pool: ${userProfile.name} (${email})`);
        } else {
            appState.matchPool.push(userProfile);
            console.log(`  ✅ Added real user to pool: ${userProfile.name} (${email})`);
        }
        
        addedEmails.add(email.toLowerCase());
    });
    
    // Sync active test bots
    activeBots.forEach(bot => {
        const botLocation = bot.location || 'New York, NY';
        const botCoords = getCoordinates(botLocation);
        const calculatedDistance = getDistanceToProfile({ location: botLocation, coordinates: botCoords });
        
        const botProfile = {
            id: bot.id || `bot_${bot.name.replace(/\s+/g, '_')}`,
            name: bot.name,
            age: bot.age || 25,
            photo: bot.photo,
            occupation: bot.occupation || 'Professional',
            location: botLocation,
            coordinates: botCoords,
            bio: bot.bio || 'Looking to meet new people!',
            distance: calculatedDistance,
            distanceText: `${calculatedDistance} miles`,
            compatibility: Math.floor(Math.random() * 20) + 75,
            gender: (bot.gender || 'female').toLowerCase(),
            ethnicity: bot.ethnicity || 'white',
            bodyType: bot.bodyType || 'Average',
            height: bot.height || "5'6\"",
            education: bot.education || 'bachelors',
            children: bot.wantsKids || 'someday',
            drinking: bot.drinking || 'socially',
            smoking: bot.smoking || 'never',
            religion: bot.religion || 'spiritual',
            interests: bot.interests || ['Movies', 'Travel', 'Dining'],
            lookingFor: bot.relationshipGoal || 'relationship',
            isTestBot: true,
            isRealUser: false,
            online: true,
            lastActive: 'Now'
        };
        
        const existingIndex = appState.matchPool.findIndex(m => 
            m.name.toLowerCase() === bot.name.toLowerCase() || m.id === bot.id
        );
        
        if (existingIndex >= 0) {
            appState.matchPool[existingIndex] = { ...appState.matchPool[existingIndex], ...botProfile };
            console.log(`  🤖 Updated test bot in pool: ${bot.name}`);
        } else {
            appState.matchPool.push(botProfile);
            console.log(`  🤖 Added test bot to pool: ${bot.name}`);
        }
        
        addedBotIds.add(bot.id);
    });
    
    console.log(`📊 Match pool now has ${appState.matchPool.length} profiles (${addedEmails.size} users, ${addedBotIds.size} bots)`);
}

/**
 * Calculate age from birthday string
 */
function calculateAgeFromBirthday(birthday) {
    if (!birthday) return null;
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

/**
 * Parse height string to inches for comparison
 * e.g., "5'6\"" -> 66, "6'0" -> 72
 */
function parseHeightToInches(heightStr) {
    if (!heightStr) return null;
    
    // Match patterns like 5'6", 5'6, 6'0", etc.
    const match = heightStr.match(/(\d+)'(\d+)?/);
    if (match) {
        const feet = parseInt(match[1]) || 0;
        const inches = parseInt(match[2]) || 0;
        return (feet * 12) + inches;
    }
    
    // Try to parse as just inches
    const inchesOnly = parseInt(heightStr);
    if (!isNaN(inchesOnly)) return inchesOnly;
    
    return null;
}

/**
 * Force sync current user to AWS - ensures profile is saved to cloud
 * Only sends ESSENTIAL profile data (not match history, conversations, etc.)
 */
async function forceSyncToAWS() {
    const email = appState.user?.email;
    if (!email) {
        console.log('⚠️ Cannot sync - no user logged in');
        return false;
    }
    
    const awsUrl = AWS_API_URL;
    if (!awsUrl) {
        console.log('⚠️ Cannot sync - no AWS URL configured');
        return false;
    }
    
    console.log('☁️ Force syncing to AWS:', email);
    
    try {
        const registeredUsers = JSON.parse(localStorage.getItem('oith_registered_users') || '{}');
        const regUser = registeredUsers[email] || {};
        
        // Only send essential profile data (keep under 400KB limit)
        // DO NOT send: match history, conversations, connections, etc.
        const payload = {
            email: email,
            name: appState.user.firstName || regUser.firstName || '',
            password: regUser.password || '',
            userData: {
                user: {
                    email: email,
                    firstName: appState.user.firstName || '',
                    age: appState.user.age || null,
                    birthday: appState.user.birthday || '',
                    gender: appState.user.gender || '',
                    location: appState.user.location || '',
                    occupation: appState.user.occupation || '',
                    education: appState.user.education || '',
                    bio: (appState.user.bio || '').substring(0, 500), // Limit bio length
                    photo: appState.user.photos?.[0] || '', // Only first photo URL
                    height: appState.user.height || '',
                    bodyType: appState.user.bodyType || '',
                    interests: (appState.user.interests || []).slice(0, 10) // Limit interests
                }
            }
        };
        
        console.log('📤 Sending to AWS (minimal data):', payload.email);
        
        const response = await fetch(`${awsUrl}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        console.log('📥 AWS Response:', result);
        
        if (response.ok && result.success) {
            console.log('✅ Successfully synced to AWS!');
            return true;
        } else {
            console.error('❌ AWS sync failed:', result);
            return false;
        }
    } catch (error) {
        console.error('❌ AWS sync error:', error);
        return false;
    }
}

// ============ REAL USER MATCHING (AWS) ============

/**
 * Like a real user - sends to AWS and checks for mutual match
 */
async function likeRealUser(toEmail) {
    const fromEmail = appState.user?.email;
    if (!fromEmail || !toEmail) {
        console.log('⚠️ Cannot like - missing email');
        return { success: false };
    }
    
    try {
        console.log(`💕 Liking user: ${toEmail}`);
        
        const response = await fetch(`${AWS_API_URL}/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromEmail, toEmail })
        });
        
        const result = await response.json();
        console.log('💕 Like result:', result);
        
        if (result.isMatch) {
            console.log('🎉 IT\'S A MATCH!');
            showToast('🎉 It\'s a Match! You can now chat!', 'success');
            
            // Store the match locally
            if (!appState.realMatches) appState.realMatches = [];
            appState.realMatches.push({
                email: toEmail,
                matchedAt: new Date().toISOString()
            });
            saveUserData();
        }
        
        return result;
    } catch (error) {
        console.error('Like error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get all matches for current user from AWS
 */
async function getMyMatches() {
    const email = appState.user?.email;
    if (!email) return [];
    
    try {
        const response = await fetch(`${AWS_API_URL}/matches/${encodeURIComponent(email)}`);
        const result = await response.json();
        console.log('💕 My matches:', result.matches);
        return result.matches || [];
    } catch (error) {
        console.error('Get matches error:', error);
        return [];
    }
}

/**
 * Send a chat message to a match
 */
async function sendChatMessage(matchId, message) {
    const fromEmail = appState.user?.email;
    if (!fromEmail || !matchId || !message) return { success: false };
    
    try {
        const response = await fetch(`${AWS_API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId, fromEmail, message })
        });
        return await response.json();
    } catch (error) {
        console.error('Send message error:', error);
        return { success: false };
    }
}

/**
 * Get chat messages for a match
 */
async function getChatMessages(matchId) {
    if (!matchId) return [];
    
    try {
        const response = await fetch(`${AWS_API_URL}/chat/${encodeURIComponent(matchId)}`);
        const result = await response.json();
        return result.messages || [];
    } catch (error) {
        console.error('Get messages error:', error);
        return [];
    }
}

/**
 * Run automatic matching service
 * Finds users who match each other's preferences and creates matches
 */
async function runAutoMatch() {
    const email = appState.user?.email;
    if (!email) {
        console.log('⚠️ Cannot run auto-match - no user logged in');
        return { success: false };
    }
    
    try {
        console.log('🔍 Running automatic matching service...');
        
        const response = await fetch(`${AWS_API_URL}/match/auto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        const result = await response.json();
        console.log('🔍 Auto-match result:', result);
        
        if (result.newMatches && result.newMatches.length > 0) {
            console.log(`💕 Found ${result.newMatches.length} automatic matches!`);
            
            // Notify user of new matches
            result.newMatches.forEach(match => {
                showToast(`💕 You matched with ${match.matchedWithName}!`, 'success');
            });
            
            // Store matches locally
            if (!appState.autoMatches) appState.autoMatches = [];
            appState.autoMatches.push(...result.newMatches);
            
            // If we got a match, hide our profile and show match screen
            if (result.newMatches.length > 0) {
                appState.profileVisibility = appState.profileVisibility || {};
                appState.profileVisibility.isHidden = true;
                appState.profileVisibility.reason = 'matched';
                appState.profileVisibility.hiddenAt = new Date().toISOString();
                
                // Set the first match as active
                const firstMatch = result.newMatches[0];
                appState.activeConnection = {
                    email: firstMatch.matchedWith,
                    name: firstMatch.matchedWithName,
                    matchId: firstMatch.matchId,
                    matchedAt: firstMatch.matchedAt
                };
                
                saveUserData();
                
                // Vibrate on match
                if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
                
                // Show match celebration
                showScreen('chat');
            }
        } else {
            console.log('🔍 No automatic matches found yet');
        }
        
        return result;
    } catch (error) {
        console.error('Auto-match error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Save user preferences to DynamoDB for matching
 */
async function savePreferencesToAWS() {
    const email = appState.user?.email;
    const prefs = appState.user?.matchPreferences || appState.user?.preferences;
    
    if (!email || !prefs) return;
    
    try {
        const userData = {
            user: {
                ...appState.user,
                preferences: prefs,
                matchPreferences: prefs
            }
        };
        
        await syncToServer(email, userData, { firstName: appState.user.firstName });
        console.log('✅ Preferences saved to AWS');
        
        // Run auto-match after saving preferences
        await runAutoMatch();
    } catch (error) {
        console.error('Failed to save preferences:', error);
    }
}

/**
 * Reset all profiles - clears passed matches so user can see everyone again
 */
function resetAllProfiles() {
    if (!confirm('This will reset all your passed profiles so you can see them again. Continue?')) {
        return;
    }
    
    // Clear passed matches
    appState.passedMatches = [];
    appState.matchHistory = [];
    appState.preferencesChanged = true;
    
    // Save the change
    saveUserData();
    
    showToast('✅ All profiles reset! Finding matches...', 'success');
    
    // Refresh match pool and find new match
    setTimeout(() => {
        if (typeof syncMatchPool === 'function') {
            syncMatchPool();
        }
        if (typeof presentMatch === 'function') {
            presentMatch();
        }
    }, 500);
}

/**
 * Manual refresh from cloud - callable by users via button
 */
async function refreshFromCloud() {
    showToast('☁️ Syncing from cloud...', 'info');
    
    try {
        await fetchAWSUsersForMatchPool();
        
        // Refresh the match pool
        if (typeof syncMatchPool === 'function') {
            syncMatchPool();
        }
        
        showToast('✅ Synced latest profiles from cloud!', 'success');
        
        // Try to get a new match
        setTimeout(() => {
            if (typeof presentMatch === 'function') {
                presentMatch();
            }
        }, 1000);
        
    } catch (error) {
        console.error('Cloud sync failed:', error);
        showToast('❌ Sync failed. Try again.', 'error');
    }
}

/**
 * Fetch users from AWS DynamoDB - this is the PRIMARY source of users
 * Only AWS/DynamoDB users are shown in the match pool
 */
async function fetchAWSUsersForMatchPool() {
    const awsApiUrl = AWS_API_URL;
    if (!awsApiUrl) {
        console.log('⚠️ No AWS API configured, skipping AWS user fetch');
        return;
    }
    
    try {
        console.log('☁️ Fetching users from DynamoDB...');
        const response = await fetch(`${awsApiUrl}/users`);
        
        if (!response.ok) {
            console.log('⚠️ Failed to fetch AWS users:', response.status);
            return;
        }
        
        const awsUsers = await response.json();
        const awsUserCount = Object.keys(awsUsers).length;
        
        console.log(`☁️ Found ${awsUserCount} users in DynamoDB`);
        
        // Store AWS profiles directly in appState (PRIMARY source for matching)
        appState.awsProfiles = awsUsers;
        
        if (awsUserCount === 0) {
            console.log('☁️ No users in DynamoDB yet');
            return;
        }
        
        console.log(`✅ Loaded ${awsUserCount} users from DynamoDB for matching`);
        
    } catch (error) {
        console.log('⚠️ AWS user fetch failed:', error.message);
    }
}

/**
 * Get all available profiles from DynamoDB ONLY
 * No test bots, no localStorage - ONLY real AWS users
 * Excludes the specified email (current user)
 */
function getAvailableProfilesFromDatabase(excludeEmail) {
    const profiles = [];
    const excludeEmailLower = excludeEmail?.toLowerCase();
    
    // ONLY use AWS profiles (fetched from DynamoDB)
    const awsProfiles = appState.awsProfiles || {};
    
    Object.entries(awsProfiles).forEach(([email, userData]) => {
        if (email.toLowerCase() === excludeEmailLower) return;
        
        // Skip users without a name
        if (!userData.firstName && !userData.name) return;
        
        const profileLocation = userData.location || 'Unknown';
        const profileCoords = getCoordinates(profileLocation);
        
        profiles.push({
            email: email,
            name: userData.firstName || userData.name || 'User',
            age: userData.age || 25,
            gender: (userData.gender || 'unknown').toLowerCase(),
            photo: userData.photo || 'https://i.pravatar.cc/400?u=' + email,
            location: profileLocation,
            coordinates: profileCoords,
            distance: getDistanceToProfile({ location: profileLocation, coordinates: profileCoords }),
            education: userData.education || 'bachelors',
            occupation: userData.occupation || 'Professional',
            bio: userData.bio || '',
            isRealUser: true,
            isTestBot: false,
            isAWSUser: true
        });
    });
    
    console.log(`☁️ DynamoDB profiles: ${profiles.length} (excluding ${excludeEmail})`);
    return profiles;
}

/**
 * Sync test bots from admin dashboard to match pool
 * Ensures active bots are available as matches
 * @deprecated Use syncUsersToMatchPool() instead
 */
function syncTestBotsToMatchPool(testBots) {
    // Now handled by syncUsersToMatchPool
    syncUsersToMatchPool();
}

/**
 * Get the next match from the pool
 * In production, this would be AI-powered matching
 * ONE PROFILE AT A TIME - returns single best match
 */
function getNextMatch() {
    const currentUserEmail = appState.user?.email?.toLowerCase();
    
    // Sync ALL users (real users + active test bots) to match pool
    syncUsersToMatchPool();
    
    // Get test bot settings for reference
    const testBots = JSON.parse(localStorage.getItem('oith_test_bots') || '[]');
    const activeBots = testBots.filter(bot => bot.active);
    
    console.log(`📊 Database sync complete. Pool has ${appState.matchPool.length} profiles`);
    console.log(`   - Active test bots: ${activeBots.length}`);
    console.log(`   - Current user: ${currentUserEmail}`);
    
    // Filter matches - include real users AND active test bots, exclude self
    const availableMatches = appState.matchPool.filter(match => {
        // Never show current user to themselves
        if (match.email && match.email.toLowerCase() === currentUserEmail) {
            console.log(`  ⏭️ ${match.name}: Skipping (this is the current user)`);
            return false;
        }
        
        const wasConnected = appState.connections.some(c => c.id === match.id);
        const wasPassed = appState.passedMatches && appState.passedMatches.includes(match.id);
        
        if (wasConnected) {
            console.log(`  ❌ ${match.name}: Already connected`);
            return false;
        }
        if (wasPassed) {
            console.log(`  ❌ ${match.name}: Already passed`);
            return false;
        }
        
        // Include real users
        if (match.isRealUser) {
            console.log(`  ✅ ${match.name}: Real user - included`);
            return true;
        }
        
        // Include active test bots
        if (match.isTestBot) {
            const isActive = activeBots.some(b => 
                b.name.toLowerCase() === match.name.toLowerCase() || b.id === match.id
            );
            if (isActive) {
                console.log(`  🤖 ${match.name}: Active test bot - included`);
                return true;
            } else {
                console.log(`  ⏭️ ${match.name}: Inactive test bot - skipped`);
                return false;
            }
        }
        
        // Skip hardcoded demo profiles if we have real users or bots
        const hasRealMatches = appState.matchPool.some(m => m.isRealUser || m.isTestBot);
        if (hasRealMatches && !match.isRealUser && !match.isTestBot) {
            console.log(`  ⏭️ ${match.name}: Demo profile skipped (real users available)`);
            return false;
        }
        
        // Include demo profiles only if no real users or bots are available
        console.log(`  📝 ${match.name}: Demo profile - included (no real users)`);
        return true;
    });
    
    console.log(`🎯 Available matches after filtering: ${availableMatches.length}`, availableMatches.map(m => m.name));
    
    if (availableMatches.length === 0) {
        // All matches exhausted - reset passed matches if preferences changed
        if (appState.preferencesChanged) {
            appState.passedMatches = [];
            appState.preferencesChanged = false;
            return getNextMatch();
        }
        return null;
    }
    
    // Get user's match preferences (use matchPreferences if set, fall back to basic preferences)
    const prefs = appState.user.matchPreferences || appState.user.preferences || {};
    
    console.log('🔍 Filtering matches with preferences:', prefs);
    
    // Filter by ALL match preferences
    const filteredMatches = availableMatches.filter(match => {
        // Age filter
        const ageMin = prefs.ageMin || 18;
        const ageMax = prefs.ageMax || 99;
        if (match.age < ageMin || match.age > ageMax) {
            console.log(`  ❌ ${match.name}: Age ${match.age} not in range ${ageMin}-${ageMax}`);
            return false;
        }
        
        // Distance filter
        const maxDistance = prefs.maxDistance || prefs.distance || 100;
        if (match.distance > maxDistance) {
            console.log(`  ❌ ${match.name}: Distance ${match.distance}mi exceeds max ${maxDistance}mi`);
            return false;
        }
        
        // Body type filter (if specified)
        if (prefs.bodyType && prefs.bodyType.length > 0) {
            const matchBodyType = match.bodyType?.toLowerCase().replace('-', '');
            const prefsBodyTypes = prefs.bodyType.map(bt => bt.toLowerCase().replace('-', ''));
            if (!prefsBodyTypes.some(bt => matchBodyType?.includes(bt) || bt.includes(matchBodyType))) {
                console.log(`  ❌ ${match.name}: Body type "${match.bodyType}" not in [${prefs.bodyType.join(', ')}]`);
                return false;
            }
        }
        
        // Ethnicity filter (if specified)
        if (prefs.ethnicity && prefs.ethnicity !== '' && prefs.ethnicity !== 'any') {
            if (match.ethnicity?.toLowerCase() !== prefs.ethnicity.toLowerCase()) {
                console.log(`  ❌ ${match.name}: Ethnicity "${match.ethnicity}" doesn't match "${prefs.ethnicity}"`);
                return false;
            }
        }
        
        // Education filter (if specified)
        if (prefs.education && prefs.education !== '' && prefs.education !== 'any') {
            const educationLevels = ['high-school', 'some-college', 'bachelors', 'masters', 'doctorate'];
            const minEducationIndex = educationLevels.indexOf(prefs.education);
            const matchEducationIndex = educationLevels.indexOf(match.education);
            if (minEducationIndex > -1 && matchEducationIndex < minEducationIndex) {
                console.log(`  ❌ ${match.name}: Education "${match.education}" below minimum "${prefs.education}"`);
                return false;
            }
        }
        
        // Smoking filter (if specified)
        if (prefs.smoking && prefs.smoking.length > 0) {
            const matchSmoking = match.smoking?.toLowerCase();
            const prefsSmoking = prefs.smoking.map(s => s.toLowerCase());
            if (!prefsSmoking.includes(matchSmoking)) {
                console.log(`  ❌ ${match.name}: Smoking "${match.smoking}" not in [${prefs.smoking.join(', ')}]`);
                return false;
            }
        }
        
        // Drinking filter (if specified)
        if (prefs.drinking && prefs.drinking.length > 0) {
            const matchDrinking = match.drinking?.toLowerCase();
            const prefsDrinking = prefs.drinking.map(d => d.toLowerCase());
            if (!prefsDrinking.includes(matchDrinking)) {
                console.log(`  ❌ ${match.name}: Drinking "${match.drinking}" not in [${prefs.drinking.join(', ')}]`);
                return false;
            }
        }
        
        // Exercise filter (if specified)
        if (prefs.exercise && prefs.exercise !== '' && prefs.exercise !== 'any') {
            if (match.exercise?.toLowerCase() !== prefs.exercise.toLowerCase()) {
                console.log(`  ❌ ${match.name}: Exercise "${match.exercise}" doesn't match "${prefs.exercise}"`);
                return false;
            }
        }
        
        // Children filter (if specified)
        if (prefs.children && prefs.children !== '' && prefs.children !== 'any') {
            if (match.children !== prefs.children) {
                console.log(`  ❌ ${match.name}: Children preference "${match.children}" doesn't match "${prefs.children}"`);
                return false;
            }
        }
        
        // Religion filter (if specified)
        if (prefs.religion && prefs.religion !== '' && prefs.religion !== 'any') {
            if (match.religion?.toLowerCase() !== prefs.religion.toLowerCase()) {
                console.log(`  ❌ ${match.name}: Religion "${match.religion}" doesn't match "${prefs.religion}"`);
                return false;
            }
        }
        
        // Looking for filter (if specified)
        if (prefs.lookingFor && prefs.lookingFor.length > 0) {
            const matchLookingFor = match.lookingFor?.toLowerCase();
            const prefsLookingFor = prefs.lookingFor.map(lf => lf.toLowerCase());
            if (!prefsLookingFor.includes(matchLookingFor)) {
                console.log(`  ❌ ${match.name}: Looking for "${match.lookingFor}" not in [${prefs.lookingFor.join(', ')}]`);
                return false;
            }
        }
        
        // Height filter (if specified)
        if (prefs.heightMin && match.heightInches) {
            if (match.heightInches < prefs.heightMin) {
                console.log(`  ❌ ${match.name}: Height ${match.heightInches}in below min ${prefs.heightMin}in`);
                return false;
            }
        }
        if (prefs.heightMax && match.heightInches) {
            if (match.heightInches > prefs.heightMax) {
                console.log(`  ❌ ${match.name}: Height ${match.heightInches}in above max ${prefs.heightMax}in`);
                return false;
            }
        }
        
        console.log(`  ✅ ${match.name}: Matches all preferences!`);
        return true;
    });
    
    console.log(`📊 Found ${filteredMatches.length} matches out of ${availableMatches.length} available`);
    
    if (filteredMatches.length === 0) {
        console.log('⚠️ No matches within preferences - consider adjusting filters');
        // Return null to show "no matches" message instead of ignoring preferences
        return null;
    }
    
    // Return the highest compatibility match - ONE AT A TIME
    return filteredMatches.sort((a, b) => b.compatibility - a.compatibility)[0];
}

/**
 * Render the current ONE match
 */
function renderCurrentMatch() {
    const match = appState.oneMatch.current;
    if (!match) return;
    
    // Update Preview Card (Pending View)
    const previewCard = document.getElementById('matchPreviewCard');
    if (previewCard) {
        const previewPhoto = previewCard.querySelector('.preview-photo');
        if (previewPhoto) previewPhoto.src = match.photo;
        
        const previewName = previewCard.querySelector('.preview-info h3');
        if (previewName) previewName.textContent = `${match.name}, ${match.age}`;
        
        const previewOcc = previewCard.querySelector('.preview-occupation');
        if (previewOcc) previewOcc.textContent = match.occupation || 'Professional';
        
        // Update height, city, and distance
        const previewHeight = document.getElementById('matchPreviewHeight');
        const previewCity = document.getElementById('matchPreviewCity');
        const previewDistance = document.getElementById('matchPreviewDistance');
        
        if (previewHeight) previewHeight.textContent = match.height || '5\'8"';
        if (previewCity) previewCity.textContent = match.location || match.city || 'Nearby';
        if (previewDistance) previewDistance.textContent = `${match.distance || match.distanceText || '3 mi'} away`;
        
        const compatBadge = previewCard.querySelector('.compatibility-badge span');
        if (compatBadge) compatBadge.textContent = `${match.compatibility}%`;
    }
    
    // Update Accepted Match Card
    const card = document.getElementById('matchCard');
    if (card) {
    // Update photo
    const photoImg = card.querySelector('.match-photo img');
    if (photoImg) photoImg.src = match.photo;
    
    // Update name and age
    const nameEl = card.querySelector('.match-name');
    if (nameEl) nameEl.textContent = `${match.name}, ${match.age}`;
    
    // Update location
    const locationEl = card.querySelector('.match-location');
    if (locationEl) {
        locationEl.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
            </svg>
            ${match.distance} away
        `;
    }
    
    // Update bio
    const bioEl = card.querySelector('.match-bio');
    if (bioEl) bioEl.textContent = match.bio;
    
    // Update interests
    const tagsContainer = card.querySelector('.match-tags');
    if (tagsContainer) {
        tagsContainer.innerHTML = match.interests.slice(0, 3).map(interest => 
            `<span class="tag">${interest}</span>`
        ).join('');
        }
    }
    
    // Update compatibility score labels
    const compatLabels = document.querySelectorAll('.match-sublabel.clickable');
    compatLabels.forEach(label => {
        label.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
            </svg>
            <span id="matchAcceptedCompatibility">${match.compatibility}%</span> compatibility
        `;
    });
    
    // Update the match label
    const matchLabel = document.querySelector('.match-accepted .match-label');
    if (matchLabel) matchLabel.textContent = `Connected with ${match.name}`;
    
    // Sync compatibility across all displays
    syncCompatibilityDisplays(match.compatibility);
}

/**
 * Sync compatibility percentage across all displays (match page, chat page, profile view, modal)
 */
function syncCompatibilityDisplays(compatibility) {
    const compatValue = compatibility || 92;
    const compatText = `${compatValue}%`;
    
    // Update match badge (pending match view)
    const matchBadge = document.getElementById('matchBadgeCompatibility');
    if (matchBadge) matchBadge.textContent = compatText;
    
    // Update accepted match view
    const matchAccepted = document.getElementById('matchAcceptedCompatibility');
    if (matchAccepted) matchAccepted.textContent = compatText;
    
    // Update profile view score
    const profileCompat = document.getElementById('profileCompatibility');
    if (profileCompat) profileCompat.textContent = compatText;
    
    // Update profile score circle (stroke-dashoffset based on percentage)
    const scoreCircle = document.getElementById('profileScoreCircle');
    if (scoreCircle) {
        // Full circle is ~283 (2 * PI * 45), so we calculate the offset
        const circumference = 283;
        const offset = circumference - (compatValue / 100) * circumference;
        scoreCircle.setAttribute('stroke-dasharray', circumference.toString());
        scoreCircle.setAttribute('stroke-dashoffset', offset.toString());
    }
    
    // Update chat page metrics
    const chatCompat = document.getElementById('chatCompatibility');
    if (chatCompat) chatCompat.textContent = compatText;
    
    // Update modal header
    const modalCompat = document.getElementById('modalCompatibility');
    if (modalCompat) modalCompat.textContent = compatText;
}

/**
 * Accept the automatically found match
 */
async function acceptMatch() {
    if (appState.oneMatch.decisionMade) return;
    
    const match = appState.oneMatch.current;
    if (!match) return;
    
    // Record user's acceptance (but not mutual yet)
    appState.oneMatch.userAccepted = true;
    appState.oneMatch.userAcceptedAt = new Date();
    appState.oneMatch.status = 'waiting_for_match';
    
    // Save state
    autoSave();
    
    // Show waiting for mutual match view
    showWaitingForMatchView(match);
    
    // Check if this is a REAL user (has email) vs test bot
    if (match.email && !match.isTestBot) {
        console.log('💕 Liking REAL user:', match.email);
        
        // Send like to AWS and check for mutual match
        const result = await likeRealUser(match.email);
        
        if (result.isMatch) {
            // MUTUAL MATCH! They already liked us
            console.log('🎉 MUTUAL MATCH with real user!');
            handleMutualMatch(match);
        } else {
            // They haven't liked us yet - show waiting
            console.log('⏳ Waiting for them to like back...');
            showToast('💕 You liked them! Waiting for them to see you...', 'info');
            
            // Poll for match every 10 seconds
            startMatchPolling(match.email);
        }
    } else {
        // Test bot - simulate response (legacy behavior)
        const responseDelay = 3000 + Math.random() * 5000;
        
        setTimeout(() => {
            const matchAccepts = Math.random() < 0.9;
            
            if (matchAccepts) {
                handleMutualMatch(match);
            } else {
                handleMatchDeclined(match);
            }
        }, responseDelay);
    }
}

/**
 * Poll AWS to check if we got a match
 */
let matchPollingInterval = null;
function startMatchPolling(matchEmail) {
    if (matchPollingInterval) clearInterval(matchPollingInterval);
    
    console.log('🔄 Starting match polling for:', matchEmail);
    
    matchPollingInterval = setInterval(async () => {
        console.log('🔍 Checking for match...');
        const matches = await getMyMatches();
        const found = matches.find(m => m.matchedWith === matchEmail);
        
        if (found) {
            console.log('🎉 Match confirmed!');
            clearInterval(matchPollingInterval);
            matchPollingInterval = null;
            
            // Play sound/vibrate
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            
            // They matched with us!
            handleMutualMatch(appState.oneMatch.current);
        }
    }, 5000); // Check every 5 seconds for faster response
    
    // Stop polling after 10 minutes
    setTimeout(() => {
        if (matchPollingInterval) {
            clearInterval(matchPollingInterval);
            matchPollingInterval = null;
            console.log('⏱️ Match polling timed out');
        }
    }, 600000);
}

/**
 * Check for new matches on app load (background check)
 */
async function checkForNewMatches() {
    const email = appState.user?.email;
    if (!email) return;
    
    try {
        const matches = await getMyMatches();
        const knownMatches = appState.knownMatches || [];
        
        // Find new matches we haven't seen
        const newMatches = matches.filter(m => !knownMatches.includes(m.matchedWith));
        
        if (newMatches.length > 0) {
            console.log('🎉 Found new matches:', newMatches);
            
            // Store as known
            appState.knownMatches = [...knownMatches, ...newMatches.map(m => m.matchedWith)];
            saveUserData();
            
            // Notify user
            newMatches.forEach(match => {
                showToast(`🎉 You matched with ${match.matchedWith}! Go to messages to chat.`, 'success');
            });
            
            // If waiting for this specific match, trigger the match screen
            if (appState.oneMatch?.status === 'waiting_for_match') {
                const waitingFor = appState.oneMatch.current?.email;
                const found = newMatches.find(m => m.matchedWith === waitingFor);
                if (found) {
                    handleMutualMatch(appState.oneMatch.current);
                }
            }
        }
    } catch (error) {
        console.log('Match check error:', error);
    }
}

// Check for matches every 30 seconds in background
setInterval(checkForNewMatches, 30000);

/**
 * Show the waiting for mutual match view
 */
function showWaitingForMatchView(match) {
    // Hide pending view
    const pendingView = document.getElementById('matchPendingView');
    const waitingView = document.getElementById('matchWaitingView');
    const acceptedView = document.getElementById('matchAcceptedView');
    
    if (pendingView) pendingView.style.display = 'none';
    if (acceptedView) acceptedView.style.display = 'none';
    
    // Set profile visibility to HIDDEN while matched
    appState.profileVisibility = appState.profileVisibility || {};
    appState.profileVisibility.isHidden = true;
    appState.profileVisibility.reason = 'matched';
    appState.profileVisibility.hiddenAt = new Date().toISOString();
    updateProfileVisibilityUI();
    
    // Update waiting view content
    const waitingMatchName = document.getElementById('waitingMatchName');
    const waitingMatchNameCard = document.getElementById('waitingMatchNameCard');
    const waitingMatchNameTip = document.getElementById('waitingMatchNameTip');
    const waitingMatchPhoto = document.getElementById('waitingMatchPhoto');
    const waitingUserPhoto = document.getElementById('waitingUserPhoto');
    
    if (waitingMatchName) waitingMatchName.textContent = match.name;
    if (waitingMatchNameCard) waitingMatchNameCard.textContent = match.name;
    if (waitingMatchNameTip) waitingMatchNameTip.textContent = match.name;
    if (waitingMatchPhoto) waitingMatchPhoto.src = match.photo;
    
    // Set user photo
    if (waitingUserPhoto && appState.user?.photos?.length > 0) {
        waitingUserPhoto.src = appState.user.photos[0];
    }
    
    // Show waiting view with animation
    if (waitingView) {
        waitingView.style.display = 'block';
        waitingView.style.opacity = '0';
        waitingView.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            waitingView.style.transition = 'all 0.3s ease';
            waitingView.style.opacity = '1';
            waitingView.style.transform = 'scale(1)';
        }, 50);
    }
    
    showToast(`💕 You accepted ${match.name}! Waiting for their response...`);
}

/**
 * Handle when both users have accepted - mutual match!
 */
function handleMutualMatch(match) {
    // Update match heart status
    const matchHeart = document.getElementById('matchHeartStatus');
    const matchStatusCard = document.getElementById('matchStatusCard');
    const matchStatusBadge = document.getElementById('matchStatusBadge');
    const waitingSubtitle = document.getElementById('waitingSubtitle');
    
    if (matchHeart) matchHeart.textContent = '❤️';
    if (matchStatusCard) {
        matchStatusCard.classList.add('accepted');
        const pendingSpinner = matchStatusCard.querySelector('.status-pending');
        if (pendingSpinner) {
            pendingSpinner.innerHTML = '<div class="status-check">✓</div>';
        }
    }
    if (matchStatusBadge) {
        matchStatusBadge.textContent = 'Accepted!';
        matchStatusBadge.classList.remove('pending');
        matchStatusBadge.classList.add('accepted');
    }
    if (waitingSubtitle) {
        waitingSubtitle.innerHTML = `<span class="mutual-success">🎉 It's a match! ${match.name} accepted too!</span>`;
    }
    
    // Finalize the connection
    appState.oneMatch.decisionMade = true;
    appState.oneMatch.isMutual = true;
    appState.oneMatch.matchAccepted = true;
    appState.oneMatch.matchAcceptedAt = new Date();
    appState.oneMatch.status = 'connected';
    
    // Create active connection
    appState.activeConnection = {
        ...match,
        connectedAt: new Date(),
        messages: []
    };
    
    // Add to match history for tracking
    if (!appState.matchHistory) appState.matchHistory = [];
    appState.matchHistory.push({
        id: match.id,
        name: match.name,
        photo: match.photo,
        age: match.age,
        compatibility: match.compatibility || 85,
        accepted: true,
        matchAccepted: true,
        connectedAt: new Date().toISOString(),
        status: 'connected'
    });
    
    // HIDE PROFILE - User is now matched
    hideProfile('matched');
    
    // Start the 24-hour connection timer
    startConnectionTimer();
    
    // Initialize connection metrics
    appState.connectionMetrics = {
        messageCount: 0,
        avgResponseTime: '0m',
        compatibility: match.compatibility || 92,
        dateReadiness: 0,
        connectedAt: new Date()
    };
    
    // Initialize conversation tracking
    appState.conversation = {
        messages: [],
        dateReadiness: 0,
        suggestedDate: null,
        datePlanned: false
    };
    
    // Save state
    autoSave();
    
    // Show success toast
    showToast(`🎉 You're connected with ${match.name}!`, 'success');
    
    // Show compact accepted view briefly
    showAcceptedMatchView(true);
    
    // After a brief moment to show the mutual match, go to chat
    setTimeout(() => {
        initializeChatWindow(match);
        showScreen('chat');
    }, 2000);
}

/**
 * Handle when match declines
 */
function handleMatchDeclined(match) {
    const matchHeart = document.getElementById('matchHeartStatus');
    const matchStatusCard = document.getElementById('matchStatusCard');
    const matchStatusBadge = document.getElementById('matchStatusBadge');
    const waitingSubtitle = document.getElementById('waitingSubtitle');
    
    if (matchHeart) matchHeart.textContent = '💔';
    if (matchStatusCard) {
        matchStatusCard.classList.add('declined');
    }
    if (matchStatusBadge) {
        matchStatusBadge.textContent = 'Declined';
        matchStatusBadge.classList.remove('pending');
        matchStatusBadge.classList.add('declined');
    }
    if (waitingSubtitle) {
        waitingSubtitle.innerHTML = `<span class="match-declined">${match.name} isn't ready to connect right now</span>`;
    }
    
    // Reset match state
    appState.oneMatch.userAccepted = false;
    appState.oneMatch.status = 'declined_by_match';
    
    // Make profile visible IMMEDIATELY so user can be found by others while we search
    showProfile('searching_for_new_match');
    
    // Show prominent decline notification modal
    showDeclineNotificationModal(match);
    
    // After showing the modal, start searching for new match
    setTimeout(() => {
        // Clear current match
        appState.oneMatch.current = null;
        appState.oneMatch.decisionMade = false;
        appState.oneMatch.status = null;
        
        autoSave();
        
        // Find next match - profile remains visible during search
        findNextMatch();
    }, 4000);
}

/**
 * Show a friendly notification modal when a match declines
 */
function showDeclineNotificationModal(match) {
    // Create or get the modal
    let modal = document.getElementById('declineNotificationModal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'declineNotificationModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="closeDeclineModal()"></div>
            <div class="decline-modal-content">
                <div class="decline-icon">💫</div>
                <h3>Keep Going!</h3>
                <p class="decline-message"></p>
                <div class="decline-searching">
                    <div class="search-animation">
                        <span>●</span><span>●</span><span>●</span>
                    </div>
                    <p>Finding your next match...</p>
                </div>
                <p class="decline-tip">Your profile is visible while we search!</p>
                <button class="btn btn-primary" onclick="closeDeclineModal()">Got it</button>
            </div>
        `;
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        document.body.appendChild(modal);
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #declineNotificationModal .modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.7);
            }
            #declineNotificationModal .decline-modal-content {
                position: relative;
                background: var(--bg-secondary, #1a1a1a);
                padding: 32px;
                border-radius: 20px;
                text-align: center;
                max-width: 320px;
                animation: popIn 0.3s ease;
            }
            @keyframes popIn {
                from { transform: scale(0.8); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
            #declineNotificationModal .decline-icon {
                font-size: 48px;
                margin-bottom: 16px;
            }
            #declineNotificationModal h3 {
                color: var(--text-primary, white);
                margin: 0 0 12px;
            }
            #declineNotificationModal .decline-message {
                color: var(--text-secondary, #aaa);
                margin-bottom: 20px;
            }
            #declineNotificationModal .decline-searching {
                background: rgba(193, 127, 116, 0.1);
                padding: 16px;
                border-radius: 12px;
                margin-bottom: 16px;
            }
            #declineNotificationModal .search-animation span {
                display: inline-block;
                color: var(--accent, #C17F74);
                animation: pulse 1.2s ease-in-out infinite;
                margin: 0 4px;
            }
            #declineNotificationModal .search-animation span:nth-child(2) { animation-delay: 0.2s; }
            #declineNotificationModal .search-animation span:nth-child(3) { animation-delay: 0.4s; }
            #declineNotificationModal .decline-searching p {
                margin: 8px 0 0;
                color: var(--accent, #C17F74);
                font-weight: 500;
            }
            #declineNotificationModal .decline-tip {
                font-size: 0.85rem;
                color: var(--text-muted, #666);
                margin-bottom: 20px;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Update message
    const messageEl = modal.querySelector('.decline-message');
    if (messageEl) {
        messageEl.textContent = `${match.name} decided to pass this time. Don't worry – there are more great matches waiting for you!`;
    }
    
    modal.style.display = 'flex';
    
    // Auto-close after 4 seconds
    setTimeout(() => {
        closeDeclineModal();
    }, 4000);
}

/**
 * Close the decline notification modal
 */
function closeDeclineModal() {
    const modal = document.getElementById('declineNotificationModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Cancel user's acceptance and go back to decision view
 */
/**
 * User likes their ONE match (legacy - now uses acceptMatch)
 */
function likeMatch() {
    // Track swipe right
    if (typeof trackSwipe === 'function') trackSwipe('right');
    acceptMatch();
}

/**
 * User passes on their ONE match
 */
function declineMatch() {
    // Track swipe left
    if (typeof trackSwipe === 'function') trackSwipe('left');
    
    if (appState.oneMatch.decisionMade) return;
    
    const matchName = appState.oneMatch.current?.name || 'this match';
    
    // Animate the card
    const card = document.getElementById('matchCard');
    const previewCard = document.getElementById('matchPreviewCard');
    
    if (card) card.classList.add('swiping-left');
    if (previewCard) {
        previewCard.style.opacity = '0';
        previewCard.style.transform = 'translateX(-100px) rotate(-10deg)';
    }
    
    // Record the decision
    appState.oneMatch.decisionMade = true;
    appState.oneMatch.status = 'passed';
    
    // Track this match as passed
    if (appState.oneMatch.current) {
        if (!appState.passedMatches) {
            appState.passedMatches = [];
        }
        appState.passedMatches.push(appState.oneMatch.current.id);
    }
    
    // MAKE PROFILE VISIBLE - User declined, so profile should be visible for next match
    showProfile('declined');
    
    setTimeout(() => {
        if (card) card.classList.remove('swiping-left');
        if (previewCard) {
            previewCard.style.opacity = '1';
            previewCard.style.transform = '';
        }
        
        // Clear current match
        appState.oneMatch.current = null;
        appState.oneMatch.decisionMade = false;
        
        // Save state after declining
        autoSave();
        
        // Show toast
        showToast(`Passed on ${matchName}. Finding your next match...`);
        
        // Immediately search for next match
        setTimeout(() => {
            findNextMatch();
        }, 500);
    }, 400);
}

/**
 * Find and present the next match
 */
function findNextMatch() {
        const nextMatch = getNextMatch();
        
        if (nextMatch) {
        // Set up the new match
        appState.oneMatch.current = nextMatch;
        appState.oneMatch.status = 'presented';
        appState.oneMatch.decisionMade = false;
        appState.oneMatch.isMutual = false;
        
        // HIDE PROFILE - Profile is hidden while you have a pending match
        hideProfile('pending_match');
        
        // Set 24-hour decision deadline
        const decisionDeadline = new Date();
        decisionDeadline.setHours(decisionDeadline.getHours() + 24);
        appState.oneMatch.decisionDeadline = decisionDeadline;
        appState.oneMatch.decisionOneHourWarned = false; // Reset 1-hour warning flag
        appState.oneMatch.presentedAt = new Date(); // Track when match was presented
        
        // Start the decision timer
        startDecisionTimer();
        
        // Render and show the new match
        renderCurrentMatch();
        showPendingMatchView();
        
        // Save state
        autoSave();
        
        // Show toast for new match
        showToast(`🎉 New match found: ${nextMatch.name}! You have 24 hours to decide.`);
        } else {
        // No more matches - profile becomes visible again
        showProfile('no_matches');
            showScreen('no-matches');
        showToast('No more matches available. Try adjusting your preferences.');
        }
}

/**
 * Show waiting screen between matches
 */
function showWaitingScreen() {
    showScreen('waiting-match');
    startWaitingCountdown();
}

// ==========================================
// 24-Hour Decision Timer (for pending matches)
// ==========================================

let decisionTimerInterval = null;

/**
 * Start the 24-hour decision timer
 * Called when a new match is presented
 */
function startDecisionTimer() {
    // Clear any existing timer
    if (decisionTimerInterval) {
        clearInterval(decisionTimerInterval);
    }
    
    // Update timer display immediately
    updateDecisionTimerDisplay();
    
    // Update every second
    decisionTimerInterval = setInterval(() => {
        updateDecisionTimerDisplay();
        checkDecisionDeadline();
    }, 1000);
}

/**
 * Update the decision timer display
 */
function updateDecisionTimerDisplay() {
    const timerEl = document.getElementById('decisionTimeLimit');
    const deadline = appState.oneMatch.decisionDeadline;
    
    if (!timerEl || !deadline) return;
    
    const now = new Date();
    const remaining = new Date(deadline) - now;
    
    if (remaining <= 0) {
        timerEl.textContent = "00:00:00";
        return;
    }
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    
    timerEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    // Check for 1-hour warning notification
    const oneHourMs = 60 * 60 * 1000;
    if (remaining <= oneHourMs && remaining > oneHourMs - 2000 && !appState.oneMatch.decisionOneHourWarned) {
        // Send 1-hour warning notification
        appState.oneMatch.decisionOneHourWarned = true;
        const matchName = appState.oneMatch.current?.name || 'your match';
        sendTimerWarningNotification('decision', matchName, hours, minutes);
    }
}

/**
 * Check if decision deadline has passed
 */
function checkDecisionDeadline() {
    const deadline = appState.oneMatch.decisionDeadline;
    
    if (!deadline) return;
    
    const now = new Date();
    const remaining = new Date(deadline) - now;
    
    if (remaining <= 0 && !appState.oneMatch.decisionMade) {
        // Time expired without a decision
        handleDecisionExpired();
    }
}

/**
 * Handle when the decision deadline expires (before accepting/declining)
 */
function handleDecisionExpired() {
    // Clear the timer
    if (decisionTimerInterval) {
        clearInterval(decisionTimerInterval);
        decisionTimerInterval = null;
    }
    
    const expiredMatch = appState.oneMatch.current;
    const matchName = expiredMatch?.name || 'this match';
    
    // Record in match history as expired
    if (expiredMatch) {
        const matchRecord = {
            id: expiredMatch.id,
            name: expiredMatch.name,
            photo: expiredMatch.photo,
            presentedAt: appState.oneMatch.presentedAt,
            endedAt: new Date(),
            outcome: 'decision_expired',
            reason: 'Decision timer expired - no response',
            messageCount: 0,
            hadDate: false
        };
        
        if (!appState.matchHistory) appState.matchHistory = [];
        appState.matchHistory.push(matchRecord);
    }
    
    // Clear the pending match
    appState.oneMatch.current = null;
    appState.oneMatch.status = 'searching';
    appState.oneMatch.decisionDeadline = null;
    appState.oneMatch.decisionMade = false;
    appState.oneMatch.userAccepted = false;
    appState.oneMatch.isMutual = false;
    
    // SHOW PROFILE - Time expired, profile is visible again while searching
    showProfile('decision_expired');
    
    // Save state
    autoSave();
    
    // Show notification
    showToast(`⏰ Time expired for ${matchName}. Finding your next match...`, 'info');
    
    // Navigate to match screen and find new match
    showScreen('match');
    
    // Find a new match after a brief delay
    setTimeout(() => {
        findNextMatch();
    }, 1500);
}

/**
 * Stop the decision timer
 */
function stopDecisionTimer() {
    if (decisionTimerInterval) {
        clearInterval(decisionTimerInterval);
        decisionTimerInterval = null;
    }
}

// ==========================================
// 24-Hour Connection Timer
// ==========================================

/**
 * Start the 24-hour connection timer
 * Called when a mutual match is made
 */
function startConnectionTimer() {
    const now = new Date();
    // Set expiration to exactly 24 hours from now
    appState.oneMatch.connectionExpiresAt = new Date(now.getTime() + appState.oneMatch.TIME_LIMIT_MS);
    appState.oneMatch.connectionOneHourWarned = false; // Reset 1-hour warning flag
    appState.connectionMetrics.connectedAt = now;
    
    console.log('⏰ Timer started! Expires at:', appState.oneMatch.connectionExpiresAt);
    
    // Save the timer immediately
    autoSave();
    
    // Start the countdown display
    updateConnectionTimer();
}

/**
 * Update the connection timer display
 */
function updateConnectionTimer() {
    const timerEl = document.getElementById('matchTimeLimit');
    const progressBar = document.querySelector('.time-limit-bar');
    
    if (!timerEl) return;
    
    const now = new Date();
    let expiresAt = appState.oneMatch.connectionExpiresAt;
    
    // If we have an active connection but no timer, start one
    if (!expiresAt && appState.activeConnection) {
        console.log('⏰ No timer found, starting new 24h timer');
        startConnectionTimer();
        expiresAt = appState.oneMatch.connectionExpiresAt;
    }
    
    if (!expiresAt) {
        // No active connection - show default
        timerEl.textContent = "24:00:00";
        if (progressBar) progressBar.style.width = "100%";
        return;
    }
    
    const remaining = expiresAt - now;
    
    if (remaining <= 0) {
        // Connection expired!
        timerEl.textContent = "Expired";
        handleConnectionExpired();
        return;
    }
    
    // Calculate hours, minutes, seconds
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    
    // Format as HH:MM:SS
    const formatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    timerEl.textContent = formatted;
    
    // Check for 1-hour warning notification
    const oneHourMs = 60 * 60 * 1000;
    if (remaining <= oneHourMs && remaining > oneHourMs - 2000 && !appState.oneMatch.connectionOneHourWarned) {
        // Send 1-hour warning notification
        appState.oneMatch.connectionOneHourWarned = true;
        const matchName = appState.activeConnection?.name || 'your match';
        sendTimerWarningNotification('connection', matchName, hours, minutes);
    }
    
    // Update progress bar (full = 24 hours remaining)
    const totalTime = appState.oneMatch.TIME_LIMIT_MS;
    const percentRemaining = (remaining / totalTime) * 100;
    if (progressBar) {
        progressBar.style.width = `${percentRemaining}%`;
        
        // Change color based on time remaining
        if (percentRemaining < 25) {
            progressBar.style.background = 'var(--danger)';
        } else if (percentRemaining < 50) {
            progressBar.style.background = 'var(--warning)';
        } else {
            progressBar.style.background = 'var(--accent)';
        }
    }
    
    // Continue updating every second
    setTimeout(updateConnectionTimer, 1000);
}

/**
 * Handle when the 24-hour connection expires
 */
function handleConnectionExpired() {
    const matchName = appState.activeConnection?.name || 'your match';
    
    // Record in match history
    if (appState.activeConnection) {
        const matchRecord = {
            id: appState.activeConnection.id,
            name: appState.activeConnection.name,
            photo: appState.activeConnection.photo,
            matchedAt: appState.connectionMetrics?.connectedAt,
            endedAt: new Date(),
            outcome: 'expired',
            reason: 'Connection timer expired',
            messageCount: appState.connectionMetrics?.messageCount || 0,
            hadDate: appState.conversation?.datePlanned || false
        };
        
        if (!appState.matchHistory) appState.matchHistory = [];
        appState.matchHistory.push(matchRecord);
    }
    
    // Clear the active connection
    appState.activeConnection = null;
    appState.oneMatch.status = 'waiting';
    appState.oneMatch.current = null;
    appState.oneMatch.connectionExpiresAt = null;
    appState.oneMatch.isMutual = false;
    
    // Clear conversation state
    appState.conversation = {
        messages: [],
        dateReadiness: 0,
        suggestedDate: null,
        datePlanned: false,
        conversationStarted: false
    };
    
    // Reset connection metrics
    appState.connectionMetrics = {
        messageCount: 0,
        avgResponseTime: '0m',
        compatibility: 0,
        dateReadiness: 0,
        connectedAt: null
    };
    
    // Make profile visible again
    showProfile('connection_expired');
    
    // Save state
    autoSave();
    
    // Show expiration modal
    showConnectionExpiredModal(matchName);
}

// ==========================================
// Profile Visibility Management
// ==========================================

/**
 * Hide profile from other users (called when matched)
 */
function hideProfile(reason = 'matched') {
    appState.profileVisibility.isHidden = true;
    appState.profileVisibility.hiddenAt = new Date();
    appState.profileVisibility.reason = reason;
    
    console.log('🙈 Profile hidden from other users - reason:', reason);
    
    // Update UI to show hidden status
    updateProfileVisibilityUI();
    
    // Save state
    autoSave();
}

/**
 * Show profile to other users again
 */
function showProfile(reason = 'manual') {
    appState.profileVisibility.isHidden = false;
    appState.profileVisibility.hiddenAt = null;
    appState.profileVisibility.reason = null;
    
    console.log('👁️ Profile visible to other users again - reason:', reason);
    
    // Update UI
    updateProfileVisibilityUI();
    
    // Save state
    autoSave();
}

/**
 * Update UI elements showing profile visibility status
 */
function updateProfileVisibilityUI() {
    const statusBadge = document.getElementById('profileVisibilityBadge');
    const statusText = document.getElementById('profileVisibilityText');
    
    if (statusBadge) {
        if (appState.profileVisibility.isHidden) {
            statusBadge.classList.add('hidden-status');
            statusBadge.classList.remove('visible-status');
        } else {
            statusBadge.classList.remove('hidden-status');
            statusBadge.classList.add('visible-status');
        }
    }
    
    if (statusText) {
        if (appState.profileVisibility.isHidden) {
            statusText.textContent = 'Profile hidden while matched';
        } else {
            statusText.textContent = 'Profile visible to matches';
        }
    }
}

/**
 * Show modal when connection expires
 */
function showConnectionExpiredModal(matchName = 'your match') {
    // Show a toast notification
    showToast(`⏰ Your 24-hour window with ${matchName} has ended. Finding your next match...`, 'info');
    
    // Navigate to match screen
    showScreen('match');
    
    // Find a new match after a brief delay
    setTimeout(() => {
        findNextMatch();
    }, 1500);
}

/**
 * Send a warning notification when 1 hour remains on the timer
 * @param {string} type - 'decision' or 'connection'
 * @param {string} matchName - Name of the match
 * @param {number} hours - Hours remaining
 * @param {number} minutes - Minutes remaining
 */
function sendTimerWarningNotification(type, matchName, hours, minutes) {
    const timeLeft = hours > 0 ? `${hours}h ${minutes}m` : `${minutes} minutes`;
    
    let title, body, toastMessage;
    
    if (type === 'decision') {
        title = '⏰ Time Running Out!';
        body = `Only ${timeLeft} left to decide on ${matchName}! Don't miss this connection.`;
        toastMessage = `⏰ Only ${timeLeft} left to decide on ${matchName}!`;
    } else {
        title = '⏰ Connection Expiring Soon!';
        body = `Your connection with ${matchName} expires in ${timeLeft}. Send a message or plan a date!`;
        toastMessage = `⏰ Only ${timeLeft} left with ${matchName}! Keep the conversation going.`;
    }
    
    // Show in-app toast
    showToast(toastMessage, 'warning');
    
    // Try to send browser/push notification
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            const notification = new Notification(title, {
                body: body,
                icon: '/assets/icon.png',
                badge: '/assets/badge.png',
                tag: `timer-warning-${type}`,
                requireInteraction: true,
                vibrate: [200, 100, 200]
            });
            
            // Click notification to go to relevant screen
            notification.onclick = function() {
                window.focus();
                if (type === 'decision') {
                    showScreen('match');
                } else {
                    showScreen('chat');
                }
                notification.close();
            };
        } else if (Notification.permission !== 'denied') {
            // Request permission
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    sendTimerWarningNotification(type, matchName, hours, minutes);
                }
            });
        }
    }
    
    console.log(`⏰ 1-Hour Warning Sent: ${type} timer for ${matchName}`);
}

/**
 * Update connection metrics display
 */
function updateConnectionMetrics() {
    const metrics = appState.connectionMetrics;
    
    // Update metric values in the UI
    const messageCountEl = document.querySelector('.metric-card:nth-child(1) .metric-value');
    const responseTimeEl = document.querySelector('.metric-card:nth-child(2) .metric-value');
    const compatibilityEl = document.querySelector('.metric-card:nth-child(3) .metric-value');
    const dateReadinessEl = document.querySelector('.metric-card:nth-child(4) .metric-value');
    
    if (messageCountEl) messageCountEl.textContent = metrics.messageCount;
    if (responseTimeEl) responseTimeEl.textContent = metrics.avgResponseTime;
    if (compatibilityEl) compatibilityEl.textContent = `${metrics.compatibility}%`;
    if (dateReadinessEl) {
        dateReadinessEl.textContent = metrics.dateReadiness >= 80 ? 'Ready!' : `${metrics.dateReadiness}%`;
    }
}

/**
 * Start countdown to next match
 */
function startWaitingCountdown() {
    const countdownEl = document.getElementById('nextMatchCountdown');
    if (!countdownEl) return;
    
    const updateCountdown = () => {
        const now = new Date();
        const target = appState.oneMatch.nextMatchTime;
        
        if (!target || now >= target) {
            // Time's up - present new match
            countdownEl.textContent = "Your next match is ready!";
            
            // Reset state for next match
            appState.oneMatch.status = 'waiting';
            appState.oneMatch.current = null;
            appState.oneMatch.decisionMade = false;
            appState.oneMatch.nextMatchTime = null;
            
            setTimeout(() => {
                presentMatch();
            }, 1000);
            return;
        }
        
        const diff = Math.ceil((target - now) / 1000);
        
        if (diff > 3600) {
            const hours = Math.floor(diff / 3600);
            const mins = Math.floor((diff % 3600) / 60);
            countdownEl.textContent = `${hours}h ${mins}m`;
        } else if (diff > 60) {
            const mins = Math.floor(diff / 60);
            const secs = diff % 60;
            countdownEl.textContent = `${mins}m ${secs}s`;
        } else {
            countdownEl.textContent = `${diff}s`;
        }
        
        setTimeout(updateCountdown, 1000);
    };
    
    updateCountdown();
}

/**
 * Show modal when match isn't mutual yet
 */
function showNotMutualYetModal() {
    // For now, show the waiting screen
    // In production, you might show "We'll notify you when they respond"
    const match = appState.oneMatch.current;
    
    // Create a temporary notification
    alert(`You liked ${match.name}! We'll notify you when they respond. In the meantime, focus on your connection.`);
    
    // Move to active connection (pending response)
    appState.activeConnection = {
        ...match,
        connectedAt: new Date(),
        messages: [],
        pendingResponse: true
    };
    
    showScreen('chat-list');
}

// ==========================================
// Screen Navigation
// ==========================================
function showScreen(screenId) {
    // Track screen entry for behavior analytics
    if (typeof trackScreenEnter === 'function') {
        trackScreenEnter(screenId);
    }
    
    // Store history for back navigation
    if (appState.currentScreen !== screenId) {
        appState.screenHistory.push(appState.currentScreen);
    }
    
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        appState.currentScreen = screenId;
        
        // Scroll to top when changing screens
        targetScreen.scrollTop = 0;
        
        // Screen-specific initializations
        if (screenId === 'chat-list') {
            // Check if user has a mutual match (active connection)
            const hasMutualMatch = appState.activeConnection || 
                                   (appState.oneMatch.current && appState.oneMatch.isMutual);
            
            const chatContent = document.getElementById('chatListContent');
            const emptyChats = document.getElementById('emptyChats');
            
            if (hasMutualMatch) {
                // Show chat content, hide empty state
                if (chatContent) chatContent.style.display = 'block';
                if (emptyChats) emptyChats.style.display = 'none';
                
                // Start/update the 24-hour timer display
                updateConnectionTimer();
                updateConnectionMetrics();
                // Update match displays
                updateAllMatchDisplays();
                // Update planned date banner if date is confirmed
                updatePlannedDateBanner();
                
                // Check if conversation has started - hide "Time to Connect" banner
                updateTimeToConnectBanner();
            } else {
                // No mutual match - show empty state
                if (chatContent) chatContent.style.display = 'none';
                if (emptyChats) emptyChats.style.display = 'flex';
            }
        }
        
        if (screenId === 'chat') {
            // Check if user has a mutual match (active connection)
            const hasMutualMatch = appState.activeConnection || 
                                   (appState.oneMatch.current && appState.oneMatch.isMutual);
            
            if (!hasMutualMatch) {
                // No mutual match - redirect to chat-list which will show empty state
                showScreen('chat-list');
                return;
            }
            
            // Update chat header with match info
            updateChatHeader();
            // Start/update the 24-hour timer
            updateConnectionTimer();
            // Update all match displays
            updateAllMatchDisplays();
            // Render chat messages (existing or blank)
            renderChatMessages();
            // Update connection insights
            updateConnectionInsights();
        }
        
        if (screenId === 'profile-view') {
            // Update profile view with match info
            updateAllMatchDisplays();
        }
        
        if (screenId === 'date-plan') {
            // Initialize date plan with smart recommendations
            initDatePlanScreen();
        }
        
        if (screenId === 'adjust-preferences') {
            // Initialize preferences screen with current values
            initAdjustPreferencesScreen();
        }
        
        if (screenId === 'my-profile') {
            // Update profile display (name, age, location)
            updateProfileDisplay();
            // Update profile visibility display
            updateProfileVisibilityUI();
            // Update main profile photo
            updateMainProfilePhoto();
            // Load platform stats
            loadPlatformStats();
        }
        
        if (screenId === 'profile-setup') {
            // Initialize profile setup photo grid
            initSetupPhotoGrid();
        }
        
        if (screenId === 'manage-photos') {
            // Initialize photo management screen
            initManagePhotosScreen();
        }
        
        if (screenId === 'edit-profile') {
            // Refresh user data from localStorage (in case admin made changes)
            refreshUserDataFromStorage();
            // Initialize edit profile screen with user data
            initEditProfileScreen();
            // Update profile visibility counter (how many users will see your profile)
            updateProfileVisibilityCounter();
        }
        
        if (screenId === 'match-preferences') {
            // Initialize match preferences screen
            initMatchPreferencesScreen();
        }
        
        if (screenId === 'match') {
            // Always sync match pool from localStorage first (picks up newly activated bots)
            syncUsersToMatchPool();
            
            // Check if user has active connection - show appropriate view
            if (appState.activeConnection) {
                showAcceptedMatchView();
            } else if (appState.oneMatch.current && !appState.oneMatch.decisionMade) {
                showPendingMatchView();
            } else if (!appState.oneMatch.current) {
                // No current match - try to get one
                const testBots = JSON.parse(localStorage.getItem('oith_test_bots') || '[]');
                const activeBots = testBots.filter(bot => bot.active);
                if (activeBots.length > 0 || appState.matchPool.length > 0) {
                    // There are potential matches, present one
                    presentMatch();
                }
            }
        }
        
        if (screenId === 'settings') {
            // Update account display with user data
            updateAccountDisplay();
            updateSubscriptionDates();
            // Initialize notification toggles
            initNotificationSettings();
        }
        
        if (screenId === 'manage-subscription') {
            // Update subscription renewal date
            updateSubscriptionDates();
            // Update billing history
            updateBillingHistory();
        }
        
        if (screenId === 'feedback-metrics') {
            // Initialize feedback metrics with user data
            initFeedbackMetricsScreen();
        }
        
        if (screenId === 'my-profile-preview') {
            // Initialize profile preview with user data
            initProfilePreview();
        }
        
        if (screenId === 'login') {
            // Pre-fill email from last login
            prefillLoginEmail();
        }
    }
}

/**
 * Update chat header with current match info
 */
function updateChatHeader() {
    const match = appState.activeConnection;
    if (!match) return;
    
    // Update chat header
    const chatAvatar = document.getElementById('chatMatchAvatar');
    const chatName = document.getElementById('chatMatchName');
    const chatStatus = document.getElementById('chatMatchStatus');
    
    if (chatAvatar) chatAvatar.src = match.photo;
    if (chatName) chatName.textContent = match.name;
    if (chatStatus) chatStatus.textContent = 'Online now';
}

/**
 * Initialize a blank chat window for a new match
 */
function initializeChatWindow(match) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    // Clear existing messages
    chatMessages.innerHTML = '';
    
    // Add today's date marker
    const today = new Date();
    const dateMarker = document.createElement('div');
    dateMarker.className = 'message-date';
    dateMarker.textContent = 'Today';
    chatMessages.appendChild(dateMarker);
    
    // Add a welcome message/ice breaker prompt
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'chat-welcome';
    welcomeDiv.innerHTML = `
        <div class="welcome-icon">💬</div>
        <h4>You matched with ${match.name}!</h4>
        <p>Start the conversation - say hello!</p>
    `;
    chatMessages.appendChild(welcomeDiv);
    
    // Reset input field
    const messageInput = document.getElementById('messageInput');
    if (messageInput) messageInput.value = '';
    
    // Show icebreakers
    const icebreakers = document.getElementById('icebreakers');
    if (icebreakers) icebreakers.style.display = 'flex';
    
    // Update connection insights display
    updateConnectionInsights();
}

/**
 * Render chat messages from conversation state
 */
function renderChatMessages() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const match = appState.activeConnection;
    const messages = appState.conversation?.messages || [];
    
    // Clear existing HTML messages
    chatMessages.innerHTML = '';
    
    // Add date marker
    const dateMarker = document.createElement('div');
    dateMarker.className = 'message-date';
    dateMarker.textContent = 'Today';
    chatMessages.appendChild(dateMarker);
    
    if (messages.length === 0) {
        // Show welcome message for new chat
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'chat-welcome';
        welcomeDiv.innerHTML = `
            <div class="welcome-icon">💬</div>
            <h4>You matched with ${match?.name || 'your match'}!</h4>
            <p>Start the conversation - say hello!</p>
        `;
        chatMessages.appendChild(welcomeDiv);
        
        // Show icebreakers
        const icebreakers = document.getElementById('icebreakers');
        if (icebreakers) icebreakers.style.display = 'flex';
    } else {
        // Render existing messages
        messages.forEach(msg => {
            if (!msg) return; // Skip null/undefined messages
            
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.type || 'sent'}`;
            
            const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit' 
            }) : '';
            
            // Handle date request messages
            if (msg.isDateRequest) {
                messageDiv.classList.add('date-request-message');
                const venueName = typeof msg.venue === 'string' ? msg.venue : (msg.venue?.name || 'Selected venue');
                messageDiv.innerHTML = `
                    <div class="date-request-card">
                        <div class="date-request-header">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="4" width="18" height="18" rx="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/>
                                <line x1="8" y1="2" x2="8" y2="6"/>
                                <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            <span>Date Request Sent!</span>
                        </div>
                        <div class="date-request-details">
                            <div class="date-detail">
                                <span class="detail-label">📍 Venue</span>
                                <span class="detail-value">${venueName}</span>
                            </div>
                            <div class="date-detail">
                                <span class="detail-label">📅 Date</span>
                                <span class="detail-value">${msg.date || 'TBD'}</span>
                            </div>
                            <div class="date-detail">
                                <span class="detail-label">🕐 Time</span>
                                <span class="detail-value">${msg.time || 'TBD'}</span>
                            </div>
                        </div>
                    </div>
                    <span class="message-time">${time}</span>
                `;
                chatMessages.appendChild(messageDiv);
                return;
            }
            
            // Handle date acceptance messages (bot accepted the date)
            if (msg.isDateAcceptance || msg.isDateResponse) {
                messageDiv.classList.add('date-acceptance-message');
                const plannedDate = appState.conversation?.plannedDate;
                const venueName = plannedDate?.venue?.name || msg.venue?.name || 'the venue';
                const dateStr = plannedDate?.date || msg.date || 'Soon';
                const timeStr = plannedDate?.time || msg.time || '';
                const matchName = match?.name || 'Your match';
                
                messageDiv.innerHTML = `
                    <div class="date-response-card accepted">
                        <div class="date-response-header">
                            <span class="response-emoji">🎉</span>
                            <span>Date Accepted!</span>
                        </div>
                        <p class="date-response-text">${matchName} accepted your date request!</p>
                        <div class="date-response-summary">
                            <span>📍 ${venueName}</span>
                            <span>📅 ${dateStr}${timeStr ? ', ' + timeStr : ''}</span>
                        </div>
                    </div>
                    <span class="message-time">${time}</span>
                `;
                chatMessages.appendChild(messageDiv);
                return;
            }
            
            const messageText = msg.text || msg.content || '';
            
            if (msg.isImage && messageText) {
                messageDiv.classList.add('image');
                messageDiv.innerHTML = `
                    <img src="${messageText}" alt="Shared photo" onclick="showImageViewer('${messageText}')">
                    <span class="message-time">${time}</span>
                `;
            } else if (messageText) {
                messageDiv.innerHTML = `
                    <p>${messageText}</p>
                    <span class="message-time">${time}</span>
                `;
            } else {
                return; // Skip empty messages
            }
            
            chatMessages.appendChild(messageDiv);
        });
        
        // Hide icebreakers if conversation exists
        const icebreakers = document.getElementById('icebreakers');
        if (icebreakers) icebreakers.style.display = 'none';
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

/**
 * Update connection insights based on conversation
 */
function updateConnectionInsights() {
    const metrics = appState.connectionMetrics;
    const conversation = appState.conversation;
    const match = appState.activeConnection;
    
    // Calculate insights based on conversation
    const messageCount = metrics.messageCount || 0;
    const dateReadiness = conversation?.dateReadiness || 0;
    
    // Update insight elements on chat-list screen
    const insightText = document.getElementById('connectionInsightText');
    const insightTitle = document.getElementById('connectionInsightTitle');
    
    if (insightText && insightTitle) {
        if (messageCount === 0) {
            insightTitle.textContent = '💬 Start Chatting';
            insightText.textContent = `Send your first message to ${match?.name || 'your match'}!`;
        } else if (messageCount < 5) {
            insightTitle.textContent = '🌱 Getting Started';
            insightText.textContent = 'Great start! Keep the conversation flowing.';
        } else if (dateReadiness < 40) {
            insightTitle.textContent = '💭 Building Connection';
            insightText.textContent = 'You\'re getting to know each other. Ask about shared interests!';
        } else if (dateReadiness < 70) {
            insightTitle.textContent = '✨ Good Chemistry';
            insightText.textContent = 'Great conversation! Consider planning a date soon.';
        } else {
            insightTitle.textContent = '🎉 Ready for a Date!';
            insightText.textContent = 'You two are hitting it off! Time to plan something special.';
        }
    }
    
    // Update AI insight on chat-list if present
    const aiInsight = document.getElementById('aiInsightText');
    if (aiInsight && match) {
        // Generate insight based on conversation analysis
        const insight = generateConversationBasedInsight(match, messageCount, dateReadiness);
        aiInsight.textContent = insight;
    }
    
    // Update date note
    const dateNote = document.getElementById('dateNoteText');
    if (dateNote) {
        if (conversation?.datePlanned) {
            dateNote.textContent = 'Date planned! Check your calendar.';
        } else if (dateReadiness >= 60) {
            dateNote.textContent = 'Ready to plan a date? Tap the calendar icon!';
        } else {
            dateNote.textContent = 'Keep chatting to build connection before planning a date.';
        }
    }
}

/**
 * Update all match-related displays across the app
 */
function updateAllMatchDisplays() {
    const match = appState.activeConnection || appState.oneMatch.current;
    if (!match) return;
    
    // Chat header
    const chatAvatar = document.getElementById('chatMatchAvatar');
    const chatName = document.getElementById('chatMatchName');
    const chatStatus = document.getElementById('chatMatchStatus');
    
    if (chatAvatar) chatAvatar.src = match.photo;
    if (chatName) chatName.textContent = match.name;
    if (chatStatus) chatStatus.textContent = 'Online now';
    
    // Chat list
    const chatListAvatar = document.getElementById('chatListMatchAvatar');
    const chatListName = document.getElementById('chatListMatchName');
    const chatListStatus = document.getElementById('chatListMatchStatus');
    
    if (chatListAvatar) chatListAvatar.src = match.photo;
    if (chatListName) chatListName.textContent = `${match.name}, ${match.age}`;
    if (chatListStatus) chatListStatus.textContent = 'Online now';
    
    // Update last message preview if conversation exists
    if (appState.conversation?.messages?.length > 0) {
        const lastMsg = appState.conversation.messages[appState.conversation.messages.length - 1];
        const previewMsg = document.getElementById('chatListPreviewMessage');
        const previewTime = document.getElementById('chatListPreviewTime');
        
        if (previewMsg && lastMsg) {
            const msgText = lastMsg.type === 'image' ? '📷 Photo' : (lastMsg.text || 'Start chatting...');
            previewMsg.textContent = msgText && msgText.length > 40 ? msgText.substring(0, 40) + '...' : (msgText || '');
        }
        if (previewTime && lastMsg?.timestamp) {
            previewTime.textContent = formatTimeAgo(lastMsg.timestamp);
        }
    }
    
    // Match preview (pending match)
    const matchPreviewPhoto = document.getElementById('matchPreviewPhoto');
    const matchPreviewName = document.getElementById('matchPreviewName');
    const matchPreviewOccupation = document.getElementById('matchPreviewOccupation');
    const matchPreviewHeight = document.getElementById('matchPreviewHeight');
    const matchPreviewCity = document.getElementById('matchPreviewCity');
    const matchPreviewDistance = document.getElementById('matchPreviewDistance');
    
    if (matchPreviewPhoto) matchPreviewPhoto.src = match.photo;
    if (matchPreviewName) matchPreviewName.textContent = `${match.name}, ${match.age}`;
    if (matchPreviewOccupation) matchPreviewOccupation.textContent = match.occupation || 'Professional';
    if (matchPreviewHeight) matchPreviewHeight.textContent = match.height || '5\'8"';
    if (matchPreviewCity) matchPreviewCity.textContent = match.location || match.city || 'Nearby';
    if (matchPreviewDistance) matchPreviewDistance.textContent = `${match.distance || match.distanceText || '3 mi'} away`;
    
    // Match accepted view
    const matchAcceptedPhoto = document.getElementById('matchAcceptedPhoto');
    const matchAcceptedName = document.getElementById('matchAcceptedName');
    const matchAcceptedLocation = document.getElementById('matchAcceptedLocation');
    const matchAcceptedBio = document.getElementById('matchAcceptedBio');
    const matchAcceptedTags = document.getElementById('matchAcceptedTags');
    
    if (matchAcceptedPhoto) matchAcceptedPhoto.src = match.photo;
    if (matchAcceptedName) matchAcceptedName.textContent = `${match.name}, ${match.age}`;
    if (matchAcceptedLocation) matchAcceptedLocation.textContent = `${match.distance || '3 miles'} away`;
    if (matchAcceptedBio) matchAcceptedBio.textContent = match.bio || '"Looking for meaningful connections."';
    
    if (matchAcceptedTags && match.interests) {
        matchAcceptedTags.innerHTML = match.interests.slice(0, 4).map(interest => 
            `<span class="tag">${interest}</span>`
        ).join('');
    }
    
    // Profile view - Basic info
    const profileViewPhoto = document.getElementById('profileViewPhoto');
    const profileViewName = document.getElementById('profileViewName');
    const profileViewOccupation = document.getElementById('profileViewOccupation');
    
    if (profileViewPhoto) profileViewPhoto.src = match.photo;
    if (profileViewName) profileViewName.textContent = `${match.name}, ${match.age}`;
    if (profileViewOccupation) profileViewOccupation.textContent = `${match.occupation || 'Professional'} • ${match.distanceText || match.distance + ' miles'} away`;
    
    // Profile view - Bio
    const profileViewBio = document.getElementById('profileViewBio');
    if (profileViewBio) profileViewBio.textContent = match.fullBio || match.bio || '"No bio provided"';
    
    // Profile view - Interests
    const profileViewInterests = document.getElementById('profileViewInterests');
    if (profileViewInterests && match.interests) {
        const interestIcons = {
            'Photography': '📸', 'Hiking': '🥾', 'Coffee': '☕', 'Reading': '📚', 
            'Cooking': '🍳', 'Travel': '✈️', 'Music': '🎵', 'Art': '🎨',
            'Yoga': '🧘', 'Dancing': '💃', 'Food': '🍕', 'Movies': '🎬',
            'Fitness': '💪', 'Wine': '🍷', 'Beach': '🏖️', 'Gaming': '🎮',
            'Technology': '💻', 'Nature': '🌿', 'Dogs': '🐕', 'Cats': '🐱',
            'Running': '🏃', 'Golf': '⛳', 'Soccer': '⚽', 'Fashion': '👗'
        };
        profileViewInterests.innerHTML = match.interests.map(interest => {
            const icon = interestIcons[interest] || '⭐';
            return `<span class="interest-tag">${icon} ${interest}</span>`;
        }).join('');
    }
    
    // Profile view - Looking for
    const profileViewLookingFor = document.getElementById('profileViewLookingFor');
    if (profileViewLookingFor) {
        const lookingForLabels = {
            'relationship': 'Long-term relationship',
            'casual': 'Something casual',
            'friendship': 'New friends',
            'marriage': 'Marriage',
            'not-sure': 'Not sure yet'
        };
        profileViewLookingFor.textContent = lookingForLabels[match.lookingFor] || match.lookingFor || 'Not specified';
    }
    
    // Profile view - Basic Info section
    const profileViewHeight = document.getElementById('profileViewHeight');
    if (profileViewHeight) profileViewHeight.textContent = match.height || 'Not specified';
    
    const profileViewBodyType = document.getElementById('profileViewBodyType');
    if (profileViewBodyType) profileViewBodyType.textContent = match.bodyType || 'Not specified';
    
    const profileViewEducation = document.getElementById('profileViewEducation');
    if (profileViewEducation) {
        const educationLabels = {
            'high-school': 'High School',
            'some-college': 'Some College',
            'bachelors': "Bachelor's Degree",
            'masters': "Master's Degree",
            'doctorate': 'Doctorate'
        };
        profileViewEducation.textContent = educationLabels[match.education] || match.education || 'Not specified';
    }
    
    const profileViewEthnicity = document.getElementById('profileViewEthnicity');
    if (profileViewEthnicity) {
        const ethnicityLabels = {
            'white': 'White/Caucasian',
            'black': 'Black/African American',
            'asian': 'Asian',
            'hispanic': 'Hispanic/Latino',
            'middle-eastern': 'Middle Eastern',
            'mixed': 'Mixed/Multiracial',
            'other': 'Other'
        };
        profileViewEthnicity.textContent = ethnicityLabels[match.ethnicity] || match.ethnicity || 'Not specified';
    }
    
    // Profile view - Lifestyle section
    const profileViewSmoking = document.getElementById('profileViewSmoking');
    if (profileViewSmoking) profileViewSmoking.textContent = match.smoking || 'Not specified';
    
    const profileViewDrinking = document.getElementById('profileViewDrinking');
    if (profileViewDrinking) profileViewDrinking.textContent = match.drinking || 'Not specified';
    
    const profileViewExercise = document.getElementById('profileViewExercise');
    if (profileViewExercise) {
        const exerciseLabels = {
            'never': 'Never',
            'sometimes': 'Sometimes',
            'regularly': 'Regularly',
            'daily': 'Daily'
        };
        profileViewExercise.textContent = exerciseLabels[match.exercise] || match.exercise || 'Not specified';
    }
    
    const profileViewReligion = document.getElementById('profileViewReligion');
    if (profileViewReligion) {
        const religionLabels = {
            'christian': 'Christian',
            'catholic': 'Catholic',
            'jewish': 'Jewish',
            'muslim': 'Muslim',
            'hindu': 'Hindu',
            'buddhist': 'Buddhist',
            'spiritual': 'Spiritual',
            'agnostic': 'Agnostic',
            'atheist': 'Atheist',
            'other': 'Other'
        };
        profileViewReligion.textContent = religionLabels[match.religion] || match.religion || 'Not specified';
    }
    
    // Profile view - Children
    const profileViewChildren = document.getElementById('profileViewChildren');
    if (profileViewChildren) {
        const childrenLabels = {
            'no-want': "Doesn't have kids, wants them",
            'no-dont-want': "Doesn't have kids, doesn't want them",
            'has': 'Has kids',
            'has-want-more': 'Has kids, wants more'
        };
        profileViewChildren.textContent = childrenLabels[match.children] || match.children || 'Not specified';
    }
    
    // Profile view - Gallery
    const profileViewGallery = document.getElementById('profileViewGallery');
    if (profileViewGallery && match.photos && match.photos.length > 0) {
        profileViewGallery.innerHTML = match.photos.map(photo => 
            `<img src="${photo}" alt="Photo">`
        ).join('');
        profileViewGallery.style.display = 'grid';
    } else if (profileViewGallery) {
        profileViewGallery.style.display = 'none';
    }
    
    // Connected with label
    const connectedLabel = document.getElementById('connectedWithLabel');
    if (connectedLabel) connectedLabel.textContent = `Connected with ${match.name}`;
    
    // Match modal text
    const matchModalText = document.getElementById('matchModalText');
    if (matchModalText) matchModalText.textContent = `You and ${match.name} both liked each other`;
    
    // AI insight text - generate based on conversation
    const aiInsightText = document.getElementById('aiInsightText');
    if (aiInsightText) {
        const insight = generateConversationBasedInsight(match, appState.conversation?.messages?.length || 0, 0);
        aiInsightText.textContent = insight;
    }
    
    // Date note text
    const dateNoteText = document.getElementById('dateNoteText');
    if (dateNoteText) dateNoteText.textContent = `We'll notify you when ${match.name} confirms!`;
    
    // Update compatibility displays
    if (match.compatibility) {
        syncCompatibilityDisplays(match.compatibility);
    }
}

/**
 * Format timestamp as "X min ago", "X hours ago", etc.
 */
function formatTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return time.toLocaleDateString();
}

function goBack() {
    if (appState.screenHistory.length > 0) {
        const previousScreen = appState.screenHistory.pop();
        showScreen(previousScreen);
    }
}

// ==========================================
// Photo Management
// ==========================================

// Track which photo slot is being edited
let currentPhotoSlot = null;

/**
 * Save photos and go back to profile
 */
function savePhotosAndGoBack() {
    // Photos are already saved in appState.user.photos as they're added
    // Just need to update the main profile photo display
    updateMainProfilePhoto();
    
    // Save to cache
    autoSave();
    
    // Show success message
    showToast('Photos saved!');
    
    // Navigate back to profile
    showScreen('my-profile');
}

/**
 * Update the profile display (name, age, location) on my-profile screen
 */
function updateProfileDisplay() {
    const user = appState.user;
    
    // Calculate age from birthday if not set
    let age = user.age;
    if (!age && user.birthday) {
        const birthDate = new Date(user.birthday);
        const today = new Date();
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        // Store calculated age
        appState.user.age = age;
    }
    
    const firstName = user.firstName || 'User';
    const location = user.location || 'Location not set';
    
    // Update display elements
    const displayName = document.getElementById('profileDisplayName');
    const displayLocation = document.getElementById('profileDisplayLocation');
    
    if (displayName) {
        displayName.textContent = age ? `${firstName}, ${age}` : firstName;
    }
    if (displayLocation) {
        displayLocation.textContent = location;
    }
    
    console.log('📋 Profile display updated:', { firstName, age, location });
}

/**
 * Update the main profile photo display
 */
function updateMainProfilePhoto() {
    const mainPhoto = document.getElementById('mainProfilePhoto');
    if (mainPhoto && appState.user.photos && appState.user.photos.length > 0) {
        mainPhoto.src = appState.user.photos[0];
    }
}

/**
 * Handle clicking on a photo slot
 */
function handlePhotoSlotClick(slotIndex) {
    currentPhotoSlot = slotIndex;
    
    // Check if slot has a photo
    const hasPhoto = appState.user.photos && appState.user.photos[slotIndex];
    
    if (hasPhoto) {
        // Show options: change or remove
        showPhotoOptions(slotIndex);
    } else {
        // Open file picker to add photo
        openPhotoUpload(slotIndex);
    }
}

/**
 * Open file picker for photo upload
 */
function openPhotoUpload(slotIndex) {
    currentPhotoSlot = slotIndex;
    const fileInput = document.getElementById('photoUploadInput');
    if (fileInput) {
        fileInput.click();
    }
}

/**
 * Handle photo file selection
 */
function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate it's an image
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file');
        return;
    }
    
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast('Image is too large. Max size is 10MB.');
        return;
    }
    
    // Read and display the image
    const reader = new FileReader();
    reader.onload = function(e) {
        const imageUrl = e.target.result;
        
        // Initialize photos array if needed
        if (!appState.user.photos) {
            appState.user.photos = [];
        }
        
        // Add or replace photo at current slot
        if (currentPhotoSlot !== null) {
            appState.user.photos[currentPhotoSlot] = imageUrl;
            updatePhotoSlotDisplay(currentPhotoSlot, imageUrl);
            showToast('Photo added!');
        }
        
        // Save state
        autoSave();
    };
    
    reader.readAsDataURL(file);
    
    // Reset file input
    event.target.value = '';
}

/**
 * Update photo slot display
 */
function updatePhotoSlotDisplay(slotIndex, imageUrl) {
    const slot = document.getElementById(`photoSlot${slotIndex}`);
    if (!slot) return;
    
    if (imageUrl) {
        // Show photo
        slot.classList.remove('empty');
        slot.innerHTML = `
            <img src="${imageUrl}" alt="Photo ${slotIndex + 1}" class="slot-image">
            ${slotIndex === 0 ? '<span class="main-label">Main</span>' : ''}
            <div class="photo-actions">
                <button class="photo-action-btn edit-btn" onclick="event.stopPropagation(); editPhoto(${slotIndex})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="photo-action-btn delete-btn" onclick="event.stopPropagation(); removePhoto(${slotIndex})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `;
    } else {
        // Show empty slot
        slot.classList.add('empty');
        slot.innerHTML = `
            <div class="empty-slot-content">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <span>Add Photo</span>
            </div>
        `;
    }
}

/**
 * Edit an existing photo (replace it)
 */
function editPhoto(slotIndex) {
    openPhotoUpload(slotIndex);
}

/**
 * Remove a photo from a slot
 */
function removePhoto(slotIndex) {
    if (!appState.user.photos) return;
    
    // Can't remove the main photo if it's the only one
    if (slotIndex === 0 && appState.user.photos.filter(p => p).length === 1) {
        showToast('You must have at least one photo');
        return;
    }
    
    // Remove the photo
    appState.user.photos[slotIndex] = null;
    
    // If removing main photo, shift others up
    if (slotIndex === 0) {
        const firstPhoto = appState.user.photos.find(p => p);
        if (firstPhoto) {
            const firstIndex = appState.user.photos.indexOf(firstPhoto);
            appState.user.photos[0] = firstPhoto;
            appState.user.photos[firstIndex] = null;
        }
    }
    
    // Update display
    updatePhotoSlotDisplay(slotIndex, null);
    
    // Refresh all slots to reflect any shifts
    refreshAllPhotoSlots();
    
    // Save state
    autoSave();
    
    showToast('Photo removed');
}

/**
 * Refresh all photo slot displays
 */
function refreshAllPhotoSlots() {
    for (let i = 0; i < 6; i++) {
        const photo = appState.user.photos ? appState.user.photos[i] : null;
        updatePhotoSlotDisplay(i, photo);
    }
}

/**
 * Show photo options modal (change/remove)
 */
function showPhotoOptions(slotIndex) {
    // For simplicity, just open the file picker to change
    // The remove button on the photo itself handles removal
    openPhotoUpload(slotIndex);
}

/**
 * Initialize manage photos screen with current photos
 */
function initManagePhotosScreen() {
    // Initialize photos array if needed
    if (!appState.user.photos) {
        appState.user.photos = [
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=400&fit=crop',
            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=400&fit=crop',
            'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&h=400&fit=crop',
            null,
            null,
            null
        ];
    }
    
    // Update all slots
    refreshAllPhotoSlots();
}

// ==========================================
// Match Preferences
// ==========================================

/**
 * Save match preferences and go back
 */
function saveMatchPreferences() {
    savePrefToState();
    autoSave();
    showToast('Preferences saved!');
    showScreen('my-profile');
}

/**
 * Save current preference values to state
 */
function savePrefToState() {
    if (!appState.user.matchPreferences) {
        appState.user.matchPreferences = {};
    }
    
    const prefs = appState.user.matchPreferences;
    
    // Get interestedIn from toggle buttons
    const interestedInGroup = document.querySelector('#match-preferences .pref-item .toggle-group');
    if (interestedInGroup) {
        const activeBtn = interestedInGroup.querySelector('.toggle-btn.active');
        if (activeBtn) {
            prefs.interestedIn = activeBtn.textContent.trim().toLowerCase();
        }
    }
    
    // Get values from inputs
    prefs.ageMin = parseInt(document.getElementById('prefAgeMinSlider')?.value) || 25;
    prefs.ageMax = parseInt(document.getElementById('prefAgeMaxSlider')?.value) || 35;
    prefs.maxDistance = parseInt(document.getElementById('prefDistanceSlider')?.value) || 25;
    prefs.heightMin = document.getElementById('prefHeightMin')?.value || '';
    prefs.heightMax = document.getElementById('prefHeightMax')?.value || '';
    prefs.ethnicity = document.getElementById('prefEthnicity')?.value || '';
    prefs.education = document.getElementById('prefEducation')?.value || '';
    prefs.exercise = document.getElementById('prefExercise')?.value || '';
    prefs.children = document.getElementById('prefChildren')?.value || '';
    prefs.religion = document.getElementById('prefReligion')?.value || '';
    
    // Get smoking preference from chips
    const smokingChips = document.querySelectorAll('#prefSmoking .chip.active');
    prefs.smoking = Array.from(smokingChips).map(c => c.textContent.trim().toLowerCase()).filter(v => v !== 'any');
    
    // Get drinking preference from chips
    const drinkingChips = document.querySelectorAll('#prefDrinking .chip.active');
    prefs.drinking = Array.from(drinkingChips).map(c => c.textContent.trim().toLowerCase()).filter(v => v !== 'any');
    
    // Get body type preference from chips
    const bodyTypeChips = document.querySelectorAll('#prefBodyType .chip.active');
    prefs.bodyType = Array.from(bodyTypeChips).map(c => c.textContent.trim().toLowerCase()).filter(v => v !== 'any');
    
    // Get looking for preference from chips
    const lookingForChips = document.querySelectorAll('#prefLookingFor .chip.active');
    prefs.lookingFor = Array.from(lookingForChips).map(c => c.textContent.trim().toLowerCase().replace('💕 ', '').replace('😊 ', '')).filter(v => v !== 'any');
    
    // Update the matches counter in real-time
    updateMatchPreferencesCounter();
}

/**
 * Set match preference from toggle buttons
 */
function setMatchPref(prefName, value, btn) {
    if (!appState.user.matchPreferences) {
        appState.user.matchPreferences = {};
    }
    
    appState.user.matchPreferences[prefName] = value;
    
    // Update UI
    const parent = btn.parentElement;
    parent.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Update available matches counter
    updateMatchPreferencesCounter();
}

/**
 * Toggle preference chip selection
 */
function togglePrefChip(btn, category) {
    const parent = btn.parentElement;
    const isAny = btn.textContent.trim() === 'Any';
    
    if (isAny) {
        // If clicking "Any", deselect all others
        parent.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
    } else {
        // Deselect "Any" and toggle this chip
        parent.querySelector('.chip:first-child')?.classList.remove('active');
        btn.classList.toggle('active');
        
        // If no chips selected, select "Any"
        const activeChips = parent.querySelectorAll('.chip.active:not(:first-child)');
        if (activeChips.length === 0) {
            parent.querySelector('.chip:first-child')?.classList.add('active');
        }
    }
    
    // Save to state (this also updates the counter)
    savePrefToState();
}

/**
 * Update preference age range display
 */
function updatePrefAgeRange() {
    const minSlider = document.getElementById('prefAgeMinSlider');
    const maxSlider = document.getElementById('prefAgeMaxSlider');
    const minDisplay = document.getElementById('prefAgeMin');
    const maxDisplay = document.getElementById('prefAgeMax');
    const track = document.getElementById('prefAgeTrack');
    
    if (!minSlider || !maxSlider) return;
    
    let minVal = parseInt(minSlider.value);
    let maxVal = parseInt(maxSlider.value);
    
    // Prevent crossing
    if (minVal > maxVal - 2) {
        if (this === minSlider) {
            minSlider.value = maxVal - 2;
            minVal = maxVal - 2;
        } else {
            maxSlider.value = minVal + 2;
            maxVal = minVal + 2;
        }
    }
    
    // Update displays
    if (minDisplay) minDisplay.textContent = minVal;
    if (maxDisplay) maxDisplay.textContent = maxVal;
    
    // Update available matches counter
    updateMatchPreferencesCounter();
    
    // Update track
    if (track) {
        const min = parseInt(minSlider.min);
        const max = parseInt(minSlider.max);
        const minPercent = ((minVal - min) / (max - min)) * 100;
        const maxPercent = ((maxVal - min) / (max - min)) * 100;
        track.style.left = `${minPercent}%`;
        track.style.width = `${maxPercent - minPercent}%`;
    }
    
    savePrefToState();
}

/**
 * Update preference distance display
 */
function updatePrefDistance() {
    const slider = document.getElementById('prefDistanceSlider');
    const display = document.getElementById('prefDistance');
    
    if (slider && display) {
        display.textContent = slider.value;
        
        // Update slider background to show filled portion
        const min = slider.min || 1;
        const max = slider.max || 100;
        const percent = ((slider.value - min) / (max - min)) * 100;
        slider.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${percent}%, var(--border) ${percent}%, var(--border) 100%)`;
    }
    
    savePrefToState();
    
    // Update available matches counter
    updateMatchPreferencesCounter();
}

/**
 * Reset match preferences to defaults
 */
function resetMatchPreferences() {
    appState.user.matchPreferences = {
        interestedIn: 'women',
        ageMin: 25,
        ageMax: 35,
        maxDistance: 25,
        heightMin: '',
        heightMax: '',
        bodyType: [],
        ethnicity: '',
        education: '',
        smoking: [],
        drinking: [],
        exercise: '',
        children: '',
        religion: '',
        lookingFor: []
    };
    
    // Re-initialize the screen
    initMatchPreferencesScreen();
    
    showToast('Preferences reset to defaults');
}

/**
 * Initialize match preferences screen with current values
 */
function initMatchPreferencesScreen() {
    const prefs = appState.user.matchPreferences || {};
    
    // Set slider values
    const ageMinSlider = document.getElementById('prefAgeMinSlider');
    const ageMaxSlider = document.getElementById('prefAgeMaxSlider');
    const distanceSlider = document.getElementById('prefDistanceSlider');
    
    if (ageMinSlider) ageMinSlider.value = prefs.ageMin || 25;
    if (ageMaxSlider) ageMaxSlider.value = prefs.ageMax || 35;
    if (distanceSlider) distanceSlider.value = prefs.maxDistance || 25;
    
    // Update displays
    updatePrefAgeRange();
    updatePrefDistance();
    
    // Set select values
    const selects = ['prefHeightMin', 'prefHeightMax', 'prefEthnicity', 'prefEducation', 'prefExercise', 'prefChildren', 'prefReligion'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        const key = id.replace('pref', '').charAt(0).toLowerCase() + id.replace('pref', '').slice(1);
        if (el && prefs[key]) {
            el.value = prefs[key];
        }
    });
    
    // Set toggle group
    if (prefs.interestedIn) {
        const toggleGroup = document.querySelector('#match-preferences .toggle-group');
        if (toggleGroup) {
            toggleGroup.querySelectorAll('.toggle-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.textContent.toLowerCase() === prefs.interestedIn) {
                    btn.classList.add('active');
                }
            });
        }
    }
    
    // Update the counter with current preferences
    updateMatchPreferencesCounter();
}

/**
 * Update the profile visibility counter on Edit Profile screen
 * Shows how many users' preferences your profile matches
 */
function updateProfileVisibilityCounter() {
    const countEl = document.getElementById('profileVisibilityCount');
    const barEl = document.getElementById('profileVisibilityBar');
    if (!countEl) return;
    
    const currentUser = appState.user || {};
    const currentUserEmail = currentUser.email?.toLowerCase();
    
    // Get all available profiles (other users)
    const allProfiles = getAvailableProfilesFromDatabase(currentUserEmail);
    
    // Count how many users' preferences our profile matches
    let visibleToCount = 0;
    
    allProfiles.forEach(otherUser => {
        // Get the other user's preferences (if stored)
        const otherPrefs = otherUser.preferences || {};
        
        // Check if current user matches other user's preferences
        const matchesAge = checkAgeMatch(currentUser.age, otherPrefs);
        const matchesGender = checkGenderMatch(currentUser.gender, otherPrefs);
        
        if (matchesAge && matchesGender) {
            visibleToCount++;
        }
    });
    
    // Update the counter
    countEl.textContent = visibleToCount;
    
    // Update bar color based on count
    if (barEl) {
        if (visibleToCount === 0) {
            barEl.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        } else if (visibleToCount < 3) {
            barEl.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        } else {
            barEl.style.background = 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)';
        }
    }
    
    console.log(`👁️ Profile visible to ${visibleToCount} users`);
}

// Helper: Check if age matches preferences
function checkAgeMatch(userAge, prefs) {
    if (!userAge) return true; // If no age, assume match
    const minAge = prefs.ageMin || 18;
    const maxAge = prefs.ageMax || 99;
    return userAge >= minAge && userAge <= maxAge;
}

// Helper: Check if gender matches preferences
function checkGenderMatch(userGender, prefs) {
    const interestedIn = (prefs.interestedIn || 'everyone').toLowerCase();
    if (interestedIn === 'everyone') return true;
    
    const gender = (userGender || '').toLowerCase();
    const isFemale = ['female', 'woman', 'women', 'f'].includes(gender);
    const isMale = ['male', 'man', 'men', 'm'].includes(gender);
    
    if (interestedIn === 'women' && isFemale) return true;
    if (interestedIn === 'men' && isMale) return true;
    
    return false;
}

/**
 * Update the available matches counter on Match Preferences screen
 */
function updateMatchPreferencesCounter() {
    const countEl = document.getElementById('matchPrefCount');
    if (!countEl) return;
    
    // Get current preferences from form or state
    const prefs = getCurrentMatchPreferences();
    const currentUserEmail = appState.user?.email?.toLowerCase();
    
    console.log('=== MATCH COUNTER DEBUG ===');
    console.log('Current user:', currentUserEmail);
    console.log('Preferences:', prefs);
    
    // Get all available profiles from database
    let allProfiles = getAvailableProfilesFromDatabase(currentUserEmail);
    
    // Filter out already declined/passed matches
    const passedMatchIds = (appState.passedMatches || []).map(m => m.id || m.name);
    const matchHistoryIds = (appState.matchHistory || []).map(m => m.id || m.name);
    const declinedIds = [...new Set([...passedMatchIds, ...matchHistoryIds])];
    
    if (declinedIds.length > 0) {
        allProfiles = allProfiles.filter(profile => {
            const profileId = profile.id || profile.name;
            return !declinedIds.includes(profileId);
        });
        console.log(`   Excluded ${declinedIds.length} declined/previous matches`);
    }
    
    console.log('📊 Updating match counter with preferences:', prefs);
    console.log('   Total profiles available:', allProfiles.length);
    
    // Debug: log each profile
    allProfiles.forEach((p, i) => {
        console.log(`   Profile ${i+1}: ${p.name}, age=${p.age}, gender="${p.gender}", distance=${p.distance}mi, isBot=${p.isTestBot}`);
    });
    
    // Filter by preferences
    const matchingProfiles = allProfiles.filter(profile => {
        // Age filter
        const age = profile.age || 25;
        const minAge = prefs.ageMin || 18;
        const maxAge = prefs.ageMax || 60;
        if (age < minAge || age > maxAge) {
            return false;
        }
        
        // Gender/interested in filter
        const interestedIn = prefs.interestedIn || 'everyone';
        if (interestedIn !== 'everyone') {
            const profileGender = (profile.gender || '').toLowerCase();
            // Handle various gender formats: female/woman/women, male/man/men
            const isFemale = ['female', 'woman', 'women', 'f'].includes(profileGender);
            const isMale = ['male', 'man', 'men', 'm'].includes(profileGender);
            
            console.log(`   Gender check for ${profile.name}: gender="${profileGender}", interested="${interestedIn}", isFemale=${isFemale}, isMale=${isMale}`);
            
            if (interestedIn === 'women' && !isFemale) {
                console.log(`   ❌ ${profile.name}: Gender mismatch (looking for women, got ${profileGender})`);
                return false;
            }
            if (interestedIn === 'men' && !isMale) {
                console.log(`   ❌ ${profile.name}: Gender mismatch (looking for men, got ${profileGender})`);
                return false;
            }
        }
        
        // Distance filter (if set and not at max)
        const maxDistance = prefs.maxDistance || 100;
        if (maxDistance < 100) {
            // User has set a distance preference, filter applies
            if (!profile.distance && profile.distance !== 0) {
                // No distance data - for strict filtering, could exclude these
                // For now, assume unknown distance profiles are "far"
                console.log(`   ⚠️ ${profile.name}: No distance data, assuming within range`);
            } else if (profile.distance > maxDistance) {
                console.log(`   ❌ ${profile.name}: Distance ${profile.distance}mi exceeds max ${maxDistance}mi`);
                return false;
            }
        }
        
        // Education filter (if set) - filters out profiles without education OR with different education
        if (prefs.education && prefs.education !== '') {
            if (!profile.education || profile.education !== prefs.education) {
                console.log(`   ❌ ${profile.name}: Education mismatch (want ${prefs.education}, got ${profile.education || 'none'})`);
                return false;
            }
        }
        
        // Ethnicity filter (if set)
        if (prefs.ethnicity && prefs.ethnicity !== '') {
            if (!profile.ethnicity || profile.ethnicity !== prefs.ethnicity) {
                console.log(`   ❌ ${profile.name}: Ethnicity mismatch (want ${prefs.ethnicity}, got ${profile.ethnicity || 'none'})`);
                return false;
            }
        }
        
        // Exercise filter (if set)
        if (prefs.exercise && prefs.exercise !== '') {
            if (!profile.exercise || profile.exercise !== prefs.exercise) {
                console.log(`   ❌ ${profile.name}: Exercise mismatch (want ${prefs.exercise}, got ${profile.exercise || 'none'})`);
                return false;
            }
        }
        
        // Children filter (if set)
        if (prefs.children && prefs.children !== '') {
            if (!profile.children || profile.children !== prefs.children) {
                console.log(`   ❌ ${profile.name}: Children mismatch (want ${prefs.children}, got ${profile.children || 'none'})`);
                return false;
            }
        }
        
        // Religion filter (if set)
        if (prefs.religion && prefs.religion !== '') {
            if (!profile.religion || profile.religion !== prefs.religion) {
                console.log(`   ❌ ${profile.name}: Religion mismatch (want ${prefs.religion}, got ${profile.religion || 'none'})`);
                return false;
            }
        }
        
        // Smoking filter (if set and not empty)
        if (prefs.smoking && prefs.smoking.length > 0) {
            if (!profile.smoking) {
                console.log(`   ❌ ${profile.name}: No smoking data, preference set`);
                return false;
            }
            const profileSmoking = profile.smoking.toLowerCase();
            if (!prefs.smoking.some(s => profileSmoking.includes(s))) {
                console.log(`   ❌ ${profile.name}: Smoking mismatch`);
                return false;
            }
        }
        
        // Drinking filter (if set and not empty)
        if (prefs.drinking && prefs.drinking.length > 0) {
            if (!profile.drinking) {
                console.log(`   ❌ ${profile.name}: No drinking data, preference set`);
                return false;
            }
            const profileDrinking = profile.drinking.toLowerCase();
            if (!prefs.drinking.some(d => profileDrinking.includes(d))) {
                console.log(`   ❌ ${profile.name}: Drinking mismatch`);
                return false;
            }
        }
        
        // Height filter (if set)
        if (prefs.heightMin) {
            const profileHeight = parseHeightToInches(profile.height);
            const minHeight = parseHeightToInches(prefs.heightMin);
            console.log(`   Height check for ${profile.name}: profile=${profile.height} (${profileHeight}in), min=${prefs.heightMin} (${minHeight}in)`);
            if (!profileHeight) {
                console.log(`   ❌ ${profile.name}: No height data, min height preference set`);
                return false;
            }
            if (minHeight && profileHeight < minHeight) {
                console.log(`   ❌ ${profile.name}: Too short (${profileHeight}in < ${minHeight}in)`);
                return false;
            }
        }
        if (prefs.heightMax) {
            const profileHeight = parseHeightToInches(profile.height);
            const maxHeight = parseHeightToInches(prefs.heightMax);
            console.log(`   Height check for ${profile.name}: profile=${profile.height} (${profileHeight}in), max=${prefs.heightMax} (${maxHeight}in)`);
            if (!profileHeight) {
                console.log(`   ❌ ${profile.name}: No height data, max height preference set`);
                return false;
            }
            if (maxHeight && profileHeight > maxHeight) {
                console.log(`   ❌ ${profile.name}: Too tall (${profileHeight}in > ${maxHeight}in)`);
                return false;
            }
        }
        
        // Body type filter (if set and not empty)
        if (prefs.bodyType && prefs.bodyType.length > 0) {
            if (!profile.bodyType) {
                console.log(`   ❌ ${profile.name}: No body type data, preference set`);
                return false;
            }
            const profileBodyType = profile.bodyType.toLowerCase();
            if (!prefs.bodyType.some(bt => profileBodyType.includes(bt))) {
                console.log(`   ❌ ${profile.name}: Body type mismatch (want ${prefs.bodyType.join('/')}, got ${profileBodyType})`);
                return false;
            }
        }
        
        // Looking for filter (if set and not empty)
        if (prefs.lookingFor && prefs.lookingFor.length > 0) {
            if (!profile.lookingFor) {
                console.log(`   ❌ ${profile.name}: No looking for data, preference set`);
                return false;
            }
            const profileLookingFor = profile.lookingFor.toLowerCase();
            // Match on relationship/casual keywords
            const matches = prefs.lookingFor.some(lf => {
                if (lf === 'relationship' && (profileLookingFor.includes('relationship') || profileLookingFor.includes('long-term'))) {
                    return true;
                }
                if (lf === 'casual' && profileLookingFor.includes('casual')) {
                    return true;
                }
                return profileLookingFor.includes(lf);
            });
            if (!matches) {
                console.log(`   ❌ ${profile.name}: Looking for mismatch (want ${prefs.lookingFor.join('/')}, got ${profileLookingFor})`);
                return false;
            }
        }
        
        return true;
    });
    
    console.log('📊 Matching profiles after all filters:', matchingProfiles.length);
    
    // Update counter with animation
    const oldCount = parseInt(countEl.textContent) || 0;
    const newCount = matchingProfiles.length;
    
    countEl.textContent = newCount;
    
    // Animate if count changed
    if (oldCount !== newCount) {
        countEl.style.transform = 'scale(1.2)';
        countEl.style.transition = 'transform 0.2s ease';
        setTimeout(() => {
            countEl.style.transform = 'scale(1)';
        }, 200);
    }
    
    // Update counter bar color based on count
    const counterBar = document.getElementById('matchPrefCounterBar');
    if (counterBar) {
        counterBar.style.display = 'flex'; // Always show the counter bar
        if (newCount === 0) {
            counterBar.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        } else if (newCount < 3) {
            counterBar.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        } else {
            counterBar.style.background = 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark, #4f46e5) 100%)';
        }
    }
    
    console.log('📊 Match preferences counter:', newCount, 'of', allProfiles.length, 'total profiles');
}

/**
 * Get current match preferences from form inputs
 */
function getCurrentMatchPreferences() {
    const prefs = {};
    
    // Get from sliders
    const ageMinSlider = document.getElementById('prefAgeMinSlider');
    const ageMaxSlider = document.getElementById('prefAgeMaxSlider');
    const distanceSlider = document.getElementById('prefDistanceSlider');
    
    prefs.ageMin = ageMinSlider ? parseInt(ageMinSlider.value) : (appState.user.matchPreferences?.ageMin || 18);
    prefs.ageMax = ageMaxSlider ? parseInt(ageMaxSlider.value) : (appState.user.matchPreferences?.ageMax || 60);
    prefs.maxDistance = distanceSlider ? parseInt(distanceSlider.value) : (appState.user.matchPreferences?.maxDistance || 100);
    
    // Get from toggle buttons (interested in)
    const toggleGroup = document.querySelector('#match-preferences .toggle-group');
    if (toggleGroup) {
        const activeBtn = toggleGroup.querySelector('.toggle-btn.active');
        if (activeBtn) {
            prefs.interestedIn = activeBtn.textContent.toLowerCase();
        }
    }
    prefs.interestedIn = prefs.interestedIn || appState.user.matchPreferences?.interestedIn || 'everyone';
    
    // Get from selects
    const heightMinEl = document.getElementById('prefHeightMin');
    const heightMaxEl = document.getElementById('prefHeightMax');
    const ethnicityEl = document.getElementById('prefEthnicity');
    const educationEl = document.getElementById('prefEducation');
    const exerciseEl = document.getElementById('prefExercise');
    const childrenEl = document.getElementById('prefChildren');
    const religionEl = document.getElementById('prefReligion');
    
    if (heightMinEl && heightMinEl.value) prefs.heightMin = heightMinEl.value;
    if (heightMaxEl && heightMaxEl.value) prefs.heightMax = heightMaxEl.value;
    if (ethnicityEl && ethnicityEl.value) prefs.ethnicity = ethnicityEl.value;
    if (educationEl && educationEl.value) prefs.education = educationEl.value;
    if (exerciseEl && exerciseEl.value) prefs.exercise = exerciseEl.value;
    if (childrenEl && childrenEl.value) prefs.children = childrenEl.value;
    if (religionEl && religionEl.value) prefs.religion = religionEl.value;
    
    // Get from chip selectors (smoking, drinking, bodyType, lookingFor)
    const smokingChips = document.querySelectorAll('#prefSmoking .chip.active');
    prefs.smoking = Array.from(smokingChips).map(c => c.textContent.trim().toLowerCase()).filter(v => v !== 'any');
    
    const drinkingChips = document.querySelectorAll('#prefDrinking .chip.active');
    prefs.drinking = Array.from(drinkingChips).map(c => c.textContent.trim().toLowerCase()).filter(v => v !== 'any');
    
    // Get body type from chip selector
    const bodyTypeChips = document.querySelectorAll('#prefBodyType .chip.active');
    prefs.bodyType = Array.from(bodyTypeChips).map(c => c.textContent.trim().toLowerCase()).filter(v => v !== 'any');
    
    // Get looking for from chip selector
    const lookingForChips = document.querySelectorAll('#prefLookingFor .chip.active');
    prefs.lookingFor = Array.from(lookingForChips).map(c => {
        // Remove emoji prefixes
        return c.textContent.trim().toLowerCase().replace('💕 ', '').replace('😊 ', '');
    }).filter(v => v !== 'any');
    
    console.log('getCurrentMatchPreferences - bodyType:', prefs.bodyType, 'lookingFor:', prefs.lookingFor);
    
    return prefs;
}

// ==========================================
// Authentication
// ==========================================
function handleLogin(event) {
    console.log('🔐 handleLogin called');
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // Get login credentials
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    
    if (!emailInput || !passwordInput) {
        console.error('❌ Login inputs not found');
        showToast('Login form error. Please refresh the page.', 'error');
        return false;
    }
    
    const email = emailInput.value?.trim().toLowerCase();
    const password = passwordInput.value?.trim();
    
    console.log('📧 Email:', email);
    console.log('🔑 Password length:', password?.length || 0);
    
    if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return false;
    }
    
    // Make sure demo accounts are seeded first
    seedDemoAccounts();
    
    // Get registered users
    const registeredUsers = JSON.parse(localStorage.getItem('oith_registered_users') || '{}');
    console.log('📋 Registered users:', Object.keys(registeredUsers));
    
    // Check if user exists (case-insensitive)
    const userEmail = Object.keys(registeredUsers).find(e => e.toLowerCase() === email.toLowerCase());
    
    if (!userEmail) {
        console.log('❌ Email not found in registered users');
        console.log('📋 Available accounts:', Object.keys(registeredUsers));
        showToast('No account found. Click "Sign up" to create one.', 'error');
        return false;
    }
    
    console.log('✅ Email found:', userEmail);
    console.log('✅ Checking password...');
    
    // Get stored password
    const storedPassword = (registeredUsers[userEmail].password || '').trim();
    console.log('   Stored password:', storedPassword);
    console.log('   Entered password:', password);
    console.log('   Match:', storedPassword === password);
    
    // Validate password (trim both to be safe)
    if (storedPassword !== password) {
        console.log('❌ Password mismatch');
        showToast('Incorrect password. Please try again.', 'error');
        return false;
    }
    
    console.log('✅ Password correct, logging in...');
    
    // Login successful!
    console.log('✅ Login successful for:', userEmail);
    
    // Set email first so we can load the correct user data
    appState.user.email = userEmail;
    
    // Load this specific user's saved data
    const hasData = loadUserData(userEmail);
    
    // Mark as logged in
    appState.isLoggedIn = true;
    
    // Ensure email is set (in case loadUserData overwrote it)
    appState.user.email = userEmail;
    
    // Recalculate profile completion based on actual data (not just old flags)
    appState.profileComplete = isProfileComplete();
    
    // Restore first name from registration if not in saved data
    if (!appState.user.firstName && registeredUsers[userEmail].firstName) {
        appState.user.firstName = registeredUsers[userEmail].firstName;
    }
    
    // Save email for auto-fill on next login
    localStorage.setItem('oith_remembered_email', userEmail);
    
    // Save login state
    saveUserData();
    
    // Check for and apply any active experiment treatments
    checkAndApplyExperiments();
    
    showToast(`Welcome back, ${appState.user.firstName || 'User'}! 👋`, 'success');
    
    console.log('🔄 Navigating after login...');
    console.log('   Profile complete:', !!appState.profileComplete);
    console.log('   Active connection:', !!appState.activeConnection);
    console.log('   Has data:', hasData);
    console.log('   Current match:', !!appState.oneMatch?.current);
    
    // Small delay to ensure toast appears, then navigate
    setTimeout(() => {
        // For returning users, allow login even if profile/photos are incomplete.
        // They can update photos later from Edit Profile, instead of being forced
        // back through the "Add your photos" setup screen.
        const profileDone = isProfileComplete();
        if (!profileDone) {
            console.log('📝 Profile incomplete - skipping photo setup for returning user');
            // Optional: gentle hint without blocking
            // showToast('Tip: add photos in Edit Profile to get better matches', 'info');
        }
        
        // After successful login, always land on My Profile first
        console.log('👤 Navigating to My Profile after login');
        // Set a friendly welcome banner on the profile screen
        const profileWelcome = document.getElementById('profileWelcomeMessage');
        if (profileWelcome) {
            profileWelcome.textContent = `Welcome back, ${appState.user.firstName || 'User'}!`;
            profileWelcome.style.display = 'block';
        }
        showScreen('my-profile');
        
        console.log('✅ Navigation complete, current screen:', appState.currentScreen);
        
        // Run auto-match in background after login
        runAutoMatch().then(result => {
            if (result.newMatches && result.newMatches.length > 0) {
                // Found a match! Show celebration
                console.log('💕 Auto-matched on login!');
            }
        }).catch(err => console.log('Auto-match check:', err.message));
    }, 100);
    
    return false; // Prevent form submission
}

/**
 * Pre-fill login email from saved data
 */
function prefillLoginEmail() {
    const savedEmail = localStorage.getItem('oith_remembered_email');
    const emailInput = document.getElementById('loginEmail');
    
    if (savedEmail && emailInput) {
        emailInput.value = savedEmail;
        console.log('📧 Email pre-filled:', savedEmail);
    }
}

/**
 * Show forgot password flow
 */
function showForgotPassword() {
    const rawEmail = document.getElementById('loginEmail')?.value?.trim() || '';
    const email = rawEmail.toLowerCase();
    
    if (!rawEmail) {
        showToast('Please enter your email above first', 'error');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(rawEmail)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    // Check if email is registered
    const registeredUsers = JSON.parse(localStorage.getItem('oith_registered_users') || '{}');
    // Find the actual stored key in a case-insensitive way
    const userEmail = Object.keys(registeredUsers).find(e => e.toLowerCase() === email.toLowerCase());
    
    if (!userEmail) {
        showToast('No account found with this email address', 'error');
        return;
    }
    
    // Email is registered - simulate sending reset link
    // In production, this would send an actual email via backend
    
    // Store reset token (for demo purposes)
    const resetToken = Math.random().toString(36).substring(2, 15);
    const resetData = {
        email: userEmail,
        token: resetToken,
        expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour expiry
    };
    localStorage.setItem('oith_password_reset', JSON.stringify(resetData));
    
    console.log('🔐 Password reset requested for:', userEmail);
    console.log('   Reset token:', resetToken);
    
    showToast(`Password reset link sent to ${userEmail}! Check your inbox.`, 'success');
    
    // Show reset password modal
    showResetPasswordModal(userEmail);
}

function showResetPasswordModal(email) {
    // For demo: show a modal to reset password directly
    const modal = document.getElementById('reset-password-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        
        // Store email for reset
        document.getElementById('resetEmail').value = email;
    }
}

function resetPassword(event) {
    event.preventDefault();
    
    const rawEmail = document.getElementById('resetEmail')?.value?.trim() || '';
    const email = rawEmail.toLowerCase();
    const currentPassword = (document.getElementById('resetCurrentPassword')?.value || '').trim();
    const newPassword = (document.getElementById('resetNewPassword')?.value || '').trim();
    const confirmPassword = (document.getElementById('resetConfirmPassword')?.value || '').trim();
    
    // Require current password for security
    if (!currentPassword) {
        showToast('Please enter your current password', 'error');
        return;
    }
    
    // Validate passwords match
    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    // Validate password length
    if (newPassword.length < 8) {
        showToast('Password must be at least 8 characters', 'error');
        return;
    }
    
    // Update password in registered users
    const registeredUsers = JSON.parse(localStorage.getItem('oith_registered_users') || '{}');
    // Find the actual stored key in a case-insensitive way
    const userEmail = Object.keys(registeredUsers).find(e => e.toLowerCase() === email.toLowerCase());
    
    if (!userEmail) {
        showToast('Account not found', 'error');
        return;
    }
    
    // Verify current password matches stored password
    const storedPassword = (registeredUsers[userEmail].password || '').trim();
    if (storedPassword !== currentPassword) {
        showToast('Current password is incorrect', 'error');
        return;
    }
    
    registeredUsers[userEmail].password = newPassword; // already trimmed above
    registeredUsers[userEmail].passwordResetAt = new Date().toISOString();
    localStorage.setItem('oith_registered_users', JSON.stringify(registeredUsers));
    
    // Clear reset token
    localStorage.removeItem('oith_password_reset');
    
    console.log('✅ Password reset successful for:', userEmail);
    
    closeModal();
    showToast('Password reset successful! You can now login.', 'success');
    
    // Pre-fill email on login screen
    const loginEmail = document.getElementById('loginEmail');
    if (loginEmail) loginEmail.value = userEmail;
}

/**
 * Calculate age from birthday and display it
 */
function calculateAndDisplayAge(inputId, displayId) {
    const birthdayInput = document.getElementById(inputId);
    const ageDisplay = document.getElementById(displayId);
    
    if (!birthdayInput || !birthdayInput.value) {
        if (ageDisplay) ageDisplay.textContent = '';
        return null;
    }
    
    const birthday = new Date(birthdayInput.value);
    const today = new Date();
    
    let age = today.getFullYear() - birthday.getFullYear();
    const monthDiff = today.getMonth() - birthday.getMonth();
    
    // Adjust if birthday hasn't occurred yet this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) {
        age--;
    }
    
    // Validate age (must be 18+)
    if (age < 18) {
        if (ageDisplay) {
            ageDisplay.textContent = '⚠️ Must be 18 or older';
            ageDisplay.style.color = 'var(--danger)';
        }
        return null;
    }
    
    if (age > 120) {
        if (ageDisplay) {
            ageDisplay.textContent = '⚠️ Please enter a valid birthday';
            ageDisplay.style.color = 'var(--danger)';
        }
        return null;
    }
    
    // Display the age
    if (ageDisplay) {
        ageDisplay.textContent = `🎂 You are ${age} years old`;
        ageDisplay.style.color = 'var(--accent)';
    }
    
    // Store in appState
    appState.user.age = age;
    
    return age;
}

/**
 * Update age field from birthday in edit profile
 * Called when birthday is changed - age field is readonly
 */
function updateAgeFromBirthday() {
    const birthdayInput = document.getElementById('editBirthday');
    const ageInput = document.getElementById('editAge');
    
    if (!birthdayInput || !birthdayInput.value || !ageInput) {
        return;
    }
    
    const birthday = new Date(birthdayInput.value);
    const today = new Date();
    
    let age = today.getFullYear() - birthday.getFullYear();
    const monthDiff = today.getMonth() - birthday.getMonth();
    
    // Adjust if birthday hasn't occurred yet this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) {
        age--;
    }
    
    // Validate age
    if (age < 18 || age > 120) {
        ageInput.value = '';
        showToast('Please enter a valid birthday (must be 18+)', 'error');
        return;
    }
    
    // Update the age input field
    ageInput.value = age;
    
    // Store in appState
    appState.user.age = age;
    appState.user.birthday = birthdayInput.value;
    
    // Auto-save
    autoSave();
}

/**
 * Calculate age from a date string
 */
function calculateAgeFromDate(birthdayStr) {
    if (!birthdayStr) return null;
    
    const birthday = new Date(birthdayStr);
    const today = new Date();
    
    let age = today.getFullYear() - birthday.getFullYear();
    const monthDiff = today.getMonth() - birthday.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) {
        age--;
    }
    
    return age >= 18 && age <= 120 ? age : null;
}

function handleSignupStep1(event) {
    event.preventDefault();
    
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    
    // Check if email is already registered
    const registeredUsers = JSON.parse(localStorage.getItem('oith_registered_users') || '{}');
    if (registeredUsers[email]) {
        showToast('This email is already registered. Please login instead.', 'error');
        return;
    }
    
    // Validate password
    if (password.length < 8) {
        showToast('Password must be at least 8 characters', 'error');
        return;
    }
    
    // Validate age
    const age = calculateAndDisplayAge('birthday', 'signupAgeDisplay');
    if (!age || age < 18) {
        showToast('You must be 18 or older to use OITH', 'error');
        return;
    }
    
    // Collect user data
    appState.user.firstName = document.getElementById('firstName').value;
    appState.user.email = email;
    appState.user.birthday = document.getElementById('birthday').value;
    appState.user.age = age; // Store the calculated age
    
    // Store password temporarily for registration completion
    appState._tempPassword = password;
    
    // Save progress
    autoSave();
    
    // Go to preferences (Step 2)
    showScreen('preferences');
}

/**
 * Format card number with spaces
 */
function formatCardNumber(input) {
    let value = input.value.replace(/\s/g, '').replace(/\D/g, '');
    let formatted = value.match(/.{1,4}/g)?.join(' ') || value;
    input.value = formatted.substring(0, 19);
}

/**
 * Format expiry date
 */
function formatExpiry(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    input.value = value;
}

/**
 * Process payment and show success screen
 */
// ==========================================
// PAYMENT CONFIGURATION
// ==========================================
const PAYMENT_CONFIG = {
    // Set to your Stripe publishable key for production
    stripePublishableKey: 'pk_test_YOUR_PUBLISHABLE_KEY',
    apiUrl: 'http://localhost:3000/api',
    testMode: true, // Set to false when Stripe is configured
    plans: {
        monthly: { price: 9.99, interval: 'month', label: '$9.99/month' },
        yearly: { price: 79.99, interval: 'year', label: '$79.99/year' }
    }
};

// Selected plan (default to yearly for best value)
let selectedPlan = 'monthly'; // Default to monthly (only option now)

// Show the payment details form
function showPaymentForm() {
    const planView = document.getElementById('paymentFormView');
    const detailsView = document.getElementById('paymentDetailsView');
    
    if (planView) planView.style.display = 'none';
    if (detailsView) detailsView.style.display = 'block';
}

// Show the plan selection view
function showPlanSelection() {
    const planView = document.getElementById('paymentFormView');
    const detailsView = document.getElementById('paymentDetailsView');
    
    if (planView) planView.style.display = 'block';
    if (detailsView) detailsView.style.display = 'none';
}

// Format card number with spaces
function formatCardNumber(input) {
    let value = input.value.replace(/\s/g, '').replace(/\D/g, '');
    let formatted = '';
    for (let i = 0; i < value.length; i++) {
        if (i > 0 && i % 4 === 0) formatted += ' ';
        formatted += value[i];
    }
    input.value = formatted;
}

// Format expiry date
function formatExpiry(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length >= 2) {
        value = value.slice(0, 2) + '/' + value.slice(2);
    }
    input.value = value;
}

// Select a subscription plan (legacy - now single plan)
function selectPlan(planId) {
    selectedPlan = planId || 'monthly';
    
    // Update UI
    document.querySelectorAll('.plan-card').forEach(card => {
        card.classList.remove('selected');
        card.style.borderColor = 'var(--border)';
        card.style.background = 'transparent';
        const check = card.querySelector('.plan-check');
        if (check) {
            check.style.background = 'transparent';
            check.style.border = '2px solid var(--border)';
            check.querySelector('svg').style.display = 'none';
        }
    });
    
    const selectedCard = document.getElementById(`plan-${planId}`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
        selectedCard.style.borderColor = 'var(--accent)';
        selectedCard.style.background = 'rgba(196, 88, 74, 0.05)';
        const check = selectedCard.querySelector('.plan-check');
        if (check) {
            check.style.background = 'var(--accent)';
            check.style.border = 'none';
            check.querySelector('svg').style.display = 'block';
        }
    }
    
    // Update button text
    const plan = PAYMENT_CONFIG.plans[planId];
    const priceEl = document.getElementById('subscribeBtnPrice');
    if (priceEl && plan) {
        priceEl.textContent = ` - ${plan.label}`;
    }
    
    console.log(`📋 Selected plan: ${planId}`);
}

// Initialize payment screen
function initPaymentScreen() {
    // Check if Stripe is configured
    const isStripeConfigured = PAYMENT_CONFIG.stripePublishableKey && 
                               !PAYMENT_CONFIG.stripePublishableKey.includes('YOUR_');
    
    // Show/hide test mode banner
    const testBanner = document.getElementById('testModeBanner');
    if (testBanner) {
        testBanner.style.display = isStripeConfigured ? 'none' : 'block';
    }
    
    // Select default plan
    selectPlan('yearly');
    
    console.log(`💳 Payment initialized - Mode: ${isStripeConfigured ? 'LIVE' : 'TEST'}`);
}

// Process payment from the payment details form
async function processPayment(event) {
    if (event) event.preventDefault();
    
    // Validate form fields
    const cardName = document.getElementById('cardName')?.value?.trim();
    const cardNumber = document.getElementById('cardNumber')?.value?.replace(/\s/g, '');
    const cardExpiry = document.getElementById('cardExpiry')?.value;
    const cardCvv = document.getElementById('cardCvv')?.value;
    
    if (!cardName || !cardNumber || !cardExpiry || !cardCvv) {
        showToast('Please fill in all payment details', 'error');
        return;
    }
    
    if (cardNumber.length < 13) {
        showToast('Please enter a valid card number', 'error');
        return;
    }
    
    // Show processing view
    const detailsView = document.getElementById('paymentDetailsView');
    const processingView = document.getElementById('paymentProcessingView');
    
    if (detailsView) detailsView.style.display = 'none';
    if (processingView) processingView.style.display = 'block';
    
    try {
        // Check if Stripe is configured
        const isStripeConfigured = PAYMENT_CONFIG.stripePublishableKey && 
                                   !PAYMENT_CONFIG.stripePublishableKey.includes('YOUR_');
        
        if (isStripeConfigured) {
            // Use Stripe Checkout
            await startStripeCheckout();
        } else {
            // Use test mode - simulate payment
            await simulateTestPayment();
        }
    } catch (error) {
        console.error('Payment error:', error);
        showToast('Payment failed: ' + error.message, 'error');
        
        // Show details view again on error
        if (detailsView) detailsView.style.display = 'block';
        if (processingView) processingView.style.display = 'none';
        
        // Re-enable button
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
        }
        if (btnText) {
            btnText.textContent = originalText;
        }
    }
}

// Start Stripe Checkout session
async function startStripeCheckout() {
    try {
        const response = await fetch(`${PAYMENT_CONFIG.apiUrl}/create-checkout-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                plan: selectedPlan,
                email: appState.user?.email || '',
                userId: appState.user?.id || 'unknown'
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Redirect to Stripe Checkout
        if (data.url) {
            window.location.href = data.url;
        }
    } catch (error) {
        throw error;
    }
}

// Simulate test payment (development mode)
async function simulateTestPayment() {
    console.log('🧪 TEST MODE: Simulating payment...');
    
    // Show processing view
    document.getElementById('paymentFormView').style.display = 'none';
    document.getElementById('paymentProcessingView').style.display = 'block';
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Calculate billing dates based on selected plan
    const plan = PAYMENT_CONFIG.plans[selectedPlan];
    const nextBilling = new Date();
    if (selectedPlan === 'yearly') {
        nextBilling.setFullYear(nextBilling.getFullYear() + 1);
    } else {
        nextBilling.setMonth(nextBilling.getMonth() + 1);
    }
    
    // Show success view
    document.getElementById('paymentProcessingView').style.display = 'none';
    document.getElementById('paymentSuccessView').style.display = 'block';
    
    // Update next billing date display
    const nextBillingEl = document.getElementById('nextBillingDate');
    if (nextBillingEl) {
        nextBillingEl.textContent = nextBilling.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
    }
    
    // Update subscription status
    appState.user.subscription = {
        type: 'premium',
        plan: selectedPlan,
        status: 'active',
        startDate: new Date().toISOString(),
        nextBillingDate: nextBilling.toISOString(),
        amount: plan.price,
        testMode: true
    };
    
    // Store payment method info
    appState.user.paymentMethod = {
        last4: '4242',
        brand: 'Test Card',
        isTestCard: true
    };
    
    // Create transaction record
    const bankSettings = JSON.parse(localStorage.getItem('oith_bank_settings') || '{}');
    const transaction = {
        id: 'TEST-' + Date.now(),
        date: new Date().toISOString(),
        amount: 0.00, // Test mode = no charge
        description: 'OITH Premium (Test Card - No Charge)',
        isTestTransaction: true,
        status: 'paid',
        paymentMethod: appState.user.paymentMethod,
        // Link to bank account on file
        depositTo: bankSettings.bankName ? {
            bank: bankSettings.bankName,
            accountLast4: bankSettings.accountNumber?.slice(-4) || '****',
            accountType: bankSettings.accountType || 'checking'
        } : null
    };
    
    // Add to billing history
    if (!appState.user.billingHistory) appState.user.billingHistory = [];
    appState.user.billingHistory.unshift(transaction);
    
    console.log('💳 Payment successful!');
    console.log('   Deposited to:', transaction.depositTo?.bank || 'No bank configured');
    
    // Update bank settings with last payout date
    if (bankSettings.bankName) {
        bankSettings.lastPayout = new Date().toISOString();
        localStorage.setItem('oith_bank_settings', JSON.stringify(bankSettings));
    }
}

/**
 * Get card brand from number
 */
function getCardBrand(number) {
    const cleaned = number.replace(/\s/g, '');
    if (cleaned.startsWith('4')) return 'Visa';
    if (/^5[1-5]/.test(cleaned)) return 'Mastercard';
    if (/^3[47]/.test(cleaned)) return 'Amex';
    if (/^6(?:011|5)/.test(cleaned)) return 'Discover';
    return 'Card';
}

/**
 * Complete signup after successful payment
 */
function completeSignup() {
    // Register the user with their credentials
    const registeredUsers = JSON.parse(localStorage.getItem('oith_registered_users') || '{}');
    
    registeredUsers[appState.user.email] = {
        password: appState._tempPassword, // In production, this would be hashed
        firstName: appState.user.firstName,
        registeredAt: new Date().toISOString()
    };
    
    localStorage.setItem('oith_registered_users', JSON.stringify(registeredUsers));
    
    // Save email for auto-fill on next login
    localStorage.setItem('oith_remembered_email', appState.user.email);
    
    // Clear temp password
    delete appState._tempPassword;
    
    // Mark as logged in
    appState.isLoggedIn = true;
    
    // Mark profile as complete (user has gone through full signup flow)
    appState.profileComplete = true;
    
    // Set subscription start date (if not already set by payment)
    if (!appState.user.subscriptionStartDate) {
        appState.user.subscriptionStartDate = new Date().toISOString();
    }
    
    // Ensure subscription is set to active/premium
    if (!appState.user.subscription || appState.user.subscription.type !== 'premium') {
        appState.user.subscription = {
            type: 'premium',
            status: 'active',
            startDate: new Date().toISOString()
        };
    }
    
    // Save complete profile
    saveUserData();
    
    // EXPLICITLY sync to AWS for cross-device access
    forceSyncToAWS();
    
    // Broadcast to admin dashboard
    broadcastSync('user_updated', { email: appState.user.email });
    
    console.log('✅ User registered:', appState.user.email);
    console.log('   Subscription:', appState.user.subscription);
    showToast('Account created successfully! Welcome to OITH! 🎉', 'success');
    
    // Run automatic matching to find preference-based matches
    runAutoMatch().then(result => {
        if (result.newMatches && result.newMatches.length > 0) {
            // Auto-match found - user is already taken to chat
            console.log('💕 Auto-matched on signup!');
        } else {
            // No auto-match yet - present profiles to browse
            presentMatch();
        }
    }).catch(() => {
        // If auto-match fails, still present matches
        presentMatch();
    });
}

/**
 * Check if user profile is complete
 * Required: firstName, birthday, gender, at least 1 photo
 * Uses actual data so returning users aren't forced through setup again.
 */
function isProfileComplete() {
    const user = appState.user || {};
    
    // Check required fields
    if (!user.firstName || user.firstName.trim() === '') return false;
    if (!user.birthday) return false;
    if (!user.gender) return false;
    
    // Require at least 1 photo
    const photos = Array.isArray(user.photos) ? user.photos : [];
    const hasPhoto = photos.some(p => typeof p === 'string' && p.trim() !== '');
    if (!hasPhoto) return false;
    
    return true;
}

/**
 * Redirect user to complete their profile
 */
function redirectToProfileSetup() {
    showToast('Please complete your profile to continue', 'info');
    showScreen('profile-setup');
}

/**
 * Export user's profile data as a downloadable JSON file
 * This allows users to share their data with admin or backup their profile
 */
function exportMyProfile() {
    try {
        const email = appState.user?.email;
        if (!email) {
            showToast('Please log in to export your profile', 'error');
            return;
        }
        
        // Get registered user data
        const registeredUsers = JSON.parse(localStorage.getItem('oith_registered_users') || '{}');
        const registeredData = registeredUsers[email] || {};
        
        // Get full user data
        const storageKey = getUserStorageKey(email);
        const savedData = JSON.parse(localStorage.getItem(storageKey) || '{}');
        
        // Create export package
        const exportData = {
            exportedAt: new Date().toISOString(),
            exportedFrom: window.location.href,
            version: '1.0',
            registeredUsers: {
                [email]: registeredData
            },
            userData: {
                [email]: savedData
            }
        };
        
        // Create downloadable file
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        // Create download link
        const link = document.createElement('a');
        link.href = url;
        link.download = `oith_profile_${email.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast('Profile exported! Send this file to admin.', 'success');
        console.log('📤 Profile exported for:', email);
        
    } catch (error) {
        console.error('Failed to export profile:', error);
        showToast('Failed to export profile', 'error');
    }
}

/**
 * Log out - saves all user data before logging out
 * User can log back in and have all their data restored
 */
function logout() {
    // SAVE all user data BEFORE logging out so it persists
    // This ensures profile, preferences, match history etc. are preserved
    saveUserData();
    
    console.log('💾 User data saved before logout');
    console.log('   Profile: ' + (appState.user.firstName || 'Not set'));
    console.log('   Email: ' + (appState.user.email || 'Not set'));
    
    // Only mark as logged out - don't clear the data
    appState.isLoggedIn = false;
    
    // Save the logged out state
    saveUserData();
    
    showToast('Logged out. Your data has been saved.', 'info');
    
    // Return to splash
    showScreen('splash');
}

/**
 * Full reset - clears ALL user data (use with caution)
 */
// ==========================================
// Support & Safety Functions
// ==========================================

function showSafetyTips() {
    const modal = document.getElementById('safety-tips-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
}

function showReportProblem() {
    const modal = document.getElementById('report-problem-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        
        // Reset form
        document.getElementById('reportType').value = '';
        document.getElementById('reportDescription').value = '';
        document.getElementById('reportBlock').checked = false;
    }
}

function showContactSupport() {
    const modal = document.getElementById('contact-support-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        
        // Reset form
        document.getElementById('supportSubject').value = '';
        document.getElementById('supportMessage').value = '';
    }
}

function submitReport(event) {
    event.preventDefault();
    
    const reportType = document.getElementById('reportType').value;
    const description = document.getElementById('reportDescription').value;
    const blockUser = document.getElementById('reportBlock').checked;
    
    // In production, this would send to a backend
    console.log('Report submitted:', { reportType, description, blockUser });
    
    // Save report to localStorage for demo purposes
    const reports = JSON.parse(localStorage.getItem('oith_reports') || '[]');
    reports.push({
        type: reportType,
        description: description,
        blockUser: blockUser,
        timestamp: new Date().toISOString(),
        matchId: appState.activeConnection?.id || null
    });
    localStorage.setItem('oith_reports', JSON.stringify(reports));
    
    closeModal();
    showToast('Report submitted. Thank you for helping keep OITH safe!', 'success');
    
    // If blocking user, end the match
    if (blockUser && appState.activeConnection) {
        endConnection();
    }
}

function submitSupportMessage(event) {
    event.preventDefault();
    
    const subject = document.getElementById('supportSubject').value;
    const message = document.getElementById('supportMessage').value;
    
    // In production, this would send to a backend/email
    console.log('Support message submitted:', { subject, message });
    
    // Save message to localStorage for demo purposes
    const messages = JSON.parse(localStorage.getItem('oith_support_messages') || '[]');
    messages.push({
        subject: subject,
        message: message,
        userEmail: appState.user.email,
        timestamp: new Date().toISOString()
    });
    localStorage.setItem('oith_support_messages', JSON.stringify(messages));
    
    closeModal();
    showToast('Message sent! We\'ll get back to you within 24 hours.', 'success');
}

function openEmail() {
    window.location.href = 'mailto:support@oith.app?subject=OITH Support Request';
}

function openLiveChat() {
    showToast('Live chat is currently unavailable. Please try email or send a message.', 'info');
}

function openFAQ() {
    // In production, this would navigate to an FAQ page
    showToast('FAQ page coming soon!', 'info');
}

function showBlockedUsers() {
    const blockedUsers = JSON.parse(localStorage.getItem('oith_blocked_users') || '[]');
    if (blockedUsers.length === 0) {
        showToast('You haven\'t blocked anyone yet.', 'info');
    } else {
        showToast(`You have ${blockedUsers.length} blocked user(s).`, 'info');
    }
}

function downloadMyData() {
    // Export user data as JSON
    const userData = {
        profile: appState.user,
        preferences: appState.user.matchPreferences,
        connections: appState.connections,
        conversation: appState.conversation,
        exportedAt: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(userData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `oith_my_data_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    showToast('Your data has been downloaded!', 'success');
}

function showPrivacyPolicy() {
    showToast('Privacy Policy page coming soon!', 'info');
}

function resetAllData() {
    // First warning
    if (!confirm('⚠️ DELETE ACCOUNT\n\nAre you sure you want to permanently delete your account and all data?\n\nThis action CANNOT be undone.')) {
        return;
    }
    
    // Second confirmation
    if (!confirm('⚠️ FINAL WARNING\n\nThis will permanently delete:\n• Your profile and photos\n• All matches and conversations\n• Payment history\n• All preferences and settings\n\nType "DELETE" in the next prompt to confirm.')) {
        return;
    }
    
    // Final text confirmation
    const confirmation = prompt('Type DELETE to permanently delete your account:');
    if (confirmation !== 'DELETE') {
        showToast('Account deletion cancelled', 'info');
        return;
    }
    
    // Get user email before clearing
    const userEmail = appState.user?.email;
    
    // Clear all user data
    clearUserData();
    
    // Remove from registered users
    if (userEmail) {
        const registeredUsers = JSON.parse(localStorage.getItem('oith_registered_users') || '{}');
        delete registeredUsers[userEmail];
        delete registeredUsers[userEmail.toLowerCase()];
        localStorage.setItem('oith_registered_users', JSON.stringify(registeredUsers));
        
        // Remove user-specific storage
        const userKey = `oith_user_${userEmail.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        localStorage.removeItem(userKey);
        
        // Broadcast deletion to admin
        if (typeof oithSyncChannel !== 'undefined') {
            oithSyncChannel.postMessage({
                type: 'user_deleted',
                email: userEmail,
                source: 'app',
                timestamp: Date.now()
            });
        }
    }
    
    // Reset state completely
    appState.isLoggedIn = false;
    appState.user = {
        firstName: '',
        email: '',
        birthday: '',
        photos: [],
        preferences: {
            interestedIn: 'women',
            lookingFor: 'relationship',
            ageMin: 25,
            ageMax: 35,
            distance: 25
        },
        matchPreferences: {
            interestedIn: 'women',
            ageMin: 25,
            ageMax: 35,
            maxDistance: 25,
            heightMin: '',
            heightMax: '',
            bodyType: [],
            ethnicity: '',
            education: '',
            smoking: [],
            drinking: [],
            exercise: '',
            children: '',
            religion: '',
            lookingFor: []
        }
    };
    appState.oneMatch.current = null;
    appState.oneMatch.status = 'waiting';
    appState.oneMatch.decisionMade = false;
    appState.activeConnection = null;
    appState.passedMatches = [];
    appState.conversation = {
        messages: [],
        dateReadiness: 0,
        suggestedDate: null,
        datePlanned: false
    };
    
    // Reset profile visibility
    appState.profileVisibility = {
        isHidden: false,
        hiddenAt: null,
        reason: null
    };
    
    showToast('All data has been deleted.', 'info');
    
    // Return to splash
    showScreen('splash');
}

/**
 * Show end match modal
 */
function showEndMatchModal() {
    showModal('end-match-modal');
    
    // Set up reason dropdown listener
    const reasonSelect = document.getElementById('endMatchReason');
    const otherContainer = document.getElementById('otherReasonContainer');
    
    if (reasonSelect && otherContainer) {
        reasonSelect.addEventListener('change', function() {
            if (this.value === 'other') {
                otherContainer.style.display = 'block';
            } else {
                otherContainer.style.display = 'none';
            }
        });
    }
}

/**
 * Confirm end match from modal
 */
function confirmEndMatch() {
    const reasonSelect = document.getElementById('endMatchReason');
    const reason = reasonSelect ? reasonSelect.value : '';
    
    if (!reason) {
        showToast('Please select a reason');
        return;
    }
    
    // Get other reason text if applicable
    let otherReasonText = '';
    if (reason === 'other') {
        const otherInput = document.getElementById('otherReasonText');
        otherReasonText = otherInput ? otherInput.value : '';
    }
    
    // Close modal
    closeModal();
    
    // End the connection with the reason
    endConnection(reason, otherReasonText);
}

/**
 * End current connection (unmatch)
 */
function endConnection(reason = 'manual', otherReasonText = '') {
    if (!appState.activeConnection) return;
    
    const matchName = appState.activeConnection.name;
    const matchId = appState.activeConnection.id;
    const connectedAt = appState.activeConnection.connectedAt;
    const messageCount = appState.conversation?.messages?.length || 0;
    const hadDate = appState.conversation?.datePlanned || false;
    
    // Log the reason (in production, this would be sent to server)
    console.log(`Connection ended with ${matchName}. Reason: ${reason}`, otherReasonText);
    
    // Update match history with end details
    if (appState.matchHistory) {
        const matchIndex = appState.matchHistory.findIndex(m => m.id === matchId);
        if (matchIndex !== -1) {
            const connectedDate = new Date(connectedAt || appState.matchHistory[matchIndex].connectedAt);
            const duration = Math.round((Date.now() - connectedDate.getTime()) / (1000 * 60 * 60)); // hours
            
            appState.matchHistory[matchIndex].status = 'ended';
            appState.matchHistory[matchIndex].endedAt = new Date().toISOString();
            appState.matchHistory[matchIndex].endReason = reason;
            appState.matchHistory[matchIndex].messageCount = messageCount;
            appState.matchHistory[matchIndex].hadDate = hadDate;
            appState.matchHistory[matchIndex].duration = duration > 24 ? `${Math.round(duration/24)}d` : `${duration}h`;
        }
    }
    
    // Store feedback given (user ended the connection)
    const feedbackEntry = {
        id: Date.now(),
        matchId: matchId,
        matchName: matchName,
        reason: reason,
        note: otherReasonText || '',
        date: new Date().toISOString(),
        type: 'given' // User gave this feedback
    };
    
    if (!appState.feedbackGiven) appState.feedbackGiven = [];
    appState.feedbackGiven.unshift(feedbackEntry);
    
    // Clear connection
    appState.activeConnection = null;
    appState.oneMatch.status = 'waiting';
    appState.oneMatch.current = null;
    appState.oneMatch.connectionExpiresAt = null;
    appState.oneMatch.decisionMade = false;
    appState.oneMatch.isMutual = false;
    
    // SHOW PROFILE - User is no longer matched, profile is visible again
    showProfile('match_ended');
    
    // Reset conversation
    appState.conversation = {
        messages: [],
        dateReadiness: 0,
        suggestedDate: null,
        datePlanned: false,
        calendarEvent: null
    };
    
    // Reset connection metrics
    appState.connectionMetrics = {
        messageCount: 0,
        avgResponseTime: '0m',
        compatibility: 0,
        dateReadiness: 0,
        connectedAt: null
    };
    
    // Save state
    saveUserData();
    
    // Show toast notification
    showToast(`Match with ${matchName} ended. Finding your next match...`);
    
    // Navigate to match screen and find new match
    showScreen('match');
    
    // Find a new match after a brief delay
    setTimeout(() => {
        findNextMatch();
    }, 500);
}

/**
 * Handle when the other user (match) ends the connection
 * This simulates receiving a notification that your match ended things
 */
function handleMatchEndedConnection(matchName) {
    if (!appState.activeConnection) return;
    
    const matchId = appState.activeConnection.id;
    const connectedAt = appState.activeConnection.connectedAt;
    const messageCount = appState.conversation?.messages?.length || 0;
    const hadDate = appState.conversation?.datePlanned || false;
    
    console.log(`😢 ${matchName} ended the connection`);
    
    // Update match history
    if (appState.matchHistory) {
        const matchIndex = appState.matchHistory.findIndex(m => m.id === matchId);
        if (matchIndex !== -1) {
            const connectedDate = new Date(connectedAt || appState.matchHistory[matchIndex].connectedAt);
            const duration = Math.round((Date.now() - connectedDate.getTime()) / (1000 * 60 * 60));
            
            appState.matchHistory[matchIndex].status = 'ended_by_match';
            appState.matchHistory[matchIndex].endedAt = new Date().toISOString();
            appState.matchHistory[matchIndex].endReason = 'other_user_ended';
            appState.matchHistory[matchIndex].messageCount = messageCount;
            appState.matchHistory[matchIndex].hadDate = hadDate;
            appState.matchHistory[matchIndex].duration = duration > 24 ? `${Math.round(duration/24)}d` : `${duration}h`;
        }
    }
    
    // Store feedback received (match ended the connection)
    const feedbackEntry = {
        id: Date.now(),
        matchId: matchId,
        matchName: matchName,
        reason: 'other_user_ended',
        note: '',
        date: new Date().toISOString(),
        type: 'received' // User received this (match ended it)
    };
    
    if (!appState.feedbackReceived) appState.feedbackReceived = [];
    appState.feedbackReceived.unshift(feedbackEntry);
    
    // Clear connection state
    appState.activeConnection = null;
    appState.oneMatch.status = 'waiting';
    appState.oneMatch.current = null;
    appState.oneMatch.connectionExpiresAt = null;
    appState.oneMatch.decisionMade = false;
    appState.oneMatch.isMutual = false;
    
    // Show profile again
    showProfile('match_ended_by_other');
    
    // Reset conversation
    appState.conversation = {
        messages: [],
        dateReadiness: 0,
        suggestedDate: null,
        datePlanned: false,
        dateConfirmed: false,
        dateAccepted: false,
        calendarEvent: null
    };
    
    // Reset connection metrics
    appState.connectionMetrics = {
        messageCount: 0,
        avgResponseTime: '0m',
        compatibility: 0,
        dateReadiness: 0,
        connectedAt: null
    };
    
    // Save state
    saveUserData();
    
    // Show notification modal
    showMatchEndedModal(matchName);
    
    // Update chat list to show empty state
    const chatContent = document.getElementById('chatListContent');
    const emptyChats = document.getElementById('emptyChats');
    if (chatContent) chatContent.style.display = 'none';
    if (emptyChats) emptyChats.style.display = 'flex';
}

/**
 * Show modal when match ends the connection
 */
function showMatchEndedModal(matchName) {
    let modal = document.getElementById('matchEndedModal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'matchEndedModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 340px; text-align: center; padding: 32px;">
                <div style="font-size: 4rem; margin-bottom: 16px;">💔</div>
                <h3 style="margin-bottom: 12px;">Connection Ended</h3>
                <p style="color: var(--text-muted); margin-bottom: 24px;" id="matchEndedMessage">
                    ${matchName} has decided to move on. Don't worry - your next great match is waiting!
                </p>
                <button class="btn btn-primary" onclick="closeMatchEndedModal()" style="width: 100%;">
                    Find New Match
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        const messageEl = modal.querySelector('#matchEndedMessage');
        if (messageEl) {
            messageEl.textContent = `${matchName} has decided to move on. Don't worry - your next great match is waiting!`;
        }
    }
    
    modal.classList.add('active');
}

/**
 * Close match ended modal and find new match
 */
function closeMatchEndedModal() {
    const modal = document.getElementById('matchEndedModal');
    if (modal) {
        modal.classList.remove('active');
    }
    
    // Navigate to match screen and find new match
    showScreen('match');
    
    setTimeout(() => {
        findNextMatch();
    }, 500);
}

// ==========================================
// Photo Management
// ==========================================

// Available placeholder photos for demo
const availablePhotos = [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=400&fit=crop',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=400&fit=crop',
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&h=400&fit=crop',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=400&fit=crop',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&h=400&fit=crop',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=400&fit=crop',
    'https://images.unsplash.com/photo-1463453091185-61582044d556?w=300&h=400&fit=crop',
    'https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=300&h=400&fit=crop'
];

let currentPhotoIndex = 0;

// ==========================================
// Profile Setup Photo Functions
// ==========================================

let currentSetupPhotoSlot = 0;

/**
 * Open gallery to select photo for setup
 */
function selectSetupPhoto(slotIndex) {
    currentSetupPhotoSlot = slotIndex;
    const fileInput = document.getElementById('setupPhotoInput');
    if (fileInput) {
        fileInput.click();
    }
}

/**
 * Handle photo selection from gallery during setup
 */
function handleSetupPhotoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('Image must be less than 5MB', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const imageData = e.target.result;
        
        // Initialize photos array if needed
        if (!appState.user.photos) {
            appState.user.photos = [];
        }
        
        // Add or replace photo at the slot
        appState.user.photos[currentSetupPhotoSlot] = imageData;
        
        // Update the UI
        updateSetupPhotoSlot(currentSetupPhotoSlot, imageData);
        updateSetupPhotoCount();
        
        // Save progress
        autoSave();
        
        showToast('Photo added!', 'success');
    };
    
    reader.readAsDataURL(file);
    
    // Reset file input so same file can be selected again
    event.target.value = '';
}

/**
 * Update a photo slot in the setup grid
 */
function updateSetupPhotoSlot(index, imageData) {
    const slot = document.getElementById(`setupPhotoSlot${index}`);
    if (!slot) return;
    
    // Check if already has an image
    let img = slot.querySelector('img');
    
    if (imageData) {
        if (!img) {
            img = document.createElement('img');
            img.alt = 'Your photo';
            slot.innerHTML = '';
            slot.appendChild(img);
        }
        img.src = imageData;
        
        // Add remove button
        if (!slot.querySelector('.remove-photo-btn')) {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-photo-btn';
            removeBtn.innerHTML = '×';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                removeSetupPhoto(index);
            };
            slot.appendChild(removeBtn);
        }
        
        slot.classList.add('has-photo');
    } else {
        // Reset to placeholder
        const isMain = index === 0;
        slot.innerHTML = `
            <div class="photo-placeholder">
                <svg width="${isMain ? '32' : '24'}" height="${isMain ? '32' : '24'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    ${isMain ? `
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <path d="M21 15l-5-5L5 21"/>
                    ` : `
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    `}
                </svg>
                ${isMain ? '<span>Main photo</span>' : ''}
            </div>
        `;
        slot.classList.remove('has-photo');
    }
}

/**
 * Remove a photo from setup
 */
function removeSetupPhoto(index) {
    if (appState.user.photos && appState.user.photos[index]) {
        appState.user.photos[index] = null;
        updateSetupPhotoSlot(index, null);
        updateSetupPhotoCount();
        autoSave();
        showToast('Photo removed', 'info');
    }
}

/**
 * Update the photo count and continue button state
 */
function updateSetupPhotoCount() {
    const photos = appState.user.photos || [];
    const count = photos.filter(p => p !== null && p !== undefined).length;
    
    const countEl = document.getElementById('setupPhotoCount');
    const continueBtn = document.getElementById('setupContinueBtn');
    
    if (countEl) {
        countEl.textContent = `${count} of 6 photos added`;
    }
    
    if (continueBtn) {
        if (count >= 2) {
            continueBtn.disabled = false;
            continueBtn.textContent = 'Continue';
        } else {
            continueBtn.disabled = true;
            continueBtn.textContent = `Add at least ${2 - count} more photo${2 - count > 1 ? 's' : ''} to continue`;
        }
    }
}

/**
 * Continue from photo setup to payment (Step 4 → Step 5)
 */
function continueFromPhotoSetup() {
    const photos = appState.user.photos || [];
    const count = photos.filter(p => p !== null && p !== undefined).length;
    
    if (count < 2) {
        showToast('Please add at least 2 photos', 'error');
        return;
    }
    
    // Photos is now Step 4, go to Payment (Step 5)
    showScreen('payment');
}

/**
 * Continue from profile details to photos (Step 3 → Step 4)
 */
function continueFromProfileDetails() {
    // Collect all the profile details
    const gender = document.querySelector('#setupGenderGroup .toggle-btn.active')?.dataset?.value || '';
    const location = document.getElementById('setupLocation')?.value || '';
    const occupation = document.getElementById('setupOccupation')?.value || '';
    const education = document.getElementById('setupEducation')?.value || '';
    const height = document.getElementById('setupHeight')?.value || '';
    const bodyType = document.getElementById('setupBodyType')?.value || '';
    const drinking = document.getElementById('setupDrinking')?.value || '';
    const smoking = document.getElementById('setupSmoking')?.value || '';
    const exercise = document.getElementById('setupExercise')?.value || '';
    const children = document.getElementById('setupChildren')?.value || '';
    const religion = document.getElementById('setupReligion')?.value || '';
    const bio = document.getElementById('setupBio')?.value || '';
    
    // Validate required fields
    if (!gender) {
        showToast('Please select your gender', 'error');
        return;
    }
    
    // Save to appState
    appState.user.gender = gender;
    appState.user.location = location;
    appState.user.occupation = occupation;
    appState.user.education = education;
    appState.user.height = height;
    appState.user.bodyType = bodyType;
    appState.user.drinking = drinking;
    appState.user.smoking = smoking;
    appState.user.exercise = exercise;
    appState.user.children = children;
    appState.user.religion = religion;
    appState.user.bio = bio;
    
    // Save progress
    autoSave();
    
    // Go to photos (Step 4)
    showScreen('profile-setup');
}

/**
 * Select gender during profile setup
 */
function selectSetupGender(gender) {
    // Remove active class from all buttons
    document.querySelectorAll('#setupGenderGroup .toggle-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to selected button
    const selectedBtn = document.querySelector(`#setupGenderGroup .toggle-btn[data-value="${gender}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }
    
    appState.user.gender = gender;
}

/**
 * Initialize setup photo grid with existing photos
 */
function initSetupPhotoGrid() {
    const photos = appState.user.photos || [];
    
    for (let i = 0; i < 6; i++) {
        if (photos[i]) {
            updateSetupPhotoSlot(i, photos[i]);
        }
    }
    
    updateSetupPhotoCount();
}

// Legacy function for backwards compatibility
function addPhoto(index) {
    const photoSlots = document.querySelectorAll('.photo-slot');
    const slot = photoSlots[index];
    
    // Simulate photo selection
    const placeholderPhotos = [
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=400&fit=crop',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=400&fit=crop',
        'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&h=400&fit=crop',
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=400&fit=crop'
    ];
    
    if (!slot.querySelector('img')) {
        const img = document.createElement('img');
        img.src = placeholderPhotos[index];
        img.alt = 'Your photo';
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: inherit;';
        
        slot.innerHTML = '';
        slot.appendChild(img);
        slot.style.border = 'none';
        
        appState.user.photos.push(placeholderPhotos[index]);
    }
}

/**
 * Change profile photo from My Profile screen
 */
function changeProfilePhoto() {
    // Cycle through available photos
    currentPhotoIndex = (currentPhotoIndex + 1) % availablePhotos.length;
    const newPhoto = availablePhotos[currentPhotoIndex];
    
    // Update main profile photo
    const mainPhoto = document.getElementById('mainProfilePhoto');
    if (mainPhoto) {
        mainPhoto.style.opacity = '0.5';
        setTimeout(() => {
            mainPhoto.src = newPhoto;
            mainPhoto.style.opacity = '1';
        }, 150);
    }
    
    // Update edit profile photo too
    const editPhoto = document.getElementById('editPhoto0');
    if (editPhoto) {
        editPhoto.src = newPhoto;
    }
    
    // Save to state
    appState.user.photos[0] = newPhoto;
    autoSave();
    
    // Show feedback
    showToast('Photo updated!');
}

/**
 * Change photo in Edit Profile screen
 */
function changePhoto(index) {
    // Cycle through available photos
    currentPhotoIndex = (currentPhotoIndex + 1) % availablePhotos.length;
    const newPhoto = availablePhotos[currentPhotoIndex];
    
    const photoEl = document.getElementById('editPhoto' + index);
    const slot = photoEl?.closest('.edit-photo-slot');
    
    if (slot && slot.classList.contains('empty')) {
        // Adding new photo to empty slot
        slot.classList.remove('empty');
        slot.innerHTML = `
            <img src="${newPhoto}" alt="Photo ${index + 1}" id="editPhoto${index}">
            <div class="photo-overlay">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
            </div>
        `;
    } else if (photoEl) {
        // Changing existing photo
        photoEl.style.opacity = '0.5';
        setTimeout(() => {
            photoEl.src = newPhoto;
            photoEl.style.opacity = '1';
        }, 150);
    }
    
    // Update main profile photo if changing photo 0
    if (index === 0) {
        const mainPhoto = document.getElementById('mainProfilePhoto');
        if (mainPhoto) {
            mainPhoto.src = newPhoto;
        }
    }
    
    // Save to state
    if (!appState.user.photos) appState.user.photos = [];
    appState.user.photos[index] = newPhoto;
    autoSave();
}

/**
 * Toggle interest selection
 */
function toggleInterest(button) {
    const selectedCount = document.querySelectorAll('.interest-chip.selected').length;
    
    if (button.classList.contains('selected')) {
        button.classList.remove('selected');
    } else if (selectedCount < 6) {
        button.classList.add('selected');
    } else {
        showToast('Maximum 6 interests allowed');
    }
}

/**
 * Select looking for option
 */
function selectLookingFor(button, value) {
    // Remove selected from all options
    document.querySelectorAll('.looking-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    // Add selected to clicked option
    button.classList.add('selected');
    
    // Update state
    appState.user.preferences.lookingFor = value;
}

/**
 * Update character count for bio
 */
function updateCharCount() {
    const bio = document.getElementById('editBio');
    const charCount = document.getElementById('bioCharCount');
    
    if (bio && charCount) {
        charCount.textContent = `${bio.value.length}/300`;
    }
}

/**
 * Initialize edit profile screen with user data
 */
function initEditProfileScreen() {
    // Populate photo preview with user's photos
    populateEditProfilePhotos();
    
    // Populate form fields with user data
    const firstNameInput = document.getElementById('editFirstName');
    const ageInput = document.getElementById('editAge');
    const birthdayInput = document.getElementById('editBirthday');
    const locationInput = document.getElementById('editLocation');
    const occupationInput = document.getElementById('editOccupation');
    const bioInput = document.getElementById('editBio');
    
    // Detail fields
    const heightSelect = document.getElementById('editHeight');
    const bodyTypeSelect = document.getElementById('editBodyType');
    const educationSelect = document.getElementById('editEducation');
    const drinkingSelect = document.getElementById('editDrinking');
    const smokingSelect = document.getElementById('editSmoking');
    const exerciseSelect = document.getElementById('editExercise');
    const childrenSelect = document.getElementById('editChildren');
    const religionSelect = document.getElementById('editReligion');
    
    if (firstNameInput) firstNameInput.value = appState.user.firstName || '';
    
    // Set age from saved age or calculate from birthday
    if (ageInput) {
        if (appState.user.age) {
            ageInput.value = appState.user.age;
        } else if (appState.user.birthday) {
            ageInput.value = calculateAge(appState.user.birthday) || '';
        }
    }
    
    // Set birthday from user data
    if (birthdayInput && appState.user.birthday) {
        birthdayInput.value = appState.user.birthday;
    }
    
    if (locationInput) locationInput.value = appState.user.location || '';
    if (occupationInput) occupationInput.value = appState.user.occupation || '';
    if (bioInput) bioInput.value = appState.user.bio || '';
    
    // Set detail fields
    if (heightSelect && appState.user.height) heightSelect.value = appState.user.height;
    if (bodyTypeSelect && appState.user.bodyType) bodyTypeSelect.value = appState.user.bodyType;
    if (educationSelect && appState.user.education) educationSelect.value = appState.user.education;
    if (drinkingSelect && appState.user.drinking) drinkingSelect.value = appState.user.drinking;
    if (smokingSelect && appState.user.smoking) smokingSelect.value = appState.user.smoking;
    if (exerciseSelect && appState.user.exercise) exerciseSelect.value = appState.user.exercise;
    if (childrenSelect && appState.user.children) childrenSelect.value = appState.user.children;
    if (religionSelect && appState.user.religion) religionSelect.value = appState.user.religion;
    
    // Populate interests
    const userInterests = appState.user.interests || [];
    document.querySelectorAll('.interest-chip').forEach(chip => {
        const interest = chip.textContent.trim();
        if (userInterests.includes(interest)) {
            chip.classList.add('selected');
        } else {
            chip.classList.remove('selected');
        }
    });
    
    // Set looking for selection
    if (appState.user.lookingFor) {
        document.querySelectorAll('.looking-option').forEach(option => {
            if (option.dataset.value === appState.user.lookingFor) {
                option.classList.add('selected');
            } else {
                option.classList.remove('selected');
            }
        });
    }
}

/**
 * Populate edit profile photo preview with user's uploaded photos
 */
function populateEditProfilePhotos() {
    const container = document.getElementById('editProfilePhotoPreview');
    if (!container) return;
    
    const photos = appState.user.photos || [];
    let html = '';
    
    // Show up to 3 photos
    const displayPhotos = photos.slice(0, 3);
    const remainingCount = photos.length - 3;
    
    if (displayPhotos.length === 0) {
        // No photos - show placeholder
        html = `
            <div class="photo-thumb add-more" onclick="showScreen('manage-photos')">
                <span>+</span>
            </div>
        `;
    } else {
        // Show user's photos
        displayPhotos.forEach((photo, index) => {
            html += `<img src="${photo}" alt="Photo ${index + 1}" class="photo-thumb">`;
        });
        
        // Show remaining count or add more button
        if (remainingCount > 0) {
            html += `<div class="photo-thumb add-more" onclick="showScreen('manage-photos')">+${remainingCount}</div>`;
        } else if (photos.length < 6) {
            html += `<div class="photo-thumb add-more" onclick="showScreen('manage-photos')">+</div>`;
        }
    }
    
    container.innerHTML = html;
}

/**
 * Save profile and go back
 */
function saveProfileAndGoBack() {
    // Gather all profile data
    const firstName = document.getElementById('editFirstName')?.value || 'Matt';
    const age = document.getElementById('editAge')?.value || '29';
    const birthday = document.getElementById('editBirthday')?.value || '';
    const location = document.getElementById('editLocation')?.value || 'New York, NY';
    const occupation = document.getElementById('editOccupation')?.value || '';
    const bio = document.getElementById('editBio')?.value || '';
    const gender = document.getElementById('editGender')?.value || appState.user.gender || '';
    
    // Gather detail fields
    const height = document.getElementById('editHeight')?.value || '';
    const bodyType = document.getElementById('editBodyType')?.value || '';
    const education = document.getElementById('editEducation')?.value || '';
    const drinking = document.getElementById('editDrinking')?.value || '';
    const smoking = document.getElementById('editSmoking')?.value || '';
    const exercise = document.getElementById('editExercise')?.value || '';
    const children = document.getElementById('editChildren')?.value || '';
    const religion = document.getElementById('editReligion')?.value || '';
    
    // Gather selected interests
    const selectedInterests = [];
    document.querySelectorAll('.interest-chip.selected').forEach(chip => {
        selectedInterests.push(chip.textContent.trim());
    });
    
    // Get looking for selection
    const lookingForSelected = document.querySelector('.looking-option.selected');
    const lookingFor = lookingForSelected?.dataset?.value || '';
    
    // Update state - ALL fields sync with admin dashboard
    appState.user.firstName = firstName;
    appState.user.age = parseInt(age);
    appState.user.birthday = birthday;
    appState.user.location = location;
    appState.user.occupation = occupation;
    appState.user.bio = bio;
    appState.user.gender = gender;
    appState.user.height = height;
    appState.user.bodyType = bodyType;
    appState.user.education = education;
    appState.user.drinking = drinking;
    appState.user.smoking = smoking;
    appState.user.exercise = exercise;
    appState.user.children = children;
    appState.user.religion = religion;
    appState.user.interests = selectedInterests;
    appState.user.lookingFor = lookingFor;
    
    // Update coordinates for distance calculations
    updateUserCoordinates();
    
    // Set last updated timestamp for admin dashboard sync
    appState.user.lastUpdated = new Date().toISOString();
    
    console.log('💾 Saving profile (syncs with admin):', {
        firstName,
        age: appState.user.age,
        birthday,
        location,
        occupation,
        photos: appState.user.photos?.filter(p => p)?.length || 0
    });
    
    // Update display on My Profile screen
    const displayName = document.getElementById('profileDisplayName');
    const displayLocation = document.getElementById('profileDisplayLocation');
    
    if (displayName) displayName.textContent = `${firstName}, ${age}`;
    if (displayLocation) displayLocation.textContent = location;
    
    // Save to localStorage AND broadcast to admin dashboard immediately
    saveUserData();
    
    // Force sync to AWS for cross-device access
    forceSyncToAWS();
    
    // Show feedback and go back
    showToast('Profile saved & synced to cloud! ☁️');
    showScreen('my-profile');
}

// ==========================================
// Emergency Contact Functions
// ==========================================

/**
 * Show the add/edit emergency contact modal
 */
function showAddEmergencyContact() {
    const modal = document.getElementById('emergency-contact-modal');
    if (!modal) return;
    
    // Pre-fill if contact already exists
    const contact = appState.user?.emergencyContact;
    if (contact) {
        const nameInput = document.getElementById('emergencyNameInput');
        const phoneInput = document.getElementById('emergencyPhoneInput');
        const relationshipSelect = document.getElementById('emergencyRelationship');
        
        if (nameInput) nameInput.value = contact.name || '';
        if (phoneInput) phoneInput.value = contact.phone || '';
        if (relationshipSelect) relationshipSelect.value = contact.relationship || '';
    }
    
    // Update preview with user name
    const previewUserName = document.getElementById('previewUserName');
    if (previewUserName) previewUserName.textContent = appState.user?.firstName || 'You';
    
    modal.classList.add('active');
}

/**
 * Save emergency contact
 */
function saveEmergencyContact() {
    const name = document.getElementById('emergencyNameInput')?.value?.trim();
    const phone = document.getElementById('emergencyPhoneInput')?.value?.trim();
    const relationship = document.getElementById('emergencyRelationship')?.value || '';
    
    if (!name) {
        showToast('Please enter a contact name', 'error');
        return;
    }
    
    if (!phone) {
        showToast('Please enter a phone number', 'error');
        return;
    }
    
    // Validate phone number (basic)
    const phoneClean = phone.replace(/\D/g, '');
    if (phoneClean.length < 10) {
        showToast('Please enter a valid phone number', 'error');
        return;
    }
    
    // Save to state
    appState.user.emergencyContact = {
        name: name,
        phone: phone,
        phoneFormatted: formatPhoneNumber(phone),
        relationship: relationship,
        addedAt: new Date().toISOString(),
        alertsEnabled: true,
        alertHistory: appState.user.emergencyContact?.alertHistory || []
    };
    
    // Update UI
    updateEmergencyContactDisplay();
    
    // Save to localStorage immediately (not debounced)
    saveUserData();
    
    // Broadcast to admin dashboard
    if (window.adminSyncChannel) {
        window.adminSyncChannel.postMessage({
            type: 'emergency_contact_updated',
            email: appState.user?.email,
            contact: appState.user.emergencyContact,
            timestamp: Date.now()
        });
    }
    
    closeModal();
    showToast('Emergency contact saved! 🛡️ They will be notified when you go on dates.', 'success');
    
    console.log('🛡️ Emergency contact saved:', appState.user.emergencyContact);
}

/**
 * Remove emergency contact
 */
function removeEmergencyContact() {
    if (!confirm('Remove your emergency contact?')) return;
    
    appState.user.emergencyContact = null;
    updateEmergencyContactDisplay();
    autoSave();
    showToast('Emergency contact removed');
}

/**
 * Update emergency contact display on edit profile page
 */
function updateEmergencyContactDisplay() {
    const contact = appState.user?.emergencyContact;
    const noContactEl = document.getElementById('noEmergencyContact');
    const contactAddedEl = document.getElementById('emergencyContactAdded');
    const contactNameEl = document.getElementById('emergencyContactName');
    const contactPhoneEl = document.getElementById('emergencyContactPhone');
    const alertsBadge = document.getElementById('alertsStatusBadge');
    const quickActions = document.getElementById('quickSafetyActions');
    const alertHistorySection = document.getElementById('alertHistorySection');
    const alertHistoryList = document.getElementById('alertHistoryList');
    
    if (contact && contact.name) {
        if (noContactEl) noContactEl.style.display = 'none';
        if (contactAddedEl) contactAddedEl.style.display = 'flex';
        if (contactNameEl) contactNameEl.textContent = contact.name;
        if (contactPhoneEl) contactPhoneEl.textContent = formatPhoneNumber(contact.phone);
        
        // Update alerts badge
        if (alertsBadge) {
            if (contact.alertsEnabled !== false) {
                alertsBadge.textContent = 'Alerts ON';
                alertsBadge.style.background = 'var(--success)';
            } else {
                alertsBadge.textContent = 'Alerts OFF';
                alertsBadge.style.background = 'var(--text-muted)';
            }
        }
        
        // Show quick actions when matched
        if (quickActions && (appState.activeConnection || appState.oneMatch?.current)) {
            quickActions.style.display = 'block';
        } else if (quickActions) {
            quickActions.style.display = 'none';
        }
        
        // Show alert history if any
        if (contact.alertHistory && contact.alertHistory.length > 0) {
            if (alertHistorySection) alertHistorySection.style.display = 'block';
            if (alertHistoryList) {
                alertHistoryList.innerHTML = contact.alertHistory.slice(0, 5).map(alert => {
                    const date = new Date(alert.sentAt);
                    const timeStr = date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                    let icon = '📱';
                    let typeLabel = 'Date Alert';
                    
                    if (alert.type === 'sos') {
                        icon = '🚨';
                        typeLabel = 'SOS';
                    } else if (alert.type === 'check_in') {
                        icon = '✅';
                        typeLabel = 'Check In';
                    }
                    
                    return `
                        <div style="display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border-light); font-size: 0.75rem;">
                            <span>${icon}</span>
                            <span style="flex: 1;">${typeLabel}</span>
                            <span style="color: var(--text-muted);">${timeStr}</span>
                        </div>
                    `;
                }).join('');
            }
        } else {
            if (alertHistorySection) alertHistorySection.style.display = 'none';
        }
    } else {
        if (noContactEl) noContactEl.style.display = 'flex';
        if (contactAddedEl) contactAddedEl.style.display = 'none';
        if (quickActions) quickActions.style.display = 'none';
        if (alertHistorySection) alertHistorySection.style.display = 'none';
    }
}

/**
 * Format phone number for display
 */
function formatPhoneNumber(phone) {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
    }
    return phone;
}

/**
 * Send safety notification to emergency contact
 */
function sendSafetyNotification(dateDetails) {
    const contact = appState.user?.emergencyContact;
    if (!contact) {
        console.log('No emergency contact set');
        return false;
    }
    
    // Check if alerts are enabled
    if (contact.alertsEnabled === false) {
        console.log('Emergency alerts are disabled');
        return false;
    }
    
    const match = appState.activeConnection || appState.oneMatch?.current;
    const user = appState.user;
    
    // Build notification message
    const alert = {
        id: 'ALERT-' + Date.now(),
        to: contact.phone,
        toName: contact.name,
        relationship: contact.relationship,
        userName: user?.firstName || 'Your friend',
        matchName: match?.name || 'their date',
        matchAge: match?.age || '',
        matchPhoto: match?.photo || '',
        venue: dateDetails?.venue?.name || 'a venue',
        venueAddress: dateDetails?.venue?.address || '',
        date: dateDetails?.date || 'Today',
        time: dateDetails?.time || 'Soon',
        sentAt: new Date().toISOString(),
        status: 'sent',
        type: 'date_scheduled'
    };
    
    // Compose the actual message text
    alert.messageText = `Hi ${contact.name}! ${user?.firstName || 'Your friend'} is going on a date through OITH.\n\n` +
        `Match: ${match?.name || 'Someone'}, ${match?.age || ''}\n` +
        `Location: ${dateDetails?.venue?.name || 'TBD'}${dateDetails?.venue?.address ? ', ' + dateDetails.venue.address : ''}\n` +
        `Time: ${dateDetails?.date || 'Today'} at ${dateDetails?.time || 'Soon'}\n\n` +
        `If you don't hear from them, check in! 💙`;
    
    // Actually send the SMS via device's native messaging app
    sendSMSToPhone(contact.phone, alert.messageText, 'date_scheduled');
    
    console.log('📱 Safety notification sent:', alert);
    console.log('📱 Message:', alert.messageText);
    
    // Store in emergency contact's alert history
    if (!appState.user.emergencyContact.alertHistory) {
        appState.user.emergencyContact.alertHistory = [];
    }
    appState.user.emergencyContact.alertHistory.unshift(alert);
    
    // Also store in global safety notifications
    if (!appState.safetyNotifications) {
        appState.safetyNotifications = [];
    }
    appState.safetyNotifications.push(alert);
    
    // Save immediately
    saveUserData();
    
    // Broadcast to admin dashboard
    if (window.adminSyncChannel) {
        window.adminSyncChannel.postMessage({
            type: 'safety_alert_sent',
            email: appState.user?.email,
            alert: alert,
            timestamp: Date.now()
        });
    }
    
    // Show confirmation modal
    showSafetyNotificationSent(contact, dateDetails, match);
    
    showToast(`🛡️ Safety alert sent to ${contact.name}!`, 'success');
    
    return true;
}

/**
 * Send SMS to a phone number using device's native messaging app
 * Falls back to showing a modal with options if SMS URL doesn't work
 * @param {string} phoneNumber - Phone number to send to
 * @param {string} message - Message text
 * @param {string} alertType - Type of alert for tracking
 */
function sendSMSToPhone(phoneNumber, message, alertType = 'general') {
    if (!phoneNumber) {
        console.error('❌ No phone number provided');
        return false;
    }
    
    // Clean the phone number (remove formatting)
    const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
    
    // Encode the message for URL
    const encodedMessage = encodeURIComponent(message);
    
    // Try different SMS URL schemes based on device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    console.log(`📱 Sending SMS to ${cleanPhone}`, { isMobile, isIOS, alertType });
    
    if (isMobile) {
        // Mobile device - open native SMS app
        let smsUrl;
        if (isIOS) {
            // iOS uses &body= syntax
            smsUrl = `sms:${cleanPhone}&body=${encodedMessage}`;
        } else {
            // Android uses ?body= syntax
            smsUrl = `sms:${cleanPhone}?body=${encodedMessage}`;
        }
        
        console.log('📱 Opening SMS app:', smsUrl);
        
        // Open SMS app
        window.location.href = smsUrl;
        return true;
    } else {
        // Desktop - show modal with options
        showSMSSendModal(cleanPhone, message, alertType);
        return true;
    }
}

/**
 * Show modal for sending SMS on desktop (with copy/email options)
 */
function showSMSSendModal(phoneNumber, message, alertType) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('sms-send-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'sms-send-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <button class="modal-close" onclick="closeSMSModal()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 3rem; margin-bottom: 16px;">📱</div>
                    <h3 style="margin-bottom: 12px;">Send Safety Alert</h3>
                    <p style="color: var(--text-muted); margin-bottom: 20px;">
                        Send this message to <strong id="smsPhoneDisplay"></strong>
                    </p>
                    <div id="smsMessagePreview" style="background: var(--bg-secondary); padding: 16px; border-radius: 12px; text-align: left; font-size: 0.9rem; margin-bottom: 20px; white-space: pre-wrap; max-height: 200px; overflow-y: auto;"></div>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <button class="btn btn-primary" onclick="copySMSAndOpen()" style="width: 100%;">
                            📋 Copy Message & Open SMS
                        </button>
                        <button class="btn btn-secondary" onclick="sendViaWhatsApp()" style="width: 100%;">
                            💬 Send via WhatsApp
                        </button>
                        <button class="btn btn-secondary" onclick="sendViaEmail()" style="width: 100%;">
                            ✉️ Send via Email Instead
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // Store data for the modal actions
    modal.dataset.phone = phoneNumber;
    modal.dataset.message = message;
    modal.dataset.alertType = alertType;
    
    // Update modal content
    document.getElementById('smsPhoneDisplay').textContent = formatPhoneNumber(phoneNumber);
    document.getElementById('smsMessagePreview').textContent = message;
    
    // Show modal
    modal.classList.add('active');
}

/**
 * Close SMS send modal
 */
function closeSMSModal() {
    const modal = document.getElementById('sms-send-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Copy SMS message to clipboard and open default SMS app
 */
function copySMSAndOpen() {
    const modal = document.getElementById('sms-send-modal');
    const message = modal?.dataset.message || '';
    const phone = modal?.dataset.phone || '';
    
    // Copy to clipboard
    navigator.clipboard.writeText(message).then(() => {
        showToast('📋 Message copied! Opening SMS...', 'success');
        
        // Try to open SMS app
        setTimeout(() => {
            window.open(`sms:${phone}`, '_blank');
        }, 500);
        
        closeSMSModal();
    }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('Could not copy message', 'error');
    });
}

/**
 * Send safety alert via WhatsApp
 */
function sendViaWhatsApp() {
    const modal = document.getElementById('sms-send-modal');
    const message = modal?.dataset.message || '';
    const phone = modal?.dataset.phone || '';
    
    // WhatsApp URL scheme
    const whatsappUrl = `https://wa.me/${phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
    closeSMSModal();
    showToast('💬 Opening WhatsApp...', 'success');
}

/**
 * Send safety alert via email as fallback
 */
function sendViaEmail() {
    const modal = document.getElementById('sms-send-modal');
    const message = modal?.dataset.message || '';
    const alertType = modal?.dataset.alertType || 'Safety Alert';
    
    const subject = `OITH Safety Alert: ${alertType === 'sos' ? '🚨 EMERGENCY SOS' : 'Date Scheduled'}`;
    const emailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    
    window.open(emailUrl, '_blank');
    closeSMSModal();
    showToast('✉️ Opening email...', 'success');
}

/**
 * Send check-in alert to emergency contact
 */
function sendCheckInAlert() {
    const contact = appState.user?.emergencyContact;
    if (!contact) {
        showToast('No emergency contact set', 'error');
        return false;
    }
    
    const match = appState.activeConnection || appState.oneMatch?.current;
    const user = appState.user;
    
    const alert = {
        id: 'ALERT-' + Date.now(),
        to: contact.phone,
        toName: contact.name,
        userName: user?.firstName || 'Your friend',
        matchName: match?.name || 'their date',
        sentAt: new Date().toISOString(),
        status: 'sent',
        type: 'check_in'
    };
    
    alert.messageText = `Safety check-in from OITH: ${user?.firstName || 'Your friend'} wants you to know they're doing great and feeling safe! 💚\n\nNo action needed - just keeping you in the loop!`;
    
    // Actually send the SMS
    sendSMSToPhone(contact.phone, alert.messageText, 'check_in');
    
    console.log('📱 Check-in alert sent:', alert);
    
    // Store in history
    if (!appState.user.emergencyContact.alertHistory) {
        appState.user.emergencyContact.alertHistory = [];
    }
    appState.user.emergencyContact.alertHistory.unshift(alert);
    
    saveUserData();
    showToast(`✅ Check-in sent to ${contact.name}!`, 'success');
    
    return true;
}

/**
 * Send SOS alert to emergency contact (urgent)
 */
function sendSOSAlert(customMessage = '') {
    const contact = appState.user?.emergencyContact;
    if (!contact) {
        showToast('No emergency contact set!', 'error');
        return false;
    }
    
    const match = appState.activeConnection || appState.oneMatch?.current;
    const user = appState.user;
    const userLocation = appState.user?.location || 'Unknown location';
    
    const alert = {
        id: 'SOS-' + Date.now(),
        to: contact.phone,
        toName: contact.name,
        userName: user?.firstName || 'Your friend',
        matchName: match?.name || 'unknown',
        sentAt: new Date().toISOString(),
        status: 'sent',
        type: 'sos',
        urgent: true
    };
    
    alert.messageText = `🚨🚨 URGENT SOS ALERT 🚨🚨\n\n` +
        `${user?.firstName || 'Your friend'} needs help NOW!\n\n` +
        `📍 Last known area: ${userLocation}\n` +
        `👤 Was meeting: ${match?.name || 'someone'} from OITH\n` +
        (customMessage ? `📝 Message: ${customMessage}\n\n` : '\n') +
        `⚠️ PLEASE TRY TO REACH THEM IMMEDIATELY!\n\n` +
        `If you cannot reach them, consider calling emergency services.`;
    
    // Actually send the SMS - this is urgent!
    sendSMSToPhone(contact.phone, alert.messageText, 'sos');
    
    console.log('🚨 SOS ALERT SENT:', alert);
    
    // Store in history
    if (!appState.user.emergencyContact.alertHistory) {
        appState.user.emergencyContact.alertHistory = [];
    }
    appState.user.emergencyContact.alertHistory.unshift(alert);
    
    saveUserData();
    
    // Broadcast urgent alert to admin
    if (window.adminSyncChannel) {
        window.adminSyncChannel.postMessage({
            type: 'sos_alert',
            email: appState.user?.email,
            alert: alert,
            timestamp: Date.now()
        });
    }
    
    showToast(`🚨 SOS sent to ${contact.name}!`, 'success');
    
    return true;
}

/**
 * Toggle emergency alerts on/off
 */
function toggleEmergencyAlerts() {
    if (!appState.user?.emergencyContact) {
        showToast('Please add an emergency contact first', 'error');
        return;
    }
    
    appState.user.emergencyContact.alertsEnabled = !appState.user.emergencyContact.alertsEnabled;
    saveUserData();
    
    const status = appState.user.emergencyContact.alertsEnabled ? 'enabled' : 'disabled';
    showToast(`Emergency alerts ${status}`, 'info');
    updateEmergencyContactDisplay();
}

/**
 * Get emergency contact alert history
 */
function getAlertHistory() {
    return appState.user?.emergencyContact?.alertHistory || [];
}

/**
 * Show safety notification sent confirmation
 */
function showSafetyNotificationSent(contact, dateDetails, match) {
    const modal = document.getElementById('safety-notification-modal');
    if (!modal) return;
    
    // Update modal content
    const sentToName = document.getElementById('sentToName');
    const sentToPhone = document.getElementById('sentToPhone');
    const sentVenue = document.getElementById('sentVenue');
    const sentMatchName = document.getElementById('sentMatchName');
    const sentDateTime = document.getElementById('sentDateTime');
    
    if (sentToName) sentToName.textContent = contact.name;
    if (sentToPhone) sentToPhone.textContent = formatPhoneNumber(contact.phone);
    if (sentVenue) sentVenue.textContent = dateDetails?.venue?.name || 'the venue';
    if (sentMatchName) sentMatchName.textContent = match?.name || 'your match';
    if (sentDateTime) sentDateTime.textContent = `${dateDetails?.date || 'Today'} at ${dateDetails?.time || 'the scheduled time'}`;
    
    modal.classList.add('active');
}

/**
 * Initialize edit profile screen
 */
function initEditProfileScreen() {
    const user = appState.user;
    if (!user) return;
    
    // Populate basic fields
    const firstName = document.getElementById('editFirstName');
    const age = document.getElementById('editAge');
    const birthday = document.getElementById('editBirthday');
    const location = document.getElementById('editLocation');
    const occupation = document.getElementById('editOccupation');
    const bio = document.getElementById('editBio');
    
    if (firstName) firstName.value = user.firstName || '';
    if (age) age.value = user.age || '';
    if (birthday) {
        birthday.value = user.birthday || '';
        // Display age if birthday is set
        if (user.birthday) {
            const calculatedAge = calculateAgeFromDate(user.birthday);
            const ageDisplay = document.getElementById('editAgeDisplay');
            if (ageDisplay && calculatedAge) {
                ageDisplay.textContent = `🎂 ${calculatedAge} years old`;
                ageDisplay.style.color = 'var(--accent)';
            }
        }
    }
    if (location) location.value = user.location || '';
    if (occupation) occupation.value = user.occupation || '';
    if (bio) bio.value = user.bio || '';
    
    // Populate detail fields
    const height = document.getElementById('editHeight');
    const bodyType = document.getElementById('editBodyType');
    const education = document.getElementById('editEducation');
    const drinking = document.getElementById('editDrinking');
    const smoking = document.getElementById('editSmoking');
    const exercise = document.getElementById('editExercise');
    const children = document.getElementById('editChildren');
    const religion = document.getElementById('editReligion');
    
    if (height) height.value = user.height || '';
    if (bodyType) bodyType.value = user.bodyType || '';
    if (education) education.value = user.education || '';
    if (drinking) drinking.value = user.drinking || '';
    if (smoking) smoking.value = user.smoking || '';
    if (exercise) exercise.value = user.exercise || '';
    if (children) children.value = user.children || '';
    if (religion) religion.value = user.religion || '';
    
    // Populate interests
    const interests = user.interests || [];
    document.querySelectorAll('.interest-chip').forEach(chip => {
        const interestName = chip.textContent.trim();
        if (interests.includes(interestName)) {
            chip.classList.add('selected');
        } else {
            chip.classList.remove('selected');
        }
    });
    
    // Populate looking for
    const lookingFor = user.lookingFor || '';
    document.querySelectorAll('.looking-option').forEach(option => {
        if (option.dataset?.value === lookingFor) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
    
    // Update emergency contact display
    updateEmergencyContactDisplay();
    
    // Populate edit profile photos
    populateEditProfilePhotos();
}

/**
 * Preview user's profile as others see it
 */
/**
 * Initialize feedback metrics screen with user data
 */
function initFeedbackMetricsScreen() {
    const user = appState.user;
    const metrics = appState.connectionMetrics || {};
    const matchHistory = appState.matchHistory || [];
    
    // Calculate stats from user data
    const totalMatches = (appState.passedMatches?.length || 0) + (appState.activeConnection ? 1 : 0) + (matchHistory.length || 0);
    
    // Count dates from match history
    let totalDates = appState.conversation?.datePlanned ? 1 : 0;
    matchHistory.forEach(m => {
        if (m.hadDate || m.datePlanned) totalDates++;
    });
    
    // Calculate response rate from actual messages
    const totalMessages = appState.conversation?.messages?.length || 0;
    const userMessages = (appState.conversation?.messages || []).filter(m => m.type === 'sent').length;
    const receivedMessages = totalMessages - userMessages;
    const responseRate = receivedMessages > 0 ? Math.round((userMessages / receivedMessages) * 100) : 0;
    
    // Calculate average messages per match
    let totalMessagesAllMatches = totalMessages;
    matchHistory.forEach(m => {
        totalMessagesAllMatches += (m.messageCount || 0);
    });
    const avgMessages = totalMatches > 0 ? Math.round(totalMessagesAllMatches / totalMatches) : 0;
    
    // Update overview stats
    const totalMatchesEl = document.getElementById('totalMatchesCount');
    if (totalMatchesEl) totalMatchesEl.textContent = totalMatches;
    
    const totalDatesEl = document.getElementById('totalDatesCount');
    if (totalDatesEl) totalDatesEl.textContent = totalDates;
    
    const responseRateEl = document.getElementById('responseRateValue');
    if (responseRateEl) responseRateEl.textContent = responseRate + '%';
    
    const avgConvoEl = document.getElementById('avgConvoLength');
    if (avgConvoEl) avgConvoEl.textContent = avgMessages;
    
    // Render the match activity chart with real data
    renderUserMatchActivityChart();
    
    // Update conversation insights
    const avgResponseTimeEl = document.getElementById('avgResponseTimeMetric');
    if (avgResponseTimeEl) avgResponseTimeEl.textContent = metrics.avgResponseTime || '8 minutes';
    
    const totalMessagesSentEl = document.getElementById('totalMessagesSent');
    if (totalMessagesSentEl) totalMessagesSentEl.textContent = metrics.messageCount || 156;
    
    // Update "Most Compatible Profile" based on actual match history
    updateMostCompatibleProfile();
    
    // Update shared interests based on user interests
    updateSharedInterestsMetrics(user.interests || ['Coffee', 'Photography', 'Hiking', 'Music', 'Travel']);
    
    // Render feedback sections with actual data
    renderFeedbackReceived();
    renderFeedbackGiven();
    
    // Update tips based on actual metrics
    updateTipsToImprove();
    
    // Update feedback summary stats
    const feedbackGiven = appState.feedbackGiven || [];
    const totalMatchesEndedEl = document.getElementById('totalMatchesEnded');
    if (totalMatchesEndedEl) totalMatchesEndedEl.textContent = feedbackGiven.length;
}

/**
 * Update shared interests metrics display
 */
function updateSharedInterestsMetrics(interests) {
    const interestsList = document.querySelector('.shared-interests-list');
    if (!interestsList || !interests.length) return;
    
    const interestEmojis = {
        'Coffee': '☕',
        'Photography': '📸',
        'Hiking': '🥾',
        'Music': '🎵',
        'Travel': '✈️',
        'Food': '🍕',
        'Fitness': '💪',
        'Art': '🎨',
        'Reading': '📚',
        'Movies': '🎬',
        'Gaming': '🎮',
        'Cooking': '👨‍🍳',
        'Wine': '🍷',
        'Yoga': '🧘',
        'Dancing': '💃'
    };
    
    // Generate random percentages for demo purposes (in production this would be real data)
    const topInterests = interests.slice(0, 5);
    let html = '';
    
    topInterests.forEach((interest, index) => {
        const percent = Math.max(85 - (index * 12), 35);
        const emoji = interestEmojis[interest] || '✨';
        html += `
            <div class="interest-metric">
                <span class="interest-name">${emoji} ${interest}</span>
                <div class="interest-bar-container">
                    <div class="interest-bar" style="width: ${percent}%"></div>
                </div>
                <span class="interest-percent">${percent}%</span>
            </div>
        `;
    });
    
    interestsList.innerHTML = html;
}

/**
 * Initialize profile preview screen
 */
function initProfilePreview() {
    // This is called when navigating to the screen via showScreen
    // Just populate the data, don't navigate again
    populateProfilePreview();
}

function previewProfile() {
    console.log('👁️ Preview Profile clicked');
    // Populate the preview data first
    populateProfilePreview();
    // Then navigate to the screen
    console.log('🚀 Navigating to my-profile-preview screen');
    showScreen('my-profile-preview');
    console.log('✅ showScreen called');
    showToast('This is how others see your profile');
}

function populateProfilePreview() {
    const user = appState.user;
    console.log('📋 Populating preview with user data:', user);
    
    // Update preview photo
    const previewPhoto = document.getElementById('previewMainPhoto');
    if (previewPhoto) {
        if (user.photos && user.photos[0]) {
            previewPhoto.src = user.photos[0];
        } else {
            previewPhoto.src = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop';
        }
    }
    
    // Update name and age
    const previewName = document.getElementById('previewName');
    if (previewName) {
        const age = user.age || calculateAge(user.birthday) || 29;
        previewName.textContent = `${user.firstName || 'You'}, ${age}`;
    }
    
    // Update occupation
    const previewOcc = document.getElementById('previewOccupation');
    if (previewOcc) {
        previewOcc.textContent = user.occupation || 'Add your occupation';
    }
    
    // Update location
    const previewLocation = document.getElementById('previewLocation');
    if (previewLocation) {
        previewLocation.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
            </svg>
            ${user.location || 'Add your location'}
        `;
    }
    
    // Update bio
    const previewBio = document.getElementById('previewBio');
    if (previewBio) {
        previewBio.textContent = user.bio || 'Add a bio to tell matches about yourself...';
    }
    
    // Update details - Height
    const previewHeight = document.getElementById('previewHeight');
    if (previewHeight) {
        previewHeight.textContent = user.height || 'Not set';
    }
    
    // Body Type
    const previewBodyType = document.getElementById('previewBodyType');
    if (previewBodyType) {
        previewBodyType.textContent = formatOption(user.bodyType) || 'Not set';
    }
    
    // Education
    const previewEducation = document.getElementById('previewEducation');
    if (previewEducation) {
        previewEducation.textContent = formatOption(user.education) || 'Not set';
    }
    
    // Drinking
    const previewDrinking = document.getElementById('previewDrinking');
    if (previewDrinking) {
        previewDrinking.textContent = formatOption(user.drinking) || 'Not set';
    }
    
    // Smoking
    const previewSmoking = document.getElementById('previewSmoking');
    if (previewSmoking) {
        previewSmoking.textContent = formatOption(user.smoking) || 'Not set';
    }
    
    // Exercise
    const previewExercise = document.getElementById('previewExercise');
    if (previewExercise) {
        previewExercise.textContent = formatOption(user.exercise) || 'Not set';
    }
    
    // Children
    const previewChildren = document.getElementById('previewChildren');
    if (previewChildren) {
        previewChildren.textContent = formatOption(user.children) || 'Not set';
    }
    
    // Religion
    const previewReligion = document.getElementById('previewReligion');
    if (previewReligion) {
        previewReligion.textContent = formatOption(user.religion) || 'Not set';
    }
    
    // Update interests
    const previewInterests = document.getElementById('previewInterests');
    if (previewInterests) {
        if (user.interests && user.interests.length > 0) {
            previewInterests.innerHTML = user.interests.map(interest => 
                `<span class="tag">${interest}</span>`
            ).join('');
        } else {
            previewInterests.innerHTML = '<span class="tag">Add your interests</span>';
        }
    }
    
    // Update looking for
    const previewLookingFor = document.getElementById('previewLookingFor');
    if (previewLookingFor) {
        const lookingForText = {
            'relationship': '💕 Long-term relationship',
            'casual': '😊 Something casual',
            'unsure': '🤷 Not sure yet',
            'long-term': '💕 Long-term relationship'
        };
        previewLookingFor.textContent = lookingForText[user.lookingFor] || 'Not specified';
    }
    
}

/**
 * Format option values for display
 */
function formatOption(value) {
    if (!value) return null;
    
    // Convert kebab-case or camelCase to Title Case
    return value
        .replace(/-/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
        .trim();
}

/**
 * Calculate age from birthday
 */
function calculateAge(birthday) {
    if (!birthday) return null;
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();
    
    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, type === 'error' ? 4000 : 2000);
}

// ==========================================
// Notification Settings
// ==========================================

/**
 * Initialize notification settings
 */
function initNotificationSettings() {
    // Set default notification preferences if not set
    if (!appState.user.notificationSettings) {
        appState.user.notificationSettings = {
            matches: true,
            messages: true,
            dates: true,
            safety: true
        };
    }
    
    // Update UI checkboxes
    const settings = appState.user.notificationSettings;
    const matchesCheck = document.getElementById('notifyMatches');
    const messagesCheck = document.getElementById('notifyMessages');
    const datesCheck = document.getElementById('notifyDates');
    const safetyCheck = document.getElementById('notifySafety');
    
    if (matchesCheck) matchesCheck.checked = settings.matches !== false;
    if (messagesCheck) messagesCheck.checked = settings.messages !== false;
    if (datesCheck) datesCheck.checked = settings.dates !== false;
    if (safetyCheck) safetyCheck.checked = settings.safety !== false;
}

/**
 * Toggle notification setting
 */
function toggleNotification(type, enabled) {
    if (!appState.user.notificationSettings) {
        appState.user.notificationSettings = {};
    }
    
    appState.user.notificationSettings[type] = enabled;
    saveUserData();
    
    const label = {
        matches: 'New match notifications',
        messages: 'Message notifications',
        dates: 'Date reminder notifications',
        safety: 'Safety alert notifications'
    }[type] || type;
    
    showToast(`${label} ${enabled ? 'enabled' : 'disabled'}`, enabled ? 'success' : 'info');
    
    console.log('🔔 Notification settings updated:', appState.user.notificationSettings);
}

/**
 * Send a notification to the user (browser notification if supported)
 */
function sendUserNotification(title, message, type = 'info') {
    const settings = appState.user.notificationSettings || {};
    
    // Check if this notification type is enabled
    if (type === 'match' && settings.matches === false) return;
    if (type === 'message' && settings.messages === false) return;
    if (type === 'date' && settings.dates === false) return;
    if (type === 'safety' && settings.safety === false) return;
    
    // Always show in-app toast
    showToast(`${title}: ${message}`, type === 'safety' ? 'warning' : 'info');
    
    // Try to send browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: message,
            icon: '/favicon.ico',
            tag: type
        });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification(title, {
                    body: message,
                    icon: '/favicon.ico',
                    tag: type
                });
            }
        });
    }
    
    console.log(`🔔 Notification [${type}]:`, title, message);
}

/**
 * Request browser notification permission
 */
function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showToast('Notifications enabled! 🔔', 'success');
            }
        });
    }
}

// ==========================================
// Preferences
// ==========================================
function updateAgeRange() {
    const minInput = document.getElementById('ageMin');
    const maxInput = document.getElementById('ageMax');
    let minAge = parseInt(minInput.value);
    let maxAge = parseInt(maxInput.value);
    
    // Prevent handles from crossing
    if (minAge > maxAge) {
        minAge = maxAge;
        minInput.value = minAge;
    }
    
    document.getElementById('minAge').textContent = minAge;
    document.getElementById('maxAge').textContent = maxAge;
    
    appState.user.preferences.ageMin = minAge;
    appState.user.preferences.ageMax = maxAge;
    
    // Update the colored track
    updateRangeTrack('ageMin', 'ageMax', 'ageTrack');
    
    // Auto-save preferences
    autoSave();
}

/**
 * Update the colored track between range slider handles
 */
function updateRangeTrack(minId, maxId, trackId) {
    const minInput = document.getElementById(minId);
    const maxInput = document.getElementById(maxId);
    const track = document.getElementById(trackId);
    
    if (!minInput || !maxInput || !track) return;
    
    const min = parseInt(minInput.min);
    const max = parseInt(minInput.max);
    const minVal = parseInt(minInput.value);
    const maxVal = parseInt(maxInput.value);
    
    // Calculate percentages
    const minPercent = ((minVal - min) / (max - min)) * 100;
    const maxPercent = ((maxVal - min) / (max - min)) * 100;
    
    // Position the track
    track.style.left = minPercent + '%';
    track.style.width = (maxPercent - minPercent) + '%';
}

function updateDistance() {
    const slider = document.getElementById('distance');
    const distance = slider.value;
    document.getElementById('distanceValue').textContent = distance;
    appState.user.preferences.distance = parseInt(distance);
    
    // Update slider background to show filled portion
    const min = slider.min || 5;
    const max = slider.max || 100;
    const percent = ((distance - min) / (max - min)) * 100;
    slider.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${percent}%, var(--border) ${percent}%, var(--border) 100%)`;
    
    // Auto-save preferences
    autoSave();
}

// ==========================================
// Adjust Preferences (When Not Matched)
// ==========================================

/**
 * Update age range on adjust preferences screen
 */
function updateAdjustAgeRange() {
    const minInput = document.getElementById('adjustAgeMin');
    const maxInput = document.getElementById('adjustAgeMax');
    let minAge = parseInt(minInput.value);
    let maxAge = parseInt(maxInput.value);
    
    // Prevent handles from crossing
    if (minAge > maxAge) {
        minAge = maxAge;
        minInput.value = minAge;
    }
    
    document.getElementById('adjustMinAge').textContent = minAge;
    document.getElementById('adjustMaxAge').textContent = maxAge;
    
    appState.user.preferences.ageMin = minAge;
    appState.user.preferences.ageMax = maxAge;
    
    // Update the colored track
    updateRangeTrack('adjustAgeMin', 'adjustAgeMax', 'adjustAgeTrack');
    
    // Update matching stats
    updateMatchingStats();
}

/**
 * Update distance on adjust preferences screen
 */
function updateAdjustDistance() {
    const slider = document.getElementById('adjustDistance');
    const distance = slider.value;
    document.getElementById('adjustDistanceValue').textContent = distance;
    appState.user.preferences.distance = parseInt(distance);
    
    // Update slider background to show filled portion
    const min = slider.min || 5;
    const max = slider.max || 100;
    const percent = ((distance - min) / (max - min)) * 100;
    slider.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${percent}%, var(--border) ${percent}%, var(--border) 100%)`;
    
    // Update matching stats
    updateMatchingStats();
}

/**
 * Update a specific preference
 */
function updatePreference(prefType, value, button) {
    // Update state
    appState.user.preferences[prefType] = value;
    
    // Update UI - remove active from siblings, add to clicked
    const toggleGroup = button.parentElement;
    toggleGroup.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    // Update matching stats
    updateMatchingStats();
}

/**
 * Calculate and display matching stats based on current preferences
 */
function updateMatchingStats() {
    const prefs = appState.user.preferences || {};
    const currentUserEmail = appState.user?.email?.toLowerCase();
    
    // Get test bots for display
    const testBots = JSON.parse(localStorage.getItem('oith_test_bots') || '[]');
    const activeBots = testBots.filter(bot => bot.active);
    
    // Get all available profiles from the database (users + active bots)
    const allProfiles = getAvailableProfilesFromDatabase(currentUserEmail);
    
    // Filter by preferences with comprehensive matching
    const compatibleProfiles = allProfiles.filter(profile => {
        // Age filter
        const age = profile.age || 25;
        const minAge = prefs.ageMin || 18;
        const maxAge = prefs.ageMax || 60;
        if (age < minAge || age > maxAge) return false;
        
        // Gender/interested in filter
        const interestedIn = prefs.interestedIn || 'everyone';
        if (interestedIn !== 'everyone') {
            const profileGender = (profile.gender || '').toLowerCase();
            // Handle various gender formats: female/woman/women, male/man/men
            const isFemale = ['female', 'woman', 'women', 'f'].includes(profileGender);
            const isMale = ['male', 'man', 'men', 'm'].includes(profileGender);
            
            if (interestedIn === 'women' && !isFemale) return false;
            if (interestedIn === 'men' && !isMale) return false;
        }
        
        // Looking for filter (if profile has relationship intent)
        const lookingFor = prefs.lookingFor || 'unsure';
        if (lookingFor !== 'unsure' && profile.lookingFor) {
            if (lookingFor !== profile.lookingFor) return false;
        }
        
        return true;
    });
    
    // Display actual counts
    const profilesInRange = allProfiles.length;
    const compatibleMatches = compatibleProfiles.length;
    
    // Update the available matches counter at the top
    const countEl = document.getElementById('availableMatchCount');
    const detailsEl = document.getElementById('matchCountDetails');
    if (countEl) {
        countEl.textContent = compatibleMatches;
        
        // Animate the counter
        countEl.style.transform = 'scale(1.1)';
        setTimeout(() => { countEl.style.transform = 'scale(1)'; }, 150);
    }
    if (detailsEl) {
        if (compatibleMatches === 0) {
            detailsEl.textContent = 'Broaden your preferences to see more';
        } else if (compatibleMatches === profilesInRange) {
            detailsEl.textContent = `All ${profilesInRange} active profiles match`;
        } else {
            detailsEl.textContent = `${profilesInRange - compatibleMatches} filtered out by preferences`;
        }
    }
    
    // Update the profile preview grid
    const previewGrid = document.getElementById('profilePreviewGrid');
    if (previewGrid) {
        if (activeBots.length === 0) {
            previewGrid.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-muted); width: 100%;">
                    <p style="font-size: 0.85rem;">No profiles available</p>
                    <p style="font-size: 0.75rem;">Ask admin to activate test profiles</p>
                </div>
            `;
        } else {
            previewGrid.innerHTML = activeBots.slice(0, 6).map(bot => `
                <div style="flex-shrink: 0; width: 70px; text-align: center;">
                    <img src="${bot.photo || 'https://i.pravatar.cc/100?u=' + bot.name}" 
                         alt="${bot.name}" 
                         style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid ${compatibleProfiles.includes(bot) ? 'var(--success)' : 'var(--border)'};">
                    <div style="font-size: 0.7rem; color: var(--text-primary); margin-top: 4px; font-weight: 500;">${bot.name}</div>
                    <div style="font-size: 0.65rem; color: var(--text-muted);">${bot.age || '?'}</div>
                </div>
            `).join('');
        }
    }
    
    const profilesEl = document.getElementById('profilesInRange');
    const compatibleEl = document.getElementById('compatibleMatches');
    
    if (profilesEl) profilesEl.textContent = profilesInRange;
    if (compatibleEl) compatibleEl.textContent = compatibleMatches;
}

/**
 * Apply preferences and find next match
 */
function applyPreferencesAndFindMatch() {
    // Save preferences
    console.log('Preferences updated:', appState.user.preferences);
    
    // Mark that preferences changed - this allows seeing passed profiles again
    appState.preferencesChanged = true;
    
    // Clear passed matches so user can see profiles again with new preferences
    appState.passedMatches = [];
    
    // Reset matching state to get fresh matches
    appState.oneMatch.status = 'waiting';
    appState.oneMatch.current = null;
    appState.oneMatch.decisionMade = false;
    appState.oneMatch.nextMatchTime = null;
    
    // Simulate finding new match with updated preferences
    // Add a small delay for UX
    showScreen('match');
    
    setTimeout(() => {
        presentMatch();
    }, 500);
}

/**
 * Initialize adjust preferences screen with current values
 */
function initAdjustPreferencesScreen() {
    const prefs = appState.user.preferences;
    
    // Set age range
    const ageMinEl = document.getElementById('adjustAgeMin');
    const ageMaxEl = document.getElementById('adjustAgeMax');
    if (ageMinEl) ageMinEl.value = prefs.ageMin;
    if (ageMaxEl) ageMaxEl.value = prefs.ageMax;
    
    document.getElementById('adjustMinAge').textContent = prefs.ageMin;
    document.getElementById('adjustMaxAge').textContent = prefs.ageMax;
    
    // Set distance
    const distanceEl = document.getElementById('adjustDistance');
    if (distanceEl) distanceEl.value = prefs.distance;
    document.getElementById('adjustDistanceValue').textContent = prefs.distance;
    
    // Set toggle buttons
    const interestToggle = document.getElementById('interestToggle');
    if (interestToggle) {
        interestToggle.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.value === prefs.interestedIn) {
                btn.classList.add('active');
            }
        });
    }
    
    const lookingForToggle = document.getElementById('lookingForToggle');
    if (lookingForToggle) {
        lookingForToggle.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.value === prefs.lookingFor) {
                btn.classList.add('active');
            }
        });
    }
    
    // Update stats
    updateMatchingStats();
}

// ==========================================
// Modal Management
// ==========================================
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

/**
 * Show compatibility breakdown modal with match-specific data
 */
function showCompatibilityBreakdown() {
    // Get current match data
    const match = appState.activeConnection || appState.oneMatch.current;
    
    if (!match) {
        showToast('No match data available');
        return;
    }
    
    // Calculate compatibility factors (simulated based on match data)
    const factors = calculateCompatibilityFactors(match);
    
    // Update modal with match-specific data
    updateCompatibilityModal(match, factors);
    
    // Show the modal
    showModal('compatibility-modal');
    
    // Animate the factor bars when modal opens
    setTimeout(() => {
        animateCompatibilityBars();
    }, 100);
}

/**
 * Calculate compatibility factors for a match
 */
function calculateCompatibilityFactors(match) {
    // Simulated compatibility calculation
    // In production, this would come from the backend
    const user = appState.user;
    
    // Relationship goals match
    const goalsMatch = match.lookingFor === user.lookingFor ? 100 : 
                       (match.lookingFor === 'unsure' || user.lookingFor === 'unsure') ? 70 : 50;
    
    // Shared interests calculation
    const userInterests = user.interests || ['Photography', 'Hiking', 'Coffee', 'Travel'];
    const matchInterests = match.interests || ['Photography', 'Hiking', 'Coffee', 'Travel'];
    const sharedInterests = userInterests.filter(i => 
        matchInterests.some(mi => mi.toLowerCase().includes(i.toLowerCase()) || i.toLowerCase().includes(mi.toLowerCase()))
    );
    const interestsScore = Math.min(100, (sharedInterests.length / Math.max(userInterests.length, 1)) * 100);
    
    // Location proximity (based on distance string)
    const distanceNum = parseInt(match.distance) || 3;
    const locationScore = distanceNum <= 5 ? 95 : distanceNum <= 10 ? 80 : distanceNum <= 20 ? 60 : 40;
    
    // Age compatibility
    const userAge = user.age || 29;
    const matchAge = match.age || 28;
    const ageDiff = Math.abs(userAge - matchAge);
    const ageScore = ageDiff <= 2 ? 100 : ageDiff <= 5 ? 85 : ageDiff <= 10 ? 70 : 50;
    
    // Communication style (simulated)
    const communicationScore = 85 + Math.floor(Math.random() * 10);
    
    return {
        goals: { score: goalsMatch, label: goalsMatch === 100 ? 'Perfect Match' : goalsMatch >= 70 ? 'Compatible' : 'Different' },
        interests: { score: Math.round(interestsScore), count: sharedInterests.length, total: matchInterests.length, shared: sharedInterests },
        location: { score: locationScore, distance: match.distance || '3 miles' },
        age: { score: ageScore, label: ageScore >= 85 ? 'Ideal Range' : 'Compatible' },
        communication: { score: communicationScore, label: 'Similar Style' }
    };
}

/**
 * Update the compatibility modal with match data
 */
function updateCompatibilityModal(match, factors) {
    // Update big score
    const bigScore = document.querySelector('.big-score');
    if (bigScore) {
        bigScore.textContent = (match.compatibility || 92) + '%';
    }
    
    // Update modal title
    const modalTitle = document.querySelector('#compatibility-modal .compatibility-header p');
    if (modalTitle) {
        modalTitle.textContent = `Here's how we calculated your compatibility with ${match.name}`;
    }
    
    // Update factor bars and values
    const factorItems = document.querySelectorAll('.factor-item');
    const factorData = [
        { icon: '💕', name: 'Relationship Goals', score: factors.goals.score, label: factors.goals.label },
        { icon: '🎯', name: 'Shared Interests', score: factors.interests.score, label: `${factors.interests.count} of ${factors.interests.total}` },
        { icon: '📍', name: 'Location', score: factors.location.score, label: factors.location.distance },
        { icon: '🎂', name: 'Age Preference', score: factors.age.score, label: factors.age.label },
        { icon: '💬', name: 'Communication Style', score: factors.communication.score, label: factors.communication.label }
    ];
    
    factorItems.forEach((item, index) => {
        if (factorData[index]) {
            const data = factorData[index];
            const fill = item.querySelector('.factor-fill');
            const value = item.querySelector('.factor-value');
            const icon = item.querySelector('.factor-icon');
            const name = item.querySelector('.factor-name');
            
            if (fill) fill.style.width = data.score + '%';
            if (value) value.textContent = data.label;
            if (icon) icon.textContent = data.icon;
            if (name) name.textContent = data.name;
        }
    });
    
    // Update shared interests tags
    const sharedTags = document.querySelector('.shared-tags');
    if (sharedTags && factors.interests.shared) {
        const interestEmojis = {
            'photography': '📸', 'hiking': '🥾', 'coffee': '☕', 'travel': '✈️',
            'music': '🎵', 'cooking': '🍳', 'reading': '📚', 'gaming': '🎮',
            'art': '🎨', 'fitness': '🏋️', 'movies': '🎬', 'wine': '🍷'
        };
        
        sharedTags.innerHTML = factors.interests.shared.map(interest => {
            const key = interest.toLowerCase().replace(/[📸🥾☕✈️🎵🍳📚🎮🎨🏋️🎬🍷\s]/g, '');
            const emoji = interestEmojis[key] || '⭐';
            return `<span class="shared-tag">${emoji} ${interest.replace(/[📸🥾☕✈️🎵🍳📚🎮🎨🏋️🎬🍷]/g, '').trim()}</span>`;
        }).join('');
    }
}

/**
 * Animate compatibility factor bars
 */
function animateCompatibilityBars() {
    const factorFills = document.querySelectorAll('.factor-fill');
    factorFills.forEach(fill => {
        const targetWidth = fill.style.width;
        fill.style.width = '0%';
        fill.style.transition = 'width 0.6s ease-out';
        setTimeout(() => {
            fill.style.width = targetWidth;
        }, 50);
    });
}

function startChat() {
    closeModal();
    showScreen('chat');
    
    // Initialize conversation tracking
    appState.conversation = {
        messages: [],
        dateReadiness: 0,
        suggestedDate: null,
        datePlanned: false
    };
    
    // Start the 24-hour connection timer
    startConnectionTimer();
    
    // Initialize connection metrics
    appState.connectionMetrics = {
        messageCount: 0,
        avgResponseTime: '0m',
        compatibility: appState.activeConnection?.compatibility || 92,
        dateReadiness: 0,
        connectedAt: new Date()
    };
}

// ==========================================
// AI-Powered Conversation Analysis
// ==========================================

/**
 * Analyze conversation for date readiness
 * This simulates the LLM/AI analysis feature
 */
function analyzeConversation(message) {
    // Keywords that indicate date readiness
    const dateKeywords = ['meet', 'coffee', 'dinner', 'drink', 'date', 'weekend', 'free', 'available', 'saturday', 'sunday', 'plans'];
    const positiveKeywords = ['love', 'excited', 'amazing', 'great', 'perfect', 'yes', 'definitely', 'absolutely', 'can\'t wait'];
    const locationKeywords = ['restaurant', 'cafe', 'bar', 'park', 'place', 'spot', 'venue'];
    
    const lowerMessage = message.toLowerCase();
    
    // Increase date readiness score based on keywords
    let scoreIncrease = 5; // Base increase for any message
    
    dateKeywords.forEach(keyword => {
        if (lowerMessage.includes(keyword)) scoreIncrease += 10;
    });
    
    positiveKeywords.forEach(keyword => {
        if (lowerMessage.includes(keyword)) scoreIncrease += 5;
    });
    
    locationKeywords.forEach(keyword => {
        if (lowerMessage.includes(keyword)) scoreIncrease += 8;
    });
    
    appState.conversation.dateReadiness = Math.min(100, appState.conversation.dateReadiness + scoreIncrease);
    
    // Update metrics with date readiness
    appState.connectionMetrics.dateReadiness = appState.conversation.dateReadiness;
    updateConnectionMetrics();
    
    // Check if ready to suggest a date
    checkDateSuggestion();
}

/**
 * Check if it's time to suggest a date
 */
function checkDateSuggestion() {
    if (appState.conversation.datePlanned) return;
    
    if (appState.conversation.dateReadiness >= 50 && !appState.conversation.suggestedDate) {
        // Time to suggest a date!
        showDateSuggestion();
    }
}

/**
 * Show AI-powered date suggestion
 */
function showDateSuggestion() {
    const match = appState.activeConnection || appState.oneMatch.current;
    if (!match) return;
    
    appState.conversation.suggestedDate = {
        suggested: true,
        match: match.name
    };
    
    // Add a suggestion banner to the chat
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const suggestionDiv = document.createElement('div');
    suggestionDiv.className = 'ai-date-suggestion';
    suggestionDiv.innerHTML = `
        <div class="suggestion-icon">💡</div>
        <div class="suggestion-content">
            <strong>Ready for a date?</strong>
            <p>Based on your conversation, now might be a great time to plan a date with ${match.name}!</p>
            <button class="btn btn-primary btn-small" onclick="showScreen('date-plan'); this.parentElement.parentElement.remove();">
                Plan a Date
            </button>
        </div>
    `;
    
    chatMessages.appendChild(suggestionDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ==========================================
// Chat Functionality
// ==========================================
function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (message) {
        // Remove welcome message if present
        const welcomeDiv = document.querySelector('.chat-welcome');
        if (welcomeDiv) welcomeDiv.remove();
        
        addMessageToChat(message, 'sent');
        input.value = '';
        
        // Track message for AI analysis
        appState.conversation.messages.push({
            text: message,
            type: 'sent',
            timestamp: new Date()
        });
        
        // Hide "Time to Connect" banner after first message is sent
        hideTimeToConnectBanner();
        
        // Update connection metrics
        appState.connectionMetrics.messageCount++;
        updateConnectionMetrics();
        
        // Update connection insights
        updateConnectionInsights();
        
        // Analyze for date readiness
        analyzeConversation(message);
        
        // Simulate response after delay
        setTimeout(() => {
            simulateResponse();
        }, 1500);
    }
}

/**
 * Hide the "Time to Connect" banner once conversation has started
 */
function hideTimeToConnectBanner() {
    const banner = document.getElementById('timeToConnectBanner');
    if (banner && banner.style.display !== 'none') {
        // Mark that conversation has started
        if (appState.conversation) {
            appState.conversation.conversationStarted = true;
        }
        
        // Animate out the banner
        banner.style.transition = 'opacity 0.3s ease, max-height 0.3s ease';
        banner.style.opacity = '0';
        banner.style.maxHeight = '0';
        banner.style.overflow = 'hidden';
        banner.style.marginBottom = '0';
        banner.style.padding = '0';
        
        setTimeout(() => {
            banner.style.display = 'none';
        }, 300);
    }
}

/**
 * Update "Time to Connect" banner visibility based on conversation state
 * Shows banner if no messages sent, hides if conversation has started
 */
function updateTimeToConnectBanner() {
    const banner = document.getElementById('timeToConnectBanner');
    if (!banner) return;
    
    // Check if conversation has started (has sent messages)
    const messages = appState.conversation?.messages || [];
    const hasSentMessage = messages.some(m => m.type === 'sent');
    const conversationStarted = appState.conversation?.conversationStarted || hasSentMessage;
    
    if (conversationStarted) {
        // Hide the banner
        banner.style.display = 'none';
    } else {
        // Show the banner and reset styles
        banner.style.display = 'block';
        banner.style.opacity = '1';
        banner.style.maxHeight = 'none';
        banner.style.overflow = 'visible';
    }
}

function handleMessageKeypress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function sendIcebreaker(button) {
    const message = button.textContent;
    
    // Remove welcome message if present
    const welcomeDiv = document.querySelector('.chat-welcome');
    if (welcomeDiv) welcomeDiv.remove();
    
    addMessageToChat(message, 'sent');
    
    // Track message
    appState.conversation.messages.push({
        text: message,
        type: 'sent',
        timestamp: new Date()
    });
    
    // Update metrics
    appState.connectionMetrics.messageCount++;
    updateConnectionMetrics();
    
    // Update connection insights
    updateConnectionInsights();
    
    // Analyze for date readiness
    analyzeConversation(message);
    
    // Hide icebreakers after use
    document.getElementById('icebreakers').style.display = 'none';
    
    // Simulate response
    setTimeout(() => {
        simulateResponse();
    }, 1500);
}

function addMessageToChat(text, type) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    
    messageDiv.innerHTML = `
        <p>${text}</p>
        <span class="message-time">${time}</span>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ==========================================
// Chat Photo Attachment
// ==========================================

/**
 * Open device gallery to select a photo
 */
function openGallery() {
    const fileInput = document.getElementById('chatPhotoInput');
    if (fileInput) {
        fileInput.click();
    }
}

/**
 * Handle photo selection from gallery
 */
function handleChatPhotoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate it's an image
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file');
        return;
    }
    
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast('Image is too large. Max size is 10MB.');
        return;
    }
    
    // Create preview and send
    const reader = new FileReader();
    reader.onload = function(e) {
        const imageUrl = e.target.result;
        
        // Add image message to chat
        addImageToChat(imageUrl, 'sent');
        
        // Track in conversation
        appState.conversation.messages.push({
            type: 'sent',
            isImage: true,
            imageUrl: imageUrl,
            timestamp: new Date()
        });
        
        // Update metrics
        appState.connectionMetrics.messageCount++;
        updateConnectionMetrics();
        
        // Save state
        autoSave();
        
        // Simulate response after photo
        setTimeout(() => {
            simulatePhotoResponse();
        }, 2000);
    };
    
    reader.readAsDataURL(file);
    
    // Reset file input for next selection
    event.target.value = '';
}

/**
 * Add image message to chat
 */
function addImageToChat(imageUrl, type) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type} image-message`;
    
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    
    messageDiv.innerHTML = `
        <div class="message-image-container">
            <img src="${imageUrl}" alt="Shared photo" class="message-image" onclick="viewFullImage(this.src)">
        </div>
        <span class="message-time">${time}</span>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Animate in
    messageDiv.style.opacity = '0';
    messageDiv.style.transform = 'translateY(10px)';
    setTimeout(() => {
        messageDiv.style.transition = 'all 0.3s ease';
        messageDiv.style.opacity = '1';
        messageDiv.style.transform = 'translateY(0)';
    }, 50);
}

/**
 * View full size image in modal
 */
function viewFullImage(src) {
    // Create fullscreen image viewer
    const viewer = document.createElement('div');
    viewer.className = 'image-viewer-modal';
    viewer.innerHTML = `
        <div class="image-viewer-backdrop" onclick="closeImageViewer()"></div>
        <div class="image-viewer-content">
            <img src="${src}" alt="Full size image">
            <button class="image-viewer-close" onclick="closeImageViewer()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
    `;
    document.body.appendChild(viewer);
    
    // Animate in
    setTimeout(() => viewer.classList.add('active'), 10);
}

/**
 * Close the image viewer modal
 */
function closeImageViewer() {
    const viewer = document.querySelector('.image-viewer-modal');
    if (viewer) {
        viewer.classList.remove('active');
        setTimeout(() => viewer.remove(), 300);
    }
}

/**
 * Simulate response after receiving a photo
 */
function simulatePhotoResponse() {
    const photoResponses = [
        "Wow, that's beautiful! 😍 Where was that taken?",
        "Love it! You have such a great eye for photos 📸",
        "That's amazing! Thanks for sharing ❤️",
        "So cool! I want to see more!",
        "This is incredible! You're so talented!",
        "I love this! It really shows your personality 🌟"
    ];
    
    const randomResponse = photoResponses[Math.floor(Math.random() * photoResponses.length)];
    addMessageToChat(randomResponse, 'received');
    
    // Track received message
    appState.conversation.messages.push({
        text: randomResponse,
        type: 'received',
        timestamp: new Date()
    });
    
    appState.connectionMetrics.messageCount++;
    updateConnectionMetrics();
}

function simulateResponse() {
    const responses = [
        "That sounds amazing! I'm so excited to meet you! ☺️",
        "Yes! Saturday works perfectly for me. Can't wait!",
        "Haha, you're so funny! I love that about you 😊",
        "The Golden Bean it is! Their coffee is incredible.",
        "I've been thinking about this all day!",
        "Would you want to grab coffee sometime this weekend?",
        "I know this great little spot downtown!",
        "That's so interesting! Tell me more about that."
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    addMessageToChat(randomResponse, 'received');
    
    // Track received message too
    appState.conversation.messages.push({
        text: randomResponse,
        type: 'received',
        timestamp: new Date()
    });
    
    // Update connection metrics
    appState.connectionMetrics.messageCount++;
    
    // Calculate average response time (simulated)
    const avgMinutes = Math.floor(Math.random() * 10) + 2;
    appState.connectionMetrics.avgResponseTime = `${avgMinutes}m`;
    
    updateConnectionMetrics();
    
    // Update connection insights based on conversation progress
    updateConnectionInsights();
    
    // Analyze their response too
    analyzeConversation(randomResponse);
}

// ==========================================
// Date Planning
// ==========================================

/**
 * Get selected date from date options
 */
function getSelectedDate() {
    // Return the stored ISO date string for proper parsing
    if (selectedDateData) {
        return selectedDateData;
    }
    
    // Fallback: try to get from active button
    const activeDate = document.querySelector('.date-option.active');
    if (activeDate) {
        // Try to extract from onclick attribute
        const onclick = activeDate.getAttribute('onclick');
        const match = onclick?.match(/'(\d{4}-\d{2}-\d{2})'/);
        if (match) {
            return match[1];
        }
        
        // Last resort: construct date from displayed values
        const day = activeDate.querySelector('.day')?.textContent || '';
        const dateNum = activeDate.querySelector('.date')?.textContent || '';
        const month = activeDate.querySelector('.month')?.textContent || '';
        if (day && dateNum && month) {
            const year = new Date().getFullYear();
            const dateStr = `${month} ${dateNum}, ${year}`;
            const parsedDate = new Date(dateStr);
            if (!isNaN(parsedDate)) {
                return parsedDate.toISOString().split('T')[0];
            }
        }
    }
    
    // Default to today
    return new Date().toISOString().split('T')[0];
}

/**
 * Get selected time from time options
 */
function getSelectedTime() {
    const activeTime = document.querySelector('.time-option.active');
    return activeTime?.textContent || 'Afternoon';
}

/**
 * Get selected venue from venue cards
 */
function getSelectedVenue() {
    const selectedVenue = document.querySelector('.venue-card.selected');
    if (selectedVenue) {
        const name = selectedVenue.querySelector('h5')?.textContent || 'The Golden Bean';
        const type = selectedVenue.querySelector('p')?.textContent || 'Coffee Shop';
        return { name, type };
    }
    return { name: 'The Golden Bean', type: 'Coffee Shop • 0.8 mi' };
}

// ==========================================
// Date Planning Functions
// ==========================================

let selectedDateData = null;
let selectedTimeData = 'afternoon';
let selectedVenueData = null;

/**
 * Initialize the date plan screen with dynamic dates and venues
 */
function initDatePlanScreen() {
    // Populate date options starting from today
    populateDateOptions();
    
    // Populate venues based on user location
    populateVenueOptions();
    
    // Update AI recommendation based on match interests
    updateAIRecommendation();
    
    // Show/hide emergency contact notification option
    updateSafetyNotifyOption();
    
    // Clear any previous search
    clearVenueSearch();
}

// ==========================================
// Venue Search Functions
// ==========================================

let currentVenueFilter = 'all';
let allVenues = [];

// Sample venue database (in production, this would come from an API like Google Places)
const venueDatabase = [
    { name: "The Coffee House", type: "cafe", rating: 4.5, price: "$$", address: "123 Main St", distance: "0.3 mi" },
    { name: "Bella Italia", type: "restaurant", rating: 4.7, price: "$$$", address: "456 Oak Ave", distance: "0.5 mi" },
    { name: "The Rooftop Bar", type: "bar", rating: 4.3, price: "$$", address: "789 High St", distance: "0.8 mi" },
    { name: "Escape Room Adventures", type: "activity", rating: 4.8, price: "$$", address: "321 Fun Blvd", distance: "1.2 mi" },
    { name: "Sunrise Cafe", type: "cafe", rating: 4.4, price: "$", address: "555 Morning Dr", distance: "0.4 mi" },
    { name: "Sushi Palace", type: "restaurant", rating: 4.6, price: "$$$", address: "777 Harbor Rd", distance: "0.6 mi" },
    { name: "The Wine Cellar", type: "bar", rating: 4.5, price: "$$$", address: "999 Vine St", distance: "0.9 mi" },
    { name: "Mini Golf World", type: "activity", rating: 4.2, price: "$", address: "111 Play Lane", distance: "1.5 mi" },
    { name: "Taco Town", type: "restaurant", rating: 4.1, price: "$", address: "222 Fiesta Ave", distance: "0.2 mi" },
    { name: "The Study", type: "cafe", rating: 4.6, price: "$$", address: "333 Book St", distance: "0.7 mi" },
    { name: "Cocktail Lounge", type: "bar", rating: 4.4, price: "$$", address: "444 Night Blvd", distance: "1.0 mi" },
    { name: "Bowling Alley", type: "activity", rating: 4.0, price: "$", address: "666 Strike Rd", distance: "1.8 mi" },
    { name: "Farm to Table", type: "restaurant", rating: 4.9, price: "$$$$", address: "888 Organic Way", distance: "1.1 mi" },
    { name: "Tea House", type: "cafe", rating: 4.3, price: "$", address: "101 Zen Garden", distance: "0.5 mi" },
    { name: "Sports Bar", type: "bar", rating: 4.0, price: "$", address: "202 Game Day Dr", distance: "0.8 mi" }
];

function searchVenues(query) {
    const searchInput = document.getElementById('venueSearchInput');
    const clearBtn = document.getElementById('clearVenueSearch');
    const resultsSection = document.getElementById('venueSearchResults');
    const suggestedSection = document.getElementById('suggestedVenuesSection');
    const resultsList = document.getElementById('searchResultsList');
    const resultsCount = document.getElementById('searchResultsCount');
    
    // Show/hide clear button
    if (clearBtn) {
        clearBtn.style.display = query.length > 0 ? 'flex' : 'none';
    }
    
    if (!query || query.length < 2) {
        // Hide search results, show suggested
        if (resultsSection) resultsSection.style.display = 'none';
        if (suggestedSection) suggestedSection.style.display = 'block';
        return;
    }
    
    // Filter venues by query and type
    const lowerQuery = query.toLowerCase();
    let results = venueDatabase.filter(venue => {
        const matchesQuery = venue.name.toLowerCase().includes(lowerQuery) ||
                            venue.type.toLowerCase().includes(lowerQuery) ||
                            venue.address.toLowerCase().includes(lowerQuery);
        const matchesFilter = currentVenueFilter === 'all' || venue.type === currentVenueFilter;
        return matchesQuery && matchesFilter;
    });
    
    // Show results section, hide suggested
    if (resultsSection) resultsSection.style.display = 'block';
    if (suggestedSection) suggestedSection.style.display = 'none';
    
    // Update count
    if (resultsCount) {
        resultsCount.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;
    }
    
    // Render results
    if (resultsList) {
        if (results.length === 0) {
            resultsList.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                    <p>No venues found for "${query}"</p>
                    <p style="font-size: 0.85rem; margin-top: 8px;">Try a different search term</p>
                </div>
            `;
        } else {
            resultsList.innerHTML = results.map(venue => renderVenueCard(venue)).join('');
        }
    }
}

function filterVenueType(btn, type) {
    // Update active state
    document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.remove('active'));
    btn.classList.add('active');
    
    currentVenueFilter = type;
    
    // Re-run search with current query
    const searchInput = document.getElementById('venueSearchInput');
    if (searchInput && searchInput.value.length >= 2) {
        searchVenues(searchInput.value);
    }
}

function clearVenueSearch() {
    const searchInput = document.getElementById('venueSearchInput');
    const clearBtn = document.getElementById('clearVenueSearch');
    const resultsSection = document.getElementById('venueSearchResults');
    const suggestedSection = document.getElementById('suggestedVenuesSection');
    
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'none';
    if (suggestedSection) suggestedSection.style.display = 'block';
    
    // Reset filter to 'all'
    currentVenueFilter = 'all';
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.toggle('active', chip.textContent.includes('All'));
    });
}

function renderVenueCard(venue) {
    const typeEmoji = {
        'restaurant': '🍽️',
        'cafe': '☕',
        'bar': '🍸',
        'activity': '🎯'
    };
    
    return `
        <div class="venue-card" onclick="selectVenue('${venue.name}', '${venue.address}')">
            <div class="venue-info">
                <div class="venue-type-badge">${typeEmoji[venue.type] || '📍'}</div>
                <div class="venue-details">
                    <h5 class="venue-name">${venue.name}</h5>
                    <p class="venue-meta">
                        <span class="venue-rating">⭐ ${venue.rating}</span>
                        <span class="venue-price">${venue.price}</span>
                        <span class="venue-distance">${venue.distance}</span>
                    </p>
                    <p class="venue-address">${venue.address}</p>
                </div>
            </div>
            <div class="venue-select-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18l6-6-6-6"/>
                </svg>
            </div>
        </div>
    `;
}

function selectVenue(name, address) {
    // Store selected venue
    if (!appState.datePlan) appState.datePlan = {};
    appState.datePlan.venue = { name, address };
    
    showToast(`📍 Selected: ${name}`, 'success');
    
    // Highlight the selected venue
    document.querySelectorAll('.venue-card').forEach(card => {
        card.classList.remove('selected');
        if (card.querySelector('.venue-name')?.textContent === name) {
            card.classList.add('selected');
        }
    });
}

/**
 * Update the safety notification option visibility based on emergency contact
 */
function updateSafetyNotifyOption() {
    const safetyOption = document.getElementById('safetyNotifyOption');
    const contactNameEl = document.getElementById('emergencyContactName');
    const contact = appState.user?.emergencyContact;
    
    if (safetyOption) {
        if (contact && contact.name) {
            // Show the option and update the contact name
            safetyOption.style.display = 'block';
            if (contactNameEl) {
                contactNameEl.textContent = contact.name;
            }
        } else {
            // Hide the option if no emergency contact
            safetyOption.style.display = 'none';
        }
    }
}

/**
 * Populate date options starting from today (14 days scrollable)
 */
function populateDateOptions() {
    const container = document.getElementById('dateOptions');
    if (!container) return;
    
    const today = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    let html = '';
    
    // 14 days of options
    for (let i = 0; i < 14; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        const dayName = dayNames[date.getDay()];
        const dateNum = date.getDate();
        const monthName = monthNames[date.getMonth()];
        const isFirst = i === 0;
        
        const dateStr = date.toISOString().split('T')[0];
        
        html += `
            <button class="date-option ${isFirst ? 'active' : ''}" onclick="selectDateOption(this, '${dateStr}')">
                <span class="day">${dayName}</span>
                <span class="date">${dateNum}</span>
                <span class="month">${monthName}</span>
            </button>
        `;
        
        if (isFirst) {
            selectedDateData = dateStr;
        }
    }
    
    container.innerHTML = html;
}

/**
 * Select a date option
 */
function selectDateOption(btn, dateStr) {
    // Remove active from all
    document.querySelectorAll('.date-option').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedDateData = dateStr;
}

/**
 * Select a time option (legacy - for button-based selection)
 */
function selectTimeOption(btn, time) {
    document.querySelectorAll('.time-option').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedTimeData = time;
}

/**
 * Select time from dropdown
 */
function selectTimeFromDropdown(select) {
    selectedTimeData = select.value;
}

/**
 * Populate venue options based on user location
 */
function populateVenueOptions() {
    const container = document.getElementById('venueList');
    const locationText = document.getElementById('userLocationText');
    const subtitle = document.getElementById('venueSubtitle');
    
    if (!container) return;
    
    // Get user location (from profile or default)
    const userLocation = appState.user?.location || 'New York, NY';
    
    if (locationText) {
        locationText.textContent = userLocation;
    }
    
    // Get shared interests with match
    const match = appState.activeConnection || appState.oneMatch?.current;
    const userInterests = appState.user?.interests || [];
    const matchInterests = match?.interests || [];
    const sharedInterests = userInterests.filter(i => matchInterests.includes(i));
    
    if (subtitle && sharedInterests.length > 0) {
        subtitle.textContent = `Based on your shared interests in ${sharedInterests.slice(0, 2).join(' and ')}`;
    }
    
    // Location-based venue database with specific addresses
    const venuesByLocation = {
        'New York': [
            { name: 'Blue Bottle Coffee', address: '450 W 15th St, Chelsea', type: 'Coffee Shop', distance: '0.5 mi', tags: ['☕ Coffee', '📸 Cozy'], img: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200&h=200&fit=crop', coords: '40.7419,-74.0061' },
            { name: 'Brooklyn Bridge Park', address: 'Pier 1, Brooklyn Heights', type: 'Park', distance: '1.2 mi', tags: ['🌳 Outdoors', '📸 Scenic'], img: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=200&h=200&fit=crop', coords: '40.7024,-73.9967' },
            { name: 'The High Line', address: 'Gansevoort St, Meatpacking', type: 'Walking Trail', distance: '0.8 mi', tags: ['🚶 Walk', '🌆 Views'], img: 'https://images.unsplash.com/photo-1565699894576-1710004524ba?w=200&h=200&fit=crop', coords: '40.7480,-74.0048' },
            { name: 'Gramercy Tavern', address: '42 E 20th St, Gramercy', type: 'Restaurant', distance: '1.5 mi', tags: ['🍽️ Dinner', '🍷 Wine'], img: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=200&fit=crop', coords: '40.7389,-73.9880' },
            { name: 'MoMA', address: '11 W 53rd St, Midtown', type: 'Museum', distance: '2.1 mi', tags: ['🎨 Art', '📚 Culture'], img: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=200&h=200&fit=crop', coords: '40.7614,-73.9776' },
            { name: 'Central Park Boathouse', address: 'E 72nd St & Park Dr', type: 'Attraction', distance: '2.8 mi', tags: ['🚣 Boats', '🌳 Nature'], img: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=200&h=200&fit=crop', coords: '40.7752,-73.9683' }
        ],
        'Los Angeles': [
            { name: 'Alfred Coffee', address: '8428 Melrose Pl, West Hollywood', type: 'Coffee Shop', distance: '0.4 mi', tags: ['☕ Coffee', '📸 Instagram'], img: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200&h=200&fit=crop', coords: '34.0839,-118.3742' },
            { name: 'Santa Monica Pier', address: '200 Santa Monica Pier', type: 'Beach', distance: '5.2 mi', tags: ['🏖️ Beach', '🎡 Fun'], img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200&h=200&fit=crop', coords: '34.0100,-118.4960' },
            { name: 'Griffith Observatory', address: '2800 E Observatory Rd', type: 'Attraction', distance: '3.2 mi', tags: ['⭐ Views', '📸 Scenic'], img: 'https://images.unsplash.com/photo-1534190760961-74e8c1c5c3da?w=200&h=200&fit=crop', coords: '34.1184,-118.3004' },
            { name: 'The Getty Center', address: '1200 Getty Center Dr', type: 'Museum', distance: '4.5 mi', tags: ['🎨 Art', '🌆 Views'], img: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=200&h=200&fit=crop', coords: '34.0780,-118.4741' },
            { name: 'Runyon Canyon', address: '2000 N Fuller Ave, Hollywood', type: 'Hiking Trail', distance: '1.8 mi', tags: ['🥾 Hiking', '🐕 Dogs'], img: 'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=200&h=200&fit=crop', coords: '34.1074,-118.3467' },
            { name: 'Bestia', address: '2121 E 7th Pl, Arts District', type: 'Restaurant', distance: '2.3 mi', tags: ['🍽️ Italian', '🍷 Wine'], img: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=200&fit=crop', coords: '34.0339,-118.2321' }
        ],
        'Chicago': [
            { name: 'Intelligentsia Coffee', address: '53 W Jackson Blvd, Loop', type: 'Coffee Shop', distance: '0.3 mi', tags: ['☕ Coffee', '💻 Chill'], img: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=200&h=200&fit=crop', coords: '41.8780,-87.6298' },
            { name: 'Millennium Park', address: '201 E Randolph St', type: 'Park', distance: '0.4 mi', tags: ['🌳 Park', '🎨 Art'], img: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=200&h=200&fit=crop', coords: '41.8826,-87.6226' },
            { name: 'Navy Pier', address: '600 E Grand Ave', type: 'Attraction', distance: '0.9 mi', tags: ['🎡 Fun', '🌅 Views'], img: 'https://images.unsplash.com/photo-1494522855154-9297ac14b55f?w=200&h=200&fit=crop', coords: '41.8917,-87.6063' },
            { name: 'Art Institute of Chicago', address: '111 S Michigan Ave', type: 'Museum', distance: '0.5 mi', tags: ['🎨 Art', '📚 Culture'], img: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=200&h=200&fit=crop', coords: '41.8796,-87.6237' },
            { name: 'Chicago Riverwalk', address: 'E Wacker Dr & Michigan', type: 'Walking Trail', distance: '0.2 mi', tags: ['🚶 Walk', '🌆 City'], img: 'https://images.unsplash.com/photo-1565699894576-1710004524ba?w=200&h=200&fit=crop', coords: '41.8881,-87.6243' },
            { name: 'Girl & The Goat', address: '809 W Randolph St, West Loop', type: 'Restaurant', distance: '1.2 mi', tags: ['🍽️ Dinner', '🌟 Famous'], img: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=200&fit=crop', coords: '41.8841,-87.6494' }
        ],
        'Miami': [
            { name: 'Panther Coffee', address: '2390 NW 2nd Ave, Wynwood', type: 'Coffee Shop', distance: '0.6 mi', tags: ['☕ Coffee', '🎨 Art'], img: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200&h=200&fit=crop', coords: '25.7992,-80.1995' },
            { name: 'South Beach', address: 'Ocean Dr & 10th St', type: 'Beach', distance: '2.1 mi', tags: ['🏖️ Beach', '🌅 Sunset'], img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200&h=200&fit=crop', coords: '25.7781,-80.1341' },
            { name: 'Pérez Art Museum', address: '1103 Biscayne Blvd', type: 'Museum', distance: '1.5 mi', tags: ['🎨 Art', '🌊 Bay Views'], img: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=200&h=200&fit=crop', coords: '25.7859,-80.1864' },
            { name: 'Wynwood Walls', address: 'NW 2nd Ave, Wynwood', type: 'Attraction', distance: '0.8 mi', tags: ['🎨 Street Art', '📸 Photos'], img: 'https://images.unsplash.com/photo-1567449303078-57ad995bd329?w=200&h=200&fit=crop', coords: '25.8010,-80.1991' },
            { name: 'Cecconi\'s', address: '4385 Collins Ave, Miami Beach', type: 'Restaurant', distance: '3.2 mi', tags: ['🍽️ Italian', '🌴 Garden'], img: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=200&fit=crop', coords: '25.8142,-80.1226' },
            { name: 'Vizcaya Museum', address: '3251 S Miami Ave', type: 'Garden', distance: '4.5 mi', tags: ['🏛️ Historic', '🌳 Gardens'], img: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=200&h=200&fit=crop', coords: '25.7441,-80.2103' }
        ],
        'San Francisco': [
            { name: 'Sightglass Coffee', address: '270 7th St, SoMa', type: 'Coffee Shop', distance: '0.4 mi', tags: ['☕ Coffee', '🏭 Industrial'], img: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200&h=200&fit=crop', coords: '37.7774,-122.4068' },
            { name: 'Golden Gate Park', address: 'Stow Lake, Inner Richmond', type: 'Park', distance: '2.8 mi', tags: ['🌳 Nature', '🚣 Boats'], img: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=200&h=200&fit=crop', coords: '37.7694,-122.4862' },
            { name: 'Ferry Building', address: '1 Ferry Building, Embarcadero', type: 'Market', distance: '1.2 mi', tags: ['🍴 Food', '🛍️ Market'], img: 'https://images.unsplash.com/photo-1567449303078-57ad995bd329?w=200&h=200&fit=crop', coords: '37.7955,-122.3937' },
            { name: 'SFMOMA', address: '151 3rd St, SoMa', type: 'Museum', distance: '0.6 mi', tags: ['🎨 Art', '📐 Modern'], img: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=200&h=200&fit=crop', coords: '37.7857,-122.4010' },
            { name: 'Lands End Trail', address: 'Point Lobos Ave', type: 'Hiking Trail', distance: '5.1 mi', tags: ['🥾 Hiking', '🌊 Ocean'], img: 'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=200&h=200&fit=crop', coords: '37.7850,-122.5054' },
            { name: 'State Bird Provisions', address: '1529 Fillmore St, Western Addition', type: 'Restaurant', distance: '1.8 mi', tags: ['🍽️ Creative', '🌟 Michelin'], img: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=200&fit=crop', coords: '37.7838,-122.4330' }
        ],
        'Austin': [
            { name: 'Houndstooth Coffee', address: '401 Congress Ave, Downtown', type: 'Coffee Shop', distance: '0.3 mi', tags: ['☕ Coffee', '🏢 Downtown'], img: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200&h=200&fit=crop', coords: '30.2672,-97.7431' },
            { name: 'Zilker Park', address: '2100 Barton Springs Rd', type: 'Park', distance: '1.5 mi', tags: ['🌳 Nature', '🏊 Swimming'], img: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=200&h=200&fit=crop', coords: '30.2669,-97.7729' },
            { name: 'South Congress Ave', address: 'S Congress & Elizabeth St', type: 'Walking Trail', distance: '0.8 mi', tags: ['🛍️ Shopping', '🎵 Music'], img: 'https://images.unsplash.com/photo-1565699894576-1710004524ba?w=200&h=200&fit=crop', coords: '30.2500,-97.7500' },
            { name: 'Barton Creek Greenbelt', address: 'Spyglass Dr Trailhead', type: 'Hiking Trail', distance: '2.3 mi', tags: ['🥾 Hiking', '🏞️ Nature'], img: 'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=200&h=200&fit=crop', coords: '30.2600,-97.8023' },
            { name: 'Uchi', address: '801 S Lamar Blvd', type: 'Restaurant', distance: '1.1 mi', tags: ['🍣 Japanese', '🌟 Award-winning'], img: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=200&fit=crop', coords: '30.2583,-97.7650' },
            { name: 'Blanton Museum of Art', address: '200 E MLK Jr Blvd, UT Campus', type: 'Museum', distance: '0.9 mi', tags: ['🎨 Art', '📚 Culture'], img: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=200&h=200&fit=crop', coords: '30.2809,-97.7374' }
        ],
        'Seattle': [
            { name: 'Storyville Coffee', address: '1001 1st Ave, Pike Place', type: 'Coffee Shop', distance: '0.2 mi', tags: ['☕ Coffee', '📖 Cozy'], img: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200&h=200&fit=crop', coords: '47.6080,-122.3385' },
            { name: 'Pike Place Market', address: '85 Pike St', type: 'Market', distance: '0.3 mi', tags: ['🛍️ Market', '🐟 Fresh'], img: 'https://images.unsplash.com/photo-1567449303078-57ad995bd329?w=200&h=200&fit=crop', coords: '47.6097,-122.3422' },
            { name: 'Discovery Park', address: '3801 Discovery Park Blvd', type: 'Park', distance: '4.2 mi', tags: ['🌳 Nature', '🌊 Beach'], img: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=200&h=200&fit=crop', coords: '47.6573,-122.4163' },
            { name: 'Chihuly Garden', address: '305 Harrison St', type: 'Museum', distance: '0.8 mi', tags: ['🎨 Glass Art', '🌺 Garden'], img: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=200&h=200&fit=crop', coords: '47.6205,-122.3509' },
            { name: 'Kerry Park', address: '211 W Highland Dr, Queen Anne', type: 'Viewpoint', distance: '1.1 mi', tags: ['🌆 Skyline', '📸 Photos'], img: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=200&h=200&fit=crop', coords: '47.6295,-122.3600' },
            { name: 'Canlis', address: '2576 Aurora Ave N', type: 'Restaurant', distance: '2.5 mi', tags: ['🍽️ Fine Dining', '🌆 Views'], img: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=200&fit=crop', coords: '47.6432,-122.3469' }
        ],
        'default': [
            { name: 'Local Coffee House', address: 'Main Street', type: 'Coffee Shop', distance: '0.8 mi', tags: ['☕ Coffee', '📸 Cozy'], img: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200&h=200&fit=crop', coords: '' },
            { name: 'City Park', address: 'Central Avenue', type: 'Park', distance: '1.0 mi', tags: ['🌳 Nature', '🚶 Walk'], img: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=200&h=200&fit=crop', coords: '' },
            { name: 'Downtown Bistro', address: 'Market Street', type: 'Restaurant', distance: '1.2 mi', tags: ['🍽️ Dinner', '🍷 Wine'], img: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=200&fit=crop', coords: '' },
            { name: 'Riverside Trail', address: 'River Road', type: 'Walking Trail', distance: '2.0 mi', tags: ['🥾 Hiking', '📸 Scenic'], img: 'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=200&h=200&fit=crop', coords: '' },
            { name: 'Art Gallery', address: 'Art District', type: 'Museum', distance: '0.9 mi', tags: ['🎨 Art', '📚 Culture'], img: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=200&h=200&fit=crop', coords: '' },
            { name: 'Harbor View', address: 'Waterfront', type: 'Attraction', distance: '1.5 mi', tags: ['🌊 Water', '🌅 Views'], img: 'https://images.unsplash.com/photo-1494522855154-9297ac14b55f?w=200&h=200&fit=crop', coords: '' }
        ]
    };
    
    // Find matching location
    let venues = venuesByLocation['default'];
    for (const city in venuesByLocation) {
        if (userLocation.toLowerCase().includes(city.toLowerCase())) {
            venues = venuesByLocation[city];
            break;
        }
    }
    
    // Analyze conversation and sort venues by relevance
    const analysis = analyzeConversationForDate();
    if (analysis.topTopics.length > 0) {
        venues = getConversationBasedVenues(analysis, venues);
    }
    
    // Generate venue HTML
    let html = '';
    venues.forEach((venue, index) => {
        const isSelected = index === 0;
        if (isSelected) {
            selectedVenueData = venue;
        }
        
        // Add recommendation badge for top-scored venues
        const isRecommended = venue.relevanceScore && venue.relevanceScore > 2;
        const recommendedBadge = isRecommended ? '<span class="venue-recommended">✨ Recommended</span>' : '';
        
        html += `
            <div class="venue-card ${isSelected ? 'selected' : ''} ${isRecommended ? 'recommended' : ''}" onclick="selectVenue(this, ${index})">
                <img src="${venue.img}" alt="${venue.name}">
                <div class="venue-info">
                    <h5>${venue.name} ${recommendedBadge}</h5>
                    <p class="venue-address">${venue.address || venue.type}</p>
                    <p class="venue-meta">${venue.type} • ${venue.distance}</p>
                    <div class="venue-tags">
                        ${venue.tags.map(tag => `<span>${tag}</span>`).join('')}
                    </div>
                </div>
                <div class="venue-check">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--accent)" stroke="white" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M9 12l2 2 4-4" stroke="white"/>
                    </svg>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Store venues for later selection
    container.dataset.venues = JSON.stringify(venues);
}

/**
 * Select a venue
 */
function selectVenue(card, index) {
    const container = document.getElementById('venueList');
    const venues = JSON.parse(container.dataset.venues || '[]');
    
    // Remove selected from all
    document.querySelectorAll('.venue-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    
    selectedVenueData = venues[index];
}

/**
 * Update AI recommendation based on match interests
 */
/**
 * Analyze conversation for date planning insights
 */
function analyzeConversationForDate() {
    const messages = appState.conversation?.messages || [];
    const match = appState.activeConnection || appState.oneMatch?.current;
    
    // Keywords to look for in conversation
    const topicKeywords = {
        coffee: ['coffee', 'cafe', 'latte', 'espresso', 'cappuccino', 'brew', 'caffeine'],
        food: ['food', 'eat', 'dinner', 'lunch', 'restaurant', 'hungry', 'cuisine', 'chef', 'cook', 'meal', 'brunch'],
        outdoor: ['hike', 'hiking', 'walk', 'nature', 'park', 'outside', 'outdoor', 'fresh air', 'trail', 'beach'],
        art: ['art', 'museum', 'gallery', 'painting', 'exhibit', 'creative', 'sculpture'],
        music: ['music', 'concert', 'band', 'live music', 'jazz', 'show', 'performance', 'song'],
        drinks: ['wine', 'drinks', 'bar', 'cocktail', 'beer', 'happy hour'],
        active: ['fitness', 'gym', 'workout', 'run', 'sport', 'active', 'yoga', 'exercise'],
        photography: ['photo', 'photography', 'pictures', 'camera', 'instagram', 'scenic', 'views'],
        culture: ['travel', 'explore', 'adventure', 'new places', 'discover', 'culture'],
        cozy: ['cozy', 'quiet', 'chill', 'relax', 'calm', 'peaceful', 'intimate']
    };
    
    // Score each topic based on conversation
    const topicScores = {};
    Object.keys(topicKeywords).forEach(topic => topicScores[topic] = 0);
    
    // Analyze messages
    messages.forEach(msg => {
        if (!msg.text) return;
        const text = msg.text.toLowerCase();
        
        Object.entries(topicKeywords).forEach(([topic, keywords]) => {
            keywords.forEach(keyword => {
                if (text.includes(keyword)) {
                    topicScores[topic] += msg.type === 'received' ? 2 : 1; // Weight match's mentions higher
                }
            });
        });
    });
    
    // Also consider shared interests
    const userInterests = appState.user?.interests || [];
    const matchInterests = match?.interests || [];
    const sharedInterests = userInterests.filter(i => matchInterests.includes(i));
    
    // Map interests to topics
    const interestToTopic = {
        'Coffee': 'coffee',
        'Food': 'food',
        'Hiking': 'outdoor',
        'Art': 'art',
        'Music': 'music',
        'Wine': 'drinks',
        'Fitness': 'active',
        'Photography': 'photography',
        'Travel': 'culture',
        'Reading': 'cozy'
    };
    
    sharedInterests.forEach(interest => {
        const topic = interestToTopic[interest];
        if (topic) topicScores[topic] += 3;
    });
    
    // Sort topics by score
    const sortedTopics = Object.entries(topicScores)
        .sort((a, b) => b[1] - a[1])
        .filter(([_, score]) => score > 0);
    
    return {
        topTopics: sortedTopics.slice(0, 3).map(([topic]) => topic),
        scores: topicScores,
        messageCount: messages.length,
        sharedInterests
    };
}

/**
 * Generate AI insight based on conversation analysis
 * Analyzes chat messages to make personalized date suggestions
 */
function generateConversationBasedInsight(match, messageCount, dateReadiness) {
    if (!match) return "Find your next great match!";
    
    const matchName = match.name || 'Your match';
    const messages = appState.conversation?.messages || [];
    
    // If no messages yet
    if (messageCount === 0 || messages.length === 0) {
        const interest = match.interests?.[0] || 'their interests';
        return `Say hi to ${matchName} - you have ${match.compatibility || 85}% compatibility! Ask about ${interest} to break the ice.`;
    }
    
    // Analyze the conversation for topics
    const analysis = analyzeConversationForDate();
    
    // Topic to date suggestion mapping
    const topicToSuggestion = {
        coffee: {
            activity: 'a coffee date',
            venues: ['The Golden Bean', 'Blue Bottle Coffee', 'a cozy cafe'],
            why: 'loves coffee'
        },
        food: {
            activity: 'trying a new restaurant',
            venues: ['that Italian place', 'the new brunch spot', 'a farm-to-table restaurant'],
            why: 'is a foodie'
        },
        outdoor: {
            activity: 'a walk in the park or hiking',
            venues: ['Central Park', 'the botanical gardens', 'a scenic trail'],
            why: 'loves the outdoors'
        },
        art: {
            activity: 'visiting a museum or gallery',
            venues: ['MoMA', 'a local gallery', 'an art exhibit'],
            why: 'appreciates art'
        },
        music: {
            activity: 'a live music event',
            venues: ['a jazz club', 'that concert venue', 'a rooftop bar with live music'],
            why: 'is into music'
        },
        drinks: {
            activity: 'drinks at a wine bar',
            venues: ['a speakeasy', 'that rooftop bar', 'a craft cocktail spot'],
            why: 'enjoys good drinks'
        },
        active: {
            activity: 'something active together',
            venues: ['a yoga class', 'rock climbing', 'a fun workout date'],
            why: 'is fitness-focused'
        },
        photography: {
            activity: 'exploring photogenic spots',
            venues: ['a scenic viewpoint', 'the waterfront', 'a photo walk'],
            why: 'loves photography'
        },
        culture: {
            activity: 'exploring somewhere new',
            venues: ['a food market', 'a cultural festival', 'the historic district'],
            why: 'loves to explore'
        },
        cozy: {
            activity: 'a cozy, intimate date',
            venues: ['a quiet bookstore cafe', 'a wine bar with board games', 'a cozy bistro'],
            why: 'prefers intimate settings'
        }
    };
    
    // Check for specific mentions in recent messages
    const recentMessages = messages.slice(-10);
    const recentText = recentMessages.map(m => (m.text || '').toLowerCase()).join(' ');
    
    // Look for specific date ideas mentioned
    if (recentText.includes('movie') || recentText.includes('film')) {
        return `🎬 ${matchName} mentioned movies! Suggest catching a film together or a movie marathon date.`;
    }
    if (recentText.includes('cook') || recentText.includes('recipe')) {
        return `👨‍🍳 Cooking came up in your chat! Consider a cooking class date or making dinner together.`;
    }
    if (recentText.includes('travel') || recentText.includes('trip') || recentText.includes('vacation')) {
        return `✈️ You've been talking about travel! Plan a fun day trip or explore a new neighborhood together.`;
    }
    if (recentText.includes('book') || recentText.includes('read')) {
        return `📚 You both like reading! Try a bookstore cafe date or a book club discussion.`;
    }
    if (recentText.includes('workout') || recentText.includes('gym') || recentText.includes('run')) {
        return `💪 Fitness is a shared interest! Suggest a workout date, hiking, or a fitness class together.`;
    }
    if (recentText.includes('dog') || recentText.includes('pet')) {
        return `🐕 Pets came up! A dog park date or pet-friendly cafe could be perfect.`;
    }
    if (recentText.includes('weekend') || recentText.includes('free time')) {
        return `📅 ${matchName} mentioned their weekend - great time to suggest a date!`;
    }
    
    // Use topic analysis for suggestions
    if (analysis.topTopics.length > 0) {
        const topTopic = analysis.topTopics[0];
        const suggestion = topicToSuggestion[topTopic];
        
        if (suggestion) {
            const venue = suggestion.venues[Math.floor(Math.random() * suggestion.venues.length)];
            return `💡 Based on your chat, ${matchName} ${suggestion.why}. Consider ${suggestion.activity} at ${venue}!`;
        }
    }
    
    // Use shared interests if no conversation topics
    if (analysis.sharedInterests && analysis.sharedInterests.length > 0) {
        const interest = analysis.sharedInterests[0];
        return `🎯 You both love ${interest}! Plan a date around this shared passion.`;
    }
    
    // Fallback based on date readiness
    if (dateReadiness >= 70) {
        return `🔥 Great chemistry with ${matchName}! The conversation is flowing - time to plan something special.`;
    } else if (dateReadiness >= 40) {
        return `💬 Keep the momentum going! Ask ${matchName} about their favorite weekend activities.`;
    } else {
        const fallbackInterest = match.interests?.[0] || 'their hobbies';
        return `💡 ${matchName} loves ${fallbackInterest}. Ask about it to deepen the connection!`;
    }
}

/**
 * Get venue recommendations based on conversation analysis
 */
function getConversationBasedVenues(analysis, allVenues) {
    const topicToVenueType = {
        coffee: ['Coffee Shop', 'Café'],
        food: ['Restaurant', 'Bistro', 'Market'],
        outdoor: ['Park', 'Beach', 'Hiking Trail', 'Walking Trail', 'Garden'],
        art: ['Museum', 'Gallery', 'Attraction'],
        music: ['Live Music', 'Bar', 'Concert Hall'],
        drinks: ['Wine Bar', 'Bar', 'Restaurant'],
        active: ['Hiking Trail', 'Park', 'Beach'],
        photography: ['Viewpoint', 'Park', 'Attraction', 'Beach'],
        culture: ['Museum', 'Market', 'Attraction'],
        cozy: ['Coffee Shop', 'Restaurant', 'Café']
    };
    
    // Score venues based on topic match
    const scoredVenues = allVenues.map(venue => {
        let score = 0;
        analysis.topTopics.forEach((topic, index) => {
            const preferredTypes = topicToVenueType[topic] || [];
            if (preferredTypes.some(type => venue.type.includes(type))) {
                score += (3 - index) * 2; // Higher weight for top topic
            }
        });
        
        // Bonus for certain tags matching topics
        if (venue.tags) {
            venue.tags.forEach(tag => {
                const tagLower = tag.toLowerCase();
                if (analysis.topTopics.includes('coffee') && tagLower.includes('coffee')) score += 2;
                if (analysis.topTopics.includes('outdoor') && (tagLower.includes('nature') || tagLower.includes('outdoors'))) score += 2;
                if (analysis.topTopics.includes('food') && (tagLower.includes('dinner') || tagLower.includes('food'))) score += 2;
                if (analysis.topTopics.includes('photography') && (tagLower.includes('scenic') || tagLower.includes('views'))) score += 2;
            });
        }
        
        return { ...venue, relevanceScore: score };
    });
    
    // Sort by relevance score
    return scoredVenues.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

function updateAIRecommendation() {
    const textEl = document.getElementById('aiRecommendationText');
    const insightsEl = document.getElementById('conversationInsights');
    if (!textEl) return;
    
    const analysis = analyzeConversationForDate();
    const match = appState.activeConnection || appState.oneMatch?.current;
    
    // Topic to recommendation mapping
    const topicRecommendations = {
        coffee: { text: 'a cozy coffee date', emoji: '☕' },
        food: { text: 'trying a great restaurant together', emoji: '🍽️' },
        outdoor: { text: 'an outdoor adventure', emoji: '🌳' },
        art: { text: 'exploring art and culture', emoji: '🎨' },
        music: { text: 'enjoying some live music', emoji: '🎵' },
        drinks: { text: 'a relaxed wine or cocktail spot', emoji: '🍷' },
        active: { text: 'an active, energetic date', emoji: '🏃' },
        photography: { text: 'somewhere scenic for photos', emoji: '📸' },
        culture: { text: 'discovering somewhere new', emoji: '✨' },
        cozy: { text: 'a quiet, intimate setting', emoji: '💕' }
    };
    
    let recommendation = '';
    let conversationNote = '';
    
    if (analysis.topTopics.length > 0) {
        const topTopic = analysis.topTopics[0];
        const rec = topicRecommendations[topTopic];
        
        if (rec) {
            recommendation = `${rec.emoji} Based on your conversation, we recommend ${rec.text}!`;
            
            // Build conversation insight
            if (analysis.messageCount > 5) {
                const mentions = [];
                if (analysis.topTopics.includes('coffee')) mentions.push('coffee');
                if (analysis.topTopics.includes('food')) mentions.push('food');
                if (analysis.topTopics.includes('outdoor')) mentions.push('outdoor activities');
                if (analysis.topTopics.includes('art')) mentions.push('art');
                if (analysis.topTopics.includes('photography')) mentions.push('photography');
                
                if (mentions.length > 0) {
                    conversationNote = `You both mentioned ${mentions.slice(0, 2).join(' and ')} in your chat`;
                }
            }
        }
    } else if (analysis.sharedInterests.length > 0) {
        recommendation = `💕 With ${analysis.sharedInterests.length} shared interests, any of these spots would be great!`;
    } else {
        recommendation = `✨ A casual first date spot would be perfect to get to know ${match?.name || 'each other'}!`;
    }
    
    textEl.innerHTML = recommendation;
    
    // Update conversation insights if element exists
    if (insightsEl && conversationNote) {
        insightsEl.innerHTML = `<span class="insight-icon">💬</span> ${conversationNote}`;
        insightsEl.style.display = 'flex';
    } else if (insightsEl) {
        insightsEl.style.display = 'none';
    }
    
    // Store analysis for venue sorting
    appState.dateAnalysis = analysis;
}

/**
 * Get selected date for date request
 */
/**
 * Confirm and send date request
 */
function confirmDate() {
    console.log('🔘 confirmDate() called');
    
    // Ensure conversation object exists
    if (!appState.conversation) {
        appState.conversation = { messages: [] };
    }
    if (!appState.conversation.messages) {
        appState.conversation.messages = [];
    }
    
    // Get selected date details using helper functions
    const selectedDate = getSelectedDate();
    const selectedTime = getSelectedTime();
    let selectedVenue = getSelectedVenue();
    
    console.log('📅 Confirming date:', { selectedDate, selectedTime, selectedVenue });
    
    // If no venue explicitly selected, use the first one (or default)
    if (!selectedVenue || !selectedVenue.name) {
        // Try to get the first venue from the list
        const firstVenue = document.querySelector('.venue-card');
        if (firstVenue) {
            selectedVenue = {
                name: firstVenue.querySelector('h5')?.textContent?.replace('✨ Recommended', '').trim() || 'Selected Venue',
                type: firstVenue.querySelector('.venue-meta')?.textContent || 'Venue'
            };
            console.log('📍 Using first venue:', selectedVenue);
        } else {
            // Fallback
            selectedVenue = { name: 'Coffee Shop', type: 'Casual Spot' };
            console.log('📍 Using fallback venue:', selectedVenue);
        }
    }
    
    // Store date details
    appState.conversation.datePlanned = true;
    appState.conversation.plannedDate = {
        date: selectedDate,
        time: selectedTime,
        venue: selectedVenue,
        createdAt: new Date()
    };
    
    // Save state
    autoSave();
    
    // Check if user wants to notify emergency contact
    const notifyCheckbox = document.getElementById('notifyEmergencyContact');
    const shouldNotify = notifyCheckbox?.checked && appState.user?.emergencyContact;
    
    if (shouldNotify) {
        const dateDetails = {
            date: selectedDate,
            time: selectedTime,
            venue: selectedVenue
        };
        
        // Send safety notification
        sendSafetyNotification(dateDetails);
        console.log('🛡️ Safety notification sent to emergency contact');
    } else {
        console.log('🛡️ Safety notification skipped (user opted out or no contact)');
    }
    
    // Store date request in conversation messages FIRST
    if (!appState.conversation.messages) {
        appState.conversation.messages = [];
    }
    appState.conversation.messages.push({
        type: 'sent',
        isDateRequest: true,
        date: selectedDate,
        time: selectedTime,
        venue: selectedVenue,
        timestamp: new Date()
    });
    
    // Save state
    saveUserData();
    
    // Navigate to chat - this will render all messages including the date request
    showScreen('chat');
    
    // Show confirmation toast
    showToast('📅 Date request sent!', 'success');
    
    // Simulate bot response to date request after a delay
    simulateBotDateResponse(selectedDate, selectedTime, selectedVenue);
}

/**
 * Simulate test bot responding to a date request
 */
function simulateBotDateResponse(date, time, venue) {
    const match = appState.activeConnection;
    if (!match) return;
    
    // Check if this is a test bot
    const testBots = JSON.parse(localStorage.getItem('oith_test_bots') || '[]');
    const isBot = testBots.some(bot => 
        bot.name?.toLowerCase() === match.name?.toLowerCase() || 
        bot.id === match.id
    );
    
    console.log('🤖 Checking if match is a bot:', { matchName: match.name, isBot });
    
    // Only auto-respond for test bots
    if (!isBot) {
        console.log('   Not a bot, no auto-response');
        return;
    }
    
    // Random delay between 2-5 seconds for realistic feel
    const delay = 2000 + Math.random() * 3000;
    
    setTimeout(() => {
        // Bot accepts the date request
        const venueName = typeof venue === 'string' ? venue : (venue?.name || 'there');
        
        const responses = [
            `Yes! I'd love that! 💕 ${venueName} sounds perfect!`,
            `Absolutely! Can't wait to meet you at ${venueName}! 😊`,
            `That sounds amazing! I'm so excited for our date! 🎉`,
            `Perfect choice! I've been wanting to go there. See you then! 💫`,
            `Yes!! I'm already looking forward to it! 😍`
        ];
        
        const response = responses[Math.floor(Math.random() * responses.length)];
        
        // Add bot's response to messages
        if (!appState.conversation.messages) {
            appState.conversation.messages = [];
        }
        
        appState.conversation.messages.push({
            type: 'received',
            text: response,
            isDateAcceptance: true,
            timestamp: new Date()
        });
        
        // Mark date as confirmed
        appState.conversation.dateConfirmed = true;
        
        // Save state
        saveUserData();
        
        // Re-render chat if still on chat screen
        const currentScreen = document.querySelector('.screen.active');
        if (currentScreen?.id === 'chat') {
            renderChatMessages();
        }
        
        // Show notification
        showToast(`${match.name} accepted your date request! 🎉`, 'success');
        
        // Send browser notification if enabled
        if (appState.user?.notificationSettings?.newMessages) {
            sendBrowserNotification(`${match.name} accepted your date! 💕`, response);
        }
        
        // Update the planned date banner on chat list
        updatePlannedDateBanner();
        
        // Automatically prompt to add to calendar after a brief delay
        setTimeout(() => {
            addDateToCalendar(date, time, venue, match.name);
        }, 1500);
        
        console.log('✅ Bot responded to date request:', response);
    }, delay);
}

/**
 * Send date request notification to chat
 */
function sendDateRequestNotification(date, time, venue) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) {
        console.error('❌ Chat messages container not found');
        return;
    }
    
    // Handle venue as string or object
    const venueName = typeof venue === 'string' ? venue : (venue?.name || 'Selected venue');
    
    console.log('📬 Sending date request notification:', { date, time, venueName });
    
    // Create the date request card
    const notificationDiv = document.createElement('div');
    notificationDiv.className = 'message sent date-request-message';
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    
    notificationDiv.innerHTML = `
        <div class="date-request-card">
            <div class="date-request-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span>Date Request Sent!</span>
            </div>
            <div class="date-request-details">
                <div class="date-detail">
                    <span class="detail-label">📍 Venue</span>
                    <span class="detail-value">${venueName}</span>
                </div>
                <div class="date-detail">
                    <span class="detail-label">📅 Date</span>
                    <span class="detail-value">${date}</span>
                </div>
                <div class="date-detail">
                    <span class="detail-label">🕐 Time</span>
                    <span class="detail-value">${time}</span>
                </div>
            </div>
        </div>
        <span class="message-time">${timeStr}</span>
    `;
    
    chatMessages.appendChild(notificationDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Animate in
    notificationDiv.style.opacity = '0';
    notificationDiv.style.transform = 'translateY(10px)';
    setTimeout(() => {
        notificationDiv.style.transition = 'all 0.3s ease';
        notificationDiv.style.opacity = '1';
        notificationDiv.style.transform = 'translateY(0)';
    }, 50);
    
    // Track in conversation
    appState.conversation.messages.push({
        type: 'sent',
        isDateRequest: true,
        date: date,
        time: time,
        venue: venue,
        timestamp: new Date()
    });
    
    // Simulate response from match
    setTimeout(() => {
        simulateDateResponse(date, time, venue);
    }, 2500);
}

/**
 * Simulate match's response to date request
 */
function simulateDateResponse(date, time, venue) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    // Create the acceptance card
    const responseDiv = document.createElement('div');
    responseDiv.className = 'message received date-response-message';
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    
    const matchName = appState.activeConnection?.name || 'Sarah';
    
    responseDiv.innerHTML = `
        <div class="date-response-card accepted">
            <div class="date-response-header">
                <span class="response-emoji">🎉</span>
                <span>Date Accepted!</span>
            </div>
            <p class="date-response-text">${matchName} accepted your date request!</p>
            <div class="date-response-summary">
                <span>📍 ${venue.name}</span>
                <span>📅 ${date}, ${time}</span>
            </div>
        </div>
        <span class="message-time">${timeStr}</span>
    `;
    
    chatMessages.appendChild(responseDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Animate in
    responseDiv.style.opacity = '0';
    responseDiv.style.transform = 'translateY(10px)';
    setTimeout(() => {
        responseDiv.style.transition = 'all 0.3s ease';
        responseDiv.style.opacity = '1';
        responseDiv.style.transform = 'translateY(0)';
    }, 50);
    
    // Track in conversation
    appState.conversation.messages.push({
        type: 'received',
        isDateResponse: true,
        accepted: true,
        timestamp: new Date()
    });
    
    // Mark date as accepted by both users
    appState.conversation.dateAccepted = true;
    appState.conversation.plannedDate = {
        ...appState.conversation.plannedDate,
        acceptedAt: new Date(),
        venue: venue
    };
    
    // Save state
    autoSave();
    
    // Update the planned date banner
    updatePlannedDateBanner();
    
    // Send follow-up message
    setTimeout(() => {
        addMessageToChat(`I can't wait for ${date}! ${venue.name} is perfect! 😊💕`, 'received');
        appState.conversation.messages.push({
            text: `I can't wait for ${date}! ${venue.name} is perfect! 😊💕`,
            type: 'received',
            timestamp: new Date()
        });
    }, 1500);
    
    // Show success toast and add to calendar
    showToast('🎉 Date confirmed!');
    
    // Auto-add to calendar after a short delay
    setTimeout(() => {
        addDateToCalendar(date, time, venue, matchName);
    }, 2000);
}

/**
 * Update the planned date banner on chat-list screen
 */
function updatePlannedDateBanner() {
    const banner = document.getElementById('plannedDateBanner');
    if (!banner) return;
    
    const plannedDate = appState.conversation?.plannedDate;
    const dateAccepted = appState.conversation?.dateAccepted || appState.conversation?.dateConfirmed;
    
    if (plannedDate && dateAccepted) {
        // Show the banner
        banner.style.display = 'block';
        
        // Update venue
        const venueEl = document.getElementById('plannedDateVenue');
        if (venueEl) {
            const venueName = plannedDate.venue?.name || plannedDate.venue || 'Your date location';
            venueEl.textContent = venueName;
        }
        
        // Update date display
        const dateDay = document.getElementById('plannedDateDay');
        if (dateDay && plannedDate.date) {
            let dateObj;
            // Handle ISO date string (YYYY-MM-DD)
            if (typeof plannedDate.date === 'string' && plannedDate.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                // Parse ISO date - add time to avoid timezone issues
                dateObj = new Date(plannedDate.date + 'T12:00:00');
            } else {
                dateObj = new Date(plannedDate.date);
            }
            
            if (!isNaN(dateObj.getTime())) {
                const options = { weekday: 'long', month: 'short', day: 'numeric' };
                dateDay.textContent = dateObj.toLocaleDateString('en-US', options);
            } else {
                // Fallback: display as-is
                dateDay.textContent = plannedDate.date;
            }
        }
        
        // Update time
        const timeEl = document.getElementById('plannedDateTime');
        if (timeEl) {
            const timeText = {
                'morning': 'Morning (9 AM - 12 PM)',
                'afternoon': 'Afternoon (12 PM - 5 PM)',
                'evening': 'Evening (5 PM - 9 PM)'
            };
            timeEl.textContent = timeText[plannedDate.time] || plannedDate.time || 'Time TBD';
        }
        
        // Update countdown
        updateDateCountdown();
    } else {
        // Hide the banner
        banner.style.display = 'none';
    }
}

/**
 * Update the countdown to the planned date
 */
function updateDateCountdown() {
    const countdownEl = document.getElementById('dateCountdownText');
    const countdownBadge = document.getElementById('dateCountdownBadge');
    if (!countdownEl) return;
    
    const plannedDate = appState.conversation?.plannedDate;
    if (!plannedDate || !plannedDate.date) return;
    
    // Parse the date properly
    let dateObj;
    if (typeof plannedDate.date === 'string' && plannedDate.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // ISO date format - parse without timezone issues
        dateObj = new Date(plannedDate.date + 'T12:00:00');
    } else {
        dateObj = new Date(plannedDate.date);
    }
    
    const now = new Date();
    
    // Set time based on the planned time for countdown
    const targetDate = new Date(dateObj);
    if (plannedDate.time === 'morning') {
        targetDate.setHours(10, 0, 0, 0);
    } else if (plannedDate.time === 'afternoon') {
        targetDate.setHours(14, 0, 0, 0);
    } else {
        targetDate.setHours(19, 0, 0, 0);
    }
    
    // Calculate days between dates (ignoring time for day count)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    const dayDiff = Math.round((dateStart - todayStart) / (1000 * 60 * 60 * 24));
    
    // Calculate hours until the event
    const diffMs = targetDate - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    let countdownText;
    let badgeColor = '#4CAF50'; // Green by default
    
    if (diffMs < 0) {
        // Date/time has passed
        countdownText = 'Happening Now!';
        badgeColor = '#E91E63'; // Pink for happening now
    } else if (dayDiff === 0) {
        // Today
        if (diffHours > 0) {
            countdownText = `Today! ${diffHours}h`;
            badgeColor = '#FF9800'; // Orange for today
        } else if (diffMinutes > 0) {
            countdownText = `${diffMinutes}m away!`;
            badgeColor = '#E91E63'; // Pink for imminent
        } else {
            countdownText = 'Today!';
            badgeColor = '#FF9800';
        }
    } else if (dayDiff === 1) {
        countdownText = 'Tomorrow!';
        badgeColor = '#4CAF50';
    } else if (dayDiff === 2) {
        countdownText = 'In 2 days';
        badgeColor = '#4CAF50';
    } else if (dayDiff <= 7) {
        countdownText = `In ${dayDiff} days`;
        badgeColor = '#4CAF50';
    } else {
        countdownText = `${dayDiff} days`;
        badgeColor = '#2196F3'; // Blue for far dates
    }
    
    countdownEl.textContent = countdownText;
    
    // Update badge color based on urgency
    if (countdownBadge) {
        countdownBadge.style.background = badgeColor;
    }
}

/**
 * Open directions to the date venue in user's preferred map app
 */
function openDirections() {
    const plannedDate = appState.conversation?.plannedDate;
    if (!plannedDate) {
        showToast('No date location set', 'error');
        return;
    }
    
    const venue = plannedDate.venue;
    const venueName = venue?.name || venue || 'Date Location';
    const userLocation = appState.user?.location || 'New York, NY';
    
    // Create search query for the venue
    const query = encodeURIComponent(`${venueName} near ${userLocation}`);
    
    // Detect platform and open appropriate map app
    const userAgent = navigator.userAgent.toLowerCase();
    
    let mapUrl;
    
    // Check if on iOS
    if (/iphone|ipad|ipod/.test(userAgent)) {
        // Apple Maps
        mapUrl = `maps://maps.apple.com/?q=${query}`;
    } else if (/android/.test(userAgent)) {
        // Google Maps for Android
        mapUrl = `geo:0,0?q=${query}`;
    } else {
        // Fallback to Google Maps web
        mapUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
    }
    
    // Try to open native app, fallback to web
    const opened = window.open(mapUrl, '_blank');
    
    if (!opened) {
        // Fallback to Google Maps web if popup blocked
        window.location.href = `https://www.google.com/maps/search/?api=1&query=${query}`;
    }
    
    showToast('Opening directions...');
}

// ==========================================
// Calendar Integration
// ==========================================

/**
 * Add date to phone calendar
 * Can be called with parameters or without (reads from appState)
 */
function addDateToCalendar(date, time, venue, matchName) {
    // If no parameters, read from planned date
    if (!date && !venue) {
        const plannedDate = appState.conversation?.plannedDate;
        if (!plannedDate) {
            showToast('No date planned yet', 'error');
            return;
        }
        date = plannedDate.date;
        time = plannedDate.time;
        venue = plannedDate.venue?.name || plannedDate.venue || 'Date Location';
        matchName = appState.activeConnection?.name || 'Your Match';
    }
    
    // Parse the date and time to create actual Date objects
    const eventDate = parseDateSelection(date, time);
    
    // Store for later use
    appState.conversation.calendarEvent = {
        date: eventDate,
        venue: venue,
        matchName: matchName
    };
    
    // Show calendar options modal
    showCalendarModal(eventDate, venue, matchName);
}

/**
 * Parse date selection to actual Date object
 */
function parseDateSelection(dateStr, timeStr) {
    // Get the next occurrence of the selected day
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayMatch = dateStr.match(/(Sun|Mon|Tue|Wed|Thu|Fri|Sat)/i);
    
    const today = new Date();
    let targetDate = new Date();
    
    if (dayMatch) {
        const targetDay = days.findIndex(d => d.toLowerCase() === dayMatch[1].toLowerCase());
        const currentDay = today.getDay();
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        targetDate.setDate(today.getDate() + daysUntil);
    }
    
    // Set time based on selection
    const timeMap = {
        'Morning': { hour: 10, minute: 0 },
        'Afternoon': { hour: 14, minute: 0 },
        'Evening': { hour: 19, minute: 0 }
    };
    
    const timeSettings = timeMap[timeStr] || timeMap['Afternoon'];
    targetDate.setHours(timeSettings.hour, timeSettings.minute, 0, 0);
    
    return targetDate;
}

/**
 * Show calendar options modal
 */
function showCalendarModal(eventDate, venue, matchName) {
    // Create modal for calendar options
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'calendar-modal';
    
    const formattedDate = eventDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
    });
    const formattedTime = eventDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
    });
    
    modal.innerHTML = `
        <div class="modal-content calendar-modal-content">
            <button class="modal-close" onclick="closeCalendarModal()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
            
            <div class="calendar-modal-header">
                <div class="calendar-icon-large">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                        <path d="M9 16l2 2 4-4"/>
                    </svg>
                </div>
                <h3>Add to Calendar</h3>
                <p>Save your date with ${matchName}</p>
            </div>
            
            <div class="calendar-event-preview">
                <div class="event-detail">
                    <span class="event-icon">📅</span>
                    <span>${formattedDate}</span>
                </div>
                <div class="event-detail">
                    <span class="event-icon">🕐</span>
                    <span>${formattedTime}</span>
                </div>
                <div class="event-detail">
                    <span class="event-icon">📍</span>
                    <span>${venue.name}</span>
                </div>
            </div>
            
            <div class="calendar-options">
                <button class="calendar-option-btn" onclick="addToGoogleCalendar()">
                    <span class="cal-icon">📆</span>
                    <span>Google Calendar</span>
                </button>
                <button class="calendar-option-btn" onclick="addToAppleCalendar()">
                    <span class="cal-icon">🍎</span>
                    <span>Apple Calendar</span>
                </button>
                <button class="calendar-option-btn" onclick="downloadICSFile()">
                    <span class="cal-icon">📥</span>
                    <span>Download .ics File</span>
                </button>
            </div>
            
            <button class="btn btn-secondary" onclick="closeCalendarModal()">Maybe Later</button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

/**
 * Close calendar modal
 */
function closeCalendarModal() {
    const modal = document.getElementById('calendar-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

/**
 * Add to Google Calendar
 */
function addToGoogleCalendar() {
    const event = appState.conversation.calendarEvent;
    if (!event) return;
    
    const startDate = event.date;
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours
    
    const formatGoogleDate = (date) => {
        return date.toISOString().replace(/-|:|\.\d+/g, '');
    };
    
    const title = encodeURIComponent(`Date with ${event.matchName} 💕`);
    const details = encodeURIComponent(`Your OITH date at ${event.venue.name}. Have a wonderful time!`);
    const location = encodeURIComponent(event.venue.name);
    const dates = `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`;
    
    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
    
    window.open(googleUrl, '_blank');
    closeCalendarModal();
    showToast('📅 Opening Google Calendar...');
}

/**
 * Add to Apple Calendar (generates .ics file)
 */
function addToAppleCalendar() {
    downloadICSFile();
}

/**
 * Generate and download ICS file
 */
function downloadICSFile() {
    const event = appState.conversation.calendarEvent;
    if (!event) return;
    
    const startDate = event.date;
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours
    
    const formatICSDate = (date) => {
        return date.toISOString().replace(/-|:|\.\d+/g, '').slice(0, -1);
    };
    
    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//OITH//Date App//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `DTSTART:${formatICSDate(startDate)}`,
        `DTEND:${formatICSDate(endDate)}`,
        `SUMMARY:Date with ${event.matchName} 💕`,
        `DESCRIPTION:Your OITH date at ${event.venue.name}. Have a wonderful time!`,
        `LOCATION:${event.venue.name}`,
        `STATUS:CONFIRMED`,
        'BEGIN:VALARM',
        'TRIGGER:-PT1H',
        'ACTION:DISPLAY',
        'DESCRIPTION:Your date is in 1 hour!',
        'END:VALARM',
        'BEGIN:VALARM',
        'TRIGGER:-PT15M',
        'ACTION:DISPLAY', 
        'DESCRIPTION:Your date starts in 15 minutes!',
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
    
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `date-with-${event.matchName.toLowerCase().replace(/\s+/g, '-')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    closeCalendarModal();
    showToast('📅 Calendar event downloaded!');
}

// ==========================================
// Event Listeners
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Toggle button functionality
    document.querySelectorAll('.toggle-group').forEach(group => {
        group.addEventListener('click', (e) => {
            if (e.target.classList.contains('toggle-btn')) {
                group.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
            }
        });
    });
    
    // Date option selection
    document.querySelectorAll('.date-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.date-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
        });
    });
    
    // Time option selection
    document.querySelectorAll('.time-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.time-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
        });
    });
    
    // Venue selection
    document.querySelectorAll('.venue-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.venue-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });
});

// ==========================================
// Touch/Swipe Support for Match Cards
// ==========================================
let touchStartX = 0;
let touchEndX = 0;
let isSwiping = false;

document.addEventListener('DOMContentLoaded', () => {
    const matchCard = document.getElementById('matchCard');
    
    if (matchCard) {
        matchCard.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            isSwiping = true;
        }, { passive: true });
        
        matchCard.addEventListener('touchmove', (e) => {
            if (!isSwiping) return;
            
            const currentX = e.changedTouches[0].screenX;
            const diff = currentX - touchStartX;
            
            matchCard.style.transform = `translateX(${diff * 0.3}px) rotate(${diff * 0.02}deg)`;
            matchCard.style.transition = 'none';
        }, { passive: true });
        
        matchCard.addEventListener('touchend', (e) => {
            if (!isSwiping) return;
            
            touchEndX = e.changedTouches[0].screenX;
            const diff = touchEndX - touchStartX;
            
            matchCard.style.transition = '';
            matchCard.style.transform = '';
            
            if (Math.abs(diff) > 100) {
                if (diff > 0) {
                    likeMatch();
                } else {
                    declineMatch();
                }
            }
            
            isSwiping = false;
        }, { passive: true });
    }
});

// ==========================================
// Keyboard Navigation
// ==========================================
document.addEventListener('keydown', (e) => {
    if (appState.currentScreen === 'match') {
        if (e.key === 'ArrowLeft') {
            declineMatch();
        } else if (e.key === 'ArrowRight') {
            likeMatch();
        }
    }
});

// ==========================================
// Seed Demo Accounts (for development only - disabled in production)
// ==========================================
function seedDemoAccounts() {
    // DISABLED: No longer auto-create demo accounts
    // Only real registered users will appear in the database
    
    // Clean up any previously created demo accounts
    cleanupDemoAccounts();
    
    return [];
}

// Clean up demo accounts that were previously auto-created
function cleanupDemoAccounts() {
    const demoEmails = ['demo@oith.com', 'test@oith.com', 'matt@oith.com'];
    
    // Remove from registered users
    const registeredUsers = JSON.parse(localStorage.getItem('oith_registered_users') || '{}');
    let updated = false;
    
    demoEmails.forEach(email => {
        if (registeredUsers[email]) {
            delete registeredUsers[email];
            updated = true;
            console.log(`🗑️ Removed demo account: ${email}`);
        }
        
        // Also remove user data
        const userDataKey = `oith_user_${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        if (localStorage.getItem(userDataKey)) {
            localStorage.removeItem(userDataKey);
            console.log(`🗑️ Removed demo user data: ${email}`);
        }
    });
    
    if (updated) {
        localStorage.setItem('oith_registered_users', JSON.stringify(registeredUsers));
    }
}

// Original demo account function (kept for reference, disabled)
function _seedDemoAccountsDisabled() {
    const registeredUsers = JSON.parse(localStorage.getItem('oith_registered_users') || '{}');
    
    // Demo accounts that work on any device
    const demoAccounts = {
        'demo@oith.com': {
            email: 'demo@oith.com',
            password: 'Demo123!',
            firstName: 'Demo',
            createdAt: '2024-01-01T00:00:00.000Z'
        },
        'test@oith.com': {
            email: 'test@oith.com',
            password: 'Test123!',
            firstName: 'Test',
            createdAt: '2024-01-01T00:00:00.000Z'
        },
        'matt@oith.com': {
            email: 'matt@oith.com',
            password: 'Deltathree41!',
            firstName: 'Matt',
            createdAt: '2024-01-01T00:00:00.000Z'
        },
        'mattr2624@gmail.com': {
            email: 'mattr2624@gmail.com',
            password: 'Deltathree41!',
            firstName: 'Matt',
            createdAt: '2024-01-01T00:00:00.000Z'
        }
    };
    
    let updated = false;
    
    // Add demo accounts if they don't exist OR update password if it changed
    Object.entries(demoAccounts).forEach(([email, account]) => {
        if (!registeredUsers[email]) {
            registeredUsers[email] = account;
            updated = true;
            console.log(`✅ Demo account created: ${email}`);
        } else if (registeredUsers[email].password !== account.password) {
            // Update password to match demo account
            registeredUsers[email].password = account.password;
            updated = true;
            console.log(`✅ Demo account password updated: ${email}`);
        }
    });
    
    if (updated) {
        localStorage.setItem('oith_registered_users', JSON.stringify(registeredUsers));
        console.log('💾 Registered users updated');
    }
    
    // Also seed user data for demo accounts
    Object.entries(demoAccounts).forEach(([email, account]) => {
        const userDataKey = `oith_user_${email}`;
        const existingData = localStorage.getItem(userDataKey);
        
        // Always ensure profileComplete is set for demo accounts
        if (existingData) {
            try {
                const data = JSON.parse(existingData);
                if (!data.profileComplete) {
                    data.profileComplete = true;
                    localStorage.setItem(userDataKey, JSON.stringify(data));
                    console.log(`✅ Fixed profileComplete for: ${email}`);
                }
            } catch (e) {
                console.error('Error parsing user data:', e);
            }
        } else {
            // Create new user data
            const userData = {
                version: 'v1.0',
                user: {
                    firstName: account.firstName,
                    email: email,
                    birthday: '1995-06-15',
                    gender: 'male',
                    location: 'New York, NY',
                    bio: 'Demo user for testing OITH features!',
                    occupation: 'Product Tester',
                    education: 'bachelors',
                    photos: []
                },
                isLoggedIn: false,
                profileComplete: true, // Demo accounts have complete profiles
                oneMatch: {
                    current: null,
                    dailyMatchPresented: false
                },
                matchHistory: [],
                conversation: { messages: [] }
            };
            localStorage.setItem(userDataKey, JSON.stringify(userData));
            console.log(`✅ Created user data for: ${email}`);
        }
    });
    
    return Object.keys(demoAccounts);
}

// Debug function - can be called from browser console
window.debugLogin = function(email) {
    const registeredUsers = JSON.parse(localStorage.getItem('oith_registered_users') || '{}');
    const lowerEmail = email?.toLowerCase();
    
    console.log('=== DEBUG LOGIN ===');
    console.log('Looking for:', lowerEmail);
    console.log('All registered emails:', Object.keys(registeredUsers));
    
    const foundEmail = Object.keys(registeredUsers).find(e => e.toLowerCase() === lowerEmail);
    if (foundEmail) {
        console.log('Found user:', foundEmail);
        console.log('Stored password:', registeredUsers[foundEmail].password);
        console.log('First name:', registeredUsers[foundEmail].firstName);
    } else {
        console.log('User NOT found');
    }
};

// Debug function to verify localStorage data - call debugStorage() in browser console
window.debugStorage = function(email) {
    const targetEmail = email || appState.user?.email;
    if (!targetEmail) {
        console.log('❌ No email provided. Usage: debugStorage("email@example.com")');
        return;
    }
    
    console.log('=== DEBUG STORAGE ===');
    console.log('Email:', targetEmail);
    
    // Check registered users
    const registeredUsers = JSON.parse(localStorage.getItem('oith_registered_users') || '{}');
    console.log('Registered users:', Object.keys(registeredUsers));
    console.log('Is registered:', !!registeredUsers[targetEmail]);
    
    // Check user data
    const storageKey = getUserStorageKey(targetEmail);
    console.log('Storage key:', storageKey);
    
    const rawData = localStorage.getItem(storageKey);
    if (rawData) {
        const data = JSON.parse(rawData);
        console.log('User data found:');
        console.log('  - Age:', data.user?.age);
        console.log('  - Birthday:', data.user?.birthday);
        console.log('  - Location:', data.user?.location);
        console.log('  - Gender:', data.user?.gender);
        console.log('  - Name:', data.user?.firstName);
        console.log('  - Photos:', data.user?.photos?.filter(p=>p)?.length || 0);
        console.log('  - ProfileComplete:', data.profileComplete);
        console.log('Full user object:', data.user);
    } else {
        console.log('❌ No user data found for key:', storageKey);
    }
    
    // Also show current appState for comparison
    console.log('\nCurrent appState.user:');
    console.log('  - Age:', appState.user?.age);
    console.log('  - Birthday:', appState.user?.birthday);
    console.log('  - Location:', appState.user?.location);
};

// Debug function to check test bots - call debugBots() in browser console
window.debugBots = function() {
    const testBots = JSON.parse(localStorage.getItem('oith_test_bots') || '[]');
    
    console.log('=== DEBUG TEST BOTS ===');
    console.log('Total bots in localStorage:', testBots.length);
    
    testBots.forEach((bot, i) => {
        console.log(`Bot ${i + 1}: ${bot.name} (ID: ${bot.id}) - Active: ${bot.active ? '✅ YES' : '❌ NO'}`);
    });
    
    const activeBots = testBots.filter(b => b.active);
    console.log(`\n${activeBots.length} active bots:`, activeBots.map(b => b.name).join(', ') || 'NONE');
    
    console.log('\nMatch pool profiles:', appState.matchPool.map(m => m.name).join(', '));
    console.log('Match pool size:', appState.matchPool.length);
    
    if (appState.oneMatch?.current) {
        console.log('\nCurrent match:', appState.oneMatch.current.name);
        console.log('Decision made:', appState.oneMatch.decisionMade);
    } else {
        console.log('\nNo current match');
    }
    
    console.log('\nTo test matching, call: debugMatch()');
};

// Debug function to test getting a match - call debugMatch() in browser console
window.debugMatch = function() {
    console.log('=== DEBUG MATCH ===');
    console.log('Calling getNextMatch()...\n');
    const match = getNextMatch();
    
    if (match) {
        console.log('✅ MATCH FOUND:', match.name);
        console.log('   Age:', match.age);
        console.log('   Location:', match.location || match.distance);
        console.log('   Compatibility:', match.compatibility);
    } else {
        console.log('❌ NO MATCH FOUND');
        console.log('   Check the logs above to see why profiles were filtered out');
    }
    
    return match;
    console.log('==================');
};

// Simulate the other user (match/bot) ending the connection
window.simulateBotEndConnection = function() {
    if (appState.activeConnection) {
        const matchName = appState.activeConnection.name;
        handleMatchEndedConnection(matchName);
        console.log('✅ Simulated bot ending connection');
    } else {
        console.log('❌ No active connection to end');
    }
};

// ==========================================
// Data Export/Import for Cross-Domain Sync
// ==========================================

/**
 * Export all user data as JSON file for transfer to another domain
 */
function exportUserData() {
    const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        source: window.location.hostname,
        data: {}
    };
    
    // Export all OITH-related localStorage items
    for (let key in localStorage) {
        if (key.startsWith('oith_')) {
            try {
                exportData.data[key] = JSON.parse(localStorage.getItem(key));
            } catch (e) {
                exportData.data[key] = localStorage.getItem(key);
            }
        }
    }
    
    // Create and download the file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oith_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('📤 Data exported! Transfer this file to your other device.', 'success');
}

/**
 * Trigger file input for importing data
 */
function triggerImportData() {
    document.getElementById('importDataFile').click();
}

/**
 * Import user data from JSON file
 */
function importUserData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importData = JSON.parse(e.target.result);
            
            // Validate import format
            if (!importData.data || typeof importData.data !== 'object') {
                showToast('❌ Invalid backup file format', 'error');
                return;
            }
            
            // Confirm import
            const itemCount = Object.keys(importData.data).length;
            const sourceInfo = importData.source ? ` from ${importData.source}` : '';
            
            if (!confirm(`Import ${itemCount} data items${sourceInfo}?\n\nThis will overwrite any existing data.`)) {
                return;
            }
            
            // Import all data
            for (let key in importData.data) {
                const value = importData.data[key];
                localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
            }
            
            showToast('📥 Data imported successfully! Please log in.', 'success');
            
            // Reset file input
            event.target.value = '';
            
            // Reload to apply imported data
            setTimeout(() => {
                window.location.reload();
            }, 1500);
            
        } catch (err) {
            console.error('Import error:', err);
            showToast('❌ Failed to import data: ' + err.message, 'error');
        }
    };
    
    reader.readAsText(file);
}

// Force reset password for an email
window.resetPassword = function(email, newPassword) {
    const registeredUsers = JSON.parse(localStorage.getItem('oith_registered_users') || '{}');
    const lowerEmail = email?.toLowerCase();
    const foundEmail = Object.keys(registeredUsers).find(e => e.toLowerCase() === lowerEmail);
    
    if (foundEmail) {
        registeredUsers[foundEmail].password = newPassword;
        localStorage.setItem('oith_registered_users', JSON.stringify(registeredUsers));
        console.log('✅ Password reset for:', foundEmail);
        console.log('New password:', newPassword);
        return true;
    } else {
        console.log('❌ User not found:', email);
        return false;
    }
};

// ==========================================
// Cross-Tab Sync (Real-time sync with Admin Dashboard)
// ==========================================

// Helper function to update UI for logged-in user (used by crawler)
function updateUIForLoggedInUser() {
    // Update any logged-in indicators
    const user = appState.user;
    if (!user) return;
    
    // Update profile displays if they exist
    const profileNameEls = document.querySelectorAll('[data-user-name]');
    profileNameEls.forEach(el => el.textContent = user.name || 'User');
    
    const profileAgeEls = document.querySelectorAll('[data-user-age]');
    profileAgeEls.forEach(el => el.textContent = user.age || '');
    
    // Update nav tabs if visible
    const navTabs = document.querySelector('.bottom-nav');
    if (navTabs) navTabs.style.display = 'flex';
    
    console.log('🎨 UI updated for logged-in user:', user.name || user.email);
}

const oithSyncChannel = new BroadcastChannel('oith_sync');

// ==========================================
// User Behavior Tracking
// ==========================================
const userBehavior = {
    sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    sessionStart: Date.now(),
    screenTime: {},          // { screenId: totalMs }
    screenVisits: {},        // { screenId: count }
    buttonClicks: {},        // { buttonId/text: count }
    navigationPath: [],      // Array of screen transitions
    currentScreenStart: null,
    lastActivity: Date.now(),
    scrollDepth: {},         // { screenId: maxScrollPercent }
    formInteractions: 0,
    swipeActions: { left: 0, right: 0 }
};

// Track screen time
function trackScreenEnter(screenId) {
    const now = Date.now();
    
    // End previous screen tracking
    if (userBehavior.currentScreenStart && appState.currentScreen) {
        const prevScreen = appState.currentScreen;
        const timeSpent = now - userBehavior.currentScreenStart;
        userBehavior.screenTime[prevScreen] = (userBehavior.screenTime[prevScreen] || 0) + timeSpent;
    }
    
    // Start new screen tracking
    userBehavior.currentScreenStart = now;
    userBehavior.screenVisits[screenId] = (userBehavior.screenVisits[screenId] || 0) + 1;
    userBehavior.navigationPath.push({ screen: screenId, timestamp: now });
    userBehavior.lastActivity = now;
    
    // Keep navigation path manageable (last 100 transitions)
    if (userBehavior.navigationPath.length > 100) {
        userBehavior.navigationPath = userBehavior.navigationPath.slice(-100);
    }
    
    // Send real-time update to admin
    sendBehaviorUpdate('screen_view', { screen: screenId });
}

// Track button clicks
function trackButtonClick(buttonInfo) {
    const key = buttonInfo.id || buttonInfo.text || buttonInfo.class || 'unknown';
    userBehavior.buttonClicks[key] = (userBehavior.buttonClicks[key] || 0) + 1;
    userBehavior.lastActivity = Date.now();
    
    // Send real-time update to admin
    sendBehaviorUpdate('button_click', { 
        button: key, 
        screen: appState.currentScreen,
        text: buttonInfo.text
    });
}

// Track swipe actions
function trackSwipe(direction) {
    if (direction === 'left') {
        userBehavior.swipeActions.left++;
    } else if (direction === 'right') {
        userBehavior.swipeActions.right++;
    }
    userBehavior.lastActivity = Date.now();
    
    sendBehaviorUpdate('swipe', { direction, screen: appState.currentScreen });
}

// Send behavior update to admin
function sendBehaviorUpdate(eventType, data) {
    try {
        oithSyncChannel.postMessage({
            source: 'app',
            type: 'behavior_event',
            eventType: eventType,
            data: data,
            user: appState.user?.email || 'anonymous',
            sessionId: userBehavior.sessionId,
            timestamp: Date.now()
        });
    } catch (e) {
        // Ignore broadcast errors
    }
}

// Send full behavior summary periodically
function sendBehaviorSummary() {
    // Calculate current screen time
    if (userBehavior.currentScreenStart && appState.currentScreen) {
        const now = Date.now();
        const currentTime = now - userBehavior.currentScreenStart;
        userBehavior.screenTime[appState.currentScreen] = 
            (userBehavior.screenTime[appState.currentScreen] || 0) + currentTime;
        userBehavior.currentScreenStart = now;
    }
    
    try {
        oithSyncChannel.postMessage({
            source: 'app',
            type: 'behavior_summary',
            sessionId: userBehavior.sessionId,
            sessionDuration: Date.now() - userBehavior.sessionStart,
            screenTime: { ...userBehavior.screenTime },
            screenVisits: { ...userBehavior.screenVisits },
            buttonClicks: { ...userBehavior.buttonClicks },
            navigationPath: userBehavior.navigationPath.slice(-20),
            swipeActions: { ...userBehavior.swipeActions },
            formInteractions: userBehavior.formInteractions,
            user: appState.user?.email || 'anonymous',
            currentScreen: appState.currentScreen,
            timestamp: Date.now()
        });
    } catch (e) {
        // Ignore broadcast errors
    }
}

// Set up global click tracking
document.addEventListener('click', (e) => {
    const target = e.target.closest('button, .btn, .nav-item, [onclick], a');
    if (target) {
        trackButtonClick({
            id: target.id || null,
            text: target.textContent?.trim().substring(0, 30) || null,
            class: target.className || null
        });
    }
    
    // Track form interactions
    if (e.target.matches('input, select, textarea')) {
        userBehavior.formInteractions++;
        userBehavior.lastActivity = Date.now();
    }
}, true);

// Send behavior summary every 30 seconds
setInterval(sendBehaviorSummary, 30000);

// Send summary when page is about to unload
window.addEventListener('beforeunload', () => {
    sendBehaviorSummary();
});

// Listen for changes from admin dashboard or other tabs
oithSyncChannel.onmessage = (event) => {
    console.log('📡 Received sync message:', event.data);
    
    // Skip messages from self
    if (event.data.source === 'app') return;
    
    // Respond to ping requests from admin
    if (event.data.type === 'ping') {
        console.log('📡 Ping received from admin, sending pong...');
        oithSyncChannel.postMessage({
            source: 'app',
            type: 'pong',
            timestamp: Date.now(),
            appReady: true,
            currentScreen: document.querySelector('.screen.active')?.id || 'unknown'
        });
        return;
    }
    
    // Handle crawler login - simulate logged-in user for testing
    if (event.data.type === 'crawler_login') {
        console.log('🔐 Crawler login request - setting up test user...');
        const { email, userData, testMatch, testConnection } = event.data;
        
        // Set up app state as if user is logged in with full data
        appState.user = userData.user;
        appState.user.loggedIn = true;
        appState.isLoggedIn = true;
        appState.profileComplete = userData.profileComplete || true;
        
        // Set up match state
        appState.oneMatch = userData.oneMatch || { current: null, status: null };
        
        // Set up active connection with all required properties
        appState.activeConnection = userData.activeConnection;
        
        // Set up connection metrics for chat screens
        appState.connectionMetrics = userData.connectionMetrics || {
            messageCount: 6,
            avgResponseTime: '5m',
            compatibility: 92,
            dateReadiness: 65,
            connectedAt: new Date().toISOString()
        };
        
        // Set up conversation state
        appState.conversation = userData.conversation || {
            messages: [],
            dateReadiness: 65,
            datePlanned: false,
            conversationStarted: true
        };
        
        // Set up connections list for chat-list screen
        appState.connections = userData.connections || [];
        
        // Set up match pool and history
        appState.matchPool = userData.matchPool || [];
        appState.matchHistory = userData.matchHistory || [];
        appState.passedMatches = userData.passedMatches || [];
        
        // Store in localStorage
        localStorage.setItem('oith_current_user', email);
        localStorage.setItem(`oith_user_${email}`, JSON.stringify(userData));
        
        // Update UI to show logged-in state
        try {
            updateUIForLoggedInUser();
        } catch (e) {
            console.log('⚠️ Could not update UI:', e.message);
        }
        
        console.log('✅ Crawler test user logged in:', email);
        console.log('   oneMatch:', appState.oneMatch);
        console.log('   activeConnection:', appState.activeConnection ? 'present' : 'none');
        console.log('   connections:', appState.connections?.length || 0);
        
        oithSyncChannel.postMessage({
            source: 'app',
            type: 'crawler_login_success',
            email: email,
            timestamp: Date.now()
        });
        return;
    }
    
    // Handle crawler logout
    if (event.data.type === 'crawler_logout') {
        console.log('🔐 Crawler logout - cleaning up test user...');
        appState.user = { loggedIn: false };
        appState.oneMatch = { current: null, status: null, decisionMade: false };
        appState.activeConnection = null;
        appState.chatMessages = {};
        localStorage.removeItem('oith_current_user');
        console.log('✅ Crawler test user logged out');
        return;
    }
    
    // Handle config updates from admin
    if (event.data.type === 'config_update' && event.data.config) {
        console.log('📡 Received config update from admin:', event.data.config);
        localStorage.setItem('oith_index_config', JSON.stringify(event.data.config));
        
        // Apply maintenance mode if enabled
        if (event.data.config.maintenanceMode) {
            alert('App is in maintenance mode. Some features may be unavailable.');
        }
        return;
    }
    
    // Handle full data sync from admin
    if (event.data.type === 'full_data_sync' && event.data.data) {
        console.log('📡 Received full data sync from admin');
        // Store test bots if provided
        if (event.data.data.testBots) {
            localStorage.setItem('oith_test_bots', JSON.stringify(event.data.data.testBots));
            syncUsersToMatchPool();
        }
        return;
    }
    
    // Handle data request from admin
    if (event.data.type === 'request_data' && event.data.from === 'admin') {
        console.log('📡 Admin requested data');
        if (appState.user) {
            const storageKey = getUserStorageKey(appState.user.email);
            const userData = localStorage.getItem(storageKey);
            oithSyncChannel.postMessage({
                source: 'app',
                type: 'data_response',
                currentUser: { email: appState.user.email },
                userData: userData ? JSON.parse(userData) : null
            });
        }
        return;
    }
    
    // Handle reset to defaults from admin
    if (event.data.type === 'reset_to_defaults' && event.data.from === 'admin') {
        console.log('📡 Admin requested reset to defaults');
        if (confirm('Admin has requested to reset the app. This will log you out. Continue?')) {
            handleLogout();
        }
        return;
    }
    
    if (event.data.type === 'user_updated') {
        console.log('📡 Received user_updated for:', event.data.email);
        console.log('   Current user:', appState.user?.email);
        
        // Check if this update is for the current user
        if (appState.user?.email && event.data.email && 
            event.data.email.toLowerCase() === appState.user.email.toLowerCase()) {
            
            // Reload user data from localStorage (which admin just updated)
            const storageKey = getUserStorageKey(appState.user.email);
            const savedData = localStorage.getItem(storageKey);
            
            console.log('📂 Reloading from localStorage:', storageKey);
            
            if (savedData) {
                const data = JSON.parse(savedData);
                if (data.user) {
                    // Merge the updated user data
                    const oldAge = appState.user.age;
                    const oldLocation = appState.user.location;
                    
                    appState.user = { ...appState.user, ...data.user };
                    
                    console.log('✅ User data synced from admin dashboard:');
                    console.log('   Age:', oldAge, '->', appState.user.age);
                    console.log('   Location:', oldLocation, '->', appState.user.location);
                    console.log('   Full user:', data.user);
                    
                    // Also restore other state if available
                    if (data.feedbackReceived) appState.feedbackReceived = data.feedbackReceived;
                    if (data.feedbackGiven) appState.feedbackGiven = data.feedbackGiven;
                    
                    // Show sync notification
                    showSyncNotification('Profile updated by admin');
                    
                    // Refresh current screen to show updated data
                    const currentScreen = document.querySelector('.screen.active');
                    if (currentScreen) {
                        console.log('🔄 Refreshing screen:', currentScreen.id);
                        showScreen(currentScreen.id);
                    }
                }
            }
        } else {
            console.log('   ⏭️ Skipping - not for current user');
        }
    }
    
    if (event.data.type === 'user_deleted' && appState.user?.email) {
        // Check if current user was deleted
        if (event.data.email && event.data.email.toLowerCase() === appState.user.email.toLowerCase()) {
            console.log('⚠️ Current user was deleted by admin');
            alert('Your account has been deleted by an administrator.');
            handleLogout();
        }
    }
    
    if (event.data.type === 'testbots_updated') {
        console.log('✅ Test bots synced from admin dashboard');
        showSyncNotification(`${event.data.count || 0} test profiles active`);
        
        // Sync match pool with new bot data
        syncUsersToMatchPool();
        
        // Refresh match if currently on waiting or adjust preferences screen
        const currentScreen = document.querySelector('.screen.active');
        if (currentScreen?.id === 'waiting-match' || currentScreen?.id === 'adjust-preferences') {
            updateMatchingStats();
        }
        
        // If on match screen and no active match, try to get one
        if (currentScreen?.id === 'match' || currentScreen?.id === 'no-matches') {
            if (!appState.activeConnection && !appState.oneMatch.current) {
                presentMatch();
            }
        }
        
        // Refresh match presentation if viewing existing match
        if (appState.oneMatch?.status === 'matched') {
            presentMatch();
        }
    }
    
    // Admin-triggered app diagnostics
    if (event.data.type === 'run_diagnostics') {
        const screens = event.data.screens || [];
        const isComprehensive = event.data.comprehensive || false;
        const simulateLogin = event.data.simulateLogin || false;
        console.log('🧪 Running diagnostics for screens:', screens, 'comprehensive:', isComprehensive, 'simulateLogin:', simulateLogin);
        
        // If simulate login is enabled and we have a logged-in test user, ensure state is ready
        if (simulateLogin && appState.user?.loggedIn) {
            console.log('🔐 Using logged-in test user for diagnostics:', appState.user.email || appState.user.name);
        }
        
        // Send immediate acknowledgment
        oithSyncChannel.postMessage({
            source: 'app',
            type: 'diagnostics_started',
            screenCount: screens.length,
            loggedIn: appState.user?.loggedIn || false,
            timestamp: Date.now()
        });
        
        // Run diagnostics with delay between screens for better accuracy
        let index = 0;
        const runNextTest = () => {
            if (index >= screens.length) {
                // Send completion signal
                oithSyncChannel.postMessage({
                    source: 'app',
                    type: 'diagnostics_complete',
                    timestamp: Date.now()
                });
                return;
            }
            
            const screenId = screens[index];
            let ok = true;
            let errorMessage = '';
            
            try {
                const screenEl = document.getElementById(screenId);
                if (screenEl) {
                    // Try to show the screen
                    showScreen(screenId);
                    
                    // Additional checks for comprehensive mode
                    if (isComprehensive) {
                        // Check if screen has content
                        if (screenEl.innerHTML.trim().length < 50) {
                            ok = false;
                            errorMessage = 'Screen appears empty';
                        }
                        
                        // Check for required elements based on screen type
                        if (screenId === 'login' && !document.getElementById('loginEmail')) {
                            ok = false;
                            errorMessage = 'Missing login form elements';
                        }
                        if (screenId === 'signup' && !document.getElementById('signupEmail')) {
                            ok = false;
                            errorMessage = 'Missing signup form elements';
                        }
                        if (screenId === 'chat' && !document.getElementById('chatMessages')) {
                            ok = false;
                            errorMessage = 'Missing chat message container';
                        }
                    }
                } else {
                    ok = false;
                    errorMessage = 'Screen element not found in DOM';
                }
            } catch (err) {
                ok = false;
                errorMessage = String(err);
            }
            
            oithSyncChannel.postMessage({
                source: 'app',
                type: 'diagnostics_result',
                screen: screenId,
                ok,
                error: errorMessage
            });
            
            index++;
            // Delay between tests - reduced for faster completion
            setTimeout(runNextTest, isComprehensive ? 100 : 30);
        };
        
        runNextTest();
    }
};

// Global error handler to report JS errors to admin
window.addEventListener('error', (event) => {
    if (typeof oithSyncChannel !== 'undefined') {
        oithSyncChannel.postMessage({
            source: 'app',
            type: 'js_error',
            message: event.message,
            source: event.filename,
            line: event.lineno,
            col: event.colno,
            timestamp: Date.now()
        });
    }
});

// Show sync notification toast - DISABLED to avoid user distraction
function showSyncNotification(message) {
    // Sync notifications are now silent - just log to console
    console.log('📡 Sync:', message);
    return; // Don't show popup
    
    // Create or reuse sync notification element
    let syncToast = document.getElementById('syncToast');
    if (!syncToast) {
        syncToast = document.createElement('div');
        syncToast.id = 'syncToast';
        syncToast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, var(--accent), #b8655a);
            color: white;
            padding: 10px 20px;
            border-radius: 25px;
            font-size: 0.85rem;
            font-weight: 500;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(syncToast);
    }
    
    syncToast.innerHTML = `📡 ${message}`;
    syncToast.style.opacity = '1';
    
    setTimeout(() => {
        syncToast.style.opacity = '0';
    }, 3000);
}

// Listen for localStorage changes from other tabs (backup sync)
window.addEventListener('storage', (event) => {
    if (event.key?.startsWith('oith_user_') && appState.user?.email) {
        const expectedKey = getUserStorageKey(appState.user.email);
        if (event.key === expectedKey && event.newValue) {
            try {
                const data = JSON.parse(event.newValue);
                if (data.user) {
                    appState.user = { ...appState.user, ...data.user };
                    console.log('✅ User data synced via storage event:', data.user);
                    
                    // Refresh current screen
                    const currentScreen = document.querySelector('.screen.active');
                    if (currentScreen) {
                        showScreen(currentScreen.id);
                    }
                    
                    showSyncNotification('Profile synced');
                }
            } catch (e) {
                console.error('Error parsing storage event data:', e);
            }
        }
    }
    
    if (event.key === 'oith_test_bots') {
        console.log('✅ Test bots synced via storage event');
        
        // Sync match pool with new bot data
        syncUsersToMatchPool();
        
        // Check active bots
        const testBots = JSON.parse(event.newValue || '[]');
        const activeBots = testBots.filter(bot => bot.active);
        console.log(`   Active bots: ${activeBots.length}`);
        
        // Reload test bots for matching
        const currentScreen = document.querySelector('.screen.active');
        if (currentScreen?.id === 'adjust-preferences') {
            updateMatchingStats();
        }
        
        // If on match or no-matches screen and no active match, try to get one
        if ((currentScreen?.id === 'match' || currentScreen?.id === 'no-matches') && 
            !appState.activeConnection && !appState.oneMatch.current && activeBots.length > 0) {
            console.log('   Presenting new match from newly activated bot...');
            presentMatch();
        }
        
        showSyncNotification(`${activeBots.length} test profiles active`);
    }
});

// Broadcast changes when app saves data
function broadcastSync(type, data = {}) {
    oithSyncChannel.postMessage({ type, ...data, source: 'app', timestamp: Date.now() });
}

// ==========================================
// Default Test Bots (seeded if none exist)
// ==========================================
const DEFAULT_TEST_BOTS = [
    {
        id: 'bot_1',
        name: 'Emma',
        age: 26,
        gender: 'female',
        location: 'New York, NY',
        occupation: 'UX Designer',
        education: 'bachelors',
        bio: 'Creative soul who loves hiking and coffee. Looking for genuine connections.',
        photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop',
        active: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'bot_2',
        name: 'Sophie',
        age: 24,
        gender: 'female',
        location: 'Los Angeles, CA',
        occupation: 'Marketing Manager',
        education: 'bachelors',
        bio: 'Beach lover and yoga enthusiast. Let\'s explore the city together!',
        photo: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=500&fit=crop',
        active: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'bot_3',
        name: 'Alex',
        age: 28,
        gender: 'male',
        location: 'Chicago, IL',
        occupation: 'Software Engineer',
        education: 'masters',
        bio: 'Tech nerd with a passion for music and travel. Always up for an adventure.',
        photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop',
        active: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'bot_4',
        name: 'Mia',
        age: 25,
        gender: 'female',
        location: 'Miami, FL',
        occupation: 'Nurse',
        education: 'bachelors',
        bio: 'Caring and compassionate. Love dancing and good food!',
        photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop',
        active: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'bot_5',
        name: 'James',
        age: 30,
        gender: 'male',
        location: 'Austin, TX',
        occupation: 'Entrepreneur',
        education: 'bachelors',
        bio: 'Building something cool. Looking for someone to share the journey.',
        photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=500&fit=crop',
        active: true,
        createdAt: new Date().toISOString()
    }
];

// ==========================================
// Auto-load Sync Data (Test Bots & Users)
// ==========================================
async function autoLoadSyncData() {
    try {
        // Check if we already have test bots
        const existingBots = localStorage.getItem('oith_test_bots');
        const existingUsers = localStorage.getItem('oith_registered_users');
        
        if (existingBots && JSON.parse(existingBots).length > 0) {
            console.log('📦 Test bots already loaded:', JSON.parse(existingBots).length);
            return true;
        }
        
        // Try to fetch sync data file
        console.log('🔄 No test bots found, attempting to load sync data...');
        
        let botsLoaded = false;
        
        try {
            const response = await fetch('data/oith_sync_data.json');
            if (response.ok) {
                const syncData = await response.json();
                console.log('📥 Sync data loaded successfully');
                
                // Load test bots if available
                if (syncData.testBots && syncData.testBots.length > 0) {
                    localStorage.setItem('oith_test_bots', JSON.stringify(syncData.testBots));
                    console.log(`   ✅ Loaded ${syncData.testBots.length} test bots from sync file`);
                    botsLoaded = true;
                }
                
                // Load registered users if we don't have any
                if (syncData.registeredUsers && Object.keys(syncData.registeredUsers).length > 0) {
                    const currentUsers = JSON.parse(existingUsers || '{}');
                    if (Object.keys(currentUsers).length === 0) {
                        localStorage.setItem('oith_registered_users', JSON.stringify(syncData.registeredUsers));
                        console.log(`   ✅ Loaded ${Object.keys(syncData.registeredUsers).length} registered users`);
                    }
                }
                
                // Load user data if available
                if (syncData.userData) {
                    Object.entries(syncData.userData).forEach(([email, data]) => {
                        const key = 'oith_user_' + email.toLowerCase().replace(/[^a-z0-9]/g, '_');
                        if (!localStorage.getItem(key)) {
                            localStorage.setItem(key, JSON.stringify(data));
                        }
                    });
                    console.log(`   ✅ Loaded user data for ${Object.keys(syncData.userData).length} users`);
                }
            }
        } catch (fetchError) {
            console.log('⚠️ Could not load sync data file:', fetchError.message);
        }
        
        // If no test bots were loaded from sync file, seed default ones
        if (!botsLoaded) {
            console.log('🤖 Seeding default test bots...');
            localStorage.setItem('oith_test_bots', JSON.stringify(DEFAULT_TEST_BOTS));
            console.log(`   ✅ Seeded ${DEFAULT_TEST_BOTS.length} default test bots`);
        }
        
        return true;
    } catch (error) {
        console.log('⚠️ Auto-load sync data failed:', error.message);
        // Still try to seed default test bots
        try {
            localStorage.setItem('oith_test_bots', JSON.stringify(DEFAULT_TEST_BOTS));
            console.log(`   ✅ Seeded ${DEFAULT_TEST_BOTS.length} default test bots (fallback)`);
        } catch (e) {
            console.log('❌ Could not seed default test bots');
        }
        return false;
    }
}

// ==========================================
// Initialize App
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // Auto-load sync data (test bots & users) if localStorage is empty
    await autoLoadSyncData();
    
    // Fetch AWS users for match pool (so users can match with other AWS users)
    await fetchAWSUsersForMatchPool();
    
    // Seed demo accounts for cross-device access
    const demoEmails = seedDemoAccounts();
    // Check if URL has a query parameter for direct screen navigation (used by overview page)
    const urlParams = new URLSearchParams(window.location.search);
    const screenParam = urlParams.get('screen');
    
    // Also check hash for backwards compatibility
    const urlHash = window.location.hash.substring(1);
    const targetScreen = screenParam || urlHash;
    
    if (targetScreen && document.getElementById(targetScreen)) {
        // Direct screen preview mode - just show the screen without loading user data
        // Hide ALL screens first with inline styles to ensure they're hidden
        document.querySelectorAll('.screen').forEach(s => {
            s.classList.remove('active');
            s.style.opacity = '0';
            s.style.visibility = 'hidden';
            s.style.display = 'none';
        });
        
        // Show only the target screen
        const target = document.getElementById(targetScreen);
        target.classList.add('active');
        target.style.opacity = '1';
        target.style.visibility = 'visible';
        target.style.display = 'flex';
        target.style.transform = 'translateX(0)';
        
        // For modals, also show them
        if (targetScreen.includes('modal')) {
            const modal = document.getElementById(targetScreen);
            if (modal) {
                modal.classList.add('active');
                modal.style.display = 'flex';
                modal.style.opacity = '1';
                modal.style.visibility = 'visible';
            }
        }
        
        // Populate screens with demo data for preview
        populatePreviewData(targetScreen);
        
        return; // Skip normal initialization
    }
    
    console.log('═══════════════════════════════════════════');
    console.log('  OITH - One In The Hand');
    console.log('  "A bird in the hand is worth two in the bush"');
    console.log('═══════════════════════════════════════════');
    console.log('');
    console.log('  ONE MATCH AT A TIME');
    console.log('  Focus on who\'s in front of you.');
    console.log('');
    console.log('  Controls: ← Pass | → Like');
    console.log('═══════════════════════════════════════════');
    
    // Try to load saved user data
    const hasData = loadUserData();
    
    // Add smooth scroll behavior
    document.querySelectorAll('.screen').forEach(screen => {
        screen.style.scrollBehavior = 'smooth';
    });
    
    // Check if user has existing session
    if (hasData && appState.isLoggedIn) {
        console.log('');
        console.log('👋 Welcome back, ' + (appState.user.firstName || 'User') + '!');
        console.log('');
        
        // Check for and apply any active experiment treatments
        checkAndApplyExperiments();
        
        // Ensure profile visibility is correct when matched
        if (appState.activeConnection && !appState.profileVisibility.isHidden) {
            appState.profileVisibility.isHidden = true;
            appState.profileVisibility.reason = 'matched';
            appState.profileVisibility.hiddenAt = new Date();
            saveUserData();
        }
        
        // Update profile visibility UI immediately
        updateProfileVisibilityUI();
        
        // Update all match displays with saved data
        updateAllMatchDisplays();
        
        // Check for new matches from AWS (in case they matched while we were away)
        checkForNewMatches();
        
        // Restore to appropriate screen based on state
        if (appState.activeConnection) {
            // Has active connection - go to chat
            updateAllMatchDisplays(); // Ensure displays are updated before showing screen
            showScreen('chat');
        } else if (appState.oneMatch.current && !appState.oneMatch.decisionMade) {
            // Has pending match - show it
            renderCurrentMatch();
            showScreen('match');
        } else {
            // Present new match
            presentMatch();
        }
    } else {
        // Fresh start - show splash
        showScreen('splash');
    }
});

// ==========================================
// Preview Mode Data Population
// ==========================================
function populatePreviewData(screenId) {
    // Set up demo data for screen previews
    const demoMatch = {
        name: 'Sarah',
        age: 28,
        photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop',
        occupation: 'Product Designer',
        distance: '3 miles',
        compatibility: 92,
        bio: '"Looking for someone to explore new restaurants with and have deep conversations over coffee."',
        interests: ['Photography', 'Hiking', 'Coffee', 'Reading']
    };
    
    // Populate match-related screens
    if (['match', 'profile-view', 'chat', 'chat-list', 'date-plan'].includes(screenId)) {
        // Update match card
        const matchPhoto = document.querySelector('.match-photo img, .preview-photo');
        if (matchPhoto) matchPhoto.src = demoMatch.photo;
        
        const matchName = document.querySelector('.match-name, .preview-info h3');
        if (matchName) matchName.textContent = `${demoMatch.name}, ${demoMatch.age}`;
        
        // Update chat header
        const chatAvatar = document.querySelector('.chat-user-avatar');
        if (chatAvatar) chatAvatar.src = demoMatch.photo;
        
        const chatName = document.querySelector('.chat-user-info h4');
        if (chatName) chatName.textContent = demoMatch.name;
    }
    
    // Populate profile screens
    if (['my-profile', 'edit-profile', 'profile-preview', 'manage-photos'].includes(screenId)) {
        const profilePhoto = document.querySelector('.profile-photo img, .main-photo img');
        if (profilePhoto) {
            profilePhoto.src = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=400&fit=crop';
        }
    }
    
    // Show modals properly
    if (screenId.includes('modal')) {
        const modal = document.getElementById(screenId);
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
        }
    }
}

// ==========================================
// Feedback Rendering Functions
// ==========================================

/**
 * Update "Most Compatible Profile" section based on actual match history
 * Analyzes all matches (history + active + passed) to find common traits
 */
function updateMostCompatibleProfile() {
    // Collect all matches
    const allMatches = [];
    
    // Add from match history
    if (appState.matchHistory) {
        appState.matchHistory.forEach(m => {
            if (m && m.name) allMatches.push(m);
        });
    }
    
    // Add current active connection
    if (appState.activeConnection) {
        allMatches.push(appState.activeConnection);
    }
    
    // Add passed matches (they're still matches we've seen)
    if (appState.passedMatches) {
        appState.passedMatches.forEach(m => {
            if (m && m.name) allMatches.push(m);
        });
    }
    
    // If no matches yet, show placeholder message
    if (allMatches.length === 0) {
        const avgMatchAgeEl = document.getElementById('avgMatchAge');
        const commonHairColorEl = document.getElementById('commonHairColor');
        const avgMatchHeightEl = document.getElementById('avgMatchHeight');
        const commonEducationEl = document.getElementById('commonEducation');
        const commonOccupationEl = document.getElementById('commonOccupation');
        const commonBodyTypeEl = document.getElementById('commonBodyType');
        
        if (avgMatchAgeEl) avgMatchAgeEl.textContent = 'No data yet';
        if (commonHairColorEl) commonHairColorEl.textContent = 'No data yet';
        if (avgMatchHeightEl) avgMatchHeightEl.textContent = 'No data yet';
        if (commonEducationEl) commonEducationEl.textContent = 'No data yet';
        if (commonOccupationEl) commonOccupationEl.textContent = 'No data yet';
        if (commonBodyTypeEl) commonBodyTypeEl.textContent = 'No data yet';
        return;
    }
    
    // Calculate age range
    const ages = allMatches.map(m => m.age).filter(a => a);
    if (ages.length > 0) {
        const minAge = Math.min(...ages);
        const maxAge = Math.max(...ages);
        const avgMatchAgeEl = document.getElementById('avgMatchAge');
        if (avgMatchAgeEl) {
            avgMatchAgeEl.textContent = minAge === maxAge ? `${minAge}` : `${minAge}-${maxAge}`;
        }
    }
    
    // Calculate most common hair color
    const hairColors = allMatches.map(m => m.hairColor || m.hair).filter(h => h);
    const commonHair = getMostCommon(hairColors);
    const commonHairColorEl = document.getElementById('commonHairColor');
    if (commonHairColorEl) {
        if (commonHair.value) {
            commonHairColorEl.textContent = `${commonHair.value} (${commonHair.percent}%)`;
        } else {
            commonHairColorEl.textContent = 'Varies';
        }
    }
    
    // Calculate height range
    const heights = allMatches.map(m => m.height).filter(h => h);
    const avgMatchHeightEl = document.getElementById('avgMatchHeight');
    if (avgMatchHeightEl) {
        if (heights.length > 0) {
            // Sort heights and get range
            const sortedHeights = heights.sort((a, b) => parseHeightToInches(a) - parseHeightToInches(b));
            const shortestHeight = sortedHeights[0];
            const tallestHeight = sortedHeights[sortedHeights.length - 1];
            avgMatchHeightEl.textContent = shortestHeight === tallestHeight ? shortestHeight : `${shortestHeight} - ${tallestHeight}`;
        } else {
            avgMatchHeightEl.textContent = 'Varies';
        }
    }
    
    // Calculate most common education
    const educations = allMatches.map(m => m.education).filter(e => e);
    const commonEdu = getMostCommon(educations);
    const commonEducationEl = document.getElementById('commonEducation');
    if (commonEducationEl) {
        if (commonEdu.value) {
            commonEducationEl.textContent = `${commonEdu.value} (${commonEdu.percent}%)`;
        } else {
            commonEducationEl.textContent = 'Varies';
        }
    }
    
    // Calculate most common occupation
    const occupations = allMatches.map(m => m.occupation || m.job).filter(o => o);
    const commonOcc = getMostCommon(occupations);
    const commonOccupationEl = document.getElementById('commonOccupation');
    if (commonOccupationEl) {
        if (commonOcc.value) {
            commonOccupationEl.textContent = commonOcc.count > 1 ? `${commonOcc.value} (${commonOcc.percent}%)` : commonOcc.value;
        } else {
            commonOccupationEl.textContent = 'Varies';
        }
    }
    
    // Calculate most common body type
    const bodyTypes = allMatches.map(m => m.bodyType).filter(b => b);
    const commonBody = getMostCommon(bodyTypes);
    const commonBodyTypeEl = document.getElementById('commonBodyType');
    if (commonBodyTypeEl) {
        if (commonBody.value) {
            commonBodyTypeEl.textContent = `${commonBody.value} (${commonBody.percent}%)`;
        } else {
            commonBodyTypeEl.textContent = 'Varies';
        }
    }
    
    console.log('📊 Updated Most Compatible Profile from', allMatches.length, 'matches');
}

/**
 * Helper function to find the most common value in an array
 * @param {Array} arr - Array of values
 * @returns {Object} - { value, count, percent }
 */
function getMostCommon(arr) {
    if (!arr || arr.length === 0) return { value: null, count: 0, percent: 0 };
    
    const counts = {};
    arr.forEach(item => {
        const key = (item || '').toString().toLowerCase().trim();
        if (key) {
            counts[key] = (counts[key] || 0) + 1;
        }
    });
    
    let maxKey = null;
    let maxCount = 0;
    
    Object.entries(counts).forEach(([key, count]) => {
        if (count > maxCount) {
            maxCount = count;
            maxKey = key;
        }
    });
    
    if (!maxKey) return { value: null, count: 0, percent: 0 };
    
    // Capitalize first letter
    const formattedValue = maxKey.charAt(0).toUpperCase() + maxKey.slice(1);
    const percent = Math.round((maxCount / arr.length) * 100);
    
    return { value: formattedValue, count: maxCount, percent };
}

/**
 * Render user's match activity chart with real data
 */
function renderUserMatchActivityChart() {
    const container = document.getElementById('userMatchActivityChart');
    if (!container) return;
    
    // Calculate match activity by day of week from user's match history
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const activity = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    
    // Count from match history
    const matchHistory = appState.matchHistory || [];
    matchHistory.forEach(match => {
        if (match.matchedAt || match.connectedAt) {
            const matchDate = new Date(match.matchedAt || match.connectedAt);
            const dayName = days[matchDate.getDay()];
            activity[dayName]++;
        }
    });
    
    // Count current active connection
    if (appState.activeConnection?.connectedAt || appState.activeConnection?.matchedAt) {
        const connDate = new Date(appState.activeConnection.connectedAt || appState.activeConnection.matchedAt);
        const dayName = days[connDate.getDay()];
        activity[dayName]++;
    }
    
    // Count passed matches
    const passedMatches = appState.passedMatches || [];
    passedMatches.forEach(match => {
        if (match.passedAt || match.declinedAt) {
            const passDate = new Date(match.passedAt || match.declinedAt);
            const dayName = days[passDate.getDay()];
            activity[dayName]++;
        }
    });
    
    // Display order: Mon-Sun
    const displayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const values = displayOrder.map(d => activity[d]);
    const maxVal = Math.max(...values, 1);
    
    // Find peak day
    const peakValue = Math.max(...values);
    const peakIndex = values.indexOf(peakValue);
    
    // Render chart
    container.innerHTML = displayOrder.map((day, i) => {
        const value = values[i];
        const heightPercent = maxVal > 0 ? Math.max((value / maxVal) * 100, 5) : 5;
        const isPeak = i === peakIndex && value > 0;
        
        return `
            <div class="chart-bar-container">
                <div class="chart-bar ${isPeak ? 'active' : ''}" style="height: ${heightPercent}%">
                    <span>${value}</span>
                </div>
                <div class="chart-label">${day}</div>
            </div>
        `;
    }).join('');
}

/**
 * Render feedback received list (from matches who ended connection with user)
 */
function renderFeedbackReceived() {
    const container = document.getElementById('feedbackReceivedList');
    if (!container) return;
    
    const feedback = appState.feedbackReceived || [];
    
    if (feedback.length === 0) {
        container.innerHTML = `
            <div class="empty-feedback">
                <p style="color: var(--text-muted); text-align: center; padding: 20px;">
                    No feedback received yet. When matches end connections, their feedback will appear here.
                </p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = feedback.map(item => {
        const date = new Date(item.date);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const reasonLabel = formatFeedbackReason(item.reason);
        
        return `
            <div class="feedback-item ${!item.note ? 'no-note' : ''}">
                <div class="feedback-header">
                    <span class="feedback-from">Anonymous Match</span>
                    <span class="feedback-date">${dateStr}</span>
                </div>
                <div class="feedback-reason">
                    <span class="feedback-tag">${reasonLabel}</span>
                </div>
                ${item.note ? `<p class="feedback-note">${item.note}</p>` : ''}
            </div>
        `;
    }).join('');
}

/**
 * Render feedback given list (feedback user gave when ending connections)
 */
function renderFeedbackGiven() {
    const container = document.getElementById('feedbackGivenList');
    if (!container) return;
    
    const feedback = appState.feedbackGiven || [];
    
    if (feedback.length === 0) {
        container.innerHTML = `
            <div class="empty-feedback">
                <p style="color: var(--text-muted); text-align: center; padding: 20px;">
                    No feedback given yet. When you end connections, your feedback will appear here.
                </p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = feedback.map(item => {
        const date = new Date(item.date);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const reasonLabel = formatFeedbackReason(item.reason);
        
        return `
            <div class="feedback-item ${!item.note ? 'no-note' : ''}">
                <div class="feedback-header">
                    <span class="feedback-from">${item.matchName || 'Match'}</span>
                    <span class="feedback-date">${dateStr}</span>
                </div>
                <div class="feedback-reason">
                    <span class="feedback-tag">${reasonLabel}</span>
                </div>
                ${item.note ? `<p class="feedback-note">${item.note}</p>` : ''}
            </div>
        `;
    }).join('');
}

/**
 * Format feedback reason code to human-readable label
 */
function formatFeedbackReason(reason) {
    const reasons = {
        'no_chemistry': 'No chemistry',
        'found_someone': 'Found someone else',
        'moving_away': 'Moving away',
        'too_busy': 'Too busy right now',
        'not_ready': 'Not ready to date',
        'different_values': 'Different values',
        'communication': 'Communication issues',
        'distance': 'Too far away',
        'schedule': "Schedule didn't align",
        'lost_interest': 'Lost interest',
        'other': 'Other reason',
        'manual': 'Ended connection'
    };
    return reasons[reason] || reason || 'Ended connection';
}

/**
 * Simulate receiving feedback (for testing - in production this comes from server)
 */
function simulateFeedbackReceived(matchName, reason, note = '') {
    const feedback = {
        id: Date.now(),
        matchName: matchName,
        reason: reason,
        note: note,
        date: new Date().toISOString(),
        type: 'received'
    };
    
    if (!appState.feedbackReceived) appState.feedbackReceived = [];
    appState.feedbackReceived.unshift(feedback);
    saveUserData();
    renderFeedbackReceived();
}

/**
 * Update Tips to Improve section based on actual metrics and feedback
 */
function updateTipsToImprove() {
    const container = document.getElementById('tipsToImproveList');
    if (!container) return;
    
    const tips = [];
    
    // Get metrics data
    const matchHistory = appState.matchHistory || [];
    const feedbackReceived = appState.feedbackReceived || [];
    const feedbackGiven = appState.feedbackGiven || [];
    const metrics = appState.connectionMetrics || {};
    const conversation = appState.conversation || {};
    const totalMatches = matchHistory.length + (appState.activeConnection ? 1 : 0);
    
    // Calculate response rate
    const messages = conversation.messages || [];
    const sentMessages = messages.filter(m => m.type === 'sent').length;
    const receivedMessages = messages.filter(m => m.type === 'received').length;
    const responseRate = receivedMessages > 0 ? Math.round((sentMessages / receivedMessages) * 100) : 0;
    
    // Tip based on response rate
    if (responseRate >= 80) {
        tips.push('✅ Your response rate is excellent! Keep engaging promptly with your matches.');
    } else if (responseRate >= 50) {
        tips.push('💬 Try responding more quickly - faster responses increase match engagement by 40%.');
    } else if (responseRate > 0) {
        tips.push('⚡ Boost your response rate! Matches are more likely to plan dates with responsive partners.');
    }
    
    // Tip based on message count
    const avgMessages = metrics.messageCount || 0;
    if (avgMessages < 5 && totalMatches > 0) {
        tips.push('💭 Try sending more messages! Deeper conversations lead to better connections.');
    } else if (avgMessages >= 20) {
        tips.push('🎯 Great conversation depth! Consider suggesting a date to take things offline.');
    }
    
    // Tip based on feedback received (what others said about the user)
    if (feedbackReceived.length > 0) {
        const reasons = feedbackReceived.map(f => f.reason?.toLowerCase() || '');
        
        if (reasons.some(r => r.includes('response') || r.includes('slow') || r.includes('reply'))) {
            tips.push('⏰ Some matches mentioned response time. Try checking the app more frequently!');
        }
        if (reasons.some(r => r.includes('conversation') || r.includes('boring') || r.includes('talk'))) {
            tips.push('🗣️ Ask more open-ended questions to spark engaging conversations.');
        }
        if (reasons.some(r => r.includes('photo') || r.includes('picture'))) {
            tips.push('📸 Consider updating your photos - variety helps matches get to know you better.');
        }
        if (reasons.some(r => r.includes('distance') || r.includes('far') || r.includes('location'))) {
            tips.push('📍 You might want to adjust your distance preferences for more local matches.');
        }
    }
    
    // Tip based on dates planned
    const datesPlanned = matchHistory.filter(m => m.hadDate || m.datePlanned).length;
    if (totalMatches > 3 && datesPlanned === 0) {
        tips.push('📅 You haven\'t planned any dates yet. Don\'t wait too long - suggest meeting up!');
    } else if (datesPlanned > 0) {
        tips.push(`🎉 You've planned ${datesPlanned} date${datesPlanned > 1 ? 's' : ''}! Keep up the great momentum.`);
    }
    
    // Tip based on match activity patterns
    if (matchHistory.length > 0) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const activity = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
        
        matchHistory.forEach(match => {
            if (match.matchedAt || match.connectedAt) {
                const day = days[new Date(match.matchedAt || match.connectedAt).getDay()];
                activity[day]++;
            }
        });
        
        // Find most active day
        let maxDay = 'Fri';
        let maxCount = 0;
        Object.entries(activity).forEach(([day, count]) => {
            if (count > maxCount) {
                maxCount = count;
                maxDay = day;
            }
        });
        
        if (maxCount > 1) {
            const fullDay = { Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };
            tips.push(`📊 You're most active on ${fullDay[maxDay]}s - great day to schedule dates!`);
        }
    }
    
    // Default tips if no specific data
    if (tips.length === 0) {
        tips.push('👋 Start matching to get personalized tips based on your activity!');
        tips.push('💡 Complete your profile to attract more compatible matches.');
        tips.push('🎯 Be authentic in your bio - it helps find genuine connections.');
    }
    
    // Limit to 5 tips max
    const displayTips = tips.slice(0, 5);
    
    // Render tips
    container.innerHTML = displayTips.map(tip => `<li>${tip}</li>`).join('');
}

// ==========================================
// Utility Functions
// ==========================================
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });
}

// ==========================================
// Payment Management Functions
// ==========================================

function showUpdatePayment() {
    const modal = document.getElementById('update-payment-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        
        // Pre-fill with existing data if available
        if (appState.user.paymentMethod) {
            const pm = appState.user.paymentMethod;
            document.getElementById('cardholderName').value = pm.cardholderName || '';
            // Don't pre-fill full card number for security
            document.getElementById('cardNumber').value = pm.lastFour ? `•••• •••• •••• ${pm.lastFour}` : '';
            document.getElementById('cardExpiry').value = pm.expiry || '';
        }
    }
}

function formatCardNumber(input) {
    // Remove all non-digits
    let value = input.value.replace(/\D/g, '');
    
    // Limit to 16 digits
    value = value.substring(0, 16);
    
    // Add spaces every 4 digits
    let formatted = '';
    for (let i = 0; i < value.length; i++) {
        if (i > 0 && i % 4 === 0) {
            formatted += ' ';
        }
        formatted += value[i];
    }
    
    input.value = formatted;
    
    // Detect card brand
    detectCardBrand(value);
}

function formatExpiry(input) {
    // Remove all non-digits
    let value = input.value.replace(/\D/g, '');
    
    // Limit to 4 digits
    value = value.substring(0, 4);
    
    // Add slash after 2 digits
    if (value.length > 2) {
        value = value.substring(0, 2) + '/' + value.substring(2);
    }
    
    input.value = value;
}

function detectCardBrand(cardNumber) {
    const cardBrand = document.getElementById('cardBrand');
    if (!cardBrand) return;
    
    // Remove existing brand classes
    cardBrand.classList.remove('visa', 'mastercard', 'amex', 'discover');
    
    // Detect brand based on first digits
    if (/^4/.test(cardNumber)) {
        cardBrand.classList.add('visa');
        cardBrand.innerHTML = `<svg width="32" height="32" viewBox="0 0 32 32" fill="#1A1F71">
            <path d="M13.823 19.876H11.8l1.265-7.736h2.023l-1.265 7.736zm8.163-7.54a5.07 5.07 0 00-1.822-.33c-2.006 0-3.42 1.058-3.43 2.572-.01 1.12 1.01 1.744 1.78 2.116.79.38 1.056.624 1.053.965-.005.52-.63.758-1.214.758-.813 0-1.244-.118-1.91-.41l-.263-.124-.287 1.756c.476.217 1.354.406 2.267.416 2.133 0 3.52-1.044 3.535-2.662.007-.887-.534-1.562-1.707-2.12-.71-.36-1.146-.6-1.14-.966 0-.324.367-.67 1.16-.67.662-.01 1.143.14 1.516.297l.182.09.275-1.688zm5.233-.197h-1.567c-.487 0-.85.139-1.064.647l-3.015 7.132h2.13l.426-1.166 2.598.002c.06.272.244 1.164.244 1.164h1.883l-1.635-7.78zM24.21 17.17c.168-.448.808-2.18.808-2.18-.012.02.166-.45.268-.74l.137.668s.388 1.86.47 2.252h-1.683zm-11.903-5.166l-1.99 5.275-.213-1.086c-.37-1.246-1.52-2.597-2.808-3.27l1.818 6.81h2.147l3.193-7.73h-2.147z"/>
        </svg>`;
    } else if (/^5[1-5]/.test(cardNumber) || /^2[2-7]/.test(cardNumber)) {
        cardBrand.classList.add('mastercard');
        cardBrand.innerHTML = `<svg width="32" height="32" viewBox="0 0 32 32">
            <circle cx="12" cy="16" r="7" fill="#EB001B"/>
            <circle cx="20" cy="16" r="7" fill="#F79E1B"/>
            <path d="M16 10.5a7 7 0 000 11 7 7 0 000-11z" fill="#FF5F00"/>
        </svg>`;
    } else if (/^3[47]/.test(cardNumber)) {
        cardBrand.classList.add('amex');
        cardBrand.innerHTML = `<svg width="32" height="32" viewBox="0 0 32 32" fill="#006FCF">
            <rect x="4" y="8" width="24" height="16" rx="2"/>
            <text x="16" y="18" font-size="6" fill="white" text-anchor="middle" font-weight="bold">AMEX</text>
        </svg>`;
    } else if (/^6(?:011|5)/.test(cardNumber)) {
        cardBrand.classList.add('discover');
        cardBrand.innerHTML = `<svg width="32" height="32" viewBox="0 0 32 32">
            <rect x="4" y="8" width="24" height="16" rx="2" fill="#FF6000"/>
            <text x="16" y="18" font-size="5" fill="white" text-anchor="middle" font-weight="bold">DISCOVER</text>
        </svg>`;
    } else {
        // Default card icon
        cardBrand.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
            <line x1="1" y1="10" x2="23" y2="10"/>
        </svg>`;
    }
}

function showCvvHelp() {
    showToast('CVV is the 3-digit code on the back of your card (or 4 digits on the front for Amex)', 'info');
}

function savePaymentMethod(event) {
    event.preventDefault();
    
    const cardholderName = document.getElementById('cardholderName').value.trim();
    const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
    const cardExpiry = document.getElementById('cardExpiry').value;
    const cardCvv = document.getElementById('cardCvv').value;
    const setAsDefault = document.getElementById('setAsDefault').checked;
    
    // Validate card number
    if (cardNumber.length < 13 || cardNumber.length > 16) {
        showToast('Please enter a valid card number', 'error');
        return;
    }
    
    // Validate expiry
    const [month, year] = cardExpiry.split('/');
    const currentYear = new Date().getFullYear() % 100;
    const currentMonth = new Date().getMonth() + 1;
    
    if (!month || !year || parseInt(month) > 12 || parseInt(month) < 1) {
        showToast('Please enter a valid expiry date', 'error');
        return;
    }
    
    if (parseInt(year) < currentYear || (parseInt(year) === currentYear && parseInt(month) < currentMonth)) {
        showToast('This card has expired', 'error');
        return;
    }
    
    // Validate CVV
    if (cardCvv.length < 3 || cardCvv.length > 4) {
        showToast('Please enter a valid CVV', 'error');
        return;
    }
    
    // Save payment method (in real app, this would be sent to a payment processor)
    appState.user.paymentMethod = {
        cardholderName: cardholderName,
        lastFour: cardNumber.slice(-4),
        expiry: cardExpiry,
        brand: detectCardBrandName(cardNumber),
        isDefault: setAsDefault,
        updatedAt: new Date().toISOString()
    };
    
    saveUserData();
    
    // Update the display in subscription management
    updatePaymentDisplay();
    
    // Close modal and show success
    closeModal();
    showToast('Payment method updated successfully!', 'success');
}

function detectCardBrandName(cardNumber) {
    if (/^4/.test(cardNumber)) return 'Visa';
    if (/^5[1-5]/.test(cardNumber) || /^2[2-7]/.test(cardNumber)) return 'Mastercard';
    if (/^3[47]/.test(cardNumber)) return 'American Express';
    if (/^6(?:011|5)/.test(cardNumber)) return 'Discover';
    return 'Card';
}

function updatePaymentDisplay() {
    const pm = appState.user.paymentMethod;
    if (!pm) return;
    
    const cardType = document.querySelector('.card-type');
    const cardExpiry = document.querySelector('.card-expiry');
    
    if (cardType) {
        cardType.textContent = `${pm.brand} ending in ${pm.lastFour}`;
    }
    if (cardExpiry) {
        cardExpiry.textContent = `Expires ${pm.expiry}`;
    }
}

/**
 * Calculate subscription renewal date (one month from start)
 */
function getSubscriptionRenewalDate() {
    // Get subscription start date or use registration date
    let startDate;
    
    if (appState.user.subscription?.startedAt) {
        startDate = new Date(appState.user.subscription.startedAt);
    } else if (appState.user.registeredAt) {
        startDate = new Date(appState.user.registeredAt);
    } else {
        // Default to today if no start date
        startDate = new Date();
    }
    
    // Calculate next renewal (one month from start, adjusted for current period)
    const renewalDate = new Date(startDate);
    
    // Find the next renewal date from today
    const today = new Date();
    while (renewalDate <= today) {
        renewalDate.setMonth(renewalDate.getMonth() + 1);
    }
    
    return renewalDate;
}

/**
 * Format date as "Mon DD, YYYY"
 */
function formatRenewalDate(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Update subscription display dates
 */
function updateSubscriptionDates() {
    const renewalDate = getSubscriptionRenewalDate();
    const formattedDate = formatRenewalDate(renewalDate);
    
    // Update settings subscription details
    const settingsRenewal = document.getElementById('settingsRenewalDate');
    if (settingsRenewal) {
        settingsRenewal.textContent = formattedDate;
    }
    
    // Update subscription management page
    const subRenewal = document.getElementById('subscriptionRenewalDate');
    if (subRenewal) {
        subRenewal.textContent = formattedDate;
    }
}

/**
 * Load and display platform stats from all users in localStorage
 */
function loadPlatformStats() {
    try {
        // Get all registered users
        const registeredUsers = JSON.parse(localStorage.getItem('oith_registered_users') || '{}');
        const userEmails = Object.keys(registeredUsers);
        
        let totalMatches = 0;
        let totalDates = 0;
        let totalMessages = 0;
        let activeUsers = 0;
        let matchSuccesses = 0;
        let matchAttempts = 0;
        
        // Aggregate data from all users
        userEmails.forEach(email => {
            const storageKey = getUserStorageKey(email);
            const userData = JSON.parse(localStorage.getItem(storageKey) || '{}');
            
            if (userData.user) {
                activeUsers++;
            }
            
            // Count matches
            const connections = userData.connections || [];
            const matchHistory = userData.matchHistory || [];
            totalMatches += connections.length + matchHistory.filter(m => m.accepted).length;
            matchAttempts += matchHistory.length;
            matchSuccesses += connections.length + matchHistory.filter(m => m.accepted && !m.cancelled).length;
            
            // Count dates
            totalDates += userData.dateHistory?.length || 0;
            if (userData.conversation?.dateDetails?.confirmed) {
                totalDates++;
            }
            
            // Count messages
            totalMessages += userData.conversation?.messages?.length || 0;
        });
        
        // Calculate response rate (percentage of matches that received a response)
        const responseRate = matchAttempts > 0 ? Math.round((matchSuccesses / matchAttempts) * 100) : 0;
        
        // Calculate match success rate
        const matchSuccess = matchAttempts > 0 ? Math.round((matchSuccesses / matchAttempts) * 100) : 0;
        
        // Calculate average time to first date (simulated for now)
        const avgDaysToDate = totalDates > 0 ? (Math.random() * 3 + 2).toFixed(1) : '—';
        
        // Calculate today's matches (simulated based on active users)
        const todayMatches = Math.max(0, Math.floor(activeUsers * 0.3));
        
        // Update UI elements
        const responseEl = document.getElementById('platformResponseRate');
        const datesEl = document.getElementById('platformDatesPlanned');
        const avgDateEl = document.getElementById('platformAvgToDate');
        const successEl = document.getElementById('platformMatchSuccess');
        const todayEl = document.getElementById('platformTodayMatches');
        
        if (responseEl) responseEl.textContent = responseRate > 0 ? `${responseRate}%` : '—';
        if (datesEl) datesEl.textContent = totalDates > 0 ? (totalDates >= 1000 ? `${(totalDates/1000).toFixed(1)}K+` : totalDates) : '0';
        if (avgDateEl) avgDateEl.textContent = avgDaysToDate !== '—' ? `${avgDaysToDate} days` : '—';
        if (successEl) successEl.textContent = matchSuccess > 0 ? `${matchSuccess}%` : '—';
        if (todayEl) todayEl.textContent = todayMatches > 0 ? `${todayMatches} new matches made` : 'No matches today yet';
        
        console.log('📊 Platform stats loaded:', { totalMatches, totalDates, responseRate, matchSuccess });
    } catch (e) {
        console.error('Error loading platform stats:', e);
    }
}

/**
 * Update billing history from user's subscription data
 */
function updateBillingHistory() {
    const historyList = document.getElementById('billingHistoryList');
    if (!historyList) return;
    
    const subscription = appState.user?.subscription;
    const startDate = subscription?.startDate ? new Date(subscription.startDate) : null;
    
    if (!startDate || subscription?.type === 'free') {
        historyList.innerHTML = `
            <div class="history-item" style="text-align: center; padding: 20px; color: var(--text-muted);">
                <p>No billing history</p>
                <small>Subscribe to Premium to see billing records</small>
            </div>
        `;
        return;
    }
    
    // Generate billing history based on subscription start date
    const billingRecords = [];
    const planPrice = subscription.type === 'monthly' ? '$10.00' : '$96.00';
    const planName = subscription.type === 'monthly' ? 'Premium Monthly' : 'Premium Annual';
    
    // Generate records for each billing cycle since start
    let currentDate = new Date(startDate);
    const today = new Date();
    
    while (currentDate <= today) {
        billingRecords.push({
            date: new Date(currentDate),
            description: planName,
            amount: planPrice
        });
        
        // Move to next billing cycle
        if (subscription.type === 'monthly') {
            currentDate.setMonth(currentDate.getMonth() + 1);
        } else {
            currentDate.setFullYear(currentDate.getFullYear() + 1);
        }
    }
    
    // Reverse to show most recent first
    billingRecords.reverse();
    
    // Generate HTML
    if (billingRecords.length === 0) {
        historyList.innerHTML = `
            <div class="history-item" style="text-align: center; padding: 20px; color: var(--text-muted);">
                <p>First billing on ${formatBillingDate(startDate)}</p>
            </div>
        `;
    } else {
        historyList.innerHTML = billingRecords.map(record => `
            <div class="history-item">
                <div class="history-info">
                    <span class="history-date">${formatBillingDate(record.date)}</span>
                    <span class="history-desc">${record.description}</span>
                </div>
                <span class="history-amount">${record.amount}</span>
            </div>
        `).join('');
    }
}

/**
 * Format date for billing display
 */
function formatBillingDate(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function updateSubscription() {
    // Get selected plan
    const selectedPlan = document.querySelector('input[name="plan"]:checked');
    if (!selectedPlan) {
        showToast('Please select a subscription plan', 'error');
        return;
    }
    
    const planValue = selectedPlan.value;
    const planNames = {
        'monthly': 'Premium Monthly - $10/mo'
    };
    
    // Set subscription with start date
    if (!appState.user.subscription?.startedAt) {
        appState.user.subscription = {
            ...appState.user.subscription,
            startedAt: new Date().toISOString()
        };
    }
    
    appState.user.subscription = {
        ...appState.user.subscription,
        plan: planValue,
        planName: planNames[planValue] || 'Premium Monthly',
        updatedAt: new Date().toISOString()
    };
    
    saveUserData();
    showToast('Subscription updated successfully!', 'success');
}

function showCancelSubscription() {
    if (confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.')) {
        appState.user.subscription = {
            ...appState.user.subscription,
            status: 'cancelled',
            cancelledAt: new Date().toISOString()
        };
        saveUserData();
        showToast('Subscription cancelled. You will have access until the end of your billing period.', 'info');
    }
}

// ==========================================
// Password Management Functions
// ==========================================

function showChangePassword() {
    const modal = document.getElementById('change-password-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        
        // Reset form
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        resetPasswordStrength();
        resetPasswordRequirements();
    }
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = input.parentElement.querySelector('.toggle-password');
    
    if (input.type === 'password') {
        input.type = 'text';
        button.classList.add('visible');
        button.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>`;
    } else {
        input.type = 'password';
        button.classList.remove('visible');
        button.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
        </svg>`;
    }
}

function checkPasswordStrength(password) {
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    
    // Check requirements
    const hasLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    // Update requirement indicators
    updateRequirement('req-length', hasLength);
    updateRequirement('req-upper', hasUpper);
    updateRequirement('req-lower', hasLower);
    updateRequirement('req-number', hasNumber);
    
    // Calculate strength
    let strength = 0;
    if (hasLength) strength++;
    if (hasUpper) strength++;
    if (hasLower) strength++;
    if (hasNumber) strength++;
    if (hasSpecial) strength++;
    
    // Update UI
    strengthFill.className = 'strength-fill';
    strengthText.className = 'strength-text';
    
    if (password.length === 0) {
        strengthFill.style.width = '0%';
        strengthText.textContent = 'Password strength';
    } else if (strength <= 2) {
        strengthFill.classList.add('weak');
        strengthText.classList.add('weak');
        strengthText.textContent = 'Weak';
    } else if (strength === 3) {
        strengthFill.classList.add('fair');
        strengthText.classList.add('fair');
        strengthText.textContent = 'Fair';
    } else if (strength === 4) {
        strengthFill.classList.add('good');
        strengthText.classList.add('good');
        strengthText.textContent = 'Good';
    } else {
        strengthFill.classList.add('strong');
        strengthText.classList.add('strong');
        strengthText.textContent = 'Strong';
    }
}

function updateRequirement(reqId, isMet) {
    const req = document.getElementById(reqId);
    if (req) {
        if (isMet) {
            req.classList.add('met');
            req.querySelector('.req-icon').textContent = '✓';
        } else {
            req.classList.remove('met');
            req.querySelector('.req-icon').textContent = '○';
        }
    }
}

function resetPasswordStrength() {
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    if (strengthFill) {
        strengthFill.className = 'strength-fill';
        strengthFill.style.width = '0%';
    }
    if (strengthText) {
        strengthText.className = 'strength-text';
        strengthText.textContent = 'Password strength';
    }
}

function resetPasswordRequirements() {
    ['req-length', 'req-upper', 'req-lower', 'req-number'].forEach(id => {
        const req = document.getElementById(id);
        if (req) {
            req.classList.remove('met');
            req.querySelector('.req-icon').textContent = '○';
        }
    });
}

function saveNewPassword(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validate current password (in real app, this would verify against stored password)
    if (!currentPassword) {
        showToast('Please enter your current password', 'error');
        return;
    }
    
    // Check if new passwords match
    if (newPassword !== confirmPassword) {
        showToast('New passwords do not match', 'error');
        return;
    }
    
    // Check password requirements
    const hasLength = newPassword.length >= 8;
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    
    if (!hasLength || !hasUpper || !hasLower || !hasNumber) {
        showToast('Password does not meet requirements', 'error');
        return;
    }
    
    // Check if new password is same as current
    if (currentPassword === newPassword) {
        showToast('New password must be different from current password', 'error');
        return;
    }
    
    // Save password (in real app, this would hash and save to backend)
    appState.user.passwordUpdatedAt = new Date().toISOString();
    saveUserData();
    
    // Close modal and show success
    closeModal();
    showToast('Password updated successfully!', 'success');
}

// ==========================================
// Email & Phone Management Functions
// ==========================================

function showEditEmail() {
    const modal = document.getElementById('edit-email-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        
        // Pre-fill with current email
        const emailInput = document.getElementById('newEmail');
        if (emailInput && appState.user.email) {
            emailInput.value = appState.user.email;
        }
    }
}

function showEditPhone() {
    const modal = document.getElementById('edit-phone-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        
        // Pre-fill with current phone
        const phoneInput = document.getElementById('newPhone');
        if (phoneInput && appState.user.phone) {
            phoneInput.value = appState.user.phone;
        }
    }
}

function saveEmail(event) {
    event.preventDefault();
    
    const newEmail = document.getElementById('newEmail').value.trim();
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    // Save email
    appState.user.email = newEmail;
    saveUserData();
    
    // Update display
    updateAccountDisplay();
    
    // Close modal and show success
    closeModal();
    showToast('Email updated successfully!', 'success');
}

function savePhone(event) {
    event.preventDefault();
    
    const newPhone = document.getElementById('newPhone').value.trim();
    
    // Validate phone (basic check for at least 10 digits)
    const digitsOnly = newPhone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
        showToast('Please enter a valid phone number', 'error');
        return;
    }
    
    // Save phone
    appState.user.phone = newPhone;
    saveUserData();
    
    // Update display
    updateAccountDisplay();
    
    // Close modal and show success
    closeModal();
    showToast('Phone number updated successfully!', 'success');
}

function formatPhoneNumberInput(input) {
    // Remove all non-digits
    let value = input.value.replace(/\D/g, '');
    
    // Format as +1 (XXX) XXX-XXXX
    if (value.length > 0) {
        if (value.length <= 1) {
            value = '+' + value;
        } else if (value.length <= 4) {
            value = '+' + value.substring(0, 1) + ' (' + value.substring(1);
        } else if (value.length <= 7) {
            value = '+' + value.substring(0, 1) + ' (' + value.substring(1, 4) + ') ' + value.substring(4);
        } else {
            value = '+' + value.substring(0, 1) + ' (' + value.substring(1, 4) + ') ' + value.substring(4, 7) + '-' + value.substring(7, 11);
        }
    }
    
    input.value = value;
}

function updateAccountDisplay() {
    // Update email display
    const emailDisplay = document.getElementById('settingsEmail');
    if (emailDisplay && appState.user.email) {
        emailDisplay.textContent = appState.user.email;
    }
    
    // Update phone display
    const phoneDisplay = document.getElementById('settingsPhone');
    if (phoneDisplay && appState.user.phone) {
        phoneDisplay.textContent = appState.user.phone;
    }
}

// ==========================================
// Service Worker Registration (for PWA support)
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('✅ OITH PWA: Service Worker registered');
                console.log('   Scope:', registration.scope);
            })
            .catch(error => {
                console.log('❌ Service Worker registration failed:', error);
            });
    });
}

// Prompt user to install PWA
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('📱 OITH can be installed as an app!');
});

function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('✅ User installed the app');
                showToast('App installed! Find OITH on your home screen.', 'success');
            }
            deferredPrompt = null;
        });
    }
}
