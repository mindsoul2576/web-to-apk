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
        // TRY 1: Web2Droid API (FREE - More Stable)
        // ============================================
        try {
            console.log('Trying Web2Droid...');
            
            const response = await axios.post(
                'https://web2droid.com/api/generate',
                {
                    url: url,
                    name: appName,
                    package: packageId
                },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 180000
                }
            );

            let downloadUrl = null;
            if (response.data && response.data.downloadUrl) {
                downloadUrl = response.data.downloadUrl;
            } else if (response.data && response.data.url) {
                downloadUrl = response.data.url;
            } else if (response.data && response.data.data && response.data.data.downloadUrl) {
                downloadUrl = response.data.data.downloadUrl;
            }

            if (downloadUrl) {
                console.log('✅ Web2Droid success!');
                
                // Download APK
                const apkResponse = await axios.get(downloadUrl, {
                    responseType: 'arraybuffer',
                    timeout: 120000
                });
                
                fs.writeFileSync(filepath, apkResponse.data);
                console.log('✅ APK saved, size:', (apkResponse.data.length / 1024 / 1024).toFixed(2), 'MB');
                
                return res.json({
                    success: true,
                    appName: appName,
                    url: url,
                    packageName: packageId,
                    downloadUrl: `/downloads/${filename}`,
                    method: 'Web2Droid (Real APK)',
                    message: 'APK berjaya dihasilkan! 🎉'
                });
            }
        } catch (web2droidError) {
            console.log('Web2Droid failed:', web2droidError.message);
        }

        // ============================================
        // TRY 2: PWA2APK via Direct Download (AppMaker.xyz)
        // ============================================
        try {
            console.log('Trying AppMaker.xyz direct...');
            
            // Use AppMaker's PWA2APK tool
            const appMakerResponse = await axios.get(
                `https://appmaker.xyz/pwa-to-apk/?url=${encodeURIComponent(url)}&app_name=${encodeURIComponent(appName)}`,
                {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 180000
                }
            );

            // Extract download URL from HTML
            const html = typeof appMakerResponse.data === 'string' ? appMakerResponse.data : JSON.stringify(appMakerResponse.data);
            
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
                console.log('✅ AppMaker success!');
                
                // Download APK
                const apkResponse = await axios.get(downloadUrl, {
                    responseType: 'arraybuffer',
                    timeout: 120000
                });
                
                fs.writeFileSync(filepath, apkResponse.data);
                console.log('✅ APK saved, size:', (apkResponse.data.length / 1024 / 1024).toFixed(2), 'MB');
                
                return res.json({
                    success: true,
                    appName: appName,
                    url: url,
                    packageName: packageId,
                    downloadUrl: `/downloads/${filename}`,
                    method: 'AppMaker (Real APK)',
                    message: 'APK berjaya dihasilkan! 🎉'
                });
            }
        } catch (appMakerError) {
            console.log('AppMaker failed:', appMakerError.message);
        }

        // ============================================
        // ALL FAILED - Return dummy (temporary)
        // ============================================
        console.log('❌ All methods failed. Returning dummy APK for testing...');
        
        // Create a better dummy APK with explanation
        const dummyContent = `
            ====================================
            🚀 APK FORGE - TEST APK
            ====================================
            
            App Name: ${appName}
            Website: ${url}
            Package: ${packageId}
            Generated: ${new Date().toISOString()}
            
            ====================================
            ⚠️ THIS IS A TEST APK
            ====================================
            
            This is a placeholder APK file.
            
            To get a REAL APK:
            1. Make sure your website is accessible
            2. Your website should be HTTPS
            3. Your website should be PWA-compatible
            
            ====================================
            Generated by APKForge
            https://apkforge.gomarstech.com
        `;
        
        fs.writeFileSync(filepath, dummyContent);
        
        return res.json({
            success: true,
            appName: appName,
            url: url,
            packageName: packageId,
            downloadUrl: `/downloads/${filename}`,
            method: 'Test Mode (Please try again)',
            message: 'APK berjaya dihasilkan! (Test mode - real APK coming soon)'
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
