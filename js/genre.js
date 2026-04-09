// js/genre.js 内の関数を修正
/**
 * @param {string} displayName - 画面表示用の名前（例：アクション）
 * @param {string} searchQuery - API検索用の名前（例：Action|アクション）
 */
function navigateToGenre(displayName, searchQuery) {
    if (typeof cleanupDetailsTrailer === 'function') cleanupDetailsTrailer();

    // searchQueryが渡されていない（URL直叩きなど）場合のフォールバック
    const finalSearchQuery = searchQuery || displayName;
    const currentType = (window.currentMediaType && window.currentMediaType !== 'MyList') ? window.currentMediaType : '';

    // URLを更新
    const newUrl = `${window.location.pathname}?genre=${encodeURIComponent(displayName)}&q=${encodeURIComponent(finalSearchQuery)}&type=${currentType}`;
    history.pushState({ view: 'genre', genre: displayName, q: finalSearchQuery, type: currentType }, '', newUrl);

    if (typeof updatePageTitle === 'function') {
        updatePageTitle(displayName);
    }

    showView('genre-view');
    loadGenreItems(displayName, finalSearchQuery, currentType);
}

// ★引数に searchQuery を追加
async function loadGenreItems(displayName, searchQuery, mediaType = '') {
    const titleEl = document.getElementById('genre-title');
    if (titleEl) {
        let typeLabel = (mediaType === 'Movie') ? '（映画）' : (mediaType === 'Series') ? '（番組）' : '';
        titleEl.innerText = `${displayName}${typeLabel}`;
    }

    const grid = document.getElementById('genre-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="loading-text">読み込み中...</div>';

    const currentServer = SERVER_URL;
    const currentUserId = userId;
    const currentToken = token;

    try {
        let typeQuery = 'Movie,Series';
        if (mediaType === 'Movie') typeQuery = 'Movie';
        else if (mediaType === 'Series') typeQuery = 'Series';

        // ★修正：displayName ではなく searchQuery を Genres パラメータに使用する
        const url = `${currentServer}/Users/${currentUserId}/Items?Genres=${encodeURIComponent(searchQuery)}&IncludeItemTypes=${typeQuery}&Recursive=true&Fields=ImageTags,BackdropImageTags,ProductionYear,UserData,Genres,Overview,CommunityRating,OfficialRating`;
        
        const res = await fetch(url, { headers: { 'X-Emby-Token': currentToken } });
        const data = await res.json();

        if (data.Items && data.Items.length > 0) {
            grid.innerHTML = data.Items.map(item => {
                // 既存のポスターカード生成ロジック
                let thumbType = 'Primary';
                if (item.ImageTags && item.ImageTags.Thumb) thumbType = 'Thumb';
                else if (item.BackdropImageTags?.length > 0) thumbType = 'Backdrop';
                
                const imgUrl = `${currentServer}/Items/${item.Id}/Images/${thumbType}?fillWidth=500&quality=90`;
                const isPoster = localStorage.getItem('view_mode') === 'poster';
                const primaryUrl = `${currentServer}/Items/${item.Id}/Images/Primary?fillWidth=400&quality=90`;
                const finalImg = isPoster ? primaryUrl : imgUrl;

                return `
                    <div class="poster-card" onclick="navigateToDetails('${item.Id}')" data-id="${item.Id}">
                        <div class="thumb-wrapper">
                            <img class="resume-thumb dynamic-img" src="${finalImg}" alt="${item.Name}" loading="lazy">
                        </div>
                        <div class="resume-title">${item.Name}</div>
                    </div>
                `;
            }).join('');

            // ホバー機能の有効化
            if (window.enhanceCard) {
                grid.querySelectorAll('.poster-card').forEach(card => window.enhanceCard(card));
            }
        } else {
            grid.innerHTML = '<p class="no-results">該当する作品がありません。</p>';
        }
    } catch (e) {
        grid.innerHTML = '<p class="error-text">データの取得に失敗しました。</p>';
    }
}