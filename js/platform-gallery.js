/**
 * Platform Gallery Manager - トランジション（ロード画面）完全対応版
 */

const TMDB_KEY = 'b5a39d9121b776763dc664288c3db7f3';
const PLATFORM_IDS = {
    prime: [9, 119, 551, 430, 554, 622],
    netflix: [8],
    disneyplus: [337],
    hulu: [15, 356],
    unext: [84, 85, 178],
    appletv: [2, 350],
    local: [] 
};

const PLATFORM_NAMES = {
    prime: 'Prime Video',
    netflix: 'NETFLIX',
    disneyplus: 'Disney+',
    hulu: 'Hulu',
    unext: 'U-NEXT',
    appletv: 'Apple TV+',
    local: 'すべて'
};
const GENRE_MAP = {
    'Action': 'アクション', 'Adventure': 'アドベンチャー', 'Animation': 'アニメ',
    'Anime': 'アニメ', 'Comedy': 'コメディ', 'Crime': 'クライム',
    'Documentary': 'ドキュメンタリー', 'Drama': 'ドラマ', 'Family': 'ファミリー',
    'Fantasy': 'ファンタジー', 'History': '歴史', 'Horror': 'ホラー',
    'Music': '音楽', 'Mystery': 'ミステリー', 'Romance': 'ロマンス',
    'Science Fiction': 'SF', 'Sci-Fi': 'SF', 'TV Movie': 'テレビ映画',
    'Thriller': 'スリラー', 'War': '戦争', 'Western': '西部劇',
    'Action & Adventure': 'アクション&アドベンチャー',
    'Sci-Fi & Fantasy': 'SF&ファンタジー', 'Kids': 'キッズ'
};

let currentSortOrder = "DateCreated&SortOrder=Descending";
let currentPlatformId = "";
let platformCache = { all: [], scanned: false };
let currentGenre = 'All';
let currentActiveSourceId = '';
let lastGenreScrollPos = 0;

function updateVODUrl(sourceId, genre = 'All') {
    const params = new URLSearchParams(window.location.search);
    params.set('tab', sourceId);
    if (genre !== 'All') {
        params.set('genre', genre);
    } else {
        params.delete('genre');
    }
    const newUrl = `?${params.toString()}`;
    if (window.location.search !== newUrl) {
        history.pushState({ type: 'vod', tab: sourceId, genre: genre }, '', newUrl);
    }
}

window.closeGallery = function() {
    const galleryView = document.getElementById('gallery-view');
    if(galleryView) galleryView.style.display = 'none';
    
    document.body.removeAttribute('data-vod');
    document.body.removeAttribute('data-library');
    window.currentMediaType = '';
    const homeUrl = window.location.pathname;
    history.pushState({ type: '', tab: 'home' }, '', homeUrl);
    document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
    const homeBtn = document.getElementById('nav-home');
    if (homeBtn) homeBtn.classList.add('active');
    if (typeof reloadAllSections === 'function') {
        reloadAllSections();
    }
};

async function renderWithOverlay(actionCallback) {
    let overlay = document.getElementById('transition-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'transition-overlay';
        document.body.appendChild(overlay);
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background-color: #141414; z-index: 999999;
            display: none; justify-content: center; align-items: center;
            opacity: 0; transition: opacity 0.2s ease; pointer-events: none;
        `;
        overlay.innerHTML = `<div style="width: 50px; height: 50px; border: 4px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: spin 1s linear infinite;"></div>`;
    }

    overlay.style.display = 'flex';
    overlay.style.pointerEvents = 'all';
    void overlay.offsetWidth;
    overlay.style.opacity = '1';

    await new Promise(resolve => setTimeout(resolve, 200));

    try {
        await actionCallback();
        const galleryView = document.getElementById('gallery-view');
        if (galleryView && typeof waitForImagesToLoad === 'function') {
            await waitForImagesToLoad(galleryView);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    } finally {
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
        setTimeout(() => overlay.style.display = 'none', 200);
    }
}

// ==========================================
// VODを開く機能
// ==========================================
async function openGallery(sourceId, genre = 'All') {
    // 描画前に状態をセット
    document.body.setAttribute('data-vod', sourceId);
    document.body.removeAttribute('data-library');
    
    // ナビを即座に黒くする（ズレ防止）
    const navbar = document.getElementById('navbar');
    if (navbar) navbar.classList.add('nav-scrolled', 'nav-black');

    await renderWithOverlay(async () => {
        window.scrollTo(0, 0);
        lastGenreScrollPos = 0;
        currentGenre = genre;
        updateVODUrl(sourceId, genre);
        currentActiveSourceId = sourceId; 
        currentPlatformId = sourceId;

        const platformName = PLATFORM_NAMES[sourceId] || 'VOD';
        if (typeof updatePageTitle === 'function') {
            updatePageTitle(platformName);
        }
        
        const galleryView = document.getElementById('gallery-view');
        if(galleryView) galleryView.style.display = 'block';
        
        // showView('home-view') を呼ぶが、上記修正により data-vod は維持される
        showView('home-view');

        if (typeof updateNavUI === 'function') updateNavUI('');
        if (typeof window.setDynamicNavTitle === 'function') window.setDynamicNavTitle('');
        await scanAllItemsForPlatforms(sourceId);
    });
}

// ==========================================
// 独自ライブラリ（4khdrなど）を開く機能
// ==========================================
let currentLibraryItems = []; 
let currentLibraryName = "";

window.openDynamicLibrary = async function(libraryId, libraryName, genre = 'All') {

    document.body.removeAttribute('data-vod');
    document.body.setAttribute('data-library', libraryId);

    const navbar = document.getElementById('navbar');
    if (navbar) navbar.classList.add('nav-scrolled', 'nav-black');

    
    await renderWithOverlay(async () => {
        // ★ 修正：画面全体を消す処理を削除し、VODと同じ安全なCSS方式に変更
        if (!document.getElementById('library-mode-styles')) {
            const style = document.createElement('style');
            style.id = 'library-mode-styles';
            style.innerHTML = `
                body[data-library] #resume-section,
                body[data-library] .row-container {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);
        }
        
        window.scrollTo(0, 0);
        lastGenreScrollPos = 0;
        currentGenre = genre;
        currentActiveSourceId = libraryId;
        currentLibraryName = libraryName;
        updateVODUrl(libraryId, genre);

        if (typeof updatePageTitle === 'function') {
            updatePageTitle(libraryName);
        }

        const galleryView = document.getElementById('gallery-view');
        if(galleryView) galleryView.style.display = 'block';
        
        showView('home-view'); // 修正後の showView を使用

        if (typeof updateNavUI === 'function') updateNavUI('');
        if (typeof window.setDynamicNavTitle === 'function') window.setDynamicNavTitle(libraryName);

        const url = `${SERVER_URL}/Users/${userId}/Items?ParentId=${libraryId}&Recursive=true&IncludeItemTypes=Movie,Series,Video&Fields=ProviderIds,Genres,BackdropImageTags,Overview,ProductionYear,OfficialRating,RunTimeTicks,ImageTags,RemoteTrailers&SortBy=${currentSortOrder}`;
        
        try {
            const res = await fetch(url, { headers: { 'X-Emby-Token': token } });
            const data = await res.json();
            currentLibraryItems = data.Items || [];
        } catch (e) {
            currentLibraryItems = [];
        }
        renderGalleryInterface(currentActiveSourceId);
    });
};

window.refreshVODGallery = function() {
    if (document.body.hasAttribute('data-vod') || document.body.hasAttribute('data-library')) {
        renderGalleryInterface(currentActiveSourceId);
    }
};

async function scanAllItemsForPlatforms(activeSourceId) {
    const galleryView = document.getElementById('gallery-view');
    
    if (!platformCache.scanned) {
        const header = galleryView.querySelector('.gallery-header');
        galleryView.innerHTML = `<p style="color:white; text-align:center; padding:50px;">データを同期中...</p>`;
        if (header) galleryView.prepend(header);
        
        const url = `${SERVER_URL}/Users/${userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true&Fields=ProviderIds,Genres,BackdropImageTags,Overview,ProductionYear,OfficialRating,RunTimeTicks,ImageTags,RemoteTrailers&SortBy=${currentSortOrder}`;
        const res = await fetch(url, { headers: { 'X-Emby-Token': token } });
        const data = await res.json();
        const items = data.Items;

        let sharedCache = {};
        try {
            const cacheRes = await fetch('/api/vod-cache');
            if (cacheRes.ok) sharedCache = await cacheRes.json();
        } catch (e) {}

        const localCache = JSON.parse(localStorage.getItem('chidacinema_vod_cache_v5') || '{}');
        const mergedCache = { ...sharedCache, ...localCache };

        const results = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const tmdbId = item.ProviderIds?.Tmdb;
            if (mergedCache[item.Id]) {
                item.platforms = mergedCache[item.Id];
            } else if (tmdbId && String(tmdbId).length < 10) {
                item.platforms = await fetchTMDBProviders(tmdbId, item.Type === 'Series' ? 'tv' : 'movie');
                mergedCache[item.Id] = item.platforms;
                await new Promise(r => setTimeout(r, 100));
            } else {
                item.platforms = [];
            }
            results.push(item);
        }
        localStorage.setItem('chidacinema_vod_cache_v5', JSON.stringify(mergedCache));
        platformCache.all = results;
        platformCache.scanned = true;
    }

    renderGalleryInterface(activeSourceId);
}

function renderGalleryInterface(sourceId) {
    currentActiveSourceId = sourceId;
    const galleryView = document.getElementById('gallery-view');
    const isLibraryMode = document.body.hasAttribute('data-library');

    const header = galleryView.querySelector('.gallery-header');
    galleryView.innerHTML = ''; 
    
    // ★ 修正：ヘッダーが消えてしまった場合の救済措置
    if (header) {
        galleryView.appendChild(header);
        const titleElem = document.getElementById('gallery-title');
        if (titleElem) {
            titleElem.innerText = isLibraryMode ? currentLibraryName : (PLATFORM_NAMES[sourceId] || 'LIBRARY');
        }
    } else {
        const fallbackHeader = document.createElement('div');
        fallbackHeader.className = 'gallery-header';
        fallbackHeader.innerHTML = `
            <h2 id="gallery-title" style="color:white; margin: 20px 5%; font-size: 2rem;">
                ${isLibraryMode ? currentLibraryName : (PLATFORM_NAMES[sourceId] || 'LIBRARY')}
            </h2>
        `;
        galleryView.appendChild(fallbackHeader);
    }

    // ★ ここで「VOD」か「独自ライブラリ」かで箱に入れるデータを切り替える
    let sourceItems = [];
    if (isLibraryMode) {
        sourceItems = currentLibraryItems || [];
    } else {
        const targetIds = PLATFORM_IDS[sourceId] || [];
        sourceItems = platformCache.all.filter(item => {
            if (sourceId === 'local') return true; 
            return item.platforms.some(pid => targetIds.includes(Number(pid)));
        });
    }

    // ジャンル翻訳
    sourceItems.forEach(item => {
        if (item.Genres) {
            item.Genres = item.Genres.map(g => GENRE_MAP[g] || g);
            item.Genres = [...new Set(item.Genres)];
        }
    });

    // ジャンルで絞り込み
    const finalItems = currentGenre === 'All' 
        ? sourceItems 
        : sourceItems.filter(i => (i.Genres || []).includes(currentGenre));

    if (finalItems.length > 0) {
        const heroCandidates = finalItems.filter(i => i.BackdropImageTags && i.BackdropImageTags.length > 0);
        
        // ★追加：予告編(RemoteTrailers)を持っている作品を優先的に絞り込む
        const withTrailers = heroCandidates.filter(i => i.RemoteTrailers && i.RemoteTrailers.length > 0);
        // 予告編ありの作品があればそれらを使い、無ければ通常候補を使う
        const pool = withTrailers.length > 0 ? withTrailers : heroCandidates;

        const shuffled = pool.sort(() => 0.5 - Math.random());
        const selectedHeroes = shuffled.slice(0, 5);
        
        if (typeof window.updateHeroContent === 'function') {
            window.updateHeroContent(selectedHeroes.length > 0 ? selectedHeroes : [finalItems[0]]);
        }
    }

    galleryView.style.cssText = 'display: block; background: transparent; position: relative; z-index: 10;';

    // VODナビ（ライブラリモードでは表示しない）
    if (!isLibraryMode) {
        const navBar = document.createElement('div');
        navBar.className = 'vod-platform-nav';
        Object.keys(PLATFORM_NAMES).forEach(id => {
            const btn = document.createElement('button');
            btn.className = `platform-tab ${id === sourceId ? 'active' : ''}`;
            btn.innerText = PLATFORM_NAMES[id];
            btn.onclick = () => { openGallery(id); }; 
            navBar.appendChild(btn);
        });
        galleryView.appendChild(navBar);
    }

    const genresSet = new Set();
    sourceItems.forEach(i => (i.Genres || []).forEach(g => genresSet.add(g)));
    
    if (!document.getElementById('genre-nav-styles')) {
        const style = document.createElement('style');
        style.id = 'genre-nav-styles';
        style.innerHTML = `.vod-genre-nav::-webkit-scrollbar { display: none; }`;
        document.head.appendChild(style);
    }

    const genreWrapper = document.createElement('div');
    genreWrapper.className = 'vod-genre-wrapper';
    genreWrapper.style.cssText = `position: relative; display: flex; align-items: center; width: 100%; overflow: hidden;`;

    const genreNav = document.createElement('div');
    genreNav.className = 'vod-genre-nav';
    genreNav.style.cssText = `display: flex; gap: 15px; overflow-x: auto; padding: 10px 2.5%; scrollbar-width: none; -ms-overflow-style: none; scroll-behavior: smooth; width: 100%;`;
    
    const allBtn = document.createElement('button');
    allBtn.className = `genre-tab ${currentGenre === 'All' ? 'active' : ''}`;
    allBtn.innerText = 'すべて';
    allBtn.onclick = () => { 
        if (currentGenre !== 'All') {
            lastGenreScrollPos = genreNav.scrollLeft;
            currentGenre = 'All'; 
            updateVODUrl(sourceId, 'All'); 
            renderWithOverlay(async () => { renderGalleryInterface(sourceId); });
        }
    };
    genreNav.appendChild(allBtn);
    
    const sortedGenres = Array.from(genresSet).sort((a, b) => {
        const isAJap = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(a);
        const isBJap = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(b);
        if (isAJap && !isBJap) return -1;
        if (!isAJap && isBJap) return 1; 
        return a.localeCompare(b, 'ja');
    });
    
    sortedGenres.forEach(g => {
        const btn = document.createElement('button');
        btn.className = `genre-tab ${currentGenre === g ? 'active' : ''}`;
        btn.innerText = g;
        btn.onclick = () => { 
            if (currentGenre !== g) {
                lastGenreScrollPos = genreNav.scrollLeft;
                currentGenre = g; 
                updateVODUrl(sourceId, g); 
                renderWithOverlay(async () => { renderGalleryInterface(sourceId); });
            }
        };
        genreNav.appendChild(btn);
    });

    const createHandle = (direction) => {
        const btn = document.createElement('div');
        const isLeft = direction === 'left';
        btn.innerHTML = `<span class="material-symbols-outlined">arrow_${isLeft ? 'back' : 'forward'}_ios</span>`;
        btn.style.cssText = `
            position: absolute; top: 0; ${isLeft ? 'left: 0;' : 'right: 0;'} height: 100%; width: 5%; min-width: 50px;
            background: linear-gradient(to ${isLeft ? 'right' : 'left'}, rgba(15,15,15,1) 0%, rgba(15,15,15,0.7) 40%, transparent 100%);
            color: white; display: flex; align-items: center; justify-content: ${isLeft ? 'flex-start' : 'flex-end'};
            padding: 0 15px; cursor: pointer; z-index: 10; opacity: 0; visibility: hidden; transition: opacity 0.3s ease;
        `;
        const icon = btn.querySelector('span');
        if(icon) {
            icon.style.transition = 'transform 0.2s ease';
            icon.style.textShadow = '0 2px 4px rgba(0,0,0,0.8)';
            icon.style.fontSize = '28px';
        }
        btn.onmouseenter = () => { if(icon) icon.style.transform = 'scale(1.3)'; };
        btn.onmouseleave = () => { if(icon) icon.style.transform = 'scale(1)'; };
        return btn;
    };

    const leftHandle = createHandle('left');
    const rightHandle = createHandle('right');

    leftHandle.onclick = () => { genreNav.scrollBy({ left: -(genreNav.clientWidth * 0.9), behavior: 'smooth' }); };
    rightHandle.onclick = () => { genreNav.scrollBy({ left: genreNav.clientWidth * 0.9, behavior: 'smooth' }); };

    const updateHandles = () => {
        const scrollLeft = genreNav.scrollLeft;
        const maxScroll = genreNav.scrollWidth - genreNav.clientWidth;
        const isHovered = genreWrapper.matches(':hover');

        if (isHovered && scrollLeft > 0) {
            leftHandle.style.opacity = '1'; leftHandle.style.visibility = 'visible';
        } else {
            leftHandle.style.opacity = '0'; leftHandle.style.visibility = 'hidden';
        }

        if (isHovered && scrollLeft < maxScroll - 1) {
            rightHandle.style.opacity = '1'; rightHandle.style.visibility = 'visible';
        } else {
            rightHandle.style.opacity = '0'; rightHandle.style.visibility = 'hidden';
        }
    };

    genreNav.addEventListener('scroll', updateHandles);
    window.addEventListener('resize', updateHandles);
    genreWrapper.addEventListener('mouseenter', updateHandles);
    genreWrapper.addEventListener('mouseleave', updateHandles);

    genreWrapper.appendChild(leftHandle);
    genreWrapper.appendChild(genreNav);
    genreWrapper.appendChild(rightHandle);
    galleryView.appendChild(genreWrapper);
    genreNav.scrollTo({ left: lastGenreScrollPos, behavior: 'instant' });
    setTimeout(updateHandles, 100);

    const grid = document.createElement('div');
    grid.className = 'vod-grid';
    const isPosterModeNow = document.body.classList.contains('poster-mode');

    finalItems.forEach(item => {
        const card = document.createElement('div');
        const ratioClass = isPosterModeNow ? 'poster-card' : 'thumb-card';
        card.className = `gallery-item ${ratioClass}`; 
        card.dataset.id = item.Id;
        card.dataset.type = item.Type || 'Movie';

        const thumbTag = item.ImageTags?.Thumb || '';
        const primaryTag = item.ImageTags?.Primary || '';
        const backdropTag = item.BackdropImageTags?.[0] || '';
        const thumbUrl = `${SERVER_URL}/Items/${item.Id}/Images/Thumb?fillWidth=700&quality=100${thumbTag ? '&tag=' + thumbTag : ''}`;
        const posterUrl = `${SERVER_URL}/Items/${item.Id}/Images/Primary?fillWidth=1200&quality=100${primaryTag ? '&tag=' + primaryTag : ''}`;
        const backdropUrl = `${SERVER_URL}/Items/${item.Id}/Images/Backdrop?fillWidth=1200&quality=100${backdropTag ? '&tag=' + backdropTag : ''}`;
        const hasThumb = item.ImageTags && item.ImageTags.Thumb;
        const hasBackdrop = item.BackdropImageTags && item.BackdropImageTags.length > 0;
        let initialImg = hasThumb ? thumbUrl : (hasBackdrop ? backdropUrl : posterUrl);
        if (isPosterModeNow && primaryTag) initialImg = posterUrl;

        card.innerHTML = `<img src="${initialImg}" class="dynamic-img" data-thumb="${thumbUrl}" data-poster="${posterUrl}" loading="lazy">`;
        card.onclick = () => {
            if (typeof navigateToDetails === 'function') {
                navigateToDetails(item.Id);
            } else {
                playMedia(item.Id);
            }
        };
        grid.appendChild(card);
    });
    
    galleryView.appendChild(grid);
    if (typeof window.initializeHoverEvents === 'function') {
        window.initializeHoverEvents(grid); 
    }
}

async function fetchTMDBProviders(id, type) {
    try {
        const url = `https://api.themoviedb.org/3/${type}/${id}/watch/providers?api_key=${TMDB_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        const jp = data.results?.JP || {};
        const all = [...(jp.flatrate || []), ...(jp.rent || []), ...(jp.buy || []), ...(jp.free || []), ...(jp.ads || [])];
        return all.map(p => Number(p.provider_id));
    } catch (e) { return []; }
}

window.changeSortOrder = function() {
    const selector = document.getElementById('sort-selector');
    if (selector) {
        currentSortOrder = selector.value;
        
        if (document.body.hasAttribute('data-library')) {
            const libId = document.body.getAttribute('data-library');
            window.openDynamicLibrary(libId, currentLibraryName, currentGenre);
        } else if (currentPlatformId) {
            platformCache.scanned = false; 
            openGallery(currentPlatformId, currentGenre);
        }
    }
};