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
// GENERATE APK - PWABuilder
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
        // USE PWABuilder
        // ============================================
        console.log('Calling PWABuilder...');
        
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

        // Extract download URL
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

        // If PWABuilder fails, return error
        console.log('❌ PWABuilder failed - no download URL');
        return res.status(500).json({
            success: false,
            error: 'Failed to generate APK. Please try again later.',
            debug: 'PWABuilder did not return a download URL'
        });

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.status, error.response.data);
        }
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
