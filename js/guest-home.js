/* =========================================
   guest-home.js : ChidaFilm ゲスト専用（確定版）
   ========================================= */
console.log("🚀 ChidaFilm Guest Mode Script Loaded");

/* =========================================
   guest-home.js : ChidaFilm ゲスト専用ポータル
   ========================================= */

function initGuestHome() {
    const contentRows = document.querySelector('.content-rows');
    if (!contentRows) return;

    // 1. 既存のセクションを一旦全部「物理的に」空にする
    contentRows.innerHTML = '';

    // 2. あなたが自由にHTMLを打つ場所
    const myNewHomeHTML = `
        <div class="guest-portal">
            <section class="portal-header">
                <h1 class="portal-logo">Chida<span>Film</span></h1>
                <p class="tagline">Official Fan Portal: 大島ハンター</p>
            </section>

            <section class="main-feature">
                <div class="feature-card">
                    <div class="feature-info">
                        <span class="badge">LATEST</span>
                        <h2>大島ハンター 第1話</h2>
                        <p>あらすじ：ついに伝説のハンターが動き出す。大島に隠された謎とは...</p>
                        <button class="play-btn" onclick="playMedia('ここにアイテムID')">今すぐ再生</button>
                    </div>
                </div>
            </section>

            <section class="cast-section">
                <h3>CREATORS & CAST</h3>
                <div class="cast-grid">
                    <div class="cast-item">
                        <img src="友達のアイコンURL" class="avatar">
                        <span class="name">友達A</span>
                        <span class="role">主人公・作画</span>
                    </div>
                    <div class="cast-item">
                        <img src="友達のアイコンURL" class="avatar">
                        <span class="name">友達B</span>
                        <span class="role">声の出演</span>
                    </div>
                    </div>
            </section>

            <section class="episode-section">
                <h3>EPISODES</h3>
                <div class="ep-list">
                    <div class="ep-item" onclick="playMedia('ID')">
                        <span class="ep-num">01</span>
                        <span class="ep-title">ハンターの目覚め</span>
                    </div>
                    <div class="ep-item">
                        <span class="ep-num">02</span>
                        <span class="ep-title">（COMING SOON）</span>
                    </div>
                </div>
            </section>
        </div>
    `;

    // 3. 画面に流し込む
    contentRows.innerHTML = myNewHomeHTML;

    // 4. 専用のスタイル（CSS）をその場で適用
    const style = document.createElement('style');
    style.innerHTML = `
        .guest-portal { padding: 20px; color: white; font-family: sans-serif; }
        .portal-header { text-align: center; margin-bottom: 40px; }
        .portal-logo { font-size: 3em; margin: 0; }
        .portal-logo span { color: #e50914; }
        
        .main-feature { margin-bottom: 40px; }
        .feature-card { 
            background: linear-gradient(90deg, rgba(0,0,0,0.8), rgba(0,0,0,0)), url('背景画像URL');
            background-size: cover; height: 300px; border-radius: 12px; display: flex; align-items: center; padding: 40px;
        }

        .cast-grid { display: flex; gap: 20px; overflow-x: auto; padding: 10px 0; }
        .cast-item { text-align: center; min-width: 100px; }
        .avatar { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid #e50914; }
        .name { display: block; font-weight: bold; margin-top: 10px; }
        .role { font-size: 0.8em; color: #aaa; }

        .ep-list { background: rgba(255,255,255,0.05); border-radius: 8px; }
        .ep-item { padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); cursor: pointer; transition: 0.3s; }
        .ep-item:hover { background: rgba(255,255,255,0.1); }
        .ep-num { font-weight: bold; color: #e50914; margin-right: 15px; }
    `;
    document.head.appendChild(style);
}

initGuestHome();