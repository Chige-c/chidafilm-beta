/* =========================================
   search.js - 検索機能（同名のアニメ・映画被り対応版）
   ========================================= */

let allItemsCache = []; 
let searchDebounceTimer = null; 

// --- 1. 検索画面を開く ---
function openSearch(fromPopstate = false) {
    const overlay = document.getElementById('search-overlay');
    const input = document.getElementById('search-input');
    if (overlay) overlay.classList.add('active');
    overlay.scrollTop = 0;

    if (typeof updatePageTitle === 'function') {
        updatePageTitle('検索');
    }

    
    setTimeout(() => { if (input) input.focus(); }, 300);
    document.body.classList.add('search-mode');

    if (!fromPopstate) {
        const newUrl = '?tab=search';
        if (window.location.search !== newUrl) {
            history.pushState({ type: 'search', tab: 'search' }, '', newUrl);
        }
    }

    if (allItemsCache.length === 0) {
        fetchAllItemsForSearch();
    }
}

// --- 2. 検索画面を閉じる ---
function closeSearch(fromPopstate = false, skipHistory = false) {
    // ★修正：skipHistory が true の時は history.back() を実行しないようにする
    if (!fromPopstate && !skipHistory && window.location.search.includes('tab=search')) {
        history.back();
        return; 
    }
    const overlay = document.getElementById('search-overlay');
    if (!overlay || !overlay.classList.contains('active')) return;
    
    overlay.classList.remove('active');
    document.body.classList.remove('search-mode');

    if (typeof updatePageTitle === 'function') {
        let returnTitle = 'ホーム';
        if (window.currentMediaType === 'Movie') returnTitle = '映画';
        else if (window.currentMediaType === 'Series') returnTitle = 'シリーズ';
        else if (window.currentMediaType === 'MyList') returnTitle = 'マイリスト';
        
        // VODやマイライブラリを開いている場合の判定
        if (document.body.hasAttribute('data-vod')) {
             const sourceId = document.body.getAttribute('data-vod');
             returnTitle = (typeof PLATFORM_NAMES !== 'undefined' && PLATFORM_NAMES[sourceId]) ? PLATFORM_NAMES[sourceId] : returnTitle;
        } else if (document.body.hasAttribute('data-library')) {
             returnTitle = typeof currentLibraryName !== 'undefined' ? currentLibraryName : 'マイライブラリ';
        }

        updatePageTitle(returnTitle);
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSearch();
});

// --- 3. Jellyfinから全作品をキャッシュ ---
async function fetchAllItemsForSearch() {
    if (typeof userId === 'undefined' || typeof token === 'undefined') {
        console.error("認証情報が見つかりません。");
        return;
    }

    try {
        // ★ 修正: Limit=10000 を追加し、作品取得漏れを完全に防ぐ
        const url = `${SERVER_URL}/Users/${userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true&Limit=10000&Fields=PrimaryImageAspectRatio,ImageTags,OriginalTitle,ProductionYear&SortBy=SortName&SortOrder=Ascending`;
        const res = await fetch(url, { headers: { 'X-Emby-Token': token } });
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        const data = await res.json();
        if (data.Items) {
            allItemsCache = data.Items;
            console.log(`Jellyfin: ${allItemsCache.length}件のキャッシュ完了`);
        }
    } catch (e) {
        console.error("Jellyfinデータの取得に失敗:", e);
    }
}

// --- 4. 表記揺れ対策の正規化 ---
function normalizeString(str) {
    if (!str) return "";
    return str.toLowerCase().replace(/[・・＝=\s　]/g, "").replace(/[ぁ-ん]/g, s => String.fromCharCode(s.charCodeAt(0) + 0x60));
}

// --- 5. 検索実行メインロジック ---
async function performSearch(query) {
    const grid = document.getElementById('search-grid');
    const meta = document.getElementById('search-meta');
    if (!grid || !meta) return;

    if (!query.trim()) {
        grid.innerHTML = '';
        meta.textContent = '';
        return;
    }

    const normalizedQuery = normalizeString(query);

    // ① Jellyfin（所持済み）
    const localResults = allItemsCache.filter(item => {
        const nName = normalizeString(item.Name);
        const nOrig = normalizeString(item.OriginalTitle || "");
        return nName.includes(normalizedQuery) || nOrig.includes(normalizedQuery);
    });

    // ② Jellyseerr（未所持）
    let remoteResults = [];
    try {
        const seerrRes = await fetch(`/seerr-api/api/v1/search?query=${encodeURIComponent(query)}&language=ja-JP`);
        if (seerrRes.ok) {
            const seerrData = await seerrRes.json();
            
            // ★ 修正: タイトルだけでなく「映画(movie)か番組(tv)か」もセットで記録する
            const localItemsSet = new Set(localResults.map(i => {
                const typeStr = (i.Type === 'Series') ? 'tv' : 'movie';
                return `${normalizeString(i.Name)}_${typeStr}`;
            }));
            
            remoteResults = (seerrData.results || []).filter(item => {
                if (item.mediaType === 'person') return false;
                const title = normalizeString(item.title || item.name);
                
                // ★ 修正: タイトルとタイプが両方完全一致した場合のみ、未所持リストから除外する
                return !localItemsSet.has(`${title}_${item.mediaType}`);
            });
        }
    } catch (e) {
        console.error("Jellyseerr検索エラー:", e);
    }

    meta.textContent = `視聴可能: ${localResults.length}件 / 未所持: ${remoteResults.length}件`;
    grid.innerHTML = '';

    localResults.forEach(item => grid.appendChild(createSearchCard(item, true)));
    remoteResults.forEach(item => grid.appendChild(createSearchCard(item, false)));
}

// --- 6. 検索カード生成 ---
function createSearchCard(item, isLocal) {
    const card = document.createElement('div');
    card.className = 'search-poster-card';

    let title = isLocal ? item.Name : (item.title || item.name);
    let imgUrl = '';
    let mediaTypeStr = '映画'; 
    let year = ''; 
    let requestBtnHtml = '';
    let isRequested = false;

    if (isLocal) {
        if (item.Type === 'Series') mediaTypeStr = 'シリーズ';
        imgUrl = `${SERVER_URL}/Items/${item.Id}/Images/Primary?fillWidth=400&quality=90`;
        if (item.ProductionYear) year = item.ProductionYear; 
    } else {
        if (item.mediaType === 'tv') mediaTypeStr = 'シリーズ';
        imgUrl = item.posterPath 
            ? `https://image.tmdb.org/t/p/w500${item.posterPath}` 
            : `https://via.placeholder.com/400x600/333/fff?text=No+Poster`;
        const dateStr = item.releaseDate || item.firstAirDate;
        if (dateStr && dateStr.length >= 4) year = dateStr.substring(0, 4);

        let btnText = 'リクエスト';
        let btnClass = 'search-request-btn';
        let disabledAttr = '';

        if (item.mediaInfo && (item.mediaInfo.status >= 2 || (item.mediaInfo.requests && item.mediaInfo.requests.length > 0))) {
            isRequested = true;
            const clockIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
            btnText = `<span>リクエスト済み</span>${clockIcon}`; 
        }

        if (isRequested) {
            btnClass += ' requested-btn'; 
            disabledAttr = 'disabled';
        }
        requestBtnHtml = `<button class="${btnClass}" ${disabledAttr}>${btnText}</button>`;
    }

    const badgeHtml = isLocal ? `<div class="search-badge">視聴可能</div>` : '';

    card.innerHTML = `
        <div class="search-poster-wrapper">
            <img src="${imgUrl}" alt="${title}" loading="lazy">
            ${badgeHtml}
            <div class="media-type-badge">${mediaTypeStr}</div>
            <div class="search-hover-overlay">
                ${year ? `<div class="hover-year">${year}年</div>` : ''}
                <div class="search-hover-title">${title}</div>
                ${requestBtnHtml}
            </div>
        </div>
    `;

    if (isLocal) {
        card.onclick = () => { 
            if (typeof closeSearch === 'function') closeSearch(false, true);
            // ★修正： local であることと、作品タイプ (Movie or Series) を明示的に渡す
            if (typeof navigateToDetails === 'function') {
                navigateToDetails(item.Id, 'local', item.Type);
            }
        };
    } else {

        card.onclick = () => {
            const mediaType = item.mediaType === 'tv' ? 'Series' : 'Movie';
            if (typeof closeSearch === 'function') closeSearch(false, true);
            // 第3引数に 'tmdb' を指定
            if (typeof navigateToDetails === 'function') navigateToDetails(item.id, 'tmdb', mediaType);
        };
        const reqBtn = card.querySelector('.search-request-btn');
        if (reqBtn && !isRequested) {
            reqBtn.onclick = (e) => {
                e.stopPropagation(); 
                handleRequest(title, item.mediaType, item.id, card);
            };
        }
    }
    return card;
}

// --- 7. リクエスト送信 ---
async function handleRequest(title, type, tmdbId, cardElement) {
    const confirmRes = await showCustomConfirm(title);
    if (!confirmRes) return;

    const btn = cardElement.querySelector('.search-request-btn');
    if (btn) {
        btn.textContent = '送信中...';
        btn.style.backgroundColor = '#ff9800'; // オレンジ
        btn.disabled = true;
    }

    try {
        let requestBody = { 
            mediaType: type, 
            mediaId: Number(tmdbId) 
        };
        if (type === 'tv') {
            const detailRes = await fetch(`/seerr-api/api/v1/tv/${tmdbId}?language=ja`);
            if (detailRes.ok) {
                const detailData = await detailRes.json();
                // シーズン番号の配列も数値であることを確認
                requestBody.seasons = detailData.seasons 
                    ? detailData.seasons.filter(s => s.seasonNumber > 0).map(s => Number(s.seasonNumber)) 
                    : [1];
            }
        }
        const res = await fetch(`/seerr-api/api/v1/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (res.ok) {
            if (btn) {
                btn.textContent = '完了しました';
                btn.style.backgroundColor = '#4caf50'; // 緑
            }
        } else {
            const errorData = await res.json();
            throw new Error(errorData.message || 'エラーが発生しました');
        }
    } catch (e) {
        if (btn) {
            btn.textContent = '失敗しました';
            btn.style.backgroundColor = '#f44336';
            btn.disabled = false;
        }
        alert(`失敗しました: ${e.message}`);
    }
}

// --- 8. カスタムモーダル ---
function showCustomConfirm(title) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';
        const modal = document.createElement('div');
        modal.className = 'custom-modal';
        modal.innerHTML = `
            <div class="custom-modal-title">リクエストの確認</div>
            <div class="custom-modal-text">「${title}」をサーバーにリクエストしますか？</div>
            <div class="custom-modal-buttons">
                <button class="custom-modal-btn cancel-btn">キャンセル</button>
                <button class="custom-modal-btn confirm-btn">リクエスト</button>
            </div>
        `;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('active'));
        const closeModal = (result) => {
            overlay.classList.remove('active');
            setTimeout(() => { overlay.remove(); resolve(result); }, 200); 
        };
        modal.querySelector('.cancel-btn').onclick = () => closeModal(false);
        modal.querySelector('.confirm-btn').onclick = () => closeModal(true);
        overlay.onclick = (e) => { if (e.target === overlay) closeModal(false); };
    });
}

// --- 9. イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            if (value.length > 0) {
                if (typeof updatePageTitle === 'function') {
                    updatePageTitle(`${value}の検索結果`);
                }
                performSearch(value);
            } else {
                const grid = document.getElementById('search-grid');
                const meta = document.getElementById('search-meta');
                if (grid) grid.innerHTML = '';
                if (meta) meta.textContent = '';
                if (typeof updatePageTitle === 'function') {
                    updatePageTitle('検索');
                }
            }
        });
    }

    // ★追加: ヘッダー上でのマウスホイール操作を、下の検索結果エリアに転送する魔法
    
});