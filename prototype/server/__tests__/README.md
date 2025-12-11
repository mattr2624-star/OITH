# 🧪 OITH Test Suite

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run with coverage report
npm run test:coverage
```

## Test Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests |
| `npm run test:unit` | Run unit tests only |
| `npm run test:integration` | Run integration tests only |
| `npm run test:matching` | Run matching algorithm tests |
| `npm run test:users` | Run users API tests |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:verbose` | Run tests with verbose output |

Or use the batch script:
```bash
run-tests.bat           # All tests
run-tests.bat unit      # Unit tests only
run-tests.bat coverage  # With coverage
```

## Test File Structure

```
__tests__/
├── README.md           # This file
├── users.test.js       # Users API unit tests
├── matching.test.js    # Matching algorithm unit tests
└── integration.test.js # API integration tests
```

## Writing Tests

### Unit Test Template

```javascript
describe('Component Name', () => {
    beforeEach(() => {
        // Setup before each test
    });

    afterEach(() => {
        // Cleanup after each test
    });

    describe('functionName', () => {
        it('should do expected behavior', () => {
            // Arrange
            const input = ...;
            
            // Act
            const result = functionName(input);
            
            // Assert
            expect(result).toBe(expected);
        });

        it('should handle edge case', () => {
            // Test edge cases
        });
    });
});
```

### API Test Template

```javascript
const request = require('supertest');
const app = require('../index');

describe('API Endpoint', () => {
    it('should return 200 OK', async () => {
        const response = await request(app)
            .get('/api/endpoint')
            .expect(200);
        
        expect(response.body).toHaveProperty('key');
    });

    it('should handle errors', async () => {
        const response = await request(app)
            .post('/api/endpoint')
            .send({ invalid: 'data' })
            .expect(400);
        
        expect(response.body).toHaveProperty('error');
    });
});
```

## Coverage Requirements

| Component | Minimum | Target |
|-----------|---------|--------|
| Backend Routes | 70% | 85% |
| Lambda Functions | 80% | 90% |
| Overall | 75% | 85% |

## Test Categories

### Unit Tests (`*.test.js`)
- Test individual functions in isolation
- Mock external dependencies (AWS, etc.)
- Fast execution, no network calls

### Integration Tests (`integration.test.js`)
- Test API endpoints working together
- Test full request/response cycles
- May use test database

### End-to-End Tests (Future)
- Test complete user journeys
- Use Playwright/Puppeteer
- Run against staging environment

## Mocking

### AWS SDK Mocking

```javascript
jest.mock('@aws-sdk/lib-dynamodb', () => ({
    PutCommand: jest.fn(),
    GetCommand: jest.fn(),
    // ...
}));

jest.mock('../aws-config', () => ({
    docClient: {
        send: jest.fn()
    },
    TABLES: {
        USERS: 'test-users-table'
    },
    isAWSConfigured: jest.fn()
}));
```

### Mocking Responses

```javascript
docClient.send.mockResolvedValue({
    Items: [{ email: 'test@test.com' }]
});

// Or for errors
docClient.send.mockRejectedValue(new Error('DynamoDB error'));
```

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Pushes to main branch
- Before deployment

See `.github/workflows/test.yml` for CI configuration.

## Troubleshooting

### Tests Timeout
- Increase Jest timeout: `jest.setTimeout(10000)`
- Check for unresolved promises
- Ensure mocks are properly configured

### Mock Not Working
- Verify mock path matches actual import
- Check mock is defined before import
- Use `jest.resetAllMocks()` in `beforeEach`

### Coverage Too Low
- Add tests for uncovered branches
- Test error handlers
- Test edge cases


