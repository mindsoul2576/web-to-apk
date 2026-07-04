const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Web-to-APK Generator is running!',
        version: '3.0.0'
    });
});

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
        // USE PWA2APK (Different Endpoint)
        // ============================================
        try {
            console.log('Trying PWA2APK (alternative)...');
            
            const response = await axios.post(
                'https://pwa2apk.com/generate',
                {
                    url: url,
                    name: appName,
                    package: packageId
                },
                {
                    headers: { 
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 180000
                }
            );

            let downloadUrl = null;
            if (response.data) {
                if (response.data.downloadUrl) downloadUrl = response.data.downloadUrl;
                else if (response.data.url) downloadUrl = response.data.url;
                else if (response.data.data && response.data.data.downloadUrl) downloadUrl = response.data.data.downloadUrl;
            }

            if (downloadUrl) {
                console.log('✅ PWA2APK success!');
                const apkResponse = await axios.get(downloadUrl, {
                    responseType: 'arraybuffer',
                    timeout: 120000
                });
                
                // Check if real APK
                if (apkResponse.data[0] === 0x50 && apkResponse.data[1] === 0x4B) {
                    fs.writeFileSync(filepath, apkResponse.data);
                    console.log('✅ Real APK saved, size:', (apkResponse.data.length / 1024 / 1024).toFixed(2), 'MB');
                    
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
            }
        } catch (pwaError) {
            console.log('PWA2APK failed:', pwaError.message);
        }

        // ============================================
        // USE Bubblewrap (Google's TWA Tool)
        // ============================================
        try {
            console.log('Trying Bubblewrap...');
            
            const response = await axios.post(
                'https://bubblewrap-api.vercel.app/api/generate',
                {
                    url: url,
                    name: appName,
                    packageId: packageId
                },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 180000
                }
            );

            let downloadUrl = null;
            if (response.data) {
                if (response.data.downloadUrl) downloadUrl = response.data.downloadUrl;
                else if (response.data.url) downloadUrl = response.data.url;
            }

            if (downloadUrl) {
                console.log('✅ Bubblewrap success!');
                const apkResponse = await axios.get(downloadUrl, {
                    responseType: 'arraybuffer',
                    timeout: 120000
                });
                
                if (apkResponse.data[0] === 0x50 && apkResponse.data[1] === 0x4B) {
                    fs.writeFileSync(filepath, apkResponse.data);
                    console.log('✅ Real APK saved, size:', (apkResponse.data.length / 1024 / 1024).toFixed(2), 'MB');
                    
                    return res.json({
                        success: true,
                        appName: appName,
                        url: url,
                        packageName: packageId,
                        downloadUrl: `/downloads/${filename}`,
                        method: 'Bubblewrap (Real APK)',
                        message: 'APK berjaya dihasilkan! 🎉'
                    });
                }
            }
        } catch (bubbleError) {
            console.log('Bubblewrap failed:', bubbleError.message);
        }

        // ============================================
        // USE PWABuilder with DNS workaround
        // ============================================
        try {
            console.log('Trying PWABuilder...');
            
            const response = await axios.post(
                'https://pwabuilder-api.azurewebsites.net/api/generate',
                {
                    url: url,
                    name: appName,
                    packageId: packageId
                },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 120000
                }
            );

            let downloadUrl = null;
            if (response.data) {
                if (response.data.downloadUrl) downloadUrl = response.data.downloadUrl;
                else if (response.data.url) downloadUrl = response.data.url;
            }

            if (downloadUrl) {
                console.log('✅ PWABuilder success!');
                const apkResponse = await axios.get(downloadUrl, {
                    responseType: 'arraybuffer',
                    timeout: 120000
                });
                
                if (apkResponse.data[0] === 0x50 && apkResponse.data[1] === 0x4B) {
                    fs.writeFileSync(filepath, apkResponse.data);
                    console.log('✅ Real APK saved, size:', (apkResponse.data.length / 1024 / 1024).toFixed(2), 'MB');
                    
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
            }
        } catch (pwaError) {
            console.log('PWABuilder failed:', pwaError.message);
        }

        // ============================================
        // ALL FAILED - Return error
        // ============================================
        console.log('❌ All methods failed');
        return res.status(500).json({
            success: false,
            error: 'Failed to generate APK. Please try again later.'
        });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Gagal generate APK: ' + error.message
        });
    }
});

app.use('/downloads', express.static(DOWNLOAD_DIR));

app.get('/downloads/:filename', (req, res) => {
    const filepath = path.join(DOWNLOAD_DIR, req.params.filename);
    if (fs.existsSync(filepath)) {
        res.download(filepath);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Downloads directory: ${DOWNLOAD_DIR}`);
});
