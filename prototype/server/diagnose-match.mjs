/**
 * Quick diagnostic script to check why two users aren't matching
 * Usage: node diagnose-match.mjs <email1> <email2>
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLES = {
    PROFILES: 'oith-profiles',
    MATCH_HISTORY: 'oith-match-history',
    BLOCKS: 'oith-blocks'
};

const CONFIG = {
    ACTIVE_USER_DAYS: 14
};

// Calculate distance between two points (Haversine formula)
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

// Check if a profile fits preferences
function checkPreferenceMatch(profile, prefs, viewerProfile) {
    // Gender preference
    const interestedIn = prefs.interestedIn || 'everyone';
    if (interestedIn !== 'everyone') {
        const profileGender = profile.gender?.toLowerCase();
        const wantsGender = interestedIn.toLowerCase();
        const genderMap = { 'men': 'male', 'women': 'female', 'male': 'male', 'female': 'female' };
        const targetGender = genderMap[wantsGender] || wantsGender;
        if (profileGender !== targetGender) {
            return { matches: false, reason: `gender_mismatch (wants ${interestedIn}, profile is ${profileGender})` };
        }
    }
    
    // Age range
    const ageMin = prefs.ageMin || 18;
    const ageMax = prefs.ageMax || 99;
    const profileAge = profile.age || 25;
    if (profileAge < ageMin || profileAge > ageMax) {
        return { matches: false, reason: `age_out_of_range (age ${profileAge} not in ${ageMin}-${ageMax})` };
    }
    
    // Distance
    const maxDistance = prefs.maxDistance || prefs.distance || 100;
    const viewerCoords = viewerProfile.coordinates || {};
    const profileCoords = profile.coordinates || {};
    const distance = calculateDistance(
        viewerCoords.lat, viewerCoords.lng,
        profileCoords.lat, profileCoords.lng
    );
    if (distance > maxDistance) {
        return { matches: false, reason: `too_far (${distance}mi > max ${maxDistance}mi)`, distance };
    }
    
    // Smoking preference
    if (prefs.smoking && prefs.smoking.length > 0) {
        const profileSmoking = profile.smoking?.toLowerCase();
        if (profileSmoking && !prefs.smoking.map(s => s.toLowerCase()).includes(profileSmoking)) {
            return { matches: false, reason: `smoking_mismatch (profile: ${profileSmoking}, wants: ${prefs.smoking.join('/')})` };
        }
    }
    
    // Drinking preference
    if (prefs.drinking && prefs.drinking.length > 0) {
        const profileDrinking = profile.drinking?.toLowerCase();
        if (profileDrinking && !prefs.drinking.map(d => d.toLowerCase()).includes(profileDrinking)) {
            return { matches: false, reason: `drinking_mismatch (profile: ${profileDrinking}, wants: ${prefs.drinking.join('/')})` };
        }
    }
    
    // Religion preference
    if (prefs.religion && prefs.religion !== '' && prefs.religion !== 'any') {
        if (profile.religion?.toLowerCase() !== prefs.religion.toLowerCase()) {
            return { matches: false, reason: `religion_mismatch (profile: ${profile.religion}, wants: ${prefs.religion})` };
        }
    }
    
    // Children preference
    if (prefs.children && prefs.children !== '' && prefs.children !== 'any') {
        if (profile.children !== prefs.children) {
            return { matches: false, reason: `children_mismatch (profile: ${profile.children}, wants: ${prefs.children})` };
        }
    }
    
    return { matches: true, distance };
}

async function diagnose(email1, email2) {
    console.log('\n' + '='.repeat(70));
    console.log('  OITH MATCH DIAGNOSTIC');
    console.log('='.repeat(70));
    console.log(`\nChecking: ${email1} ↔ ${email2}\n`);
    
    // 1. Get both profiles
    console.log('📥 Fetching profiles from DynamoDB...\n');
    
    let user1, user2;
    
    try {
        const [u1, u2] = await Promise.all([
            docClient.send(new GetCommand({
                TableName: TABLES.PROFILES,
                Key: { email: email1.toLowerCase() }
            })),
            docClient.send(new GetCommand({
                TableName: TABLES.PROFILES,
                Key: { email: email2.toLowerCase() }
            }))
        ]);
        
        user1 = u1.Item;
        user2 = u2.Item;
    } catch (err) {
        console.log('❌ Error connecting to DynamoDB:', err.message);
        console.log('\nMake sure:');
        console.log('  1. AWS credentials are configured (aws configure)');
        console.log('  2. The oith-profiles table exists in us-east-1');
        return;
    }
    
    // Check if users exist
    if (!user1) {
        console.log(`❌ USER 1 NOT FOUND: ${email1}`);
        console.log('   This user does not exist in the oith-profiles table');
    }
    if (!user2) {
        console.log(`❌ USER 2 NOT FOUND: ${email2}`);
        console.log('   This user does not exist in the oith-profiles table');
    }
    
    if (!user1 || !user2) {
        console.log('\n⚠️  Cannot continue diagnosis without both users in database');
        return;
    }
    
    // Display profiles
    console.log('👤 USER 1:', user1.firstName || email1);
    console.log('   Email:', user1.email);
    console.log('   Gender:', user1.gender || 'NOT SET');
    console.log('   Age:', user1.age || 'NOT SET');
    console.log('   Location:', user1.location || 'NOT SET');
    console.log('   Coordinates:', user1.coordinates ? `${user1.coordinates.lat}, ${user1.coordinates.lng}` : 'NOT SET');
    console.log('   isVisible:', user1.isVisible !== false ? 'true (available)' : 'FALSE ⚠️');
    console.log('   lastSeen:', user1.lastSeen || 'NOT SET');
    console.log('   Preferences:', JSON.stringify(user1.matchPreferences || user1.preferences || {}, null, 2).split('\n').map((l, i) => i === 0 ? l : '               ' + l).join('\n'));
    
    console.log('\n👤 USER 2:', user2.firstName || email2);
    console.log('   Email:', user2.email);
    console.log('   Gender:', user2.gender || 'NOT SET');
    console.log('   Age:', user2.age || 'NOT SET');
    console.log('   Location:', user2.location || 'NOT SET');
    console.log('   Coordinates:', user2.coordinates ? `${user2.coordinates.lat}, ${user2.coordinates.lng}` : 'NOT SET');
    console.log('   isVisible:', user2.isVisible !== false ? 'true (available)' : 'FALSE ⚠️');
    console.log('   lastSeen:', user2.lastSeen || 'NOT SET');
    console.log('   Preferences:', JSON.stringify(user2.matchPreferences || user2.preferences || {}, null, 2).split('\n').map((l, i) => i === 0 ? l : '               ' + l).join('\n'));
    
    console.log('\n' + '-'.repeat(70));
    console.log('  DIAGNOSTIC CHECKS');
    console.log('-'.repeat(70) + '\n');
    
    let canMatch = true;
    
    // Check 1: Visibility
    console.log('1️⃣  VISIBILITY CHECK');
    if (user1.isVisible === false) {
        console.log(`   ❌ ${user1.firstName || email1} has isVisible=false`);
        console.log('      → This user is currently viewing/in a match and hidden from pool');
        canMatch = false;
    } else {
        console.log(`   ✅ ${user1.firstName || email1} is visible`);
    }
    if (user2.isVisible === false) {
        console.log(`   ❌ ${user2.firstName || email2} has isVisible=false`);
        console.log('      → This user is currently viewing/in a match and hidden from pool');
        canMatch = false;
    } else {
        console.log(`   ✅ ${user2.firstName || email2} is visible`);
    }
    
    // Check 2: Activity
    console.log('\n2️⃣  ACTIVITY CHECK (must be active within 14 days)');
    const activeThreshold = new Date(Date.now() - CONFIG.ACTIVE_USER_DAYS * 24 * 60 * 60 * 1000);
    
    if (!user1.lastSeen) {
        console.log(`   ⚠️  ${user1.firstName || email1} has NO lastSeen timestamp`);
        console.log('      → User may have never logged in or data is missing');
    } else if (new Date(user1.lastSeen) < activeThreshold) {
        console.log(`   ❌ ${user1.firstName || email1} last seen: ${user1.lastSeen}`);
        console.log(`      → Inactive for >${CONFIG.ACTIVE_USER_DAYS} days, hidden from matching`);
        canMatch = false;
    } else {
        console.log(`   ✅ ${user1.firstName || email1} last seen: ${user1.lastSeen}`);
    }
    
    if (!user2.lastSeen) {
        console.log(`   ⚠️  ${user2.firstName || email2} has NO lastSeen timestamp`);
        console.log('      → User may have never logged in or data is missing');
    } else if (new Date(user2.lastSeen) < activeThreshold) {
        console.log(`   ❌ ${user2.firstName || email2} last seen: ${user2.lastSeen}`);
        console.log(`      → Inactive for >${CONFIG.ACTIVE_USER_DAYS} days, hidden from matching`);
        canMatch = false;
    } else {
        console.log(`   ✅ ${user2.firstName || email2} last seen: ${user2.lastSeen}`);
    }
    
    // Check 3: Match History
    console.log('\n3️⃣  MATCH HISTORY CHECK (passed/accepted previously?)');
    try {
        const [h1to2, h2to1] = await Promise.all([
            docClient.send(new GetCommand({
                TableName: TABLES.MATCH_HISTORY,
                Key: { userEmail: email1.toLowerCase(), matchEmail: email2.toLowerCase() }
            })).catch(() => ({ Item: null })),
            docClient.send(new GetCommand({
                TableName: TABLES.MATCH_HISTORY,
                Key: { userEmail: email2.toLowerCase(), matchEmail: email1.toLowerCase() }
            })).catch(() => ({ Item: null }))
        ]);
        
        if (h1to2.Item) {
            console.log(`   ⚠️  ${user1.firstName || email1} previously ${h1to2.Item.action}ED ${user2.firstName || email2}`);
            if (h1to2.Item.action === 'pass') canMatch = false;
        } else {
            console.log(`   ✅ ${user1.firstName || email1} has no history with ${user2.firstName || email2}`);
        }
        
        if (h2to1.Item) {
            console.log(`   ⚠️  ${user2.firstName || email2} previously ${h2to1.Item.action}ED ${user1.firstName || email1}`);
            if (h2to1.Item.action === 'pass') canMatch = false;
        } else {
            console.log(`   ✅ ${user2.firstName || email2} has no history with ${user1.firstName || email1}`);
        }
    } catch (e) {
        console.log('   ⚠️  Could not check match history:', e.message);
    }
    
    // Check 4: Blocks
    console.log('\n4️⃣  BLOCK CHECK');
    try {
        const [b1, b2] = await Promise.all([
            docClient.send(new GetCommand({
                TableName: TABLES.BLOCKS,
                Key: { blockerEmail: email1.toLowerCase(), blockedEmail: email2.toLowerCase() }
            })).catch(() => ({ Item: null })),
            docClient.send(new GetCommand({
                TableName: TABLES.BLOCKS,
                Key: { blockerEmail: email2.toLowerCase(), blockedEmail: email1.toLowerCase() }
            })).catch(() => ({ Item: null }))
        ]);
        
        if (b1.Item) {
            console.log(`   ❌ ${user1.firstName || email1} has BLOCKED ${user2.firstName || email2}`);
            canMatch = false;
        }
        if (b2.Item) {
            console.log(`   ❌ ${user2.firstName || email2} has BLOCKED ${user1.firstName || email1}`);
            canMatch = false;
        }
        if (!b1.Item && !b2.Item) {
            console.log('   ✅ No blocks between these users');
        }
    } catch (e) {
        console.log('   ⚠️  Could not check blocks:', e.message);
    }
    
    // Check 5: Preference Matching (MUTUAL)
    console.log('\n5️⃣  PREFERENCE MATCHING (must be MUTUAL)');
    
    const user1Prefs = user1.matchPreferences || user1.preferences || {};
    const user2Prefs = user2.matchPreferences || user2.preferences || {};
    
    const user1Profile = {
        email: user1.email,
        gender: user1.gender?.toLowerCase(),
        age: user1.age,
        coordinates: user1.coordinates,
        drinking: user1.drinking,
        smoking: user1.smoking,
        religion: user1.religion,
        children: user1.children
    };
    
    const user2Profile = {
        email: user2.email,
        gender: user2.gender?.toLowerCase(),
        age: user2.age,
        coordinates: user2.coordinates,
        drinking: user2.drinking,
        smoking: user2.smoking,
        religion: user2.religion,
        children: user2.children
    };
    
    // Direction A: Does user2 fit user1's preferences?
    console.log(`\n   [A] Does ${user2.firstName || email2} fit ${user1.firstName || email1}'s preferences?`);
    const check1 = checkPreferenceMatch(user2Profile, user1Prefs, user1Profile);
    if (check1.matches) {
        console.log(`       ✅ YES - ${check1.distance !== undefined ? `${check1.distance} miles apart` : 'all preferences match'}`);
    } else {
        console.log(`       ❌ NO - ${check1.reason}`);
        canMatch = false;
    }
    
    // Direction B: Does user1 fit user2's preferences?
    console.log(`\n   [B] Does ${user1.firstName || email1} fit ${user2.firstName || email2}'s preferences?`);
    const check2 = checkPreferenceMatch(user1Profile, user2Prefs, user2Profile);
    if (check2.matches) {
        console.log(`       ✅ YES - ${check2.distance !== undefined ? `${check2.distance} miles apart` : 'all preferences match'}`);
    } else {
        console.log(`       ❌ NO - ${check2.reason}`);
        canMatch = false;
    }
    
    // Summary
    console.log('\n' + '='.repeat(70));
    if (canMatch) {
        console.log('  ✅ RESULT: These users SHOULD be able to match');
        console.log('     If they still don\'t see each other, check:');
        console.log('     - Is the matching service properly deployed?');
        console.log('     - Are both users refreshing their match screen?');
        console.log('     - Is there a GSI (geohash-lastSeen-index) issue?');
    } else {
        console.log('  ❌ RESULT: These users CANNOT match');
        console.log('     Review the issues marked with ❌ above');
    }
    console.log('='.repeat(70) + '\n');
}

// Get emails from command line
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node diagnose-match.mjs <email1> <email2>');
    console.log('Example: node diagnose-match.mjs user1@test.com user2@test.com');
    process.exit(1);
}

diagnose(args[0], args[1]).catch(console.error);

