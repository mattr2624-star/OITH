/**
 * OITH Caching Layer
 * 
 * Multi-tier caching strategy to address:
 * - Database latency (89.2ms → target <30ms)
 * - P95 response time (458ms → target <200ms)
 * 
 * Tiers:
 * 1. In-Memory LRU Cache (Lambda warm instances)
 * 2. ElastiCache Redis (shared across instances)
 * 3. DynamoDB DAX (DynamoDB-specific caching)
 */

// ==========================================
// IN-MEMORY LRU CACHE
// ==========================================

class LRUCache {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 1000;
        this.ttlMs = options.ttlMs || 300000; // 5 minutes default
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            sets: 0
        };
    }
    
    get(key) {
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.stats.misses++;
            return null;
        }
        
        // Check TTL
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }
        
        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, entry);
        
        this.stats.hits++;
        return entry.value;
    }
    
    set(key, value, ttlMs = this.ttlMs) {
        // Evict if at capacity
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
            this.stats.evictions++;
        }
        
        this.cache.set(key, {
            value,
            expiresAt: Date.now() + ttlMs
        });
        
        this.stats.sets++;
    }
    
    delete(key) {
        return this.cache.delete(key);
    }
    
    clear() {
        this.cache.clear();
    }
    
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;
            
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRate: `${hitRate}%`,
            ...this.stats
        };
    }
}

// ==========================================
// REDIS CACHE CLIENT (ElastiCache)
// ==========================================

class RedisCache {
    constructor(options = {}) {
        this.host = options.host || process.env.REDIS_HOST || 'localhost';
        this.port = options.port || process.env.REDIS_PORT || 6379;
        this.password = options.password || process.env.REDIS_PASSWORD;
        this.db = options.db || 0;
        this.keyPrefix = options.keyPrefix || 'oith:';
        this.defaultTTL = options.defaultTTL || 300; // 5 minutes
        
        this.client = null;
        this.isConnected = false;
        this.connectionPromise = null;
        
        // Metrics
        this.stats = {
            hits: 0,
            misses: 0,
            errors: 0,
            sets: 0
        };
    }
    
    async connect() {
        if (this.isConnected) return this.client;
        if (this.connectionPromise) return this.connectionPromise;
        
        this.connectionPromise = this._createConnection();
        return this.connectionPromise;
    }
    
    async _createConnection() {
        try {
            // Dynamic import to avoid issues if redis not installed
            const { createClient } = await import('redis');
            
            this.client = createClient({
                socket: {
                    host: this.host,
                    port: this.port,
                    reconnectStrategy: (retries) => {
                        if (retries > 10) return new Error('Max retries reached');
                        return Math.min(retries * 100, 3000);
                    }
                },
                password: this.password,
                database: this.db
            });
            
            this.client.on('error', (err) => {
                console.error('[RedisCache] Error:', err.message);
                this.stats.errors++;
            });
            
            this.client.on('connect', () => {
                console.log('[RedisCache] Connected to Redis');
                this.isConnected = true;
            });
            
            this.client.on('end', () => {
                console.log('[RedisCache] Disconnected from Redis');
                this.isConnected = false;
            });
            
            await this.client.connect();
            return this.client;
        } catch (error) {
            console.error('[RedisCache] Connection failed:', error.message);
            this.connectionPromise = null;
            throw error;
        }
    }
    
    async get(key) {
        try {
            if (!this.isConnected) await this.connect();
            
            const value = await this.client.get(this.keyPrefix + key);
            
            if (value === null) {
                this.stats.misses++;
                return null;
            }
            
            this.stats.hits++;
            return JSON.parse(value);
        } catch (error) {
            this.stats.errors++;
            console.error('[RedisCache] Get error:', error.message);
            return null;
        }
    }
    
    async set(key, value, ttlSeconds = this.defaultTTL) {
        try {
            if (!this.isConnected) await this.connect();
            
            await this.client.setEx(
                this.keyPrefix + key,
                ttlSeconds,
                JSON.stringify(value)
            );
            
            this.stats.sets++;
            return true;
        } catch (error) {
            this.stats.errors++;
            console.error('[RedisCache] Set error:', error.message);
            return false;
        }
    }
    
    async delete(key) {
        try {
            if (!this.isConnected) await this.connect();
            return await this.client.del(this.keyPrefix + key);
        } catch (error) {
            this.stats.errors++;
            return false;
        }
    }
    
    async mget(keys) {
        try {
            if (!this.isConnected) await this.connect();
            
            const prefixedKeys = keys.map(k => this.keyPrefix + k);
            const values = await this.client.mGet(prefixedKeys);
            
            return values.map((v, i) => {
                if (v === null) {
                    this.stats.misses++;
                    return null;
                }
                this.stats.hits++;
                return JSON.parse(v);
            });
        } catch (error) {
            this.stats.errors++;
            return keys.map(() => null);
        }
    }
    
    async mset(entries, ttlSeconds = this.defaultTTL) {
        try {
            if (!this.isConnected) await this.connect();
            
            const pipeline = this.client.multi();
            
            for (const [key, value] of Object.entries(entries)) {
                pipeline.setEx(this.keyPrefix + key, ttlSeconds, JSON.stringify(value));
            }
            
            await pipeline.exec();
            this.stats.sets += Object.keys(entries).length;
            return true;
        } catch (error) {
            this.stats.errors++;
            return false;
        }
    }
    
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;
            
        return {
            isConnected: this.isConnected,
            host: this.host,
            hitRate: `${hitRate}%`,
            ...this.stats
        };
    }
    
    async disconnect() {
        if (this.client) {
            await this.client.quit();
            this.isConnected = false;
        }
    }
}

// ==========================================
// DYNAMODB DAX CLIENT WRAPPER
// ==========================================

class DAXCache {
    constructor(options = {}) {
        this.endpoints = options.endpoints || process.env.DAX_ENDPOINTS?.split(',') || [];
        this.region = options.region || process.env.AWS_REGION || 'us-east-1';
        this.client = null;
        this.isEnabled = this.endpoints.length > 0;
        
        this.stats = {
            hits: 0,
            misses: 0,
            errors: 0
        };
    }
    
    async connect() {
        if (!this.isEnabled) {
            console.log('[DAXCache] DAX not configured, using standard DynamoDB');
            return null;
        }
        
        try {
            // Dynamic import
            const { DynamoDBDocument } = await import('@aws-sdk/lib-dynamodb');
            const AmazonDaxClient = await import('amazon-dax-client');
            
            const dax = new AmazonDaxClient({
                endpoints: this.endpoints,
                region: this.region
            });
            
            this.client = DynamoDBDocument.from(dax);
            console.log('[DAXCache] Connected to DAX cluster');
            return this.client;
        } catch (error) {
            console.error('[DAXCache] Connection failed:', error.message);
            this.isEnabled = false;
            return null;
        }
    }
    
    getClient() {
        return this.client;
    }
    
    isAvailable() {
        return this.isEnabled && this.client !== null;
    }
}

// ==========================================
// MULTI-TIER CACHE MANAGER
// ==========================================

class CacheManager {
    constructor(options = {}) {
        // L1: In-memory (fastest, per-instance)
        this.l1 = new LRUCache({
            maxSize: options.l1MaxSize || 1000,
            ttlMs: options.l1TTL || 60000 // 1 minute
        });
        
        // L2: Redis/ElastiCache (fast, shared)
        this.l2 = options.redis || new RedisCache({
            host: options.redisHost,
            port: options.redisPort,
            defaultTTL: options.l2TTL || 300 // 5 minutes
        });
        
        // L3: DAX (DynamoDB caching)
        this.l3 = options.dax || new DAXCache({
            endpoints: options.daxEndpoints
        });
        
        this.useL2 = options.useRedis !== false;
        this.useL3 = options.useDax !== false;
        
        this.stats = {
            l1Hits: 0,
            l2Hits: 0,
            l3Hits: 0,
            misses: 0
        };
    }
    
    async get(key, fetcher = null) {
        // Try L1 (in-memory)
        let value = this.l1.get(key);
        if (value !== null) {
            this.stats.l1Hits++;
            return value;
        }
        
        // Try L2 (Redis) if enabled
        if (this.useL2) {
            try {
                value = await this.l2.get(key);
                if (value !== null) {
                    this.stats.l2Hits++;
                    // Populate L1
                    this.l1.set(key, value);
                    return value;
                }
            } catch (error) {
                // Redis unavailable, continue
            }
        }
        
        // Cache miss - call fetcher if provided
        if (fetcher) {
            try {
                value = await fetcher();
                if (value !== null && value !== undefined) {
                    await this.set(key, value);
                    return value;
                }
            } catch (error) {
                throw error;
            }
        }
        
        this.stats.misses++;
        return null;
    }
    
    async set(key, value, options = {}) {
        const l1TTL = options.l1TTL || 60000;
        const l2TTL = options.l2TTL || 300;
        
        // Set in L1
        this.l1.set(key, value, l1TTL);
        
        // Set in L2 if enabled
        if (this.useL2) {
            try {
                await this.l2.set(key, value, l2TTL);
            } catch (error) {
                // Redis unavailable, continue
            }
        }
    }
    
    async invalidate(key) {
        this.l1.delete(key);
        
        if (this.useL2) {
            try {
                await this.l2.delete(key);
            } catch (error) {
                // Continue
            }
        }
    }
    
    async invalidatePattern(pattern) {
        // L1 doesn't support patterns, clear all
        // In production, implement pattern matching
        
        if (this.useL2 && this.l2.client) {
            try {
                const keys = await this.l2.client.keys(this.l2.keyPrefix + pattern);
                if (keys.length > 0) {
                    await this.l2.client.del(keys);
                }
            } catch (error) {
                // Continue
            }
        }
    }
    
    getStats() {
        return {
            l1: this.l1.getStats(),
            l2: this.l2.getStats(),
            manager: this.stats
        };
    }
}

// ==========================================
// PRE-COMPUTED CACHE KEYS
// ==========================================

const CacheKeys = {
    // User profiles
    userProfile: (email) => `user:profile:${email}`,
    userPreferences: (email) => `user:prefs:${email}`,
    
    // Matching
    matchCandidates: (email, geohash) => `match:candidates:${email}:${geohash}`,
    compatibilityScore: (email1, email2) => `match:compat:${[email1, email2].sort().join(':')}`,
    userMatches: (email) => `match:user:${email}`,
    
    // Geolocation
    usersInGeohash: (geohash) => `geo:users:${geohash}`,
    nearbyUsers: (geohash, radius) => `geo:nearby:${geohash}:${radius}`,
    
    // Analytics
    dailyStats: (date) => `stats:daily:${date}`,
    userActivity: (email) => `stats:activity:${email}`
};

// ==========================================
// PRE-CONFIGURED INSTANCES
// ==========================================

// Profile cache (high TTL, used frequently)
const profileCache = new LRUCache({
    maxSize: 5000,
    ttlMs: 300000 // 5 minutes
});

// Match candidates cache (shorter TTL, changes more)
const matchCache = new LRUCache({
    maxSize: 2000,
    ttlMs: 60000 // 1 minute
});

// Compatibility scores cache (longer TTL, expensive to compute)
const compatibilityCache = new LRUCache({
    maxSize: 10000,
    ttlMs: 3600000 // 1 hour
});

// Shared cache manager
let cacheManager = null;

function getCacheManager(options = {}) {
    if (!cacheManager) {
        cacheManager = new CacheManager(options);
    }
    return cacheManager;
}

// ==========================================
// CACHE-ASIDE PATTERN HELPERS
// ==========================================

async function cacheAside(cache, key, fetcher, ttl = null) {
    // Try cache first
    let value = cache.get ? cache.get(key) : await cache.get(key);
    
    if (value !== null && value !== undefined) {
        return value;
    }
    
    // Cache miss - fetch from source
    value = await fetcher();
    
    if (value !== null && value !== undefined) {
        if (ttl) {
            cache.set(key, value, ttl);
        } else {
            cache.set(key, value);
        }
    }
    
    return value;
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    // Classes
    LRUCache,
    RedisCache,
    DAXCache,
    CacheManager,
    
    // Pre-configured instances
    profileCache,
    matchCache,
    compatibilityCache,
    getCacheManager,
    
    // Helpers
    CacheKeys,
    cacheAside
};

