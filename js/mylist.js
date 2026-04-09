/* =========================================
   mylist.js - VOD完全一致版（詳細パネル対応・旧ボタン削除）
   ========================================= */

let mylistData = [];
let currentMylistFilter = 'All';

async function loadMyListItems() {

    if (typeof window.setDynamicNavTitle === 'function') {
        window.setDynamicNavTitle('');
    }
    const grid = document.getElementById('mylist-grid');
    if (!grid) return;

    // 1. 初期化：前回のデータを消し、空の状態にする
    grid.innerHTML = '';
    const emptyState = document.getElementById('mylist-empty');
    if (emptyState) emptyState.style.display = 'none';

    const currentUserId = typeof userId !== 'undefined' ? userId : localStorage.getItem('userId');
    const currentToken = typeof token !== 'undefined' ? token : localStorage.getItem('token');
    const currentServer = typeof SERVER_URL !== 'undefined' ? SERVER_URL : localStorage.getItem('serverUrl');

    const url = `${currentServer}/Users/${currentUserId}/Items?Filters=IsFavorite&Recursive=true&Fields=PrimaryImageAspectRatio,BasicSyncInfo,UserData,SeriesId,SeriesThumbImageTag,ImageTags,BackdropImageTags,DateCreated,ProductionYear,Overview,Genres,OfficialRating,RunTimeTicks&SortBy=DateCreated&SortOrder=Descending`;

    try {
        const res = await fetch(url, { headers: { 'X-Emby-Token': currentToken } });
        const data = await res.json();
        mylistData = data.Items || [];
        renderMyListGrid();
    } catch (error) { 
        console.error("Error:", error); 
    } finally {
        // 2. 完了処理：ローディング画面を消す（home.jsのreloadAllSectionsと同じ演出）
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.transition = 'opacity 0.3s ease';
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 300);
        }
    }
}

function renderMyListGrid() {
    const grid = document.getElementById('mylist-grid');
    const allContainer = document.getElementById('mylist-all-container');
    const emptyState = document.getElementById('mylist-empty');
    const heroSection = document.getElementById('hero-section');
    
    if (heroSection) heroSection.style.display = 'none';

    if (mylistData.length === 0) {
        if (grid) grid.style.display = 'none';
        if (allContainer) allContainer.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (currentMylistFilter === 'All') {
        // --- 「すべて」の時：スライダー形式 ---
        if (grid) grid.style.display = 'none';
        if (allContainer) allContainer.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';

        const movies = mylistData.filter(item => item.Type === 'Movie');
        const series = mylistData.filter(item => item.Type === 'Series');
        const episodes = mylistData.filter(item => item.Type === 'Episode');

        renderMylistSliderRow('mylist-movies-section', 'mylist-movies-grid', movies);
        renderMylistSliderRow('mylist-series-section', 'mylist-series-grid', series);
        renderMylistSliderRow('mylist-episodes-section', 'mylist-episodes-grid', episodes);

        // ホーム等で使っている横スクロール用ハンドラーを一括登録
        if (typeof window.refreshSliders === 'function') {
            // ★修正: DOMが画面に表示されて幅が計算可能になるまで少し待つ
            setTimeout(() => window.refreshSliders(), 200);
        }
    } else {
        // --- 「個別タブ」の時：これまでのグリッド形式 ---
        if (allContainer) allContainer.style.display = 'none';
        if (grid) {
            grid.innerHTML = '';
            grid.style.display = 'grid'; 
        }

        const filteredData = mylistData.filter(item => item.Type === currentMylistFilter);

        if (filteredData.length === 0) {
            if (grid) grid.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        filteredData.forEach(item => {
            const card = createMylistCard(item, true); // true = gridモード用 (gallery-item)
            if (grid) grid.appendChild(card);
        });

        if (typeof window.initializeHoverEvents === 'function' && grid) {
            window.initializeHoverEvents(grid); 
        }
    }
}

// 共通化するためのカード生成関数
function createMylistCard(item, isGridMode = false) {
    const currentServer = typeof SERVER_URL !== 'undefined' ? SERVER_URL : localStorage.getItem('serverUrl');
    const isPosterModeNow = document.body.classList.contains('poster-mode');
    
    const card = document.createElement('div');
    const ratioClass = isPosterModeNow ? 'poster-card' : 'thumb-card';
    
    // グリッドなら gallery-item を付け、スライダーなら付けない（あるいはスライダー用のクラスに合わせる）
    card.className = isGridMode ? `gallery-item ${ratioClass}` : ratioClass;
    
    card.dataset.id = item.Id;
    card.dataset.type = item.Type || 'Movie';
    card.dataset.favorite = 'true'; 

    const thumbTag = item.ImageTags?.Thumb || '';
    const primaryTag = item.ImageTags?.Primary || '';
    const backdropTag = item.BackdropImageTags?.[0] || '';

    const thumbUrl = `${currentServer}/Items/${item.Id}/Images/Thumb?fillWidth=700&quality=100${thumbTag ? '&tag=' + thumbTag : ''}`;
    const posterUrl = `${currentServer}/Items/${item.Id}/Images/Primary?fillWidth=1200&quality=100${primaryTag ? '&tag=' + primaryTag : ''}`;
    const backdropUrl = `${currentServer}/Items/${item.Id}/Images/Backdrop?fillWidth=1200&quality=100${backdropTag ? '&tag=' + backdropTag : ''}`;

    const hasThumb = item.ImageTags && item.ImageTags.Thumb;
    const hasBackdrop = item.BackdropImageTags && item.BackdropImageTags.length > 0;
    let initialImg = hasThumb ? thumbUrl : (hasBackdrop ? backdropUrl : posterUrl);
    if (isPosterModeNow && primaryTag) initialImg = posterUrl;

    card.innerHTML = `
        <img src="${initialImg}" class="dynamic-img" data-thumb="${thumbUrl}" data-poster="${posterUrl}" loading="lazy">
    `;
    
    card.onclick = () => { if (typeof playMedia === 'function') playMedia(item.Id); };
    return card;
}

// スライダー行を展開する関数
function renderMylistSliderRow(sectionId, gridId, items) {
    const section = document.getElementById(sectionId);
    const row = document.getElementById(gridId);
    if (!section || !row) return;

    if (items.length === 0) {
        section.style.display = 'none';
        row.innerHTML = '';
    } else {
        section.style.display = 'block';
        row.innerHTML = '';
        items.forEach(item => {
            const card = createMylistCard(item, false);
            row.appendChild(card);
        });
        
        // スライダー（ホバー）イベント初期化
        if (typeof window.initializeHoverEvents === 'function') {
            window.initializeHoverEvents(row); 
        }
        
        // スライダーの矢印を初期化（handle.js の updateArrowVisibility があれば呼ぶ）
        if (typeof window.updateArrowVisibility === 'function') {
            setTimeout(() => window.updateArrowVisibility(row), 100);
        }
    }
}

// ※ ここにあった古い removeFavorite 関数は削除しました

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.mylist-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchMylistTab(e.target.getAttribute('data-filter'));
        });
    });
});

// 「すべて見る」ボタンから直接絞り込みタブへジャンプするための関数
window.switchMylistTab = function(filterValue) {
    document.querySelectorAll('.mylist-filter-btn').forEach(b => {
        if (b.getAttribute('data-filter') === filterValue) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });
    currentMylistFilter = filterValue;
    renderMyListGrid();
    
    // スクロールを一番上に戻す
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
};