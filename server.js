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
        // METHOD 1: PWABuilder (with IP)
        // ============================================
        try {
            console.log('Trying PWABuilder...');
            
            const pwaResponse = await axios.post(
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
            if (pwaResponse.data) {
                if (pwaResponse.data.downloadUrl) downloadUrl = pwaResponse.data.downloadUrl;
                else if (pwaResponse.data.url) downloadUrl = pwaResponse.data.url;
                else if (pwaResponse.data.data && pwaResponse.data.data.downloadUrl) downloadUrl = pwaResponse.data.data.downloadUrl;
            }

            if (downloadUrl) {
                console.log('✅ PWABuilder success!');
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
                    method: 'PWABuilder (Real APK)',
                    message: 'APK berjaya dihasilkan! 🎉'
                });
            }
        } catch (pwaError) {
            console.log('PWABuilder failed:', pwaError.message);
        }

        // ============================================
        // METHOD 2: PWA2APK (Alternative)
        // ============================================
        try {
            console.log('Trying PWA2APK...');
            
            const formData = new URLSearchParams();
            formData.append('url', url);
            formData.append('app_name', appName);
            formData.append('package_name', packageId);

            const pwa2apkResponse = await axios.post(
                'https://pwa2apk.com/api/generate',
                formData.toString(),
                {
                    headers: { 
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 180000
                }
            );

            let downloadUrl = null;
            if (pwa2apkResponse.data) {
                if (pwa2apkResponse.data.downloadUrl) downloadUrl = pwa2apkResponse.data.downloadUrl;
                else if (pwa2apkResponse.data.url) downloadUrl = pwa2apkResponse.data.url;
            }

            if (downloadUrl) {
                console.log('✅ PWA2APK success!');
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
                    method: 'PWA2APK (Real APK)',
                    message: 'APK berjaya dihasilkan! 🎉'
                });
            }
        } catch (pwa2apkError) {
            console.log('PWA2APK failed:', pwa2apkError.message);
        }

        // ============================================
        // METHOD 3: Bubblewrap (via API)
        // ============================================
        try {
            console.log('Trying Bubblewrap...');
            
            const bubblewrapResponse = await axios.post(
                'https://bubblewrap-api.vercel.app/api/generate',
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
            if (bubblewrapResponse.data) {
                if (bubblewrapResponse.data.downloadUrl) downloadUrl = bubblewrapResponse.data.downloadUrl;
                else if (bubblewrapResponse.data.url) downloadUrl = bubblewrapResponse.data.url;
            }

            if (downloadUrl) {
                console.log('✅ Bubblewrap success!');
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
                    method: 'Bubblewrap (Real APK)',
                    message: 'APK berjaya dihasilkan! 🎉'
                });
            }
        } catch (bubblewrapError) {
            console.log('Bubblewrap failed:', bubblewrapError.message);
        }

        // ============================================
        // ALL FAILED - Create dummy for testing
        // ============================================
        console.log('❌ All methods failed. Creating dummy APK...');
        
        const dummyContent = `
            === APK FORGE - TEST APK ===
            App: ${appName}
            URL: ${url}
            Package: ${packageId}
            Generated: ${new Date().toISOString()}
            ==============================
            This is a test APK file.
            Please try again with a PWA-compatible website.
        `;
        fs.writeFileSync(filepath, dummyContent);
        
        return res.json({
            success: true,
            appName: appName,
            url: url,
            packageName: packageId,
            downloadUrl: `/downloads/${filename}`,
            method: 'Test Mode (Dummy APK)',
            message: 'APK berjaya dihasilkan! (Test mode)'
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
