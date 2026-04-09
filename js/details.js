/**
 * 作品詳細ページへの遷移ロジック
 */

function navigateToDetails(itemId, source = 'local', mediaType = 'Movie', seasonId = null) {
    if (typeof window.setDynamicNavTitle === 'function') {
        window.setDynamicNavTitle(''); 
    }
    window.currentViewingSeriesId = itemId;
    if (typeof cleanupDetailsTrailer === 'function') cleanupDetailsTrailer();
    
    // 詳細ページのヒーローリセット
    const detailsHero = document.getElementById('details-hero-container');
    if (detailsHero) {
        detailsHero.style.setProperty('--bg-image', 'none');
        detailsHero.style.setProperty('--bg-image-next', 'none');
        detailsHero.classList.remove('bg-swap', 'is-playing-video');
    }

    // ホーム・ジャンル画面の非表示
    const homeHero = document.getElementById('hero-section');
    if (homeHero) homeHero.style.display = 'none';
    const genreView = document.getElementById('genre-view');
    if (genreView) genreView.style.display = 'none';

    document.body.removeAttribute('data-vod');
    document.body.removeAttribute('data-library');
    document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));

    // 🌟 URLパラメータの構築（URLSearchParamsを使うと確実です）
    const params = new URLSearchParams();
    params.set('id', itemId);
    params.set('source', source);
    params.set('type', mediaType);
    
    // seasonId が渡されている場合はURLに追加する
    if (seasonId) {
        params.set('seasonId', seasonId);
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`;

    // 🌟 履歴に保存するデータにも seasonId を含める
    history.pushState({ 
        view: 'details', 
        itemId: itemId, 
        source: source, 
        type: mediaType,
        seasonId: seasonId 
    }, '', newUrl);

    if (typeof showView === 'function') {
        showView('details-view');
    }

    // showDetails を呼び出し
    // showDetails 内部で URLSearchParams(window.location.search) を使って 
    // seasonId を取得するロジックがあるため、URLが正しければ復元されます。
    showDetails(itemId, source, mediaType);
}

window.addEventListener('popstate', (event) => {

    if (window.isReturningFromPlayer) {
        console.log("🛑 details.js の popstate を完全ブロックしました");
        return;
    }

    const settingsOverlay = document.getElementById('global-settings-overlay');
    if (window.isClosingSettings || (settingsOverlay && settingsOverlay.classList.contains('show'))) {
        console.log("⚙️ 設定画面から戻ったため details.js のリロードをブロックします。");
        return;
    }
    // 1. トレーラーやスライドショーの掃除（移動時に音が残らないように）
    if (typeof cleanupDetailsTrailer === 'function') cleanupDetailsTrailer();
    if (typeof stopBgCarousel === 'function') stopBgCarousel();

    // 2. URLからパラメータを取得（source, type を追加）
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get('id');
    const source = params.get('source') || 'local'; // 作品の出所
    const genre = params.get('genre');
    const genreSearchQuery = params.get('q');
    const type = params.get('type') || ''; // Movie か Series か

    // 3. 画面要素の取得
    const hero = document.getElementById('hero-section');
    const detailsView = document.getElementById('details-view');
    const genreView = document.getElementById('genre-view');
    const homeView = document.getElementById('home-view');

    // 4. 表示の切り分けロジック
    if (itemId) {
        // --- A. 詳細画面に戻る場合 ---
        if (hero) hero.style.display = 'none';
        if (genreView) genreView.style.display = 'none';
        if (homeView) homeView.style.display = 'none';

        if (typeof showView === 'function') showView('details-view');
        // ★引数を3つ正しく渡す
        if (typeof showDetails === 'function') showDetails(itemId, source, type);

    } else if (genre) {
        // --- B. ジャンル画面に戻る場合 ---
        if (hero) hero.style.display = 'none';
        if (detailsView) detailsView.style.display = 'none';
        if (homeView) homeView.style.display = 'none';

        if (typeof showView === 'function') showView('genre-view');
        if (typeof loadGenreItems === 'function') {
            loadGenreItems(genre, genreSearchQuery || genre, type);
        }

    } else {
        // --- C. ホーム画面に戻る場合 ---
        if (detailsView) detailsView.style.display = 'none';
        if (genreView) genreView.style.display = 'none';
        
        if (typeof showView === 'function') showView('home-view');

        if (typeof updatePageTitle === 'function') {
            // window.currentMediaType を使って元のタブ名を復元
            let returnTitle = 'ホーム';
            if (window.currentMediaType === 'Movie') returnTitle = '映画';
            else if (window.currentMediaType === 'Series') returnTitle = 'シリーズ';
            else if (window.currentMediaType === 'MyList') returnTitle = 'マイリスト';
            updatePageTitle(returnTitle);
        }
        
        // ヒーローセクションを復活させる
        if (hero && window.currentMediaType !== 'MyList') {
            hero.style.display = ''; 
        }
        if (typeof reloadAllSections === 'function') reloadAllSections();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get('id');
    const source = params.get('source') || 'local'; // 追加
    const genre = params.get('genre');
    const type = params.get('type') || '';
    const seasonId = params.get('seasonId');
    
    if (itemId) {
        navigateToDetails(itemId, source, type, seasonId); // 全ての引数を渡す
    } else if (genre) {
        showView('genre-view');
        const genreSearchQuery = params.get('q');
        loadGenreItems(genre, genreSearchQuery || genre, type);
    }
});

// スクロール時にタブをアクティブにする関数
function setupScrollSpy() {
    const scrollHandler = () => {
        const sections = document.querySelectorAll('#details-view .section-block');
        const navLinks = document.querySelectorAll('#details-view .tab-button');
        if(!sections.length) return;
        
        let current = "";
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            if (window.pageYOffset >= sectionTop - 150) {
                current = section.getAttribute('id');
            }
        });
        if (current === "") {
            current = sections[0].getAttribute('id');
        }

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('onclick') && link.getAttribute('onclick').includes(current)) {
                link.classList.add('active');
            }
        });
    };
    scrollHandler();
    // 既存のイベントを消してから追加
    window.removeEventListener('scroll', scrollHandler);
    window.addEventListener('scroll', scrollHandler);
}


function setupStickyTabs() {
    const sentinel = document.getElementById('tabs-sentinel');
    const originalTabs = document.querySelector('.tabs-header');
    if (!sentinel || !originalTabs) return;

    // 1. 古いクローンがあれば削除（ページ遷移時の重複防止）
    const oldClone = document.querySelector('.tabs-header-clone');
    if (oldClone) oldClone.remove();

    // 2. Prime Videoと同じ「合体専用」の要素(btf-sticky-nav)をクローンして裏で生成
    const cloneTabs = originalTabs.cloneNode(true);
    cloneTabs.classList.add('tabs-header-clone'); // 専用クラスを付与
    originalTabs.parentNode.insertBefore(cloneTabs, originalTabs.nextSibling);

    if (window.tabsObserver) window.tabsObserver.disconnect();

    // 3. 判定ロジック
    window.tabsObserver = new IntersectionObserver((entries) => {
        const entry = entries[0];
        
        // 要素が画面外に出た（isIntersecting が false）かつ、
        // Y座標が 71px（ナビバー部分）より上にはみ出した場合にのみ固定タブを表示させる。
        // これにより、画面下方に隠れている初期状態での誤作動を防ぐ。
        if (!entry.isIntersecting && entry.boundingClientRect.y <= 75) {
            cloneTabs.classList.add('is-visible');
            document.body.classList.add('header-merged');
        } else {
            cloneTabs.classList.remove('is-visible');
            document.body.classList.remove('header-merged');
        }
    }, {
        rootMargin: '-71px 0px 0px 0px', // ナビバーの高さ(70px) + 1px
        threshold: [0, 1] // より確実に判定するために閾値を追加
    });

    window.tabsObserver.observe(sentinel);
}

// クリックでスクロールする関数（グローバルに配置）
window.scrollToSection = function(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        // ナビバー(70px) + タブヘッダー(64px) + 少しの余白(10px) = 144px分だけ上にずらしてスクロール
        const offset = 144;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;
        
        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }
}

/**
 * 詳細画面の描画メイン
 * @param {string} itemId - ID
 * @param {string} source - 'local' または 'tmdb'
 * @param {string} mediaType - 'Movie' または 'Series'
 */
async function showDetails(itemId, source = 'local', mediaType = 'Movie') {
    if (window.isReturningFromPlayer) {
        console.log("🛑 爆速モード: showDetails の再描写とロード画面をブロックしました");
        return; 
    }

    const detailContent = document.getElementById('details-content') || document.getElementById('details-view');
    const loadingOverlay = document.getElementById('loading-overlay');

    if (source === 'tmdb') {
        const tmdbType = (mediaType.toLowerCase() === 'series' || mediaType.toLowerCase() === 'tv') ? 'tv' : 'movie';
        showRemoteDetails(itemId, tmdbType);
        return; 
    }

    // 1. 初期化
    stopBgCarousel(); 
    if (detailContent) detailContent.innerHTML = ''; 
    
    let progressHtml = ''; // 🌟 冒頭で確実に初期化
    const currentServer = typeof SERVER_URL !== 'undefined' ? SERVER_URL : localStorage.getItem('serverUrl');
    const currentUserId = typeof userId !== 'undefined' ? userId : localStorage.getItem('userId');
    const currentToken = typeof token !== 'undefined' ? token : localStorage.getItem('token');

    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        loadingOverlay.style.opacity = '1';
    }

    if (!detailContent) return;

    try {
        const url = `${currentServer}/Users/${currentUserId}/Items/${itemId}?Fields=Overview,ProductionYear,OfficialRating,Genres,RemoteTrailers,UserData,People,Tags,Studios,BackdropImageTags,MediaSources,MediaStreams`;
        const res = await fetch(url, { headers: { 'X-Emby-Token': currentToken } });
        const item = await res.json();

        let displayTitle = item.Name;
        if (item.Type === 'Episode' && item.SeriesName) {
            displayTitle = `${item.SeriesName} | ${item.Name}`; // 🌟変更：ここも「|」に統一
        }
        if (typeof updatePageTitle === 'function') {
            updatePageTitle(displayTitle);
        }

        currentBackdropTags = item.BackdropImageTags || []; 
        currentItemIdForBg = itemId;

        let isSeries = item.Type === 'Series';
        let isEpisode = item.Type === 'Episode'; // ★追加
        let seasonsHtml = '';
        let initialSeasonId = '';
        let playButtonText = '今すぐ観る'; 
        let episodeSiblingsHtml = ''; // ★追加

        if (isSeries) {
            // シリーズ情報の取得
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const urlSeasonId = urlParams.get('seasonId');
                const seasonsUrl = `${currentServer}/Shows/${item.Id}/Seasons?userId=${currentUserId}`;
                const seasonsRes = await fetch(seasonsUrl, { headers: { 'X-Emby-Token': currentToken } });
                const seasonsData = await seasonsRes.json();
                const seasons = seasonsData.Items || [];

                if (seasons.length > 0) {
                    const targetSeason = seasons.find(s => s.Id === urlSeasonId) || seasons[0];
                    initialSeasonId = targetSeason.Id;
                    
                    if (seasons.length === 1) {
                        seasonsHtml = `<div class="season-selector-wrapper"><span class="season-single-label">${seasons[0].Name}</span></div>`;
                    } else {
                        const selectedSeasonName = seasons.find(s => s.Id === initialSeasonId)?.Name || seasons[0].Name;
                        let optionsHtml = seasons.map(s => `
                            <li class="custom-dropdown-item ${s.Id === initialSeasonId ? 'selected' : ''}" 
                                onclick="selectCustomSeason('${item.Id}', '${s.Id}', '${s.Name}')">
                                ${s.Name}
                            </li>
                        `).join('');

                        seasonsHtml = `
                            <div class="season-selector-wrapper" id="season-wrapper">
                                <div class="season-overlay" onclick="closeCustomDropdown()"></div>
                                <div class="custom-select-container">
                                    <div class="season-dropdown custom-select-trigger" onclick="toggleCustomDropdown()">
                                        <span id="custom-season-label">${selectedSeasonName}</span>
                                        <span class="material-symbols-outlined" style="pointer-events:none;">expand_more</span>
                                    </div>
                                    <ul class="custom-select-list">${optionsHtml}</ul>
                                </div>
                            </div>
                        `;
                    }
                }
            } catch (e) { console.error("シーズン情報の取得に失敗:", e); }
        } else {
            // 映画の進捗確認
            const isResuming = item.UserData && item.UserData.PlaybackPositionTicks > 0;
            playButtonText = isResuming ? '続きから観る' : '今すぐ観る';

            if (isResuming && item.RunTimeTicks > 0) {
                const percent = (item.UserData.PlaybackPositionTicks / item.RunTimeTicks) * 100;
                progressHtml = `
                    <div class="details-resume-bar-root">
                        <div class="details-resume-bar-track">
                            <div class="details-resume-bar-fill" style="width: ${percent}%;"></div>
                        </div>
                    </div>
                `;
            }
        }

        // スタッフ情報の抽出
        const directors = (item.People || []).filter(p => p.Type === 'Director').map(p => p.Name).slice(0, 2);
        let tagsHtml = '';
        if (item.Genres && item.Genres.length > 0) {
            tagsHtml += `<div class="tag-group"><span class="tag-label">ジャンル</span><div class="tags-wrapper">`;
            item.Genres.slice(0, 4).forEach(g => tagsHtml += `<span class="detail-tag" onclick="navigateToGenre('${g}')" style="cursor: pointer;">${g}</span>`);
            tagsHtml += `</div></div>`;
        }

        let backdropUrl = '';
        let backdropUrlNext = '';
        const backdropTags = item.BackdropImageTags || [];

        if (isEpisode && item.ImageTags && item.ImageTags.Primary) {
            // エピソードの場合は自身のPrimary画像を背景として使用する
            backdropUrl = `${currentServer}/Items/${item.Id}/Images/Primary?quality=100`;
            // スライダー自体の生成HTMLを作る（あらすじなどのTabの上に挿入）
            let seasonNum = item.ParentIndexNumber || 1;
            episodeSiblingsHtml = `
                <div class="row-container episode-slider-wrapper">
                    <h3 style="margin-bottom: 8px; color: white; font-size: 1.25rem; font-weight: bold;">もっと詳しく シーズン${seasonNum}</h3>
                    <div class="slider-wrapper">
                        <button class="handle handle-left" onclick="scrollRow(this, -1)">
                            <span class="material-symbols-outlined">chevron_left</span>
                        </button>
                        <div id="episode-siblings-grid" class="movie-row resume-grid" data-current-x="0"></div>
                        <button class="handle handle-right" onclick="scrollRow(this, 1)">
                            <span class="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>
                </div>
            `;
        } else {
            backdropUrl = backdropTags.length > 0 ? `${currentServer}/Items/${item.Id}/Images/Backdrop/0?tag=${backdropTags[0]}&quality=100` : '';
            backdropUrlNext = backdropTags.length > 1 ? `${currentServer}/Items/${item.Id}/Images/Backdrop/1?tag=${backdropTags[1]}&quality=100` : '';
        }

        const titleHtml = item.ImageTags && item.ImageTags.Logo 
            ? `<img class="details-logo" src="${currentServer}/Items/${item.Id}/Images/Logo">`
            : `<h1 class="details-title-fallback">${item.Name}</h1>`;

        // 音声・字幕言語の抽出
        let mediaStreams = item.MediaStreams || [];
        if (isSeries) {
            try {
                // シリーズの場合は第1話を取得して言語判定の参考にする
                const firstEpUrl = `${currentServer}/Shows/${item.Id}/Episodes?userId=${currentUserId}&Limit=1&Fields=MediaStreams`;
                const firstEpRes = await fetch(firstEpUrl, { headers: { 'X-Emby-Token': currentToken } });
                const firstEpData = await firstEpRes.json();
                if (firstEpData.Items && firstEpData.Items.length > 0) {
                    mediaStreams = firstEpData.Items[0].MediaStreams || [];
                }
            } catch (e) {
                console.error("第一話の言語情報取得に失敗:", e);
            }
        }

        let audioLangs = new Set();
        let subLangs = new Set();
        if (mediaStreams) {
            mediaStreams.forEach(stream => {
                if (stream.Type === 'Audio' && stream.Language && stream.Language !== 'und') {
                    audioLangs.add(stream.Language.toLowerCase());
                } else if (stream.Type === 'Subtitle' && stream.Language && stream.Language !== 'und') {
                    subLangs.add(stream.Language.toLowerCase());
                }
            });
        }

        const langMap = { 'ja': '日本語', 'jpn': '日本語', 'en': '英語', 'eng': '英語', 'ko': '韓国語', 'kor': '韓国語', 'zh': '中国語', 'chi': '中国語', 'zho': '中国語', 'fr': 'フランス語', 'fre': 'フランス語', 'fra': 'フランス語' };
        const formatLang = (l) => langMap[l] || l.toUpperCase();

        let audioHtml = audioLangs.size > 0 ? Array.from(audioLangs).map(formatLang).join(', ') : '情報なし';
        let subHtml = subLangs.size > 0 ? Array.from(subLangs).map(formatLang).join(', ') : '情報なし';

        let languagesHtml = `
            <div class="details-languages" style="margin-top: 30px;">
                <h3 class="details-heading">音声 / 字幕言語</h3>
                <div style="margin-bottom: 6px;"><strong style="color: #bcbcbc; margin-right: 8px;">音声:</strong> ${audioHtml}</div>
                <div><strong style="color: #bcbcbc; margin-right: 8px;">字幕:</strong> ${subHtml}</div>
            </div>
        `;

        // キャスト
        const castHtml = (item.People || []).filter(p => p.Type === 'Actor').slice(0, 12).map(actor => {
            const imgUrl = actor.PrimaryImageTag ? `${currentServer}/Items/${actor.Id}/Images/Primary?tag=${actor.PrimaryImageTag}&width=150&quality=90` : '';
            return `<div class="cast-card">${imgUrl ? `<img src="${imgUrl}" class="cast-photo">` : ''}<div class="cast-name">${actor.Name}</div><div class="cast-role">${actor.Role || ''}</div></div>`;
        }).join('') || '<p>キャスト情報なし</p>';

        // --- 描画実行 ---
        detailContent.innerHTML = `
            <div class="details-hero ${isSeries ? 'is-series' : ''}" id="details-hero-container" style="--bg-image: url('${backdropUrl}'); ${backdropUrlNext ? `--bg-image-next: url('${backdropUrlNext}');` : ''}">
                <div id="details-trailer-container"></div>
                <div class="hero-gradient-idle-layer"></div>
                <button id="details-mute-toggle" class="details-mute-btn" onclick="toggleDetailsMute()"><span class="material-symbols-outlined">volume_off</span></button>
                <div class="info-col-main">
                    ${titleHtml}
                    <div class="details-sub-actions">
                        ${item.RemoteTrailers && item.RemoteTrailers.length > 0 ? `<button class="details-sub-btn" onclick="window.open('${item.RemoteTrailers[0].Url}', '_blank')"><span class="material-symbols-outlined">movie</span><span>予告編</span></button>` : ''}
                    </div>
                    ${progressHtml}
                    <div class="details-actions-row">
                        <button class="details-btn details-play-btn" onclick="startPlayback('${item.Id}')">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="currentColor" d="M8 17.175V6.825q0-.425.3-.713t.7-.287q.125 0 .263.037t.262.113l8.15 5.175q.225.15.338.375t.112.475t-.112.475t-.338.375l-8.15 5.175q-.125.075-.262.113T9 18.175q-.4 0-.7-.288t-.3-.712"/></svg>
                            ${playButtonText}
                        </button>
                        <button class="details-btn details-main-fav-btn ${item.UserData && item.UserData.IsFavorite ? 'is-favorite' : ''}" onclick="toggleFavorite('${item.Id}', this)">
                            <span class="material-symbols-outlined">${item.UserData && item.UserData.IsFavorite ? 'check' : 'add'}</span>
                        </button>
                    </div>
                    <div class="details-tags-container">${tagsHtml}</div>
                </div>
                <div class="info-col-synopsis" onclick="toggleSynopsis(this)"><p class="hero-overview">${item.Overview || ''}</p></div>
                ${seasonsHtml}
            </div>
            ${episodeSiblingsHtml} <!-- エピソード用の同シーズンスライダー -->
            <div id="tabs-sentinel"></div>
            <div class="tabs-header">
                ${isSeries ? `<button class="tab-button active" onclick="scrollToSection('episodes-section')">エピソード</button>` : ''}
                <button class="tab-button ${!isSeries ? 'active' : ''}" onclick="scrollToSection('related-section')">関連コンテンツ</button>
                <button class="tab-button" onclick="scrollToSection('details-section')">詳細</button>
            </div>
            <div class="content-sections">
                ${isSeries ? `<div id="episodes-section" class="section-block"><h2 class="section-title">エピソード</h2><div id="episodes-list-container"></div></div>` : ''}
                <div id="related-section" class="section-block">
                    <h2 class="section-title">関連コンテンツ</h2>
                    <div class="slider-wrapper">
                        <button class="handle handle-left" onclick="scrollRow(this, -1)">
                            <span class="material-symbols-outlined">chevron_left</span>
                        </button>
                        <div class="movie-row resume-grid" id="similar-items-grid" data-current-x="0"></div>
                        <button class="handle handle-right" onclick="scrollRow(this, 1)">
                            <span class="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>
                </div>
                <div id="details-section" class="section-block">
                    <div class="details-extended-layout">
                        <div class="details-info-column">
                            <h3 class="details-heading">あらすじ</h3>
                            <p class="hero-overview">${item.Overview || ''}</p>
                            ${languagesHtml}
                        </div>
                        <div class="details-cast-column"><h3 class="details-heading">キャスト</h3><div class="cast-grid">${castHtml}</div></div>
                    </div>
                </div>
            </div>
        `;

        // 🌟 重要：ブラウザの描画完了を待ってから子要素を操作する
        requestAnimationFrame(() => {
            setupScrollSpy();
            setupStickyTabs();
            
            // 要素が存在するか確認してから関数を呼ぶ
            if (document.getElementById('similar-items-grid')) {
                loadSimilarItems(itemId, currentServer, currentUserId, currentToken);
            }
            
            if (item.RemoteTrailers && item.RemoteTrailers.length > 0) {
                setupDetailsTrailer(item.RemoteTrailers[0].Url);
            }
            
            startBgCarousel(itemId, backdropTags);
            
            if (isSeries && initialSeasonId && document.getElementById('episodes-list-container')) {
                loadEpisodes(item.Id, initialSeasonId, currentServer, currentUserId, currentToken);
            }
            
            // エピソードの場合、同シーズンの全エピソードを取得してスライダーに注入
            if (isEpisode && item.SeasonId && item.SeriesId && document.getElementById('episode-siblings-grid')) {
                loadSeasonEpisodesSlider(item.SeriesId, item.SeasonId, item.Id, currentServer, currentUserId, currentToken);
            }
        });

    } catch (err) {
        console.error('詳細情報の取得に失敗しました:', err);
        detailContent.innerHTML = '<p style="color:white; padding:100px;">情報の取得に失敗しました。</p>';
    } finally {
        if (loadingOverlay) {
            loadingOverlay.style.opacity = '0';
            setTimeout(() => { loadingOverlay.style.display = 'none'; }, 300);
        }
    }
}




async function loadSimilarItems(itemId, serverUrl, userId, token) {
    try {
        const url = `${serverUrl}/Items/${itemId}/Similar?userId=${userId}&limit=12&Fields=ImageTags,BackdropImageTags,ProductionYear,UserData,Genres,Overview,CommunityRating,OfficialRating`;
        const res = await fetch(url, { headers: { 'X-Emby-Token': token } });
        const data = await res.json();
        const grid = document.getElementById('similar-items-grid');
        
        if (data.Items && data.Items.length > 0) {
            grid.innerHTML = data.Items.map(item => {
                // 画像URLの取得
                let thumbType = 'Primary';
                if (item.ImageTags && item.ImageTags.Thumb) thumbType = 'Thumb';
                else if (item.BackdropImageTags?.length > 0) thumbType = 'Backdrop';
                
                const thumbUrl = `${serverUrl}/Items/${item.Id}/Images/${thumbType}?fillWidth=800&quality=90`;
                const primaryUrl = `${serverUrl}/Items/${item.Id}/Images/Primary?fillWidth=500&quality=90`;
                const backdropUrl = `${serverUrl}/Items/${item.Id}/Images/Backdrop/0?fillWidth=500&quality=80`;
                
                const isPoster = localStorage.getItem('view_mode') === 'poster';
                const defaultImg = isPoster ? primaryUrl : thumbUrl;
                const releaseYear = item.ProductionYear ? `<div class="poster-year">${item.ProductionYear}年</div>` : "";

                // ★修正：ホーム画面と一言一句同じHTML構造で出力！これで全機能が使い回せます
                return `
                    <div class="poster-card" onclick="navigateToDetails('${item.Id}')" data-id="${item.Id}" data-type="${item.Type || 'Movie'}">
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
                    </div>
                `;
            }).join('');

            grid.dataset.currentX = 0;
            grid.style.transform = "translateX(0px)";

            // ★修正：出力したカードをhover-card.jsに渡し、詳細パネルを自動生成させる
            if (window.enhanceCard) {
                grid.querySelectorAll('.poster-card').forEach(card => {
                    window.enhanceCard(card);
                });
            }

            if (typeof updateArrowVisibility === 'function') {
                setTimeout(() => updateArrowVisibility(grid), 150);
            }
        } else {
            grid.innerHTML = '<p style="color:#666;">関連コンテンツはありません。</p>';
        }
    } catch (e) {
        console.error('関連コンテンツ取得失敗:', e);
    }
}

// 🌟 エピソード専用：同じシーズンのエピソードを横スライダー形式で出力する関数
async function loadSeasonEpisodesSlider(seriesId, seasonId, currentEpisodeId, serverUrl, userId, token) {
    try {
        const grid = document.getElementById('episode-siblings-grid');
        if (!grid) return;
        
        const url = `${serverUrl}/Shows/${seriesId}/Episodes?seasonId=${seasonId}&userId=${userId}&Fields=Overview,ItemCounts,PrimaryImageAspectRatio`;
        const res = await fetch(url, { headers: { 'X-Emby-Token': token } });
        const data = await res.json();
        
        if (data.Items && data.Items.length > 0) {
            grid.innerHTML = data.Items.map(ep => {
                const imgUrl = `${serverUrl}/Items/${ep.Id}/Images/Primary?fillWidth=500&quality=90`;
                
                // 再生進捗の取得
                const userData = ep.UserData || {};
                const isPlayed = userData.Played;
                const ticks = userData.PlaybackPositionTicks || 0;
                const runTime = ep.RunTimeTicks || 0;
                let progressHtml = '';
                if (!isPlayed && ticks > 0 && runTime > 0) {
                    const pct = (ticks / runTime) * 100;
                    progressHtml = `
                        <div class="resume-bar-root">
                            <div class="resume-bar-track">
                                <div class="resume-bar-fill" style="width:${pct}%;"></div>
                            </div>
                        </div>`;
                } else if (isPlayed) {
                     progressHtml = `
                        <div class="resume-bar-root">
                            <div class="resume-bar-track">
                                <div class="resume-bar-fill" style="width:100%; background-color: var(--primary-accent);"></div>
                            </div>
                        </div>`;
                }

                const isActive = ep.Id === currentEpisodeId; // 現在開いているエピソードかどうか
                // isPosterModeによらず、エピソードは横長画像で出力する
                return `
                    <div class="poster-card ${isActive ? 'active-episode' : ''}" onclick="navigateToDetails('${ep.Id}')" data-id="${ep.Id}" data-type="Episode" style="${isActive ? 'border: 2px solid white; border-radius:10px;' : ''}">
                        <div class="thumb-wrapper" style="aspect-ratio: 16/9;">
                            <img class="resume-thumb dynamic-img" 
                                 src="${imgUrl}" 
                                 data-thumb="${imgUrl}"
                                 data-poster="${imgUrl}"
                                 alt="${ep.Name}" loading="lazy" style="object-fit: cover; width: 100%; height: 100%;">
                            ${progressHtml}
                        </div>
                        <div class="resume-title" style="margin-top: 8px; font-weight: bold;">${ep.IndexNumber ? ep.IndexNumber + '.' : ''} ${ep.Name}</div>
                        <!-- ポスターモード時のポップアップ用隠しデータ -->
                         <div class="poster-info-panel">
                            <div class="poster-title">${ep.IndexNumber ? ep.IndexNumber + '.' : ''} ${ep.Name}</div>
                        </div>
                    </div>
                `;
            }).join('');

            // ホバーカードイベント登録
            if (window.enhanceCard) {
                grid.querySelectorAll('.poster-card').forEach(card => window.enhanceCard(card));
            }
            if (typeof updateArrowVisibility === 'function') {
                setTimeout(() => updateArrowVisibility(grid), 150);
            }
            
            // 現在見ているエピソードまで少しスクロールさせる
            setTimeout(() => {
                const activeCard = grid.querySelector('.active-episode');
                if (activeCard) {
                    const targetLeft = activeCard.offsetLeft;
                    grid.style.transform = `translateX(-${Math.max(0, targetLeft - 50)}px)`;
                    grid.dataset.currentX = -Math.max(0, targetLeft - 50);
                    
                    // スクロール位置が変わるため、矢印の表示有無を再評価する
                    if (typeof updateArrowVisibility === 'function') {
                        updateArrowVisibility(grid);
                    }
                }
            }, 300);
        }
    } catch (e) {
        console.error('同じシーズンのエピソード取得失敗:', e);
    }
}


function navigateBack() {
    cleanupDetailsTrailer();
    if (window.history.length > 1) {
        history.back();
    } else {
        history.pushState({ view: 'home' }, '', window.location.pathname);
        const hero = document.getElementById('hero-section');
        if (hero) hero.style.display = 'block';
        
        // ★追加：ホームへ強制的に戻る場合もジャンル画面を隠す
        const genreView = document.getElementById('genre-view');
        if (genreView) genreView.style.display = 'none';
        
        showView('home-view');
    }
}

let detailsTrailerTimer = null;
let detailsPlayer = null; // ★詳細ページ用のプレーヤーを保持
let detailsIdleTimer = null; // ★追加：アイドル検知タイマー
let isDetailsIdle = false;
function startDetailsIdleDetection() {
    // 既存のイベントを消してから追加
    document.removeEventListener('mousemove', resetDetailsIdleTimer);
    document.removeEventListener('mousedown', resetDetailsIdleTimer);
    document.removeEventListener('scroll', resetDetailsIdleTimer, true);
    document.removeEventListener('keydown', resetDetailsIdleTimer);
    
    // イベントリスナーを登録
    document.addEventListener('mousemove', resetDetailsIdleTimer);
    document.addEventListener('mousedown', resetDetailsIdleTimer);
    document.addEventListener('scroll', resetDetailsIdleTimer, true); // キャプチャリングフェーズで検知
    document.addEventListener('keydown', resetDetailsIdleTimer);
    
    // タイマーを開始
    resetDetailsIdleTimer();
}

/**
 * アイドルタイマーをリセットし、コンテンツを表示する (追加)
 */
function resetDetailsIdleTimer() {
    clearTimeout(detailsIdleTimer);
    const detailsView = document.getElementById('details-view');
    const cloneTabs = document.querySelector('.tabs-header-clone'); // ★追加
    
    // アイドル状態を解除（コンテンツを表示）
    if (isDetailsIdle) {
        if (detailsView) detailsView.classList.remove('is-video-idle');
        isDetailsIdle = false;
        document.body.style.cursor = 'default';
        
        // ★追加：復帰した時にスクロール位置に応じてクローンを再判定
        if (cloneTabs && typeof setupStickyTabs === 'function') {
            // スクロール位置が sentinel より下なら再表示されるようになります
        }
    }
    
    // 動画が再生中の場合のみ、タイマーを再設定
    if (detailsPlayer && detailsPlayer.getPlayerState && detailsPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
        detailsIdleTimer = setTimeout(() => {
            if (detailsView) {
                detailsView.classList.add('is-video-idle');
                isDetailsIdle = true;
                
                // ★追加：アイドル突入時にクローンの表示クラスを直接消す
                if (cloneTabs) cloneTabs.classList.remove('is-visible');
                
                document.body.style.cursor = 'none';
            }
        }, 5000); 
    }
}
let currentBackdropTags = [];
let currentItemIdForBg = "";

/**
 * 背景スライドショーを開始する関数 (リファクタリング)
 */
function startBgCarousel(itemId, tags) {
    if (!tags || tags.length <= 1) return;
    
    // 既存のタイマーをクリア
    stopBgCarousel();
    
    currentBackdropTags = tags;
    currentItemIdForBg = itemId;

    let bgIndex = 0;
    console.log(`[Debug] スライドショー開始: ${tags.length}枚`);

    window.detailsBgInterval = setInterval(() => {
        bgIndex = (bgIndex + 1) % currentBackdropTags.length;
        const currentTag = currentBackdropTags[bgIndex];
        const currentServer = typeof SERVER_URL !== 'undefined' ? SERVER_URL : localStorage.getItem('serverUrl');
        const nextUrl = `${currentServer}/Items/${currentItemIdForBg}/Images/Backdrop/${bgIndex}?tag=${currentTag}&quality=100`;
        
        const hero = document.getElementById('details-hero-container');
        if (hero) {
            console.log(`[Debug] 背景切り替え: Index ${bgIndex}`);
            
            // ★現在どちらの画像が表示されているか判定し、隠れている方のURLを書き換えてフェードさせる
            if (hero.classList.contains('bg-swap')) {
                // レイヤー2が見えているので、レイヤー1を書き換えてクラスを外す
                hero.style.setProperty('--bg-image', `url('${nextUrl}')`);
                hero.classList.remove('bg-swap');
            } else {
                // レイヤー1が見えているので、レイヤー2を書き換えてクラスを付ける
                hero.style.setProperty('--bg-image-next', `url('${nextUrl}')`);
                hero.classList.add('bg-swap');
            }
        }
    }, 8000);
}

/**
 * 背景スライドショーを停止する関数
 */
function stopBgCarousel() {
    if (window.detailsBgInterval) {
        clearInterval(window.detailsBgInterval);
        window.detailsBgInterval = null;
        console.log("[Debug] スライドショーを停止しました");
    }
}
/**
 * 詳細ページの予告編再生セットアップ (API監視方式)
 */
function setupDetailsTrailer(trailerUrl) {
    if (detailsTrailerTimer) clearTimeout(detailsTrailerTimer);
    cleanupDetailsTrailer(); // 既存のプレーヤーがあれば破棄
    
    const detailsView = document.getElementById('details-view');
    // クラスをリセット
    if (detailsView) detailsView.classList.remove('is-video-idle');

    detailsTrailerTimer = setTimeout(() => {
        const container = document.getElementById('details-trailer-container');
        const hero = document.getElementById('details-hero-container');
        if (!container || !hero) return;

        let videoId = "";
        const ytMatch = trailerUrl.match(/(?:v=|be\/)([^#&?]*)/);
        if (ytMatch) videoId = ytMatch[1];

        if (videoId) {
            container.style.opacity = '0';
            container.style.transition = 'opacity 0.8s ease';
            container.innerHTML = '<div id="details-player-target"></div>';

            detailsPlayer = new YT.Player('details-player-target', {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: {
                    autoplay: 1,
                    mute: 1,
                    controls: 0,
                    modestbranding: 1,
                    
                    /* ★修正：loop を 0 にし、playlist の行を削除します */
                    loop: 0, 
                    
                    rel: 0,
                    enablejsapi: 1,
                    origin: window.location.origin
                },
                events: {
                    onReady: (event) => {
                        event.target.playVideo();
                    },
                    onStateChange: (event) => {
                        if (event.data === YT.PlayerState.PLAYING) {
                            container.style.opacity = '1';
                            hero.classList.add('is-playing-video');
                            
                            // ★再生が始まったのでアイドル検知を開始
                            startDetailsIdleDetection();
                            stopBgCarousel();
                        } else if (event.data === YT.PlayerState.ENDED) {
                            container.classList.add('is-hidden'); // CSSで透明化
                            container.style.opacity = '0'; // 念のためインラインでも透明化
                            hero.classList.remove('is-playing-video'); // 背景を明るく戻す
                            resetDetailsIdleTimer(); // アイドル状態を解除し、UIを再表示させる
                            startBgCarousel(currentItemIdForBg, currentBackdropTags);
                        // ★★★ ここまで追加 ★★★

                        } else {
                            // 一時停止など、再生中以外はアイドル状態を解除してコンテンツを表示
                            resetDetailsIdleTimer(); 
                        }
                    }
                }
            });
        }
    }, 5000);
}
function toggleDetailsMute() {
    if (!detailsPlayer || typeof detailsPlayer.isMuted !== 'function') return;

    const btn = document.getElementById('details-mute-toggle');
    const icon = btn ? btn.querySelector('.material-symbols-outlined') : null;

    if (detailsPlayer.isMuted()) {
        detailsPlayer.unMute();
        if (icon) icon.innerText = 'volume_up';
        btn.classList.add('is-unmuted');
    } else {
        detailsPlayer.mute();
        if (icon) icon.innerText = 'volume_off';
        btn.classList.remove('is-unmuted');
    }
}

/**
 * クリーンアップ処理の強化
 */
function cleanupDetailsTrailer() {
    // 予告編タイマーとプレーヤーの破棄
    if (detailsTrailerTimer) clearTimeout(detailsTrailerTimer);
    if (detailsPlayer) {
        if (typeof detailsPlayer.destroy === 'function') detailsPlayer.destroy();
        detailsPlayer = null;
    }

    const muteBtn = document.getElementById('details-mute-toggle');
    if (muteBtn) {
        const icon = muteBtn.querySelector('.material-symbols-outlined');
        if (icon) icon.innerText = 'volume_off';
        muteBtn.classList.remove('is-unmuted');
    }
    
    // アイドル検知タイマーをクリア
    if (detailsIdleTimer) clearTimeout(detailsIdleTimer);
    isDetailsIdle = false;

    // ★背景スライドショーを完全に停止する（ここには item は使いません）
    if (window.detailsBgInterval) {
        clearInterval(window.detailsBgInterval);
        window.detailsBgInterval = null;
    }
    
    // イベントリスナーを解除
    document.removeEventListener('mousemove', resetDetailsIdleTimer);
    document.removeEventListener('mousedown', resetDetailsIdleTimer);
    document.removeEventListener('scroll', resetDetailsIdleTimer, true);
    document.removeEventListener('keydown', resetDetailsIdleTimer);
    
    // クラスと表示をリセット
    const container = document.getElementById('details-trailer-container');
    const hero = document.getElementById('details-hero-container');
    const detailsView = document.getElementById('details-view');
    if (container) {
        container.innerHTML = '';
        container.style.opacity = '0';
        container.classList.remove('is-hidden');
    }
    if (hero) hero.classList.remove('is-playing-video');
    if (detailsView) detailsView.classList.remove('is-video-idle');
}

async function loadEpisodes(seriesId, seasonId, serverUrl, userId, token) {
    try {
        const container = document.getElementById('episodes-list-container');
    if (!container) return;

    // 🌟 修正：すでにエピソードのHTML（episodes-layout）が存在する場合は「読み込み中...」を出さない（チラつき防止）
    if (!container.innerHTML.includes('episodes-layout')) {
        container.innerHTML = '<p style="color:#666;">読み込み中...</p>';
    }

    // 念のため Fields に必要なデータが欠けないように追加しておく
    const url = `${serverUrl}/Shows/${seriesId}/Episodes?seasonId=${seasonId}&userId=${userId}&Fields=Overview,ItemCounts,PrimaryImageAspectRatio`;
        const res = await fetch(url, { headers: { 'X-Emby-Token': token } });
        const data = await res.json();
        
        if (data.Items && data.Items.length > 0) {
            container.innerHTML = `
                <div class="episodes-layout">
                    ${data.Items.map(ep => {
                        // 🌟 1. 進行度と視聴済みの計算
                        const userData = ep.UserData || {};
                        const isPlayed = userData.Played; 
                        const ticks = userData.PlaybackPositionTicks || 0; 
                        const runTime = ep.RunTimeTicks || 0; 

                        // 🌟 2. 視聴済みバッジのHTML
                        let badgeHtml = '';
                        if (isPlayed) {
                            badgeHtml = `
                                <div class="episode-watched-badge">
                                    <span class="material-symbols-outlined">check</span>
                                </div>
                            `;
                        }

                        // 🌟 3. 進行度バーのHTML（ホーム画面のクラスを再利用）
                        let progressHtml = '';
                        if (!isPlayed && ticks > 0 && runTime > 0) {
                            const percent = (ticks / runTime) * 100;
                            // インラインスタイルを削除し、既存のクラスを活用
                            progressHtml = `
                                <div class="progress-container">
                                    <div class="progress-bar" style="width: ${percent}%;"></div>
                                </div>
                            `;
                        }

                        // 🌟 4. サムネイルラッパーの中に組み込む
                        return `
                            <div class="episode-card" onclick="startPlayback('${ep.Id}')">
                                <div class="episode-img-wrapper">
                                    <img src="${serverUrl}/Items/${ep.Id}/Images/Primary?maxWidth=400" alt="${ep.Name}" onerror="this.style.display='none'">
                                    
                                    ${badgeHtml}
                                    
                                    <div class="episode-play-overlay">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"><path fill="currentColor" d="M8 17.175V6.825q0-.425.3-.713t.7-.287q.125 0 .263.037t.262.113l8.15 5.175q.225.15.338.375t.112.475t-.112.475t-.338.375l-8.15 5.175q-.125.075-.262.113T9 18.175q-.4 0-.7-.288t-.3-.712"/></svg>
                                    </div>
                                    
                                    ${progressHtml}
                                </div>
                                <div class="episode-info">
                                    <h3 class="episode-title">${ep.IndexNumber ? `${ep.IndexNumber}. ` : ''}${ep.Name}</h3>
                                    <p class="episode-overview">${ep.Overview || ''}</p>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } else {
            container.innerHTML = '<p style="color:#666;">エピソードが見つかりません。</p>';
        }
    } catch (e) {
        console.error('エピソードの取得失敗:', e);
        document.getElementById('episodes-list-container').innerHTML = '<p style="color:red;">取得に失敗しました。</p>';
    }
}



async function toggleFavorite(itemId, btnElement) {
    // 現在のアイコンから「追加」か「削除」かを判定
    const icon = btnElement.querySelector('.material-symbols-outlined');
    const isAdding = icon.innerText.trim() === 'add';

    const currentServer = typeof SERVER_URL !== 'undefined' ? SERVER_URL : localStorage.getItem('serverUrl');
    const currentUserId = typeof userId !== 'undefined' ? userId : localStorage.getItem('userId');
    const currentToken = typeof token !== 'undefined' ? token : localStorage.getItem('token');

    // ★プチ演出：押した瞬間にボタンを少し縮ませる
    btnElement.style.transform = 'scale(0.8)';
    btnElement.style.transition = 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)';
    setTimeout(() => {
        btnElement.style.transform = ''; // すぐ元に戻す
    }, 150);

    try {
        if (isAdding) {
            // 【追加処理】APIへPOSTリクエスト
            await fetch(`${currentServer}/Users/${currentUserId}/FavoriteItems/${itemId}`, {
                method: 'POST',
                headers: { 'X-Emby-Token': currentToken }
            });
            // UIを「チェック（登録済）」に更新
            icon.innerText = 'check';
            btnElement.classList.add('is-favorite');
            
        } else {
            // 【削除処理】APIへDELETEリクエスト
            await fetch(`${currentServer}/Users/${currentUserId}/FavoriteItems/${itemId}`, {
                method: 'DELETE',
                headers: { 'X-Emby-Token': currentToken }
            });
            // UIを「プラス（未登録）」に戻す
            icon.innerText = 'add';
            btnElement.classList.remove('is-favorite');
        }

        // （任意）マイリスト画面から詳細を開いていた場合、戻った時にリストを再読み込みさせるフラグ
        window.myListNeedsUpdate = true; 

    } catch (e) {
        console.error('お気に入りの操作に失敗しました:', e);
        // エラー時はアイコンを元に戻す等の処理を入れても良いです
    }
}


window.changeSeason = function(seriesId, seasonId) {
    console.log("Season changed to:", seasonId);

    // ★修正：変数名を current... に変更して、グローバルの token 等と衝突しないようにする
    const currentServer = typeof SERVER_URL !== 'undefined' ? SERVER_URL : localStorage.getItem('serverUrl');
    const currentUserId = typeof userId !== 'undefined' ? userId : localStorage.getItem('userId');
    const currentToken = typeof token !== 'undefined' ? token : localStorage.getItem('token');

    // 1. URLパラメータを更新
    const params = new URLSearchParams(window.location.search);
    params.set('seasonId', seasonId);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    
    history.pushState({ view: 'details', itemId: seriesId, seasonId: seasonId }, '', newUrl);

    // 2. エピソード表示を更新
    if (typeof loadEpisodes === 'function') {
        // ★修正：上で定義した変数名を使って呼び出す
        loadEpisodes(seriesId, seasonId, currentServer, currentUserId, currentToken);
    } else {
        console.error("loadEpisodes function is not defined");
    }
};


// ====== 追加：カスタムドロップダウン制御用関数 ======

// ドロップダウンの開閉
window.toggleCustomDropdown = function() {
    const wrapper = document.getElementById('season-wrapper');
    if (wrapper) {
        wrapper.classList.toggle('is-active');
    }
};

// ドロップダウンを閉じる（オーバーレイをクリックした時など）
window.closeCustomDropdown = function() {
    const wrapper = document.getElementById('season-wrapper');
    if (wrapper) {
        wrapper.classList.remove('is-active');
    }
};

// シーズンが選択された時の処理
window.selectCustomSeason = function(seriesId, seasonId, seasonName) {
    // 1. ボタンの表示名を書き換える
    const label = document.getElementById('custom-season-label');
    if (label) label.innerText = seasonName;
    
    // 2. メニューを閉じる
    closeCustomDropdown();
    
    // 3. 既存のシーズン変更関数を呼び出す
    if (typeof changeSeason === 'function') {
        changeSeason(seriesId, seasonId);
    }
};

async function showRemoteDetails(tmdbId, type) {
    const detailContent = document.getElementById('details-content');
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.style.display = 'flex';

    try {
        const res = await fetch(`/seerr-api/api/v1/${type}/${tmdbId}?language=ja`);
        const data = await res.json();

        // --- 1. キャスト情報の構築 (追加) ---
        let castHtml = '<p style="color:#666;">キャスト情報がありません。</p>';
        if (data.credits && data.credits.cast && data.credits.cast.length > 0) {
            // 最大12人まで抽出
            const actors = data.credits.cast.slice(0, 12);
            castHtml = actors.map(actor => {
                // 顔写真URL（なければプレースホルダー）
                const imgUrl = actor.profilePath 
                    ? `https://image.tmdb.org/t/p/w185${actor.profilePath}` 
                    : 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"150\" height=\"150\" viewBox=\"0 0 150 150\"%3E%3Crect width=\"150\" height=\"150\" fill=\"%23333\"/%3E%3Cpath d=\"M75 35a20 20 0 1 0 0 40 20 20 0 0 0 0-40zM40 115c0-23 20-30 35-30s35 7 35 30H40z\" fill=\"%23666\"/%3E%3C/svg%3E';
                
                return `
                    <div class="cast-card">
                        <img src="${imgUrl}" class="cast-photo" alt="${actor.name}" loading="lazy">
                        <div class="cast-name">${actor.name}</div>
                        <div class="cast-role">${actor.character || ''}</div>
                    </div>
                `;
            }).join('');
        }

        // --- 2. 既存のロゴ・動画取得ロジック (そのまま維持) ---
        let logoPath = '';
        if (typeof TMDB_API_KEY !== 'undefined') {
            const tmdbImagesUrl = `https://api.themoviedb.org/3/${type}/${tmdbId}/images?api_key=${TMDB_API_KEY}`;
            const tmdbRes = await fetch(tmdbImagesUrl);
            if (tmdbRes.ok) {
                const tmdbData = await tmdbRes.json();
                if (tmdbData.logos && tmdbData.logos.length > 0) {
                    const logo = tmdbData.logos.find(l => l.iso_639_1 === 'ja') || 
                                 tmdbData.logos.find(l => l.iso_639_1 === 'en') || 
                                 tmdbData.logos[0];
                    if (logo && logo.file_path) logoPath = `https://image.tmdb.org/t/p/original${logo.file_path}`;
                }
            }
        }

        // --- 3. HTMLの描画 (キャストカラムを追加) ---
        const backdropPath = data.backdropPath ? `https://image.tmdb.org/t/p/original${data.backdropPath}` : '';
        const title = data.title || data.name;

        // 🌟 ここから追加：リモート（検索等）の作品名をタブに表示
        if (typeof updatePageTitle === 'function') {
            updatePageTitle(title);
        }
        const year = (data.releaseDate || data.firstAirDate || "").substring(0, 4);
        const overview = data.overview || 'あらすじ情報がありません。';
        const genres = data.genres ? data.genres.map(g => g.name).join(', ') : '';
        const isRequested = data.mediaInfo && (data.mediaInfo.status >= 2 || (data.mediaInfo.requests && data.mediaInfo.requests.length > 0));

        detailContent.innerHTML = `
            <div class="details-hero" id="details-hero-container" style="--bg-image: url('${backdropPath}');">
                <div id="details-trailer-container"></div>
                <div class="hero-gradient-idle-layer"></div>
                <button id="details-mute-toggle" class="details-mute-btn" onclick="toggleDetailsMute()">
                    <span class="material-symbols-outlined">volume_off</span>
                </button>
                <div class="info-col-main">
                    ${logoPath ? `<img class="details-logo" src="${logoPath}" alt="${title}">` : `<h1 class="details-title-fallback">${title}</h1>`}
                    <div class="details-actions-row">
                        <button class="details-btn details-play-btn search-request-btn ${isRequested ? 'requested-btn' : ''}" 
                                ${isRequested ? 'disabled' : ''} 
                                onclick="handleRequest('${title.replace(/'/g, "\\'")}', '${type === 'tv' ? 'tv' : 'movie'}', ${tmdbId}, this.parentElement)">
                            <span class="material-symbols-outlined">${isRequested ? 'check' : 'add'}</span>
                            ${isRequested ? 'リクエスト済み' : '作品をリクエストする'}
                        </button>
                    </div>
                    <div class="details-tags-container">
                        <div class="tag-group"><span class="tag-label">公開年</span><span class="detail-tag">${year}年</span></div>
                        <div class="tag-group"><span class="tag-label">ジャンル</span><span class="detail-tag">${genres}</span></div>
                    </div>
                </div>
                <div class="info-col-synopsis">
                    <p class="hero-overview">${overview}</p>
                </div>
            </div>
            
            <div id="tabs-sentinel"></div>
            <div class="tabs-header">
                <button class="tab-button active">詳細情報</button>
            </div>

            <div class="content-sections">
                <div id="details-section" class="section-block">
                    <div class="details-extended-layout">
                        <div class="details-info-column">
                            <h3 class="details-heading">作品解説</h3>
                            <p class="details-full-overview">${overview}</p>
                        </div>
                        <div class="details-cast-column">
                            <h3 class="details-heading">キャスト</h3>
                            <div class="cast-grid" id="cast-list-container">
                                ${castHtml}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 予告編再生の起動
        const videoSource = data.relatedVideos || data.videos || [];
        const video = videoSource.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videoSource.find(v => v.site === 'YouTube');
        if (video) {
            setTimeout(() => {
                if (typeof stopBgCarousel === 'function') stopBgCarousel();
                setupDetailsTrailer(`https://www.youtube.com/watch?v=${video.key}`);
            }, 200);
        }

        if (typeof setupStickyTabs === 'function') setupStickyTabs();

    } catch (e) {
        console.error("Remote details error:", e);
        detailContent.innerHTML = '<p style="color:white; padding:100px;">情報の取得に失敗しました。</p>';
    } finally {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
}
async function refreshDetailsPlaybackState(itemId) {
    const currentServer = typeof SERVER_URL !== 'undefined' ? SERVER_URL : localStorage.getItem('serverUrl');
    const currentUserId = typeof userId !== 'undefined' ? userId : localStorage.getItem('userId');
    const currentToken = typeof token !== 'undefined' ? token : localStorage.getItem('token');

    try {
        const url = `${currentServer}/Users/${currentUserId}/Items/${itemId}?Fields=UserData&_t=${Date.now()}`;
        const res = await fetch(url, { headers: { 'X-Emby-Token': currentToken } });
        const item = await res.json();

        const playBtn = document.querySelector('.details-play-btn');
        const actionsRow = document.querySelector('.details-actions-row');
        
        if (playBtn) {
            const isResuming = item.UserData && item.UserData.PlaybackPositionTicks > 0;
            const newText = isResuming ? '続きから観る' : '今すぐ観る';
            playBtn.innerHTML = `<span class="material-symbols-outlined">play_arrow</span> ${newText}`;

            // 🌟 新しいクラス名で検索
            let progressWrapper = document.querySelector('.details-resume-bar-root');

            if (isResuming && item.RunTimeTicks > 0) {
                const percent = (item.UserData.PlaybackPositionTicks / item.RunTimeTicks) * 100;
                
                if (!progressWrapper) {
                    progressWrapper = document.createElement('div');
                    progressWrapper.className = 'details-resume-bar-root';
                    progressWrapper.innerHTML = `
                        <div class="details-resume-bar-track">
                            <div class="details-resume-bar-fill" style="width: ${percent}%;"></div>
                        </div>
                    `;
                    // 再生ボタンの行（actionsRow）の直前に挿入
                    if (actionsRow) actionsRow.parentNode.insertBefore(progressWrapper, actionsRow);
                } else {
                    // 🌟 進捗の更新
                    const barFill = progressWrapper.querySelector('.details-resume-bar-fill');
                    if (barFill) barFill.style.width = `${percent}%`;
                }
                
                // 🌟 【ここが重要】requestAnimationFrame や px 指定のコードはすべて削除！
                // 幅は CSS の calc(100% - 67px) が自動で処理します。

            } else if (progressWrapper) {
                progressWrapper.remove();
            }
        }

        // シリーズのエピソード更新
        if (item.Type === 'Series') {
            const params = new URLSearchParams(window.location.search);
            const seasonId = params.get('seasonId');
            if (seasonId && typeof loadEpisodes === 'function') {
                loadEpisodes(item.Id, seasonId, currentServer, currentUserId, currentToken);
            }
        }
    } catch (e) {
        console.error("詳細画面の同期失敗:", e);
    }
}

/**
 * あらすじをクリックした際に全体を表示/折りたたむトグル処理
 */
window.toggleSynopsis = function(element) {
    if (element.classList.contains('is-expanded')) {
        element.classList.remove('is-expanded');
        element.style.maxHeight = '84px'; // 閉じた状態(3行)
        
        // もし画面の上端ギリギリにいたら位置を調整する（オプション）
        // element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
        const fullHeight = element.scrollHeight;
        if (fullHeight > 84) {
            element.classList.add('is-expanded');
            element.style.maxHeight = fullHeight + 'px';
        }
    }
};