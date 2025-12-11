/**
 * OITH User Simulation - User Profile Generator
 * 
 * Generates realistic synthetic user profiles for load testing
 * the matching algorithm at scale.
 */

// Realistic data distributions based on dating app demographics
const DATA = {
    firstNames: {
        male: ['James', 'John', 'Michael', 'David', 'Robert', 'William', 'Christopher', 'Matthew', 'Daniel', 'Andrew', 'Joshua', 'Ryan', 'Brandon', 'Tyler', 'Kevin', 'Brian', 'Justin', 'Austin', 'Eric', 'Jason', 'Aaron', 'Adam', 'Nathan', 'Zachary', 'Jeremy', 'Kyle', 'Sean', 'Alex', 'Ethan', 'Noah', 'Liam', 'Mason', 'Logan', 'Lucas', 'Jake', 'Dylan', 'Caleb', 'Owen', 'Hunter', 'Chase'],
        female: ['Emma', 'Olivia', 'Sophia', 'Ava', 'Isabella', 'Mia', 'Charlotte', 'Amelia', 'Harper', 'Evelyn', 'Jessica', 'Ashley', 'Emily', 'Sarah', 'Amanda', 'Jennifer', 'Lauren', 'Samantha', 'Hannah', 'Rachel', 'Megan', 'Nicole', 'Taylor', 'Brittany', 'Stephanie', 'Kayla', 'Natalie', 'Victoria', 'Grace', 'Lily', 'Chloe', 'Zoe', 'Madison', 'Ella', 'Scarlett', 'Aria', 'Riley', 'Aubrey', 'Layla', 'Nora']
    },
    occupations: ['Software Engineer', 'Teacher', 'Nurse', 'Marketing Manager', 'Designer', 'Accountant', 'Sales Representative', 'Project Manager', 'Physical Therapist', 'Lawyer', 'Doctor', 'Consultant', 'Writer', 'Chef', 'Photographer', 'Real Estate Agent', 'Financial Analyst', 'Social Worker', 'Architect', 'Entrepreneur', 'Data Scientist', 'Product Manager', 'UX Designer', 'HR Manager', 'Veterinarian'],
    interests: ['Travel', 'Hiking', 'Cooking', 'Reading', 'Movies', 'Music', 'Fitness', 'Photography', 'Art', 'Gaming', 'Dancing', 'Yoga', 'Coffee', 'Wine', 'Sports', 'Dogs', 'Cats', 'Beach', 'Mountains', 'Food', 'Concerts', 'Theater', 'Podcasts', 'Gardening', 'Running', 'Cycling', 'Swimming', 'Meditation', 'Camping', 'Surfing'],
    heights: ['5\'2"', '5\'3"', '5\'4"', '5\'5"', '5\'6"', '5\'7"', '5\'8"', '5\'9"', '5\'10"', '5\'11"', '6\'0"', '6\'1"', '6\'2"', '6\'3"', '6\'4"'],
    drinking: ['Never', 'Rarely', 'Socially', 'Often'],
    smoking: ['Never', 'Occasionally', 'Regularly'],
    exercise: ['Never', 'Sometimes', 'Regularly', 'Daily'],
    children: ['No children', 'Want someday', 'Have & want more', 'Have, done', 'Not sure'],
    religion: ['Christian', 'Catholic', 'Jewish', 'Muslim', 'Hindu', 'Buddhist', 'Spiritual', 'Agnostic', 'Atheist', 'Other'],
    lookingFor: ['relationship', 'casual', 'friendship', 'not_sure'],
    
    // US cities with approximate lat/lng for geohash testing
    cities: [
        { name: 'New York, NY', lat: 40.7128, lng: -74.0060 },
        { name: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437 },
        { name: 'Chicago, IL', lat: 41.8781, lng: -87.6298 },
        { name: 'Houston, TX', lat: 29.7604, lng: -95.3698 },
        { name: 'Phoenix, AZ', lat: 33.4484, lng: -112.0740 },
        { name: 'Philadelphia, PA', lat: 39.9526, lng: -75.1652 },
        { name: 'San Antonio, TX', lat: 29.4241, lng: -98.4936 },
        { name: 'San Diego, CA', lat: 32.7157, lng: -117.1611 },
        { name: 'Dallas, TX', lat: 32.7767, lng: -96.7970 },
        { name: 'San Jose, CA', lat: 37.3382, lng: -121.8863 },
        { name: 'Austin, TX', lat: 30.2672, lng: -97.7431 },
        { name: 'Jacksonville, FL', lat: 30.3322, lng: -81.6557 },
        { name: 'Fort Worth, TX', lat: 32.7555, lng: -97.3308 },
        { name: 'Columbus, OH', lat: 39.9612, lng: -82.9988 },
        { name: 'San Francisco, CA', lat: 37.7749, lng: -122.4194 },
        { name: 'Charlotte, NC', lat: 35.2271, lng: -80.8431 },
        { name: 'Indianapolis, IN', lat: 39.7684, lng: -86.1581 },
        { name: 'Seattle, WA', lat: 47.6062, lng: -122.3321 },
        { name: 'Denver, CO', lat: 39.7392, lng: -104.9903 },
        { name: 'Boston, MA', lat: 42.3601, lng: -71.0589 },
        { name: 'Nashville, TN', lat: 36.1627, lng: -86.7816 },
        { name: 'Miami, FL', lat: 25.7617, lng: -80.1918 },
        { name: 'Atlanta, GA', lat: 33.7490, lng: -84.3880 },
        { name: 'Portland, OR', lat: 45.5152, lng: -122.6784 },
        { name: 'Las Vegas, NV', lat: 36.1699, lng: -115.1398 }
    ]
};

// Gender distribution on dating apps (varies by app)
const GENDER_DISTRIBUTION = { male: 0.60, female: 0.40 };

// Age distribution (skews younger on dating apps)
const AGE_DISTRIBUTION = [
    { range: [18, 24], weight: 0.25 },
    { range: [25, 29], weight: 0.30 },
    { range: [30, 34], weight: 0.20 },
    { range: [35, 39], weight: 0.12 },
    { range: [40, 49], weight: 0.08 },
    { range: [50, 65], weight: 0.05 }
];

// Helper functions
function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomWeightedChoice(items, weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
        random -= weights[i];
        if (random <= 0) return items[i];
    }
    return items[items.length - 1];
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomSubset(arr, minCount, maxCount) {
    const count = randomInt(minCount, Math.min(maxCount, arr.length));
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

function generateAge() {
    const ranges = AGE_DISTRIBUTION.map(d => d.range);
    const weights = AGE_DISTRIBUTION.map(d => d.weight);
    const range = randomWeightedChoice(ranges, weights);
    return randomInt(range[0], range[1]);
}

function addLocationVariation(city) {
    // Add small random variation to coordinates (within ~10 miles)
    const variation = 0.15; // About 10 miles
    return {
        lat: city.lat + (Math.random() - 0.5) * variation,
        lng: city.lng + (Math.random() - 0.5) * variation
    };
}

// Geohash encoding (same as in matchingService.mjs)
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

function encodeGeohash(lat, lng, precision = 4) {
    if (!lat || !lng) return null;
    
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
 * Generate a single user profile
 */
function generateUser(index) {
    const gender = Math.random() < GENDER_DISTRIBUTION.male ? 'male' : 'female';
    const age = generateAge();
    const city = randomChoice(DATA.cities);
    const coords = addLocationVariation(city);
    
    // Generate preferences based on gender and age
    const interestedIn = gender === 'male' 
        ? (Math.random() < 0.92 ? 'women' : (Math.random() < 0.5 ? 'men' : 'everyone'))
        : (Math.random() < 0.92 ? 'men' : (Math.random() < 0.5 ? 'women' : 'everyone'));
    
    const ageMin = Math.max(18, age - randomInt(5, 15));
    const ageMax = Math.min(99, age + randomInt(5, 15));
    const maxDistance = randomChoice([10, 15, 25, 50, 100]);
    
    const email = `user_${index}_${Date.now()}@oith-test.com`;
    
    return {
        email: email.toLowerCase(),
        firstName: randomChoice(DATA.firstNames[gender]),
        age,
        gender,
        location: city.name,
        coordinates: coords,
        geohash: encodeGeohash(coords.lat, coords.lng, 4),
        occupation: randomChoice(DATA.occupations),
        bio: `Test user ${index} for simulation`,
        photo: `https://i.pravatar.cc/400?u=${email}`,
        photos: [`https://i.pravatar.cc/400?u=${email}`],
        height: randomChoice(DATA.heights),
        drinking: randomChoice(DATA.drinking),
        smoking: randomChoice(DATA.smoking),
        exercise: randomChoice(DATA.exercise),
        children: randomChoice(DATA.children),
        religion: randomChoice(DATA.religion),
        interests: randomSubset(DATA.interests, 3, 8),
        lookingFor: randomChoice(DATA.lookingFor),
        matchPreferences: {
            interestedIn,
            ageMin,
            ageMax,
            maxDistance,
            smoking: Math.random() < 0.3 ? [randomChoice(DATA.smoking)] : [],
            drinking: Math.random() < 0.2 ? [randomChoice(DATA.drinking)] : [],
            religion: Math.random() < 0.1 ? randomChoice(DATA.religion) : '',
            children: Math.random() < 0.1 ? randomChoice(DATA.children) : ''
        },
        isVisible: true,
        online: Math.random() < 0.3,
        lastSeen: new Date(Date.now() - randomInt(0, 7 * 24 * 60 * 60 * 1000)).toISOString(),
        createdAt: new Date().toISOString()
    };
}

/**
 * Generate multiple users with realistic distribution
 */
function generateUsers(count, options = {}) {
    const {
        cityFocus = null,      // Focus users in specific city
        cityFocusWeight = 0.5, // What percentage should be in focused city
        genderRatio = null     // Override default gender ratio
    } = options;
    
    const users = [];
    const startTime = Date.now();
    
    for (let i = 0; i < count; i++) {
        const user = generateUser(i);
        
        // Apply city focus if specified
        if (cityFocus && Math.random() < cityFocusWeight) {
            const focusCity = DATA.cities.find(c => c.name.includes(cityFocus)) || DATA.cities[0];
            const coords = addLocationVariation(focusCity);
            user.location = focusCity.name;
            user.coordinates = coords;
            user.geohash = encodeGeohash(coords.lat, coords.lng, 4);
        }
        
        users.push(user);
        
        // Progress logging for large batches
        if ((i + 1) % 1000 === 0) {
            const elapsed = Date.now() - startTime;
            console.log(`Generated ${i + 1} users (${elapsed}ms)`);
        }
    }
    
    return users;
}

/**
 * Get statistics about generated user pool
 */
function getUserPoolStats(users) {
    const stats = {
        total: users.length,
        byGender: { male: 0, female: 0, other: 0 },
        byAge: {},
        byCity: {},
        byGeohash: {},
        interestedIn: { men: 0, women: 0, everyone: 0 },
        activeUsers: 0,
        avgAge: 0
    };
    
    let totalAge = 0;
    
    for (const user of users) {
        // Gender
        stats.byGender[user.gender] = (stats.byGender[user.gender] || 0) + 1;
        
        // Age brackets
        const ageBracket = Math.floor(user.age / 10) * 10;
        const ageKey = `${ageBracket}-${ageBracket + 9}`;
        stats.byAge[ageKey] = (stats.byAge[ageKey] || 0) + 1;
        totalAge += user.age;
        
        // City
        stats.byCity[user.location] = (stats.byCity[user.location] || 0) + 1;
        
        // Geohash
        if (user.geohash) {
            stats.byGeohash[user.geohash] = (stats.byGeohash[user.geohash] || 0) + 1;
        }
        
        // Preferences
        const pref = user.matchPreferences?.interestedIn || 'everyone';
        stats.interestedIn[pref] = (stats.interestedIn[pref] || 0) + 1;
        
        // Active (last seen within 7 days)
        const lastSeen = new Date(user.lastSeen);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (lastSeen > sevenDaysAgo) {
            stats.activeUsers++;
        }
    }
    
    stats.avgAge = Math.round(totalAge / users.length);
    
    return stats;
}

// Export for use in other modules
if (typeof module !== 'undefined') {
    module.exports = {
        generateUser,
        generateUsers,
        getUserPoolStats,
        encodeGeohash,
        DATA
    };
}

// If run directly, generate sample users
if (typeof require !== 'undefined' && require.main === module) {
    console.log('Generating sample users...\n');
    
    const users = generateUsers(100);
    const stats = getUserPoolStats(users);
    
    console.log('=== User Pool Statistics ===');
    console.log(`Total users: ${stats.total}`);
    console.log(`Gender distribution: ${JSON.stringify(stats.byGender)}`);
    console.log(`Average age: ${stats.avgAge}`);
    console.log(`Active users (7 days): ${stats.activeUsers}`);
    console.log(`\nAge distribution:`, stats.byAge);
    console.log(`\nTop cities:`, Object.entries(stats.byCity).sort((a, b) => b[1] - a[1]).slice(0, 5));
    console.log(`\nGeohash distribution:`, Object.entries(stats.byGeohash).sort((a, b) => b[1] - a[1]).slice(0, 5));
    console.log(`\nPreference distribution:`, stats.interestedIn);
    
    console.log('\n=== Sample User ===');
    console.log(JSON.stringify(users[0], null, 2));
}

