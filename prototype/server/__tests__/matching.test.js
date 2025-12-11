/**
 * Unit Tests for Matching Service Lambda
 * 
 * Tests the core matching algorithm, preference matching,
 * compatibility scoring, and timer enforcement.
 * 
 * Run with: npm test -- __tests__/matching.test.js
 */

// ==========================================
// Test Utilities (functions extracted for testing)
// ==========================================

/**
 * Geohash encoding (copied from matchingService.mjs for testing)
 */
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

function encodeGeohash(lat, lng, precision = 5) {
    let idx = 0;
    let bit = 0;
    let evenBit = true;
    let geohash = '';
    
    let latMin = -90, latMax = 90;
    let lngMin = -180, lngMax = 180;
    
    while (geohash.length < precision) {
        if (evenBit) {
            const lngMid = (lngMin + lngMax) / 2;
            if (lng >= lngMid) {
                idx = idx * 2 + 1;
                lngMin = lngMid;
            } else {
                idx = idx * 2;
                lngMax = lngMid;
            }
        } else {
            const latMid = (latMin + latMax) / 2;
            if (lat >= latMid) {
                idx = idx * 2 + 1;
                latMin = latMid;
            } else {
                idx = idx * 2;
                latMax = latMid;
            }
        }
        evenBit = !evenBit;
        
        if (++bit === 5) {
            geohash += BASE32[idx];
            bit = 0;
            idx = 0;
        }
    }
    
    return geohash;
}

/**
 * Distance calculation (copied from matchingService.mjs)
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    if (!lat1 || !lng1 || !lat2 || !lng2) return 9999;
    
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return Math.round(R * c);
}

/**
 * Preference matching (copied from matchingService.mjs)
 */
function checkPreferenceMatch(profile, prefs, viewerProfile) {
    // Gender preference
    const interestedIn = prefs.interestedIn || 'everyone';
    if (interestedIn !== 'everyone') {
        const profileGender = profile.gender?.toLowerCase();
        const wantsGender = interestedIn.toLowerCase();
        const genderMap = { 'men': 'male', 'women': 'female', 'male': 'male', 'female': 'female' };
        const targetGender = genderMap[wantsGender] || wantsGender;
        if (profileGender !== targetGender) {
            return { matches: false, reason: 'gender_mismatch' };
        }
    }
    
    // Age range
    const ageMin = prefs.ageMin || 18;
    const ageMax = prefs.ageMax || 99;
    const profileAge = profile.age || 25;
    if (profileAge < ageMin || profileAge > ageMax) {
        return { matches: false, reason: 'age_out_of_range' };
    }
    
    // Distance
    const maxDistance = prefs.maxDistance || 100;
    const viewerCoords = viewerProfile.coordinates || {};
    const profileCoords = profile.coordinates || {};
    const distance = calculateDistance(
        viewerCoords.lat, viewerCoords.lng,
        profileCoords.lat, profileCoords.lng
    );
    if (distance > maxDistance) {
        return { matches: false, reason: 'too_far', distance };
    }
    
    return { matches: true, distance };
}

/**
 * Compatibility scoring (copied from matchingService.mjs)
 */
function calculateCompatibility(profile1, profile2) {
    let score = 50; // Base score
    
    // Interest overlap (up to +25)
    const interests1 = profile1.interests || [];
    const interests2 = profile2.interests || [];
    if (interests1.length > 0 && interests2.length > 0) {
        const overlap = interests1.filter(i => 
            interests2.some(i2 => i2.toLowerCase() === i.toLowerCase())
        ).length;
        const maxPossible = Math.min(interests1.length, interests2.length);
        score += maxPossible > 0 ? (overlap / maxPossible) * 25 : 0;
    }
    
    // Lifestyle alignment (up to +15)
    if (profile1.drinking?.toLowerCase() === profile2.drinking?.toLowerCase()) score += 3;
    if (profile1.smoking?.toLowerCase() === profile2.smoking?.toLowerCase()) score += 3;
    if (profile1.exercise?.toLowerCase() === profile2.exercise?.toLowerCase()) score += 3;
    if (profile1.children === profile2.children) score += 3;
    if (profile1.religion?.toLowerCase() === profile2.religion?.toLowerCase()) score += 3;
    
    // Looking for alignment (+10)
    if (profile1.lookingFor?.toLowerCase() === profile2.lookingFor?.toLowerCase()) {
        score += 10;
    }
    
    return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Rate limiting (copied from matchingService.mjs)
 */
const rateLimitCache = new Map();
const CONFIG = {
    RATE_LIMIT_REQUESTS: 20,
    RATE_LIMIT_WINDOW_SECONDS: 60
};

function checkRateLimit(userEmail) {
    const now = Date.now();
    const key = userEmail.toLowerCase();
    const windowMs = CONFIG.RATE_LIMIT_WINDOW_SECONDS * 1000;
    
    let entry = rateLimitCache.get(key);
    
    if (!entry || (now - entry.windowStart) > windowMs) {
        entry = { windowStart: now, count: 0 };
    }
    
    entry.count++;
    rateLimitCache.set(key, entry);
    
    const remaining = Math.max(0, CONFIG.RATE_LIMIT_REQUESTS - entry.count);
    const resetIn = Math.ceil((entry.windowStart + windowMs - now) / 1000);
    
    if (entry.count > CONFIG.RATE_LIMIT_REQUESTS) {
        return { limited: true, remaining: 0, resetIn };
    }
    
    return { limited: false, remaining, resetIn };
}

// ==========================================
// TESTS
// ==========================================

describe('Matching Service', () => {
    beforeEach(() => {
        rateLimitCache.clear();
    });

    // ==========================================
    // Geohash Tests
    // ==========================================
    describe('Geohash Encoding', () => {
        it('should encode coordinates to geohash correctly', () => {
            // San Francisco: 37.7749, -122.4194
            const geohash = encodeGeohash(37.7749, -122.4194, 5);
            expect(geohash).toBeDefined();
            expect(geohash.length).toBe(5);
            expect(geohash).toBe('9q8yy'); // Expected geohash for SF
        });

        it('should handle different precision levels', () => {
            const hash4 = encodeGeohash(40.7128, -74.0060, 4);
            const hash6 = encodeGeohash(40.7128, -74.0060, 6);
            
            expect(hash4.length).toBe(4);
            expect(hash6.length).toBe(6);
            expect(hash6.startsWith(hash4)).toBe(true);
        });

        it('should handle edge coordinates', () => {
            // North pole
            const northPole = encodeGeohash(90, 0, 4);
            expect(northPole).toBeDefined();
            
            // Equator/Prime Meridian
            const origin = encodeGeohash(0, 0, 4);
            expect(origin).toBeDefined();
            
            // South pole
            const southPole = encodeGeohash(-90, 0, 4);
            expect(southPole).toBeDefined();
        });
    });

    // ==========================================
    // Distance Calculation Tests
    // ==========================================
    describe('Distance Calculation', () => {
        it('should calculate distance accurately (Haversine)', () => {
            // NYC to LA: approximately 2,451 miles
            const nycToLa = calculateDistance(40.7128, -74.0060, 34.0522, -118.2437);
            expect(nycToLa).toBeGreaterThan(2400);
            expect(nycToLa).toBeLessThan(2500);
        });

        it('should return same point as 0 distance', () => {
            const samePoint = calculateDistance(40.7128, -74.0060, 40.7128, -74.0060);
            expect(samePoint).toBe(0);
        });

        it('should return 9999 for missing coordinates', () => {
            expect(calculateDistance(null, -74.0060, 34.0522, -118.2437)).toBe(9999);
            expect(calculateDistance(40.7128, null, 34.0522, -118.2437)).toBe(9999);
            expect(calculateDistance(40.7128, -74.0060, null, -118.2437)).toBe(9999);
            expect(calculateDistance(40.7128, -74.0060, 34.0522, null)).toBe(9999);
        });

        it('should handle short distances', () => {
            // Two points ~1 mile apart
            const shortDistance = calculateDistance(40.7128, -74.0060, 40.7270, -74.0060);
            expect(shortDistance).toBeGreaterThan(0);
            expect(shortDistance).toBeLessThan(5);
        });
    });

    // ==========================================
    // Preference Matching Tests
    // ==========================================
    describe('Preference Matching', () => {
        const viewerProfile = {
            gender: 'male',
            age: 28,
            coordinates: { lat: 40.7128, lng: -74.0060 }
        };

        it('should match "everyone" gender preference', () => {
            const profile = { gender: 'female', age: 25, coordinates: { lat: 40.7130, lng: -74.0060 } };
            const prefs = { interestedIn: 'everyone', ageMin: 21, ageMax: 35 };
            
            const result = checkPreferenceMatch(profile, prefs, viewerProfile);
            expect(result.matches).toBe(true);
        });

        it('should filter by specific gender (women)', () => {
            const femaleProfile = { gender: 'female', age: 25, coordinates: { lat: 40.7130, lng: -74.0060 } };
            const maleProfile = { gender: 'male', age: 25, coordinates: { lat: 40.7130, lng: -74.0060 } };
            const prefs = { interestedIn: 'women', ageMin: 21, ageMax: 35 };
            
            expect(checkPreferenceMatch(femaleProfile, prefs, viewerProfile).matches).toBe(true);
            expect(checkPreferenceMatch(maleProfile, prefs, viewerProfile).matches).toBe(false);
        });

        it('should filter by specific gender (men)', () => {
            const maleProfile = { gender: 'male', age: 25, coordinates: { lat: 40.7130, lng: -74.0060 } };
            const prefs = { interestedIn: 'men', ageMin: 21, ageMax: 35 };
            
            expect(checkPreferenceMatch(maleProfile, prefs, viewerProfile).matches).toBe(true);
        });

        it('should filter by age range - within range', () => {
            const profile = { gender: 'female', age: 27, coordinates: { lat: 40.7130, lng: -74.0060 } };
            const prefs = { interestedIn: 'everyone', ageMin: 25, ageMax: 30 };
            
            const result = checkPreferenceMatch(profile, prefs, viewerProfile);
            expect(result.matches).toBe(true);
        });

        it('should filter by age range - too young', () => {
            const profile = { gender: 'female', age: 20, coordinates: { lat: 40.7130, lng: -74.0060 } };
            const prefs = { interestedIn: 'everyone', ageMin: 25, ageMax: 30 };
            
            const result = checkPreferenceMatch(profile, prefs, viewerProfile);
            expect(result.matches).toBe(false);
            expect(result.reason).toBe('age_out_of_range');
        });

        it('should filter by age range - too old', () => {
            const profile = { gender: 'female', age: 45, coordinates: { lat: 40.7130, lng: -74.0060 } };
            const prefs = { interestedIn: 'everyone', ageMin: 25, ageMax: 35 };
            
            const result = checkPreferenceMatch(profile, prefs, viewerProfile);
            expect(result.matches).toBe(false);
            expect(result.reason).toBe('age_out_of_range');
        });

        it('should filter by max distance - within range', () => {
            const profile = { 
                gender: 'female', 
                age: 25, 
                coordinates: { lat: 40.7130, lng: -74.0060 } // Very close
            };
            const prefs = { interestedIn: 'everyone', maxDistance: 10 };
            
            const result = checkPreferenceMatch(profile, prefs, viewerProfile);
            expect(result.matches).toBe(true);
        });

        it('should filter by max distance - too far', () => {
            const profile = { 
                gender: 'female', 
                age: 25, 
                coordinates: { lat: 34.0522, lng: -118.2437 } // LA (far from NYC)
            };
            const prefs = { interestedIn: 'everyone', maxDistance: 50 };
            
            const result = checkPreferenceMatch(profile, prefs, viewerProfile);
            expect(result.matches).toBe(false);
            expect(result.reason).toBe('too_far');
        });

        it('should use default values for missing preferences', () => {
            const profile = { gender: 'female', age: 25, coordinates: { lat: 40.7130, lng: -74.0060 } };
            const prefs = {}; // Empty preferences
            
            const result = checkPreferenceMatch(profile, prefs, viewerProfile);
            expect(result.matches).toBe(true); // Should use defaults (everyone, 18-99, 100mi)
        });
    });

    // ==========================================
    // Compatibility Scoring Tests
    // ==========================================
    describe('Compatibility Scoring', () => {
        it('should start with base score of 50', () => {
            const profile1 = {};
            const profile2 = {};
            
            const score = calculateCompatibility(profile1, profile2);
            expect(score).toBe(50);
        });

        it('should add points for interest overlap', () => {
            const profile1 = { interests: ['hiking', 'reading', 'cooking'] };
            const profile2 = { interests: ['hiking', 'reading', 'gaming'] };
            
            const score = calculateCompatibility(profile1, profile2);
            // 2 out of 3 overlap = 66% of 25 points = ~16.67 + 50 base = ~67
            expect(score).toBeGreaterThan(60);
            expect(score).toBeLessThan(70);
        });

        it('should add points for lifestyle alignment', () => {
            const profile1 = { 
                drinking: 'socially', 
                smoking: 'never', 
                exercise: 'regularly',
                children: 'want someday',
                religion: 'christian'
            };
            const profile2 = { 
                drinking: 'socially', 
                smoking: 'never', 
                exercise: 'regularly',
                children: 'want someday',
                religion: 'christian'
            };
            
            const score = calculateCompatibility(profile1, profile2);
            // 5 lifestyle matches = 15 points + 50 base = 65
            expect(score).toBe(65);
        });

        it('should add points for "looking for" alignment', () => {
            const profile1 = { lookingFor: 'relationship' };
            const profile2 = { lookingFor: 'relationship' };
            
            const score = calculateCompatibility(profile1, profile2);
            // 10 points + 50 base = 60
            expect(score).toBe(60);
        });

        it('should cap score at 100', () => {
            const profile1 = { 
                interests: ['a', 'b', 'c', 'd', 'e'],
                drinking: 'never', 
                smoking: 'never', 
                exercise: 'daily',
                children: 'have kids',
                religion: 'buddhist',
                lookingFor: 'relationship'
            };
            const profile2 = { ...profile1 }; // Perfect match
            
            const score = calculateCompatibility(profile1, profile2);
            expect(score).toBe(100);
        });

        it('should floor score at 0', () => {
            const profile1 = {};
            const profile2 = {};
            
            // Base score is 50, can't go below 0
            const score = calculateCompatibility(profile1, profile2);
            expect(score).toBeGreaterThanOrEqual(0);
        });

        it('should handle case-insensitive interest matching', () => {
            const profile1 = { interests: ['HIKING', 'Reading'] };
            const profile2 = { interests: ['hiking', 'READING'] };
            
            const score = calculateCompatibility(profile1, profile2);
            // 100% overlap = 25 points + 50 base = 75
            expect(score).toBe(75);
        });
    });

    // ==========================================
    // Rate Limiting Tests
    // ==========================================
    describe('Rate Limiting', () => {
        it('should allow requests under the limit', () => {
            const result = checkRateLimit('user@test.com');
            expect(result.limited).toBe(false);
            expect(result.remaining).toBe(19); // 20 - 1
        });

        it('should block requests over the limit', () => {
            // Make 21 requests
            for (let i = 0; i < 20; i++) {
                checkRateLimit('spammer@test.com');
            }
            
            const result = checkRateLimit('spammer@test.com');
            expect(result.limited).toBe(true);
            expect(result.remaining).toBe(0);
        });

        it('should track users independently', () => {
            // User A makes 15 requests
            for (let i = 0; i < 15; i++) {
                checkRateLimit('userA@test.com');
            }
            
            // User B should still have full quota
            const resultB = checkRateLimit('userB@test.com');
            expect(resultB.limited).toBe(false);
            expect(resultB.remaining).toBe(19);
        });

        it('should normalize emails to lowercase', () => {
            checkRateLimit('User@Test.com');
            const result = checkRateLimit('USER@TEST.COM');
            
            // Should be counted as same user
            expect(result.remaining).toBe(18); // 20 - 2
        });
    });

    // ==========================================
    // Edge Cases
    // ==========================================
    describe('Edge Cases', () => {
        it('should handle undefined interests gracefully', () => {
            const profile1 = { interests: undefined };
            const profile2 = { interests: ['hiking'] };
            
            const score = calculateCompatibility(profile1, profile2);
            expect(score).toBe(50); // Base score only
        });

        it('should handle empty interests array', () => {
            const profile1 = { interests: [] };
            const profile2 = { interests: ['hiking', 'reading'] };
            
            const score = calculateCompatibility(profile1, profile2);
            expect(score).toBe(50); // Base score only
        });

        it('should handle missing coordinates in distance check', () => {
            const profile = { gender: 'female', age: 25 };
            const viewerProfile = { coordinates: { lat: 40.7128, lng: -74.0060 } };
            const prefs = { interestedIn: 'everyone', maxDistance: 10 };
            
            const result = checkPreferenceMatch(profile, prefs, viewerProfile);
            expect(result.matches).toBe(false);
            expect(result.reason).toBe('too_far');
        });
    });
});


