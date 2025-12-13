/**
 * OITH Admin Backend Server
 * Connects to AWS S3 (files) and DynamoDB (data)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes
const usersRoutes = require('./routes/users');
const documentsRoutes = require('./routes/documents');
const experimentsRoutes = require('./routes/experiments');
const orgRoutes = require('./routes/org');
const payrollRoutes = require('./routes/payroll');
const syncRoutes = require('./routes/sync');
const emailRoutes = require('./routes/email');
const calendarRoutes = require('./routes/calendar');
const authRoutes = require('./routes/auth');
const filesRoutes = require('./routes/files');
const marketDataRoutes = require('./routes/market-data');
const scannerRoutes = require('./routes/scanner');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5500', 
        'http://127.0.0.1:5500', 
        'http://localhost:3000',
        'http://localhost:8080',
        'https://main.d3cpep2ztx08x2.amplifyapp.com',
        /\.amplifyapp\.com$/  // Allow all Amplify subdomains
    ],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from prototype folder
app.use(express.static(path.join(__dirname, '..')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        aws: {
            region: process.env.AWS_REGION || 'not configured',
            s3Bucket: process.env.AWS_S3_BUCKET || 'not configured',
            dynamoTable: process.env.AWS_DYNAMODB_TABLE || 'not configured'
        }
    });
});

// API Routes
app.use('/api/users', usersRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/experiments', experimentsRoutes);
app.use('/api/org', orgRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/market-data', marketDataRoutes);
app.use('/api/scanner', scannerRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error', 
        message: err.message 
    });
});

// Start server
app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  🚀 OITH Admin Server Started');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  📡 Server:     http://localhost:${PORT}`);
    console.log(`  🔌 API Base:   http://localhost:${PORT}/api`);
    console.log(`  💚 Health:     http://localhost:${PORT}/api/health`);
    console.log('');
    console.log('  AWS Configuration:');
    console.log(`    Region:      ${process.env.AWS_REGION || '⚠️  Not set'}`);
    console.log(`    S3 Bucket:   ${process.env.AWS_S3_BUCKET || '⚠️  Not set'}`);
    console.log(`    DynamoDB:    ${process.env.AWS_DYNAMODB_TABLE || '⚠️  Not set'}`);
    console.log('');
    console.log('  Email Configuration:');
    console.log(`    Gmail:       ${process.env.GMAIL_CLIENT_ID ? '✅ Configured' : '⚠️  Not set'}`);
    console.log(`    Email:       ${process.env.GMAIL_EMAIL || '⚠️  Not set'}`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
});

module.exports = app;

