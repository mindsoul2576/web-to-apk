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
        version: '2.0.0'
    });
});

// ============================================
// GENERATE APK
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

        // Create filename
        const filename = `${appName.toLowerCase().replace(/\s/g, '-')}.apk`;
        const filepath = path.join(DOWNLOAD_DIR, filename);

        // ============================================
        // METHOD 1: Try PWABuilder
        // ============================================
        try {
            console.log('Trying PWABuilder...');
            
            const pwaResponse = await axios.post(
                'https://pwabuilder-api.azurewebsites.net/api/generate',
                {
                    url: url,
                    name: appName,
                    packageId: packageName || `com.${appName.toLowerCase().replace(/\s/g, '')}`
                },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 120000
                }
            );

            let downloadUrl = null;
            if (pwaResponse.data && pwaResponse.data.downloadUrl) {
                downloadUrl = pwaResponse.data.downloadUrl;
            }

            if (downloadUrl) {
                // Download the APK file
                console.log('Downloading APK from:', downloadUrl);
                const apkResponse = await axios.get(downloadUrl, {
                    responseType: 'arraybuffer',
                    timeout: 120000
                });
                
                // Save to local
                fs.writeFileSync(filepath, apkResponse.data);
                console.log('✅ APK saved to:', filepath);
                
                return res.json({
                    success: true,
                    appName: appName,
                    url: url,
                    downloadUrl: `/downloads/${filename}`,
                    method: 'PWABuilder',
                    message: 'APK berjaya dihasilkan! 🎉'
                });
            }
        } catch (pwaError) {
            console.log('PWABuilder failed:', pwaError.message);
        }

        // ============================================
        // METHOD 2: Create dummy APK (for testing)
        // ============================================
        console.log('Creating dummy APK for testing...');
        
        // Create a simple text file as APK (for testing)
        const dummyContent = `
            === APK FORGE - TEST APK ===
            App Name: ${appName}
            Website: ${url}
            Package: ${packageName || `com.${appName.toLowerCase().replace(/\s/g, '')}`}
            Generated: ${new Date().toISOString()}
            ==============================
            This is a test APK file.
            In production, this will be a real APK.
        `;
        
        fs.writeFileSync(filepath, dummyContent);
        console.log('✅ Dummy APK saved to:', filepath);

        return res.json({
            success: true,
            appName: appName,
            url: url,
            packageName: packageName,
            downloadUrl: `/downloads/${filename}`,
            method: 'Test Mode (Dummy APK)',
            message: 'APK berjaya dihasilkan! 🎉 (Test mode)'
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
