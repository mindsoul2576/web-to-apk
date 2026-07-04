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

// Ensure downloads directory exists
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// ============================================
// HEALTH CHECK
// ============================================

app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Web-to-APK Generator is running!',
        version: '3.0.0'
    });
});

// ============================================
// GENERATE APK - REAL VERSION
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

        const packageId = packageName || `com.${appName.toLowerCase().replace(/\s/g, '')}`;
        const filename = `${appName.toLowerCase().replace(/\s/g, '-')}.apk`;
        const filepath = path.join(DOWNLOAD_DIR, filename);

        // ============================================
        // TRY 1: PWABuilder API
        // ============================================
        try {
            console.log('Trying PWABuilder...');
            
            const pwaResponse = await axios.post(
                'https://pwabuilder-api.azurewebsites.net/api/generate',
                {
                    url: url,
                    name: appName,
                    packageId: packageId,
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

            let downloadUrl = null;
            
            // Extract download URL from various response formats
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
                console.log('✅ PWABuilder success! Download URL:', downloadUrl);
                
                // Download the APK file
                const apkResponse = await axios.get(downloadUrl, {
                    responseType: 'arraybuffer',
                    timeout: 120000
                });
                
                // Save to local
                fs.writeFileSync(filepath, apkResponse.data);
                console.log('✅ APK saved to:', filepath);
                console.log('📦 APK size:', (apkResponse.data.length / 1024 / 1024).toFixed(2), 'MB');
                
                return res.json({
                    success: true,
                    appName: appName,
                    url: url,
                    packageName: packageId,
                    downloadUrl: `/downloads/${filename}`,
                    method: 'PWABuilder (Real APK)',
                    message: 'APK berjaya dihasilkan! 🎉'
                });
            }
        } catch (pwaError) {
            console.log('PWABuilder failed:', pwaError.message);
            if (pwaError.response) {
                console.log('PWABuilder response:', pwaError.response.status, pwaError.response.data);
            }
        }

        // ============================================
        // TRY 2: PWA2APK (AppMaker.xyz)
        // ============================================
        try {
            console.log('Trying PWA2APK...');
            
            const formData = new URLSearchParams();
            formData.append('url', url);
            formData.append('app_name', appName);
            formData.append('package_name', packageId);
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
            const html = typeof pwa2apkResponse.data === 'string' ? pwa2apkResponse.data : JSON.stringify(pwa2apkResponse.data);
            
            const patterns = [
                /https?:\/\/[^\s"']+\.apk/i,
                /https?:\/\/[^\s"']+download[^\s"']*/i,
                /https?:\/\/storage\.googleapis\.com[^\s"']+\.apk/i,
                /https?:\/\/[^\s"']+\.appmaker\.xyz[^\s"']+/i
            ];

            let downloadUrl = null;
            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match) {
                    downloadUrl = match[0];
                    break;
                }
            }

            if (downloadUrl) {
                console.log('✅ PWA2APK success! Download URL:', downloadUrl);
                
                // Download the APK file
                const apkResponse = await axios.get(downloadUrl, {
                    responseType: 'arraybuffer',
                    timeout: 120000
                });
                
                fs.writeFileSync(filepath, apkResponse.data);
                console.log('✅ APK saved to:', filepath);
                console.log('📦 APK size:', (apkResponse.data.length / 1024 / 1024).toFixed(2), 'MB');
                
                return res.json({
                    success: true,
                    appName: appName,
                    url: url,
                    packageName: packageId,
                    downloadUrl: `/downloads/${filename}`,
                    method: 'PWA2APK (Real APK)',
                    message: 'APK berjaya dihasilkan! 🎉'
                });
            }
        } catch (pwa2apkError) {
            console.log('PWA2APK failed:', pwa2apkError.message);
        }

        // ============================================
        // ALL METHODS FAILED - Return error
        // ============================================
        console.log('❌ All APK generation methods failed');
        
        return res.status(500).json({
            success: false,
            error: 'Failed to generate APK. Please try again later.',
            debug: 'All methods failed. Make sure your website is accessible and try again.'
        });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Gagal generate APK: ' + error.message
        });
    }
});

// ============================================
// SERVE DOWNLOADS
// ============================================

app.use('/downloads', express.static(DOWNLOAD_DIR));

app.get('/downloads/:filename', (req, res) => {
    const filepath = path.join(DOWNLOAD_DIR, req.params.filename);
    if (fs.existsSync(filepath)) {
        res.download(filepath);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Downloads directory: ${DOWNLOAD_DIR}`);
});
