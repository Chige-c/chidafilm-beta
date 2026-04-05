const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const http = require('http');
const fs = require('fs');

const app = express();
const PORT = 8006;

const keepAliveAgent = new http.Agent({
    keepAlive: true, // 通信を繋ぎっぱなしにする
    maxSockets: 100, // 同時に処理できる通信数を大幅に増やす（デフォルトは制限されがち）
    maxFreeSockets: 10,
    timeout: 60000
});

// --- VODキャッシュ用の設定 ---
const VOD_CACHE_FILE = path.join(__dirname, '..', 'data', 'vod_cache.json');

// 【読み込み用】ブラウザからデータが要求されたときに呼ばれる
app.get('/api/vod-cache', (req, res) => {
    if (fs.existsSync(VOD_CACHE_FILE)) {
        const data = fs.readFileSync(VOD_CACHE_FILE, 'utf8');
        res.json(JSON.parse(data));
    } else {
        res.json({}); // ファイルがなければ空のデータを返す
    }
});

// 【保存用】ブラウザで新しい解析結果が出たときに呼ばれる
app.post('/api/vod-cache', express.json(), (req, res) => {
    const cacheData = req.body;
    
    // dataフォルダがない場合は作成
    const dir = path.dirname(VOD_CACHE_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    // vod_cache.json として保存
    fs.writeFile(VOD_CACHE_FILE, JSON.stringify(cacheData, null, 2), (err) => {
        if (err) {
            console.error('VODキャッシュ保存失敗:', err);
            return res.status(500).send('保存に失敗しました');
        }
        console.log('VODキャッシュを保存しました');
        res.json({ success: true });
    });
});


const DATA_FILE = path.join(__dirname, '..', 'data', 'recommendations.json');

// 【読み込み用】画面を開いたときに呼ばれる
app.get('/api/recommendations', (req, res) => {
    if (fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        res.json(JSON.parse(data));
    } else {
        res.json({ ids: "" }); // ファイルがなければ空を返す
    }
});

// 【保存用】「追加」「削除」をしたときに呼ばれる
app.post('/api/recommendations', express.json(), (req, res) => {
    const { ids } = req.body;
    
    // dataフォルダ自体がない場合は自動で作成する
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    // JSON形式で上書き保存
    fs.writeFileSync(DATA_FILE, JSON.stringify({ ids: ids || "" }));
    res.json({ success: true });
});

// --- 通知・既読ログ用の設定 ---
app.get('/api/notif-log/:userId', (req, res) => {
    const userId = req.params.userId.replace(/[^a-zA-Z0-9]/g, '') || 'guest';
    const logFile = path.join(__dirname, '..', 'data', 'notif_logs', `notif_log_${userId}.json`);
    if (fs.existsSync(logFile)) {
        res.json(JSON.parse(fs.readFileSync(logFile, 'utf8')));
    } else {
        res.json({});
    }
});

app.post('/api/notif-log', express.json(), (req, res) => {
    const { userId, log, lastCheck } = req.body;
    const safeUserId = String(userId || 'guest').replace(/[^a-zA-Z0-9]/g, '');
    const dir = path.join(__dirname, '..', 'data', 'notif_logs');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const logFile = path.join(dir, `notif_log_${safeUserId}.json`);
    
    fs.writeFile(logFile, JSON.stringify({ log: log || [], lastCheck: lastCheck || null }, null, 2), (err) => {
        if (err) return res.status(500).json({ error: '保存失敗' });
        res.json({ success: true });
    });
});


// --- 1. Jellyseerrへの中継 ---
app.use('/seerr-api', createProxyMiddleware({
    target: 'http://192.168.0.11:5055',
    changeOrigin: true,
    pathRewrite: { '^/seerr-api': '' },
}));

// --- 2. Jellyfinへの中継 (★これを追加) ---
// --- 2. Jellyfinへの中継 ---
app.use('/jellyfin-api', createProxyMiddleware({
    target: 'http://192.168.0.11:7096',
    changeOrigin: true,
    agent: keepAliveAgent,
    pathRewrite: { '^/jellyfin-api': '' },
    onProxyRes: function (proxyRes, req, res) {
        // リクエストが「画像(/Images/)」に関するものだったら、大掃除を開始
        if (req.url.includes('/Images/')) {
            
            // 1. キャッシュを邪魔するヘッダーを根こそぎ削除
            delete proxyRes.headers['expires'];
            delete proxyRes.headers['pragma'];
            delete proxyRes.headers['set-cookie']; // ★これが一番重要！クッキーがあるとキャッシュされません
            delete proxyRes.headers['cache-control']; // 一旦本家の命令を消す
            
            // 2. ブラウザに「1年間(31536000秒)はディスクに保存して使い回せ」と最強の命令を出す
            // immutable をつけると、ブラウザは「再確認すら不要」と判断します
            proxyRes.headers['Cache-Control'] = 'public, max-age=31536000, immutable';
            
            // 3. ETag（サーバーへの再確認用ID）も消すと、ブラウザは完全に自分のキャッシュだけを信じるようになります
            delete proxyRes.headers['etag'];
        }
    }
}));

// --- 3. 静的ファイルの配信 ---
const rootPath = path.join(__dirname, '..');
// 開発中の反映漏れ（古いHTMLが読まれる現象）を防ぐため、HTMLやJS等の強制的な1日キャッシュ(maxAge)を解除
app.use(express.static(rootPath));



app.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`Windows開発サーバー: http://localhost:${PORT}`);
    console.log(`Jellyseerrプロキシ: 有効 (/seerr-api)`);
    console.log(`Jellyfinプロキシ: 有効 (/jellyfin-api)`);
    console.log(`=========================================`);
});