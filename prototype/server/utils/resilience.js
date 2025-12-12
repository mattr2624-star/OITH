/**
 * OITH Resilience Utilities
 * 
 * Circuit breakers, retry with jitter, and fault tolerance patterns
 * Based on stress test results requiring:
 * - Network failure rate < 0.5%
 * - P95 response time < 200ms
 * - Graceful degradation under load
 */

// ==========================================
// CIRCUIT BREAKER IMPLEMENTATION
// ==========================================

class CircuitBreaker {
    constructor(options = {}) {
        this.name = options.name || 'default';
        this.failureThreshold = options.failureThreshold || 5;
        this.successThreshold = options.successThreshold || 3;
        this.timeout = options.timeout || 30000; // 30 seconds
        this.resetTimeout = options.resetTimeout || 60000; // 1 minute
        
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failures = 0;
        this.successes = 0;
        this.lastFailureTime = null;
        this.nextAttempt = Date.now();
        
        // Metrics
        this.metrics = {
            totalCalls: 0,
            successfulCalls: 0,
            failedCalls: 0,
            rejectedCalls: 0,
            stateChanges: []
        };
    }
    
    async execute(fn) {
        this.metrics.totalCalls++;
        
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttempt) {
                this.metrics.rejectedCalls++;
                throw new CircuitBreakerOpenError(
                    `Circuit breaker ${this.name} is OPEN. Next attempt at ${new Date(this.nextAttempt).toISOString()}`
                );
            }
            // Transition to half-open
            this.setState('HALF_OPEN');
        }
        
        try {
            const result = await this.executeWithTimeout(fn);
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure(error);
            throw error;
        }
    }
    
    async executeWithTimeout(fn) {
        return Promise.race([
            fn(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new TimeoutError(`Operation timed out after ${this.timeout}ms`)), this.timeout)
            )
        ]);
    }
    
    onSuccess() {
        this.metrics.successfulCalls++;
        this.failures = 0;
        
        if (this.state === 'HALF_OPEN') {
            this.successes++;
            if (this.successes >= this.successThreshold) {
                this.setState('CLOSED');
            }
        }
    }
    
    onFailure(error) {
        this.metrics.failedCalls++;
        this.failures++;
        this.lastFailureTime = Date.now();
        
        if (this.state === 'HALF_OPEN') {
            this.setState('OPEN');
        } else if (this.failures >= this.failureThreshold) {
            this.setState('OPEN');
        }
    }
    
    setState(newState) {
        const oldState = this.state;
        this.state = newState;
        
        this.metrics.stateChanges.push({
            from: oldState,
            to: newState,
            timestamp: new Date().toISOString()
        });
        
        if (newState === 'OPEN') {
            this.nextAttempt = Date.now() + this.resetTimeout;
            this.successes = 0;
        } else if (newState === 'CLOSED') {
            this.failures = 0;
            this.successes = 0;
        }
        
        console.log(`[CircuitBreaker:${this.name}] State changed: ${oldState} -> ${newState}`);
    }
    
    getState() {
        return {
            name: this.name,
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            metrics: this.metrics
        };
    }
    
    reset() {
        this.state = 'CLOSED';
        this.failures = 0;
        this.successes = 0;
    }
}

class CircuitBreakerOpenError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CircuitBreakerOpenError';
        this.isCircuitBreakerError = true;
    }
}

class TimeoutError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TimeoutError';
        this.isTimeoutError = true;
    }
}

// ==========================================
// RETRY WITH EXPONENTIAL BACKOFF AND JITTER
// ==========================================

const DEFAULT_RETRY_OPTIONS = {
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 10000,
    jitterFactor: 0.3, // 30% jitter
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ProvisionedThroughputExceededException', 'ThrottlingException'],
    retryableStatusCodes: [429, 500, 502, 503, 504]
};

async function retryWithBackoff(fn, options = {}) {
    const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError;
    
    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            // Check if error is retryable
            if (!isRetryableError(error, opts) || attempt === opts.maxRetries) {
                throw error;
            }
            
            // Calculate delay with exponential backoff and jitter
            const delay = calculateDelayWithJitter(attempt, opts);
            
            console.log(`[Retry] Attempt ${attempt + 1}/${opts.maxRetries + 1} failed. Retrying in ${delay}ms...`, {
                error: error.message,
                code: error.code
            });
            
            await sleep(delay);
        }
    }
    
    throw lastError;
}

function isRetryableError(error, opts) {
    // Check error codes
    if (opts.retryableErrors.includes(error.code)) {
        return true;
    }
    
    // Check HTTP status codes
    if (error.statusCode && opts.retryableStatusCodes.includes(error.statusCode)) {
        return true;
    }
    
    // Check for network errors
    if (error.message && (
        error.message.includes('ECONNRESET') ||
        error.message.includes('socket hang up') ||
        error.message.includes('network') ||
        error.message.includes('timeout')
    )) {
        return true;
    }
    
    // AWS SDK specific errors
    if (error.$metadata && error.$metadata.httpStatusCode) {
        return opts.retryableStatusCodes.includes(error.$metadata.httpStatusCode);
    }
    
    return false;
}

function calculateDelayWithJitter(attempt, opts) {
    // Exponential backoff: baseDelay * 2^attempt
    const exponentialDelay = opts.baseDelayMs * Math.pow(2, attempt);
    
    // Cap at maxDelay
    const cappedDelay = Math.min(exponentialDelay, opts.maxDelayMs);
    
    // Add jitter: random value between -jitter% and +jitter%
    const jitterRange = cappedDelay * opts.jitterFactor;
    const jitter = (Math.random() * 2 - 1) * jitterRange;
    
    return Math.max(0, Math.floor(cappedDelay + jitter));
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==========================================
// REQUEST THROTTLING / RATE LIMITER
// ==========================================

class RateLimiter {
    constructor(options = {}) {
        this.maxRequests = options.maxRequests || 100;
        this.windowMs = options.windowMs || 1000; // 1 second
        this.requests = [];
        this.queue = [];
        this.processing = false;
    }
    
    async acquire() {
        return new Promise((resolve, reject) => {
            const now = Date.now();
            
            // Clean old requests outside window
            this.requests = this.requests.filter(time => now - time < this.windowMs);
            
            if (this.requests.length < this.maxRequests) {
                this.requests.push(now);
                resolve();
            } else {
                // Queue the request
                const timeout = setTimeout(() => {
                    reject(new Error('Rate limit queue timeout'));
                }, 30000); // 30 second queue timeout
                
                this.queue.push({ resolve, reject, timeout, timestamp: now });
                this.processQueue();
            }
        });
    }
    
    processQueue() {
        if (this.processing || this.queue.length === 0) return;
        
        this.processing = true;
        
        const interval = setInterval(() => {
            const now = Date.now();
            this.requests = this.requests.filter(time => now - time < this.windowMs);
            
            while (this.queue.length > 0 && this.requests.length < this.maxRequests) {
                const { resolve, timeout } = this.queue.shift();
                clearTimeout(timeout);
                this.requests.push(now);
                resolve();
            }
            
            if (this.queue.length === 0) {
                clearInterval(interval);
                this.processing = false;
            }
        }, 50);
    }
    
    getStats() {
        return {
            currentRequests: this.requests.length,
            maxRequests: this.maxRequests,
            queueLength: this.queue.length,
            windowMs: this.windowMs
        };
    }
}

// ==========================================
// BULKHEAD PATTERN (Concurrency Limiter)
// ==========================================

class Bulkhead {
    constructor(options = {}) {
        this.name = options.name || 'default';
        this.maxConcurrent = options.maxConcurrent || 10;
        this.maxQueue = options.maxQueue || 100;
        this.queueTimeout = options.queueTimeout || 30000;
        
        this.running = 0;
        this.queue = [];
        
        this.metrics = {
            totalExecutions: 0,
            rejectedExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            queuedExecutions: 0
        };
    }
    
    async execute(fn) {
        this.metrics.totalExecutions++;
        
        if (this.running >= this.maxConcurrent) {
            if (this.queue.length >= this.maxQueue) {
                this.metrics.rejectedExecutions++;
                throw new BulkheadFullError(`Bulkhead ${this.name} is full`);
            }
            
            // Queue the execution
            this.metrics.queuedExecutions++;
            await this.waitForSlot();
        }
        
        this.running++;
        
        try {
            const result = await fn();
            this.metrics.successfulExecutions++;
            return result;
        } catch (error) {
            this.metrics.failedExecutions++;
            throw error;
        } finally {
            this.running--;
            this.releaseSlot();
        }
    }
    
    waitForSlot() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                const index = this.queue.findIndex(item => item.resolve === resolve);
                if (index > -1) this.queue.splice(index, 1);
                reject(new Error('Bulkhead queue timeout'));
            }, this.queueTimeout);
            
            this.queue.push({ resolve, reject, timeout });
        });
    }
    
    releaseSlot() {
        if (this.queue.length > 0) {
            const { resolve, timeout } = this.queue.shift();
            clearTimeout(timeout);
            resolve();
        }
    }
    
    getStats() {
        return {
            name: this.name,
            running: this.running,
            maxConcurrent: this.maxConcurrent,
            queued: this.queue.length,
            maxQueue: this.maxQueue,
            metrics: this.metrics
        };
    }
}

class BulkheadFullError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BulkheadFullError';
    }
}

// ==========================================
// PRE-CONFIGURED INSTANCES FOR OITH
// ==========================================

// Circuit breakers for different services
const circuitBreakers = {
    dynamodb: new CircuitBreaker({ 
        name: 'dynamodb',
        failureThreshold: 5,
        timeout: 5000,
        resetTimeout: 30000
    }),
    s3: new CircuitBreaker({ 
        name: 's3',
        failureThreshold: 3,
        timeout: 10000,
        resetTimeout: 60000
    }),
    stripe: new CircuitBreaker({ 
        name: 'stripe',
        failureThreshold: 3,
        timeout: 15000,
        resetTimeout: 60000
    }),
    ses: new CircuitBreaker({ 
        name: 'ses',
        failureThreshold: 5,
        timeout: 10000,
        resetTimeout: 30000
    }),
    matching: new CircuitBreaker({ 
        name: 'matching',
        failureThreshold: 10,
        timeout: 15000,  // Allow longer for complex matching
        resetTimeout: 30000
    })
};

// Rate limiters
const rateLimiters = {
    api: new RateLimiter({ maxRequests: 100, windowMs: 1000 }),
    matching: new RateLimiter({ maxRequests: 50, windowMs: 1000 }),
    uploads: new RateLimiter({ maxRequests: 10, windowMs: 1000 })
};

// Bulkheads for concurrency control
const bulkheads = {
    matching: new Bulkhead({ 
        name: 'matching',
        maxConcurrent: 50,  // Handle peak of 50 concurrent requests
        maxQueue: 200
    }),
    imageProcessing: new Bulkhead({ 
        name: 'imageProcessing',
        maxConcurrent: 20,
        maxQueue: 100
    }),
    dbWrites: new Bulkhead({ 
        name: 'dbWrites',
        maxConcurrent: 100,
        maxQueue: 500
    })
};

// ==========================================
// HELPER FUNCTION FOR RESILIENT CALLS
// ==========================================

async function resilientCall(serviceName, fn, options = {}) {
    const circuitBreaker = circuitBreakers[serviceName];
    const bulkhead = bulkheads[serviceName];
    
    const execute = async () => {
        // Apply circuit breaker
        if (circuitBreaker) {
            return circuitBreaker.execute(fn);
        }
        return fn();
    };
    
    // Apply bulkhead if exists
    const bulkheadedExecute = async () => {
        if (bulkhead) {
            return bulkhead.execute(execute);
        }
        return execute();
    };
    
    // Apply retry with backoff
    return retryWithBackoff(bulkheadedExecute, {
        maxRetries: options.maxRetries || 3,
        baseDelayMs: options.baseDelayMs || 100,
        ...options
    });
}

// ==========================================
// HEALTH CHECK FOR ALL CIRCUIT BREAKERS
// ==========================================

function getResilienceHealth() {
    return {
        circuitBreakers: Object.entries(circuitBreakers).reduce((acc, [name, cb]) => {
            acc[name] = cb.getState();
            return acc;
        }, {}),
        rateLimiters: Object.entries(rateLimiters).reduce((acc, [name, rl]) => {
            acc[name] = rl.getStats();
            return acc;
        }, {}),
        bulkheads: Object.entries(bulkheads).reduce((acc, [name, bh]) => {
            acc[name] = bh.getStats();
            return acc;
        }, {})
    };
}

module.exports = {
    // Classes
    CircuitBreaker,
    RateLimiter,
    Bulkhead,
    
    // Errors
    CircuitBreakerOpenError,
    TimeoutError,
    BulkheadFullError,
    
    // Functions
    retryWithBackoff,
    resilientCall,
    getResilienceHealth,
    sleep,
    
    // Pre-configured instances
    circuitBreakers,
    rateLimiters,
    bulkheads
};

