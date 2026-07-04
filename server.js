const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Web-to-APK Generator is running!',
        version: '1.0.0'
    });
});

// Generate APK
app.post('/api/generate', async (req, res) => {
    try {
        const { url, appName, packageName } = req.body;
        
        if (!url || !appName) {
            return res.status(400).json({
                success: false,
                error: 'URL dan App Name diperlukan'
            });
        }

        console.log(`📱 Generating APK for: ${appName} (${url})`);

        // Try PWABuilder API
        try {
            const pwaResponse = await axios.post('https://pwabuilder-api.azurewebsites.net/api/generate', {
                url: url,
                name: appName,
                packageId: packageName || `com.${appName.toLowerCase().replace(/\s/g, '')}`
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 120000
            });

            let downloadUrl = null;
            if (pwaResponse.data && pwaResponse.data.downloadUrl) {
                downloadUrl = pwaResponse.data.downloadUrl;
            } else if (pwaResponse.data && pwaResponse.data.url) {
                downloadUrl = pwaResponse.data.url;
            }

            if (downloadUrl) {
                return res.json({
                    success: true,
                    appName: appName,
                    url: url,
                    downloadUrl: downloadUrl,
                    message: 'APK berjaya dihasilkan! 🎉'
                });
            }
        } catch (pwaError) {
            console.log('PWABuilder failed, trying alternative...');
        }

        // Try alternative: Web-to-APK using Puppeteer/Chrome
        // (This is a simplified version - for production, use Docker)
        
        return res.status(500).json({
            success: false,
            error: 'Failed to generate APK. Please try again later.',
            debug: 'All APK generation methods failed'
        });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Gagal generate APK: ' + error.message
        });
    }
});

// Status check
app.get('/api/status/:jobId', async (req, res) => {
    res.json({
        jobId: req.params.jobId,
        status: 'completed',
        progress: 100
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/`);
});
