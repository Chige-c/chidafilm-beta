// --- 定数定義 ---
const TMDB_API_KEY = 'b5a39d9121b776763dc664288c3db7f3';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

/**
 * 1. 続けて観るセクション
 * 視聴途中のアイテムを取得し、進捗バー付きで表示します
 */
async function loadResumeItems() {
    try {
        const url = `${SERVER_URL}/Users/${userId}/Items/Resume?Fields=PrimaryImageAspectRatio,BasicSyncInfo,UserData,SeriesId,SeriesThumbImageTag,ImageTags,BackdropImageTags,DateCreated,DateLastContentAdded,ProductionYear&Limit=12`;
        const res = await fetch(url, { headers: { 'X-Emby-Token': token } });
        const data = await res.json();

        const section = document.getElementById('resume-section');
        const grid = document.getElementById('resume-grid');

        if (data.Items && data.Items.length > 0) {
            section.style.display = 'block';
            grid.innerHTML = ''; 

            data.Items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'resume-card poster-card';
                card.onclick = () => navigateToDetails(item.Id);

                card.dataset.id = item.Id;
    card.dataset.type = item.Type || 'Movie';

                const progress = (item.UserData.PlaybackPositionTicks / item.RunTimeTicks) * 100;
                let thumbId = item.Type === 'Episode' ? item.SeriesId : item.Id;
                let primaryTargetId = (item.Type === 'Episode' || item.Type === 'Season') ? item.SeriesId : item.Id;
                
                const thumbUrl = `${SERVER_URL}/Items/${thumbId}/Images/Thumb?fillWidth=500&quality=90`;
                const backdropUrl = `${SERVER_URL}/Items/${thumbId}/Images/Backdrop/0?fillWidth=500&quality=80`;
                const primaryUrl = `${SERVER_URL}/Items/${primaryTargetId}/Images/Primary?fillWidth=400&quality=90`;

                // 現在のモードを確認
                const isPoster = localStorage.getItem('view_mode') === 'poster';
                const defaultImg = isPoster ? primaryUrl : thumbUrl;
                const releaseYear = item.ProductionYear ? `<div class="poster-year">${item.ProductionYear}年</div>` : "";

                
                card.innerHTML = `
                    <div class="thumb-wrapper">
                        <img src="${defaultImg}" 
                             alt="${item.Name}" 
                             class="resume-thumb dynamic-img" 
                             data-thumb="${thumbUrl}" 
                             data-poster="${primaryUrl}"
                             onerror="handleImageError(this, '${backdropUrl}', '${primaryUrl}')">
                        <div class="progress-container">
                            <div class="progress-bar" style="width: ${progress}%"></div>
                        </div>
                    </div>
                    <div class="resume-title">
                        ${item.Type === 'Episode' ? item.SeriesName : item.Name}
                    </div>
                    <div class="poster-info-panel">
        <div class="poster-title">${item.Name}</div>
        ${releaseYear}
    </div>
                `;
                const now = new Date();
                const diffCreated = item.DateCreated ? Math.ceil(Math.abs(now - new Date(item.DateCreated)) / (1000 * 60 * 60 * 24)) : 999;
                const diffContent = item.DateLastContentAdded ? Math.ceil(Math.abs(now - new Date(item.DateLastContentAdded)) / (1000 * 60 * 60 * 24)) : 999;

                let finalBadge = ""; // この変数名で統一します

                if (diffCreated <= 14) {
                    // 1. 作品自体が新しい場合
                    if (item.Type === 'Movie' || item.Type === 'Series') {
                        finalBadge = "新作";
                    } else {
                        finalBadge = "新エピソード";
                    }
                } 
                else if (diffContent <= 14) {
                    // 2. 作品は古いが、新しいエピソードが追加された場合
                    finalBadge = "新エピソード";
                }

                // バッジの追加（1回だけに集約）
                if (finalBadge) {
                    const badge = document.createElement('div');
                    badge.className = 'home-new-badge';
                    badge.textContent = finalBadge;
                    const target = card.querySelector('.thumb-wrapper');
                    if (target) target.appendChild(badge);
                }
                grid.appendChild(card);
            });

            setTimeout(() => updateArrowVisibility(grid), 100);
        } else {
            section.style.display = 'none';
        }
    } catch (err) {
        console.error("Resume Load Error:", err);
    }
}

/**
 * 2. 通常のセクション用 (最近追加・公開など)
 * 指定されたクエリに基づいてJellyfinからアイテムを取得し表示します
 */
async function loadSectionItems(query, gridId) {
    try {
        const baseUrl = `${SERVER_URL}/Users/${userId}/Items${query}`;
        let url = `${baseUrl}${query.includes('?') ? '&' : '?'}Fields=PrimaryImageAspectRatio,BasicSyncInfo,UserData,ImageTags,BackdropImageTags,ThumbImageTag,SeriesId,DateCreated,DateLastContentAdded,ProductionYear`;
        if (!query.toLowerCase().includes('limit=')) {
            url += '&Limit=20';
        }
        const res = await fetch(url, { headers: { 'X-Emby-Token': token } });
        const data = await res.json();

        const grid = document.getElementById(gridId);
        if (!grid) return;

        if (data && (data.Items || Array.isArray(data))) {
            let items = Array.isArray(data) ? data : data.Items; // ← const を let に変更！
            const uniqueItems = [];
            const seenIds = new Set();

            items.forEach(item => {
                // エピソードなら「番組ID」、映画なら「自分自身のID」で重複チェック
                const checkId = item.SeriesId || item.Id;
                if (!seenIds.has(checkId)) {
                    seenIds.add(checkId);
                    uniqueItems.push(item); // 初めて見た番組だけリストに追加
                }
            });

            items = uniqueItems.slice(0, 20);

            grid.innerHTML = '';
            
            items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'poster-card';
                card.onclick = () => playMedia(item.Id);
                card.dataset.id = item.Id;
                card.dataset.type = item.Type || 'Movie';

                let targetId = (item.Type === 'Episode' || item.Type === 'Season') ? item.SeriesId : item.Id;
                const thumbUrl = `${SERVER_URL}/Items/${targetId}/Images/Thumb?fillWidth=500&quality=90`;
                const backdropUrl = `${SERVER_URL}/Items/${targetId}/Images/Backdrop/0?fillWidth=500&quality=80`;
                const primaryUrl = `${SERVER_URL}/Items/${targetId}/Images/Primary?fillWidth=500&quality=90`;

                const isPoster = localStorage.getItem('view_mode') === 'poster';
                const defaultImg = isPoster ? primaryUrl : thumbUrl;
                const releaseYear = item.ProductionYear ? `<div class="poster-year">${item.ProductionYear}年</div>` : "";

                card.innerHTML = `
                    <div class="thumb-wrapper">
                        <img class="resume-thumb dynamic-img" 
                             src="${defaultImg}" 
                             data-thumb="${thumbUrl}" 
                             data-poster="${primaryUrl}" 
                             alt="${item.Name}" loading="lazy"
                             onerror="handleImageError(this, '${backdropUrl}', '${primaryUrl}')">
                    </div>
                    <div class="resume-title">${item.Name}</div>
                    <div class="poster-info-panel">
        <div class="poster-title">${item.Name}</div>
        ${releaseYear}
    </div>
                `;
                const now = new Date();
                
                // 日付を安全に取得
                const dateCreated = item.DateCreated ? new Date(item.DateCreated) : null;
                const dateContent = item.DateLastContentAdded ? new Date(item.DateLastContentAdded) : null;

                // 何日前かの計算（日付がない場合は 999日 にする）
                const diffCreated = dateCreated ? Math.ceil(Math.abs(now - dateCreated) / (1000 * 60 * 60 * 24)) : 999;
                const diffContent = dateContent ? Math.ceil(Math.abs(now - dateContent) / (1000 * 60 * 60 * 24)) : 999;


                let finalBadgeText = ""; // 宣言を統一

                // 1. 新作判定 (番組・映画そのものが 14日以内に追加された)
                if ((item.Type === 'Series' || item.Type === 'Movie') && diffCreated <= 14) {
                    finalBadgeText = "新作";
                }
                // 2. 新エピソード判定 (番組の更新が 14日以内、またはエピソード単体の追加が 14日以内)
                else if ((item.Type === 'Series' && diffContent <= 7) || (item.Type === 'Episode' && diffCreated <= 7)) {
                    finalBadgeText = "新エピソード";
                }

                // バッジを追加する（1回のみ実行）
                if (finalBadgeText) {
                    const badge = document.createElement('div');
                    badge.className = 'home-new-badge';
                    badge.textContent = finalBadgeText;
                    const thumbWrapper = card.querySelector('.thumb-wrapper');
                    if (thumbWrapper) {
                        thumbWrapper.appendChild(badge);
                    }
                }
                grid.appendChild(card);

            });
            updateArrowVisibility(grid);
        }
    } catch (err) {
        console.error(`Error loading ${gridId}:`, err);
    }
}













function toggleAdminPanel() {
    const panel = document.getElementById('admin-screen');
    
    // active クラスを付け外しする
    // 外れた瞬間に CSS の transition により、縮小しながら透明になります
    panel.classList.toggle('active');

    // 開いた時（activeがついた時）だけデータを読み込む
    if (panel.classList.contains('active')) {
        renderAdminList();
    }
}
/**
 * 管理画面内の「現在のリスト」をサーバーから取得して描画
 */


/**
 * 3. 世界で人気の作品 / 名作映画 (TMDB 取得用)
 * @param {string} gridId - 表示先のID
 * @param {string} fetchUrl - TMDBのAPIエンドポイント
 * @param {boolean} showRank - ランキング数字を表示するかどうか
 */
/**
 * 3. トレンド・名作の中から「自分の在庫にあるもの」だけをフィルタリングして表示
 */
async function loadTrendingFromTMDB(gridId, fetchUrl, showRank = false) {
    try {
        // A. まず、自分のJellyfinサーバーにある全映画の情報を取得（TMDB IDを含む）
        const jfUrl = `${SERVER_URL}/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true&Fields=ProviderIds,DateCreated,DateLastContentAdded,ProductionYear&ExcludeLocationTypes=Virtual`;
        const jfRes = await fetch(jfUrl, { headers: { 'X-Emby-Token': token } });
        const jfData = await jfRes.json();
        
        // B. 次に、TMDBからトレンド/名作のリストを取得
        const tmdbRes = await fetch(fetchUrl);
        const tmdbData = await tmdbRes.json();
        
        const grid = document.getElementById(gridId);
        if (!grid) return;
        grid.innerHTML = '';

        // C. TMDBのリストを1つずつチェックし、自分のサーバーにあるか確認
        const matchedItems = [];
        tmdbData.results.forEach(tmdbMovie => {
            const match = jfData.Items.find(item => 
                item.ProviderIds && item.ProviderIds.Tmdb === tmdbMovie.id.toString()
            );
            if (match) {
                // Jellyfin側の情報を優先して保存
                matchedItems.push(match);
            }
        });

        // D. 一致した作品だけを描画（最大15件）
        matchedItems.slice(0, 15).forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'poster-card';
            card.onclick = () => playMedia(item.Id); // 自分の在庫なので直接再生可能

            card.dataset.id = item.Id;
            card.dataset.type = item.Type || 'Movie';

            const thumbUrl = `${SERVER_URL}/Items/${item.Id}/Images/Thumb?fillWidth=500&quality=90`;
            const backdropUrl = `${SERVER_URL}/Items/${item.Id}/Images/Backdrop/0?fillWidth=500&quality=80`;
            const primaryUrl = `${SERVER_URL}/Items/${item.Id}/Images/Primary?fillWidth=400&quality=90`;
            const isPoster = localStorage.getItem('view_mode') === 'poster';
            const defaultImg = isPoster ? primaryUrl : thumbUrl;

            const rankHtml = (showRank && index < 10) ? `<div class="rank-number">${index + 1}</div>` : '';
            const releaseYear = item.ProductionYear ? `<div class="poster-year">${item.ProductionYear}年</div>` : "";

            card.innerHTML = `
                <div class="thumb-wrapper">
                    ${rankHtml}
                    <img class="resume-thumb dynamic-img" 
                         src="${defaultImg}" 
                         data-thumb="${thumbUrl}" 
                         data-poster="${primaryUrl}" 
                         alt="${item.Name}" loading="lazy"
                         onerror="handleImageError(this, '${backdropUrl}', '${primaryUrl}')">
                </div>
                <div class="resume-title">${item.Name}</div>
                <div class="poster-info-panel">
        <div class="poster-title">${item.Name}</div>
        ${releaseYear}
    </div>
            `;
            const compareDate = item.DateLastContentAdded || item.DateCreated;
            if (compareDate) {
                const diffDays = Math.ceil(Math.abs(new Date() - new Date(compareDate)) / (1000 * 60 * 60 * 24));
                if (diffDays <= 14) {
                    const badge = document.createElement('div');
                    badge.className = 'home-new-badge';
                    badge.textContent = '新作';
                    card.querySelector('.thumb-wrapper').appendChild(badge);
                }
            }
            grid.appendChild(card);
        });
        updateArrowVisibility(grid);

        // もし1つも一致しなかった場合、セクションごと隠すかメッセージを出す
        if (matchedItems.length === 0) {
            grid.innerHTML = '<p style="padding:20px; color:gray;">このカテゴリに一致する在庫がありません</p>';
        }

    } catch (err) {
        console.error(`Filter Load Error (${gridId}):`, err);
    }
}

/**
 * 4. 初期化処理
 * 全セクションを順番に読み込みます
 */
/**
 * 4. 初期化処理
 * 全セクションを並列で読み込みます（一つが失敗しても他を表示させるため）
 */
async function initHomeSections() {
    console.log("全セクションの読み込みを開始します...");

    checkAdminAuth();
    
    // 既存のJellyfinセクション
    loadResumeItems();
    
    // ① 映画は最新取得APIのままでOK
    loadSectionItems('/Latest?IncludeItemTypes=Movie', 'movie-grid');
    
    // ② 最近追加された番組（更新日データを省略させずに完全な状態で取得）
    loadSectionItems('?IncludeItemTypes=Series&SortBy=DateLastContentAdded,DateCreated&SortOrder=Descending&Recursive=true&Limit=20', 'series-grid');
    
    // ③ 最新エピソード（★重要: 番組にグループ化させず、エピソード単体として取得）
    loadSectionItems('/Latest?IncludeItemTypes=Episode&GroupItems=false&Limit=250', 'latest-episodes-grid');
    
    // ④ 最近のリリース
    loadSectionItems('?SortBy=PremiereDate&SortOrder=Descending&IncludeItemTypes=Movie&Recursive=true&Limit=100', 'recent-releases-grid');
    
    // 名作・受賞作品 (suggested-grid)
    const classicUrl = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&language=ja-JP&sort_by=vote_count.desc&vote_average.gte=7&page=1`;
    loadTrendingFromTMDB('suggested-grid', classicUrl, false);
}
async function checkAdminAuth() {
    try {
        // localStorageから確実に再取得しておく（グローバル変数が他ファイル定義で未検出にならない対策）
        const currentUserId = localStorage.getItem('userId') || sessionStorage.getItem('userId') || (typeof userId !== 'undefined' ? userId : null);
        const currentToken = localStorage.getItem('token') || sessionStorage.getItem('token') || (typeof token !== 'undefined' ? token : null);
        const currentServerUrl = typeof SERVER_URL !== 'undefined' ? SERVER_URL : (localStorage.getItem('serverUrl') || '/jellyfin-api');
        
        if (!currentUserId || !currentToken) {
            const icon = document.getElementById('admin-settings-icon');
            if(icon) icon.style.display = 'none';
            return;
        }

        const url = `${currentServerUrl}/Users/${currentUserId}`;
        const res = await fetch(url, { headers: { 'X-Emby-Token': currentToken } });
        if (!res.ok) throw new Error("ユーザー情報の取得に失敗しました");
        const user = await res.json();

        const adminIcon = document.getElementById('admin-settings-icon');
        if (!adminIcon) return;

        // ログ出力して権限テストの確認
        console.log("Check Auth User Policy:", user.Policy);

        // Jellyfinのポリシーで管理者権限があるかチェック
        if (user.Policy && user.Policy.IsAdministrator) {
            // !important を上書きするために class を操作する方法もあるが、直接 style に適用
            adminIcon.style.setProperty('display', 'inline-block', 'important'); 
        } else {
            adminIcon.style.setProperty('display', 'none', 'important'); 
        }
    } catch (err) {
        console.error("Admin check error:", err);
        const icon = document.getElementById('admin-settings-icon');
        if(icon) icon.style.setProperty('display', 'none', 'important');
    }
}

// --- ユーティリティ関数 (スライダー制御) ---

function updateArrowVisibility(row) {
    if (!row) return;
    const wrapper = row.closest('.slider-wrapper');
    if (!wrapper) return;

    const leftBtn = wrapper.querySelector('.handle-left');
    const rightBtn = wrapper.querySelector('.handle-right');
    if (!leftBtn || !rightBtn) return;

    const currentX = Math.abs(parseFloat(row.dataset.currentX || 0));
    const maxScroll = Math.max(0, row.scrollWidth - wrapper.clientWidth);

    // --- 左端判定 (100px以上の移動で表示) ---
    if (currentX > 5) { 
        leftBtn.classList.remove('is-at-edge');
    } else {
        leftBtn.classList.add('is-at-edge');
    }

    // --- 右端判定 ---
    // 右端付近（マージン10px以内）なら右矢印を隠す
    if (currentX < maxScroll - 10) {
        rightBtn.classList.remove('is-at-edge');
    } else {
        rightBtn.classList.add('is-at-edge');
    }
}
function scrollRow(btn, direction) {
    const wrapper = btn.closest('.slider-wrapper');
    const row = wrapper.querySelector('.movie-row');
    const card = row.firstElementChild; // クラス名に依存せず、行内の最初のカード要素を取得する
    
    if (card && row) {
        if (!row.dataset.currentX) row.dataset.currentX = 0;
        let currentX = parseFloat(row.dataset.currentX);

        // --- ★ここを修正：全体(body)ではなく、この wrapper だけにクラスをつける ---
        wrapper.classList.add('is-scrolling'); 
        document.body.classList.add('disable-hover'); // マウス誤検知防止用（そのまま）
        window.isSliderScrolling = true; 
        
        if (window.scrollTimeout) clearTimeout(window.scrollTimeout);
        window.scrollTimeout = setTimeout(() => {
            window.isSliderScrolling = false;
            // 終了時にクラスを外す
            wrapper.classList.remove('is-scrolling');
            document.body.classList.remove('disable-hover');
        }, 1000);

        // スクロール計算（既存のまま）
        const cardWidth = card.getBoundingClientRect().width;
        const gap = 10; 
        const isPoster = document.body.classList.contains('poster-mode');
        let itemsToScroll = isPoster ? (window.innerWidth > 1950 ? 8 : 7) : (window.innerWidth > 1950 ? 6 : 5);

        const scrollAmount = (cardWidth + gap) * itemsToScroll;
        currentX += (scrollAmount * direction);

        const maxScroll = Math.max(0, row.scrollWidth - wrapper.clientWidth);
        if (currentX < 0) currentX = 0;
        if (currentX > maxScroll) currentX = maxScroll;

        row.style.transform = `translateX(-${currentX}px)`;
        row.dataset.currentX = currentX;

        updateArrowVisibility(row);
    }
}

function initAllSliders() {
    document.querySelectorAll('.movie-row').forEach(row => {
        if (row.id === 'popularity-grid') return;
        // 滑らかに動かすためのCSS設定
        row.style.transition = "transform 1.0s cubic-bezier(0.25, 1, 0.5, 1)";
        row.dataset.currentX = 0;
        
        updateArrowVisibility(row);
    });
}
/* handle.js の末尾に追加 */
function handleImageError(img, backdrop, primary) {
    if (img.src.includes('Thumb')) {
        // サムネがない場合はバックドロップを試す
        img.src = backdrop;
    } else if (img.src.includes('Primary')) {
        // ポスターがない場合はバックドロップを試す
        img.src = backdrop;
    }
    // すでにBackdropを試して失敗した場合は、エラーを止める
    img.onerror = null; 
}
let lastMouseX = 0;
let lastMouseY = 0;

window.addEventListener('mousemove', (e) => {
    // スクロール中（1秒間）は座標だけ更新して無視
    if (window.isSliderScrolling) {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        return;
    }

    // 前回から何ピクセル動いたかを計算
    const moveX = Math.abs(e.clientX - lastMouseX);
    const moveY = Math.abs(e.clientY - lastMouseY);

    // 2px未満の移動は「手ブレ」や「ブラウザの誤検知」として無視する！
    if (moveX < 2 && moveY < 2) {
        return;
    }

    // しっかり動いた場合のみ座標を更新し、ホバー禁止を解除
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    if (document.body.classList.contains('disable-hover')) {
        document.body.classList.remove('disable-hover');
    }
});

// グローバルスコープへの書き出し
window.addEventListener('load', initAllSliders);

// 画面読み込み時に管理者アイコンの表示権限を自動チェックする
window.addEventListener('DOMContentLoaded', checkAdminAuth);
window.scrollRow = scrollRow;
window.refreshSliders = initAllSliders;