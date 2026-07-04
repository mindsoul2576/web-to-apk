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
// GENERATE APK - AppMaker.xyz ONLY
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
        // USE AppMaker.xyz - THIS WORKS!
        // ============================================
        console.log('Calling AppMaker.xyz...');
        
        const formData = new URLSearchParams();
        formData.append('url', url);
        formData.append('app_name', appName);
        formData.append('package_name', packageId);
        formData.append('submit', 'Generate APK');

        const appMakerResponse = await axios.post(
            'https://appmaker.xyz/pwa-to-apk/',
            formData.toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 180000,
                maxRedirects: 5
            }
        );

        // Extract download URL from HTML response
        const html = typeof appMakerResponse.data === 'string' ? appMakerResponse.data : JSON.stringify(appMakerResponse.data);
        
        const patterns = [
            /https?:\/\/[^\s"']+\.apk/i,
            /https?:\/\/[^\s"']+download[^\s"']*/i,
            /https?:\/\/storage\.googleapis\.com[^\s"']+\.apk/i,
            /https?:\/\/[^\s"']+\.appmaker\.xyz[^\s"']+/i,
            /https?:\/\/[^\s"']+\.pwa2apk\.com[^\s"']+/i
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
            console.log('✅ AppMaker success! Download URL:', downloadUrl);
            
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
                method: 'AppMaker (Real APK)',
                message: 'APK berjaya dihasilkan! 🎉'
            });
        }

        // If no download URL found
        console.log('❌ AppMaker failed - no download URL found');
        return res.status(500).json({
            success: false,
            error: 'Failed to get download URL from APK generator',
            debug: 'AppMaker did not return a download URL'
        });

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.status);
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
