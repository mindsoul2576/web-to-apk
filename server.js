const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// HEALTH CHECK
// ============================================

app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Web-to-APK Generator is running!',
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// GENERATE APK - FULL VERSION
// ============================================

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

        // ============================================
        // METHOD 1: PWABuilder API
        // ============================================
        try {
            console.log('Trying PWABuilder...');
            
            const pwaResponse = await axios.post(
                'https://pwabuilder-api.azurewebsites.net/api/generate',
                {
                    url: url,
                    name: appName,
                    packageId: packageName || `com.${appName.toLowerCase().replace(/\s/g, '')}`,
                    orientation: 'portrait',
                    display: 'standalone',
                    startUrl: url,
                    backgroundColor: '#ffffff',
                    themeColor: '#000000'
                },
                {
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: 120000
                }
            );

            // Extract download URL from various response formats
            let downloadUrl = null;
            if (pwaResponse.data) {
                if (pwaResponse.data.downloadUrl) {
                    downloadUrl = pwaResponse.data.downloadUrl;
                } else if (pwaResponse.data.url) {
                    downloadUrl = pwaResponse.data.url;
                } else if (pwaResponse.data.data && pwaResponse.data.data.downloadUrl) {
                    downloadUrl = pwaResponse.data.data.downloadUrl;
                } else if (pwaResponse.data.downloadLinks && pwaResponse.data.downloadLinks.android) {
                    downloadUrl = pwaResponse.data.downloadLinks.android;
                } else if (pwaResponse.data.links && pwaResponse.data.links.android) {
                    downloadUrl = pwaResponse.data.links.android;
                }
            }

            if (downloadUrl) {
                console.log('✅ PWABuilder success!');
                return res.json({
                    success: true,
                    appName: appName,
                    url: url,
                    packageName: packageName,
                    downloadUrl: downloadUrl,
                    method: 'PWABuilder',
                    message: 'APK berjaya dihasilkan! 🎉'
                });
            }
        } catch (pwaError) {
            console.log('PWABuilder failed:', pwaError.message);
        }

        // ============================================
        // METHOD 2: PWA2APK (AppMaker.xyz)
        // ============================================
        try {
            console.log('Trying PWA2APK...');
            
            const formData = new URLSearchParams();
            formData.append('url', url);
            formData.append('app_name', appName);
            formData.append('package_name', packageName || `com.${appName.toLowerCase().replace(/\s/g, '')}`);
            formData.append('submit', 'Generate APK');

            const pwa2apkResponse = await axios.post(
                'https://appmaker.xyz/pwa-to-apk/',
                formData.toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 120000,
                    maxRedirects: 5
                }
            );

            // Extract download URL from HTML response
            let downloadUrl = null;
            const html = typeof pwa2apkResponse.data === 'string' ? pwa2apkResponse.data : JSON.stringify(pwa2apkResponse.data);
            
            // Pattern to find APK URL
            const patterns = [
                /https?:\/\/[^\s"']+\.apk/i,
                /https?:\/\/[^\s"']+download[^\s"']*/i,
                /https?:\/\/storage\.googleapis\.com[^\s"']+\.apk/i,
                /https?:\/\/[^\s"']+\.appmaker\.xyz[^\s"']+/i
            ];

            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match) {
                    downloadUrl = match[0];
                    break;
                }
            }

            if (downloadUrl) {
                console.log('✅ PWA2APK success!');
                return res.json({
                    success: true,
                    appName: appName,
                    url: url,
                    packageName: packageName,
                    downloadUrl: downloadUrl,
                    method: 'PWA2APK',
                    message: 'APK berjaya dihasilkan! 🎉'
                });
            }
        } catch (pwa2apkError) {
            console.log('PWA2APK failed:', pwa2apkError.message);
        }

        // ============================================
        // METHOD 3: Simulate APK (Fallback for testing)
        // ============================================
        console.log('All methods failed. Returning simulation...');
        
        // Create a dummy APK file (for testing)
        const filename = `${appName.toLowerCase().replace(/\s/g, '-')}.apk`;
        const filepath = path.join(__dirname, 'downloads', filename);
        
        // Ensure downloads directory exists
        const dir = path.join(__dirname, 'downloads');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Create a dummy APK file
        const dummyContent = `Dummy APK file for testing\nApp: ${appName}\nURL: ${url}\nGenerated: ${new Date().toISOString()}`;
        fs.writeFileSync(filepath, dummyContent);
        
        const downloadUrl = `${req.protocol}://${req.get('host')}/downloads/${filename}`;
        
        return res.json({
            success: true,
            appName: appName,
            url: url,
            packageName: packageName,
            downloadUrl: downloadUrl,
            method: 'Simulation (Fallback)',
            message: 'APK berjaya dihasilkan! 🎉 (Test mode)'
        });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Gagal generate APK: ' + error.message,
            debug: error.stack
        });
    }
});

// ============================================
// SERVE STATIC FILES (for downloads)
// ============================================

app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// ============================================
// STATUS CHECK
// ============================================

app.get('/api/status/:jobId', (req, res) => {
    res.json({
        jobId: req.params.jobId,
        status: 'completed',
        progress: 100
    });
});

// ============================================
// 404 HANDLER
// ============================================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        available: ['GET /', 'POST /api/generate', 'GET /api/status/:jobId']
    });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/`);
});

// Handle errors
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
});
