window.currentMediaType = ''; // 空＝ホーム、'Movie'＝映画、'Series'＝番組

window.updatePageTitle = function(title) {
    const base = "ChidaFilm"; // 🌟変更：ベース名を変更
    // 🌟変更：「-」を「|」に変更（前後に半角スペースを入れると綺麗です）
    document.title = title ? `${title} | ${base}` : base;
};

const tabStyles = document.createElement('style');
tabStyles.innerHTML = `
    body[data-tab="Movie"] #resume-section,
    body[data-tab="Series"] #resume-section,
    body[data-vod] #resume-section {
        display: none !important;
    }
    body[data-vod] .row-container {
        display: none !important;
    }
`;
document.head.appendChild(tabStyles);

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');

    // VODプラットフォームのリスト
    const vodPlatforms = ['netflix', 'prime', 'disneyplus', 'hulu', 'unext', 'appletv', 'local'];
    const genreParam = urlParams.get('genre') || 'All';

    let initialType = '';
    let activeBtnId = 'nav-home';
    const playId = urlParams.get('play');
    const path = window.location.pathname;

    if (playId) {
        window.isDirectPlay = true; // 🌟 追加：直叩き・リロードで再生から始まった場合の判定フラグ
        console.log("🚀 URLから再生開始:", playId);
        setTimeout(() => {
            if (typeof startPlayback === 'function') startPlayback(playId);
        }, 100);
        return; 
    } else if ((path === '/' || path === '/index.html' || path === '/home') && !window.location.search) {
        // 🌟 修正ポイント：URLにパラメータ（?tab= 等）が「無い」ときだけ実行する
        history.replaceState({ modal: 'home' }, '', '/?view=home');
    }

    // 1. 起動時のURL判定
    if (vodPlatforms.includes(tabParam)) {
        document.body.setAttribute('data-vod', tabParam);
        setTimeout(() => {
            if (typeof openGallery === 'function') openGallery(tabParam, genreParam);
        }, 100);
    } else if (tabParam === 'search') {
        setTimeout(() => {
            if (typeof openSearch === 'function') openSearch(true);
        }, 100);
    } else if (tabParam === 'movies') {
        initialType = 'Movie';
        activeBtnId = 'nav-movies';
    } else if (tabParam === 'shows') {
        initialType = 'Series';
        activeBtnId = 'nav-shows';
    } else if (tabParam === 'mylist') { 
        initialType = 'MyList';
        activeBtnId = 'nav-mylist';
        
        // 起動時にマイリスト画面を表示する処理
        setTimeout(() => {
            const homeView = document.getElementById('home-view');
            const heroSection = document.getElementById('hero-section'); // ★追加
            const mylistView = document.getElementById('mylist-view');
            if (homeView) homeView.style.display = 'none';
            if (heroSection) heroSection.style.display = 'none'; // ★追加
            if (mylistView) {
                mylistView.style.display = ''; // ★ block を空文字に変更
                if (typeof loadMyListItems === 'function') loadMyListItems();
            }
        }, 100);
    } else if (tabParam && tabParam !== 'home') {
        // ==========================================
        // ライブラリ（4KHDR等）のURLで直接開いた時の処理
        // ==========================================
        setTimeout(async () => {
            let libName = "ライブラリ"; // API取得失敗時の仮の名前
            try {
                // URLのIDを使って、Jellyfinから直接フォルダ名（ライブラリ名）を取得する
                const url = `${SERVER_URL}/Users/${userId}/Items/${tabParam}`;
                const res = await fetch(url, { headers: { 'X-Emby-Token': token } });
                const data = await res.json();
                if(data && data.Name) libName = data.Name;
            } catch(e) {}
            
            // 取得した名前を使って、ライブラリ画面を開き直す
            if (typeof window.openDynamicLibrary === 'function') {
                window.openDynamicLibrary(tabParam, libName, genreParam);
            }
        }, 100);
    }

    // 初期状態をセット
    window.currentMediaType = initialType;
    document.body.setAttribute('data-tab', initialType);
    updateNavUI(activeBtnId);
    let initialTitle = 'ホーム';
    if (tabParam === 'movies') initialTitle = '映画';
    else if (tabParam === 'shows') initialTitle = 'シリーズ';
    else if (tabParam === 'mylist') initialTitle = 'マイリスト';
    else if (tabParam === 'search') initialTitle = '検索';
    updatePageTitle(initialTitle);

    // 現在のURL状態を履歴に保存（初期化）
    if (!history.state) {
        // URLにすでにパラメータがある場合はそれを維持、ない場合は /?view=home を使う
        const currentURL = window.location.search ? window.location.href : '/?view=home';
        history.replaceState({ type: initialType, tab: tabParam || 'home' }, '', currentURL);
    }

    // 2. ナビゲーションボタンのクリックイベント
   if (typeof setupNavClick === 'function') {
        setupNavClick('nav-home', '', 'home');
        setupNavClick('nav-movies', 'Movie', 'movies');
        setupNavClick('nav-shows', 'Series', 'shows');
        setupNavClick('nav-mylist', 'MyList', 'mylist');
        
        // ★ロゴをクリックした時も「ホームボタン」として扱うように修正
        const navLogo = document.querySelector('.nav-logo');
        if (navLogo) {
            navLogo.addEventListener('click', (e) => {
                e.preventDefault();
                const homeBtn = document.getElementById('nav-home'); // ホームボタンを取得
                switchTab('', homeBtn, 'home'); // 第2引数に homeBtn を渡す
            });
        }
    }

    // 3. ブラウザの「戻る」「進む」ボタンへの対応
    window.addEventListener('popstate', (e) => {

       if (window.isReturningFromPlayer) {
        // わずかに遅らせてフラグを消す（他のスクリプトの無駄な処理も弾くため）
        setTimeout(() => { window.isReturningFromPlayer = false; }, 100);
        console.log("⚡ 爆速モード: 画面の再読み込みをブロックし、そのまま復帰します。");
        return; // 🛑 ここでストップ！ showDetails(再描画) に絶対行かせない！
    }
    
    const settingsOverlay = document.getElementById('global-settings-overlay');
    if (window.isClosingSettings || (settingsOverlay && settingsOverlay.classList.contains('show'))) {
        console.log("⚙️ 設定画面から戻ったためリロードをブロックします。");
        return;
    }
    // 1. 特殊ビューを一旦すべて隠す（混ざるのを防ぐ）
    const specialViews = ['gallery-view', 'details-view', 'search-view', 'genre-view'];
    specialViews.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // 2. URLの状態を確認
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get('id'); // 詳細IDがあるか？
    const tabParam = params.get('tab');

    // --- A. 詳細ページに戻る場合 ---
    if (itemId) {
        if (typeof showDetails === 'function') {
            const detailsView = document.getElementById('details-view');
            if (detailsView) detailsView.style.display = 'block';
            showDetails(itemId);
        }
        return; // 詳細表示時はここで終了
    }

    // --- B. それ以外のページ（e.stateがある場合）に戻る場合 ---
    if (e.state) {
        const tab = e.state.tab;
        const genre = e.state.genre || 'All';

        // 検索画面の制御
        if (tab === 'search') {
            if (typeof openSearch === 'function') openSearch(true);
            return;
        } else {
            if (typeof closeSearch === 'function') closeSearch(true);
        }

        // VOD・ライブラリ・通常タブの判定
        if (vodPlatforms.includes(tab)) {
            if (typeof openGallery === 'function') openGallery(tab, genre);
        } else if (tab && !['home', 'movies', 'shows', 'mylist'].includes(tab)) {
            // カスタムライブラリ（ID指定）
            setTimeout(async () => {
                let libName = "ライブラリ";
                try {
                    const url = `${SERVER_URL}/Users/${userId}/Items/${tab}`;
                    const res = await fetch(url, { headers: { 'X-Emby-Token': token } });
                    const data = await res.json();
                    if (data && data.Name) libName = data.Name;
                } catch (e) {}
                if (typeof window.openDynamicLibrary === 'function') {
                    window.openDynamicLibrary(tab, libName, genre);
                }
            }, 100);
        } else {
                // 通常のホーム・マイリスト等
                document.body.removeAttribute('data-vod');
                document.body.removeAttribute('data-library');
                if (typeof window.setDynamicNavTitle === 'function') window.setDynamicNavTitle('');

                window.currentMediaType = e.state.type || '';
                document.body.setAttribute('data-tab', window.currentMediaType);

                const homeView = document.getElementById('home-view');
                const heroSection = document.getElementById('hero-section');
                const mylistView = document.getElementById('mylist-view');

                if (window.currentMediaType === 'MyList') {
                    if (homeView) homeView.style.display = 'none';
                    if (heroSection) heroSection.style.display = 'none';
                    if (mylistView) {
                        mylistView.style.display = ''; 
                        if (typeof loadMyListItems === 'function') loadMyListItems();
                    }
                } else {
                    // ★ここを確実に！
                    if (mylistView) mylistView.style.display = 'none';
                    if (homeView) homeView.style.display = '';
                    if (heroSection) {
                        heroSection.style.display = ''; // ヒーローを確実に表示
                        heroSection.classList.remove('section-fade-out'); // フェードアウト状態を解除
                        heroSection.style.opacity = '1';
                    }
                    
                    if (typeof reloadAllSections === 'function') reloadAllSections();
                }

            // ナビゲーションUIのハイライトを更新
            let btnId = 'nav-home';
            if (window.currentMediaType === 'Movie') btnId = 'nav-movies';
            else if (window.currentMediaType === 'Series') btnId = 'nav-shows';
            else if (window.currentMediaType === 'MyList') btnId = 'nav-mylist';
            if (typeof updateNavUI === 'function') updateNavUI(btnId);
        }
    }
    });

});
function setupNavClick(id, type, tabName) {
    const btn = document.getElementById(id);
    if (btn) {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            // 処理をすべて switchTab に任せる
            switchTab(type, btn, tabName);
        });
    }
}

// タブを切り替える関数
window.goToHome = function() {
    console.log("ホームへ戻ります");
    document.body.removeAttribute('data-tab');
    document.body.removeAttribute('data-vod');
    document.body.removeAttribute('data-library');
    
    // 🌟 initHome() をここで呼ばない（showViewの中で呼ばれるため）
    showView('home-view'); 
};

window.initHome = function() {
    // 🌟 1000ms（1秒）待つことで、サーバー側の保存完了を確実に待機する
    setTimeout(() => {
        console.log("♻️ ホームデータを最新の状態に更新します...");
        window.currentMediaType = '';
        updateActiveNav('nav-home');
        
        loadHeroSection();
        
        // 🌟 正しい関数名 loadResumeItems を呼ぶ
        if (typeof loadResumeItems === 'function') {
            loadResumeItems(); 
        }
        
        loadAllHomeSections();
    }, 1000); 
};
async function loadResumeItems() {
    const grid = document.getElementById('resume-grid'); // HTML側のIDに合わせてください
    const section = document.getElementById('resume-section');
    if (!grid || !section) return;

    // 🌟 _t= タイムスタンプを付けて、キャッシュを無視して最新の順序で取得する
    const url = `${SERVER_URL}/Users/${userId}/Items/Resume?Recursive=true&Fields=PrimaryImageAspectRatio,BasicSyncInfo,UserData,ImageTags,BackdropImageTags&Limit=12&_t=${Date.now()}`;

    try {
        const res = await fetch(url, { headers: { 'X-Emby-Token': token } });
        const data = await res.json();

        grid.innerHTML = '';

        if (data.Items && data.Items.length > 0) {
            section.style.display = ''; // セクションを表示
            data.Items.forEach(item => {
                // 他の行と同じ poster-card 形式でカードを作成
                const card = document.createElement('div');
                card.className = 'poster-card';
                card.onclick = () => navigateToDetails(item.Id);

                const img = document.createElement('img');
                img.className = 'resume-thumb dynamic-img';
                
                // サムネイル（16:9）があれば優先、なければ背景画像
                let thumbUrl = "";
                if (item.ImageTags && item.ImageTags.Thumb) {
                    thumbUrl = `${SERVER_URL}/Items/${item.Id}/Images/Thumb?fillWidth=400&quality=90`;
                } else {
                    thumbUrl = `${SERVER_URL}/Items/${item.Id}/Images/Backdrop/0?fillWidth=400&quality=90`;
                }
                img.src = thumbUrl;

                // 進捗バーの計算
                const pct = item.UserData ? item.UserData.PlaybackPositionTicks / item.RunTimeTicks * 100 : 0;
                const progressDiv = document.createElement('div');
                progressDiv.className = 'resume-progress-container';
                progressDiv.innerHTML = `<div class="resume-progress-bar" style="width: ${pct}%"></div>`;

                const titleDiv = document.createElement('div');
                titleDiv.className = 'resume-title';
                titleDiv.textContent = item.Name;

                card.appendChild(img);
                card.appendChild(progressDiv);
                card.appendChild(titleDiv);
                grid.appendChild(card);
            });
        } else {
            section.style.display = 'none'; // アイテムがなければセクションごと隠す
        }
    } catch (err) {
        console.error('続きから観るの取得に失敗:', err);
    }
}
// タブを切り替える関数（CSS連携版）
function switchTab(type, clickedBtn, tabName) {
    // 1. 特殊なビュー（詳細・ギャラリー・検索）をすべて確実に隠す
    const specialViews = ['gallery-view', 'details-view', 'search-view', 'genre-view'];
    specialViews.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // 2. 状態のリセット
    document.body.removeAttribute('data-vod');
    document.body.removeAttribute('data-library');
    
    const homeView = document.getElementById('home-view');
    const mylistView = document.getElementById('mylist-view');
    const heroSection = document.getElementById('hero-section');
    const loadingOverlay = document.getElementById('loading-overlay');

    // 3. ローディング画面を表示
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        loadingOverlay.style.opacity = '1';
    }

    // 4. メインエリアの表示切り替え（'' を使ってレイアウト崩れを防止）
    if (type === 'MyList') {
        if (homeView) homeView.style.display = 'none';
        if (heroSection) heroSection.style.display = 'none';
        if (mylistView) mylistView.style.display = ''; 
    } else {
        if (mylistView) mylistView.style.display = 'none';
        if (homeView) homeView.style.display = ''; 
        if (heroSection) heroSection.style.display = ''; 
    }

    // 5. URLとUIの更新
    window.currentMediaType = type;
    document.body.setAttribute('data-tab', type);
    
    if (clickedBtn) updateNavUI(clickedBtn.id);
    const newUrl = (tabName === 'home' && type === '') ? '/?view=home' : `?tab=${tabName}`;
    history.pushState({ type: type, tab: tabName }, '', newUrl);

    let pageTitle = 'ホーム';
    if (type === 'Movie') pageTitle = '映画';
    else if (type === 'Series') pageTitle = 'シリーズ';
    else if (type === 'MyList') pageTitle = 'マイリスト';
    updatePageTitle(pageTitle);
    // 6. データ読み込み
    if (type === 'MyList') {
    if (typeof loadMyListItems === 'function') loadMyListItems();
} else {
    reloadAllSections(); 
    // typeが空（＝ホーム）の時だけライブラリ行をロードして表示させる
    if (type === '' && typeof loadMyMediaRow === 'function') {
        loadMyMediaRow('library-grid');
    }
}
}

function updateNavUI(activeId) {
    document.querySelectorAll('.nav-links a').forEach(b => b.classList.remove('active'));
    // activeId が指定されている場合のみハイライトをつける
    if (activeId) {
        const btn = document.getElementById(activeId);
        if (btn) btn.classList.add('active');
    }
}

async function reloadAllSections() {

    if (window.isReturningFromPlayer) {
        console.log("🛑 reloadAllSections をブロックしました（爆速モード維持）");
        return; 
    }

    console.log("ここで「" + (window.currentMediaType || 'ホーム') + "」のデータを再取得します！");

    if (typeof window.setDynamicNavTitle === 'function') {
        window.setDynamicNavTitle('');
    }

    // =========================================
    // 1. スクロール位置の完全リセット
    // =========================================
    if (typeof window.resetHomeScrollPositions === 'function') {
        window.resetHomeScrollPositions();
    }

    // =========================================
    // 2. ローディング画面を表示
    // =========================================
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        loadingOverlay.style.opacity = '1';
    }
    
    // =========================================
    // 3. 既存の動画やタイマーをリセット
    // =========================================
    if (typeof slideInterval !== 'undefined') clearInterval(slideInterval);
    if (typeof trailerTimer !== 'undefined') clearTimeout(trailerTimer);
    if (typeof player !== 'undefined' && player) { try { player.destroy(); } catch(e){} player = null; }

    // =========================================
    // 4. 新しいデータの取得開始
    // =========================================
    // ★重要：ヒーローのデータ取得と画像の準備が終わるまで「待機(await)」する。
    await loadHeroItems(true);

    // その他のジャンル行の再取得
    loadGenreRow(['Action', 'アクション', 'Action & Adventure', 'アクション＆アドベンチャー'], 'genre-action');
    loadGenreRow(['Adventure', 'アドベンチャー', 'Action & Adventure', 'アクション＆アドベンチャー'], 'genre-adventure');
    loadGenreRow(['Animation', 'アニメーション', 'Anime', 'アニメ'], 'genre-animation');
    loadGenreRow(['Drama', 'ドラマ'], 'genre-drama');
    loadGenreRow(['Fantasy', 'ファンタジー', 'Sci-Fi & Fantasy', 'SF＆ファンタジー'], 'genre-fantasy');
    loadGenreRow(['Comedy', 'コメディ'], 'genre-comedy');
    loadGenreRow(['Science Fiction', 'Sci-Fi', 'SF', 'Sci-Fi & Fantasy', 'SF＆ファンタジー'], 'genre-sf');
    

    // ホーム画面限定のセクション制御
    const isHome = (window.currentMediaType === '');
    const isMovie = (window.currentMediaType === 'Movie');
    const isSeries = (window.currentMediaType === 'Series');

    if (isHome || isMovie) {
        if (typeof loadSectionItems === 'function') {
            loadSectionItems('/Latest?IncludeItemTypes=Movie', 'movie-grid');
            loadSectionItems('?SortBy=PremiereDate&SortOrder=Descending&IncludeItemTypes=Movie&Recursive=true&Limit=100', 'recent-releases-grid');
        }
    }

    // 【番組タブ ＆ ホーム】の時だけ取得
    if (isHome || isSeries) {
        if (typeof loadSectionItems === 'function') {
            loadSectionItems('?IncludeItemTypes=Series&SortBy=DateLastContentAdded,DateCreated&SortOrder=Descending&Recursive=true&Limit=20', 'series-grid');
            loadSectionItems('/Latest?IncludeItemTypes=Episode&GroupItems=false&Limit=250', 'latest-episodes-grid');
        }
    }

    if (isHome) {
        if (typeof loadTrendingFromTMDB === 'function' && typeof TMDB_BASE_URL !== 'undefined') {
            const classicUrl = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&language=ja-JP&sort_by=vote_count.desc&vote_average.gte=7&page=1`;
            loadTrendingFromTMDB('suggested-grid', classicUrl, false);
        }
    }

    // ▼ ★ 全ての表示復活処理を 'block' ではなく ''（空文字）にしてレイアウト崩れを防ぐ
    const libraryGrid = document.getElementById('library-grid');
    if (libraryGrid) libraryGrid.closest('.row-container').style.display = isHome ? '' : 'none';

    const resumeSection = document.getElementById('resume-section');
    if (isHome) {
        if (typeof loadResumeItems === 'function') {
            loadResumeItems();
        }
    } else {
        if (resumeSection) resumeSection.style.display = 'none';
    }

    const popularityGrid = document.getElementById('popularity-grid');
    if (popularityGrid) popularityGrid.closest('.row-container').style.display = isHome ? '' : 'none';

    const suggestedGrid = document.getElementById('suggested-grid');
    if (suggestedGrid) suggestedGrid.closest('.row-container').style.display = isHome ? '' : 'none';

    loadInlineRecommendation();


    // ▼ 【映画タブ ＆ ホーム画面】で表示するセクション
    const movieGrid = document.getElementById('movie-grid'); 
    if (movieGrid) movieGrid.closest('.row-container').style.display = (isHome || isMovie) ? '' : 'none';

    const recentReleasesGrid = document.getElementById('recent-releases-grid'); 
    if (recentReleasesGrid) recentReleasesGrid.closest('.row-container').style.display = (isHome || isMovie) ? '' : 'none';


    // ▼ 【番組タブ ＆ ホーム画面】で表示するセクション
    const seriesGrid = document.getElementById('series-grid'); 
    if (seriesGrid) seriesGrid.closest('.row-container').style.display = (isHome || isSeries) ? '' : 'none';

    const latestEpisodesGrid = document.getElementById('latest-episodes-grid'); 
    if (latestEpisodesGrid) latestEpisodesGrid.closest('.row-container').style.display = (isHome || isSeries) ? '' : 'none';

    // ★ヒーローが裏側で完全にセットされたら、少しだけ余韻を残してローディングを消す
    setTimeout(() => {
        if (loadingOverlay) {
            loadingOverlay.style.transition = 'opacity 0.3s ease';
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 300);
        }
    }, 400); 
}

let heroItems = [];
let currentIndex = 0;
let slideInterval;
let trailerTimer;
let player = null;
let fadeOutTimer = null;
let currentLayer = 1;
let isTrailerPausedByScroll = false;
let scrollResumeTimer = null;
let visibilityTimeout = null;
let lastScrollY = window.scrollY;

window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    const vodNav = document.querySelector('.vod-platform-nav');
    const heroSection = document.getElementById('hero-section');
    const container = document.getElementById('trailer-container');
    const muteBtn = document.getElementById('mute-toggle');
    const scrollPos = window.scrollY;

    if (scrollPos > 50) { 
        if (navbar) navbar.classList.add('nav-black');
        if (vodNav) vodNav.classList.add('nav-black');
        if (navbar) navbar.classList.remove('nav-transparent');
        if (vodNav) vodNav.classList.remove('nav-transparent');
    } else { 
        if (navbar) navbar.classList.add('nav-transparent');
        if (vodNav) vodNav.classList.add('nav-transparent');
        if (navbar) navbar.classList.remove('nav-black');
        if (vodNav) vodNav.classList.remove('nav-black');
    }

    document.body.classList.remove('nav-sticky', 'nav-hidden');

    if (scrollPos > 400) { 
        if (!isTrailerPausedByScroll) {
            isTrailerPausedByScroll = true;
            clearInterval(slideInterval);
            clearTimeout(scrollResumeTimer);
            
            if (container) container.classList.remove('visible');
            if (muteBtn) muteBtn.style.display = 'none';

            if (player && typeof player.pauseVideo === 'function') {
                player.pauseVideo();
            } else {
                const videoEl = document.getElementById('hero-video');
                if (videoEl) videoEl.pause();
            }
        }
    } else if (scrollPos < 30) { 
        if (isTrailerPausedByScroll) {
            isTrailerPausedByScroll = false;

            clearTimeout(scrollResumeTimer);
            if (typeof startAutoSlide === 'function') startAutoSlide();
            
            scrollResumeTimer = setTimeout(() => {
                if (window.scrollY < 30) { 
                    if (player || document.getElementById('hero-video')) {
                        if (container) container.classList.add('visible');
                        if (muteBtn) muteBtn.style.display = 'flex';

                        if (player && typeof player.seekTo === 'function') {
                            player.seekTo(0);
                            player.playVideo();
                        } else {
                            const videoEl = document.getElementById('hero-video');
                            if (videoEl) {
                                videoEl.currentTime = 0;
                                videoEl.play();
                            }
                        }
                    }
                }
            }, 1500);
        }
    }
});

function pauseTrailer() {
    const container = document.getElementById('trailer-container');
    const muteBtn = document.getElementById('mute-toggle');

    container.classList.remove('visible'); 
    if (muteBtn) muteBtn.style.display = 'none';

    if (player && typeof player.pauseVideo === 'function') {
        player.pauseVideo();
    }
}

function resumeTrailer() {
    const container = document.getElementById('trailer-container');
    const muteBtn = document.getElementById('mute-toggle');

    container.classList.add('visible'); 
    if (muteBtn) muteBtn.style.display = 'flex';

    if (player && typeof player.playVideo === 'function') {
        player.seekTo(0); 
        player.playVideo(); 
    } else {
        isTrailerPausedByScroll = false;
        startTrailerTimer(heroItems[currentIndex]);
    }
}

async function loadHeroItems(isImmediate = false) {
    try {
        let typeQuery = (window.currentMediaType && window.currentMediaType !== 'MyList') ? window.currentMediaType : 'Movie,Series';
        
        const res = await fetch(`${SERVER_URL}/Users/${userId}/Items?IncludeItemTypes=${typeQuery}&Recursive=true&SortBy=DateCreated&SortOrder=Descending&Limit=5&Fields=Overview,ProductionYear,CommunityRating,OfficialRating,RemoteTrailers`, { headers: { 'X-Emby-Token': token } });
        const data = await res.json();
        
        if (data.Items && data.Items.length > 0) {
            heroItems = data.Items;
            setupDots();
            showSlide(0, isImmediate); 
            startAutoSlide(); 
        }
    } catch(e) { console.error("ヒーローアイテムの取得エラー:", e); }
}

function playMedia(id) {
    if (typeof startPlayback === 'function') {
        startPlayback(id);
    }
}

let currentSlideId = null;

function showSlide(index, isImmediate = false) {
    if (!heroItems || heroItems.length === 0) return;

    const heroSection = document.getElementById('hero-section');
    
    clearTimeout(trailerTimer);
    if (fadeOutTimer) clearTimeout(fadeOutTimer);

    const updateContent = () => {
        if (index < 0) index = heroItems.length - 1;
        if (index >= heroItems.length) index = 0;
        currentIndex = index;
        const item = heroItems[currentIndex];
        currentSlideId = item.Id;
        
        const container = document.getElementById('trailer-container');
        const muteBtn = document.getElementById('mute-toggle');
        const heroContent = document.querySelector('.hero-content');

        if (player) { try { player.destroy(); } catch(e){} player = null; }
        
        if (heroContent) heroContent.classList.remove('is-trailer-playing');
        container.classList.remove('visible');
        container.innerHTML = '';
        if (muteBtn) muteBtn.style.display = 'none';

        const titleContainer = document.getElementById('hero-title-container');
        titleContainer.innerHTML = ''; 
        if (item.ImageTags && item.ImageTags.Logo) {
            const logoUrl = `${SERVER_URL}/Items/${item.Id}/Images/Logo?quality=100&maxWidth=3600`;
            titleContainer.innerHTML = `<img src="${logoUrl}" class="hero-logo" alt="${item.Name}">`;
        } else {
            titleContainer.innerHTML = `<h1 id="hero-title">${item.Name}</h1>`;
        }
        document.getElementById('hero-desc').textContent = item.Overview || '';
        updateMetaInfo(item);
        
        // すべてのドットコンテナ（PC版とモバイル版の両方）を個別に更新する
        document.querySelectorAll('.hero-dots').forEach(container => {
            const dots = container.querySelectorAll('.hero-thumb');
            dots.forEach((dot, idx) => {
                dot.classList.toggle('active', idx === currentIndex);
            });
        });

        const imgUrl = `${SERVER_URL}/Items/${item.Id}/Images/Backdrop/0`;
        const tempImg = new Image();

        tempImg.onload = () => {
            const layer1 = document.getElementById('backdrop-1');
            const layer2 = document.getElementById('backdrop-2');
            const nextLayer = (currentLayer === 1) ? layer2 : layer1;
            const prevLayer = (currentLayer === 1) ? layer1 : layer2;

            prevLayer.style.transition = 'none'; 
            prevLayer.style.opacity = 0;

            nextLayer.style.transition = 'none';
            nextLayer.style.backgroundImage = `url(${imgUrl})`;
            nextLayer.style.opacity = 1;

            currentLayer = (currentLayer === 1) ? 2 : 1;

            setTimeout(() => {
                heroSection.classList.remove('section-fade-out');
                void heroSection.offsetWidth; 
                heroSection.classList.add('section-fade-in');
                
                startTrailerTimer(item);
            }, 50); 
        };
        tempImg.src = imgUrl;
    };

    if (isImmediate) {
        updateContent();
    } else {
        heroSection.classList.remove('section-fade-in');
        void heroSection.offsetWidth; 
        heroSection.classList.add('section-fade-out');
        setTimeout(updateContent, 500); 
    }
}

function startFadeOut(shouldNext = true) {
    const container = document.getElementById('trailer-container');
    const heroContent = document.querySelector('.hero-content');
    const muteBtn = document.getElementById('mute-toggle');
    
    if (!container.classList.contains('visible')) return;

    if (heroContent) heroContent.classList.remove('is-trailer-playing');

    container.classList.remove('visible');
    if (muteBtn) muteBtn.style.display = 'none';

    setTimeout(() => {
        if (!container.classList.contains('visible')) {
            container.innerHTML = '';
            if (player) {
                try { player.destroy(); } catch(e) {}
                player = null;
            }
            if (shouldNext) nextSlide();
        }
    }, 850); 
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        const container = document.getElementById('trailer-container');
        const heroContent = document.querySelector('.hero-content');
        const muteBtn = document.getElementById('mute-toggle');
        
        if (container) container.classList.add('visible');
        if (heroContent) heroContent.classList.add('is-trailer-playing');
        if (muteBtn) muteBtn.style.display = 'flex';

        const checkEnd = setInterval(() => {
            if (!player || typeof player.getDuration !== 'function') {
                clearInterval(checkEnd);
                return;
            }
            
            const duration = player.getDuration();
            const currentTime = player.getCurrentTime();
            
            if (duration > 0 && (duration - currentTime) < 1.7) {
                startFadeOut(true);
                clearInterval(checkEnd);
            }
        }, 500); 
    }
    
    if (event.data === YT.PlayerState.ENDED) {
        startFadeOut(true);
    }
}

function nextSlide() {
    showSlide(currentIndex + 1);
}

function startTrailerTimer(item) {
    clearTimeout(trailerTimer);
    trailerTimer = setTimeout(() => {
        if (currentSlideId === item.Id && !isTrailerPausedByScroll) {
            loadYouTubeTrailer(item);
        }
    }, 2500);
}

function loadYouTubeTrailer(item) {
    const container = document.getElementById('trailer-container');
    const muteBtn = document.getElementById('mute-toggle');
    const heroContent = document.querySelector('.hero-content');
    
    let youtubeId = null;
    if (item.RemoteTrailers && item.RemoteTrailers.length > 0) {
        const trailerUrl = item.RemoteTrailers[0].Url;
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = trailerUrl.match(regExp);
        youtubeId = (match && match[7].length == 11) ? match[7] : null;
    }

    if (!youtubeId) return;

    container.innerHTML = `<div id="youtube-player"></div>`;
    player = new YT.Player('youtube-player', {
        videoId: youtubeId,
        playerVars: { 
            autoplay: 1, 
            controls: 0, 
            mute: 1, 
            modestbranding: 1, 
            rel: 0,
            iv_load_policy: 3,
            showinfo: 0,
            playsinline: 1,
            disablekb: 1,
            enablejsapi: 1,
            origin: window.location.origin
        },
        events: {
            onReady: (e) => {
                if (muteBtn) {
                    const icon = muteBtn.querySelector('.material-symbols-outlined');
                    if (icon) icon.textContent = 'volume_off';
                }

                const iframe = e.target.getIframe();
                if (iframe) {
                    iframe.style.cssText = `
                        position: absolute;
                        width: 100%;
                        height: 140%;
                        top: -20%;
                        left: 0;
                        pointer-events: none;
                    `;
                }
                
                e.target.playVideo(); 
            },
            onStateChange: onPlayerStateChange
        }
    });
}

function updateMetaInfo(item) {
    const yearSpan = document.getElementById('hero-year');
    const typeSpan = document.getElementById('hero-type');
    if (yearSpan) yearSpan.textContent = item.ProductionYear || '';
    if (typeSpan) typeSpan.textContent = item.Type === 'Movie' ? '映画' : 'TV番組';
}
    
function startAutoSlide() {
    clearInterval(slideInterval);
    slideInterval = setInterval(() => {
        if (!player || (player && player.getPlayerState() !== YT.PlayerState.PLAYING)) {
            nextSlide();
        }
    }, 15000); 
}

function setupDots() {
    // 既存のドットコンテナと、新設のモバイル専用コンテナの両方を対象にする
    const containers = [
        document.getElementById('hero-dots'),
        document.getElementById('mobile-hero-dots')
    ].filter(c => c !== null); // 存在するコンテナのみ抽出

    containers.forEach(dotsContainer => {
        dotsContainer.innerHTML = '';
        
        heroItems.forEach((item, idx) => {
            const thumb = document.createElement('img');
            
            let thumbUrl = "";
            if (item.ImageTags && item.ImageTags.Thumb) {
                thumbUrl = `${SERVER_URL}/Items/${item.Id}/Images/Thumb?fillWidth=400&quality=90&tag=${item.ImageTags.Thumb}`;
            } else if (item.BackdropImageTags && item.BackdropImageTags.length > 0) {
                thumbUrl = `${SERVER_URL}/Items/${item.Id}/Images/Backdrop/0?fillWidth=400&quality=90&tag=${item.BackdropImageTags[0]}`;
            } else {
                const primaryTag = item.ImageTags?.Primary || '';
                thumbUrl = `${SERVER_URL}/Items/${item.Id}/Images/Primary?fillWidth=400&quality=90&tag=${primaryTag}`;
            }

            thumb.src = thumbUrl;
            // querySelectorAll('.hero-thumb') で一括管理されるため、クラス名は共通
            thumb.className = idx === currentIndex ? 'hero-thumb active' : 'hero-thumb';

            thumb.onclick = () => { 
                showSlide(idx); 
                resetTimer(); 
            };
            
            dotsContainer.appendChild(thumb);
        });
    });
}

function resetTimer() {
    clearInterval(slideInterval);
}

document.getElementById('mute-toggle').onclick = function() {
    const icon = this.querySelector('.material-symbols-outlined');
    if (player && typeof player.unMute === 'function') {
        if (player.isMuted()) {
            player.unMute(); player.setVolume(50); icon.textContent = 'volume_up';
        } else {
            player.mute(); icon.textContent = 'volume_off';
        }
    }
};

document.addEventListener('visibilitychange', () => {
    const container = document.getElementById('trailer-container');

    if (document.hidden) {
        if (trailerTimer) clearTimeout(trailerTimer);

        if (player && typeof player.pauseVideo === 'function') {
            player.pauseVideo();
        }

        if (visibilityTimeout) clearTimeout(visibilityTimeout);
        visibilityTimeout = setTimeout(() => {
            startFadeOut(false);
            clearInterval(slideInterval);
            visibilityTimeout = null;
        }, 10000);

    } else {
        if (visibilityTimeout) {
            clearTimeout(visibilityTimeout);
            visibilityTimeout = null;

            if (player && typeof player.playVideo === 'function' && container.classList.contains('visible')) {
                player.playVideo();
            } else {
                if (heroItems[currentIndex]) startTrailerTimer(heroItems[currentIndex]);
            }
            startAutoSlide();
        } else {
            clearInterval(slideInterval);
            startAutoSlide();
            
            if (heroItems[currentIndex]) {
                startTrailerTimer(heroItems[currentIndex]);
            }
        }
    }
});

async function loadGenreRow(genreInput, elementId) {
    const grid = document.getElementById(elementId);
    if (!grid) return;

    const rowContainer = grid.closest('.row-container');
    if (rowContainer) {
        const titleEl = rowContainer.querySelector('h3');
        if (titleEl && !rowContainer.querySelector('.view-all-btn')) {
            // 表示用（日本語）
            const displayGenreName = Array.isArray(genreInput) ? genreInput[1] : genreInput;
            // 検索用（Action|アクション の形式）
            const searchGenreQuery = Array.isArray(genreInput) ? genreInput.join('|') : genreInput;

            const wrapper = document.createElement('div');
            wrapper.className = 'section-title-wrapper';
            titleEl.parentNode.insertBefore(wrapper, titleEl);
            wrapper.appendChild(titleEl);

            const btn = document.createElement('button');
            btn.className = 'view-all-btn';
            btn.innerHTML = `すべて見る <span class="material-symbols-outlined">chevron_right</span>`;
            
            // ★修正：表示名だけでなく、検索クエリも渡すように変更
            btn.onclick = () => {
                if (typeof navigateToGenre === 'function') {
                    navigateToGenre(displayGenreName, searchGenreQuery);
                }
            };
            wrapper.appendChild(btn);
        }
    }

    let genreQuery = genreInput;
    if (Array.isArray(genreInput)) {
        genreQuery = genreInput.join('|'); 
    }

    let typeQuery = (window.currentMediaType && window.currentMediaType !== 'MyList') ? window.currentMediaType : 'Movie,Series';
    let fetchLimit = window.currentMediaType ? 40 : 25;

    const url = `${SERVER_URL}/Users/${userId}/Items?IncludeItemTypes=${typeQuery}&Recursive=true&Genres=${encodeURIComponent(genreQuery)}&SortBy=Random&Limit=${fetchLimit}&Fields=PrimaryImageAspectRatio,BasicSyncInfo,UserData,SeriesId,SeriesThumbImageTag,ImageTags,BackdropImageTags,DateCreated,DateLastContentAdded`;

    try {
        const res = await fetch(url, { headers: { 'X-Emby-Token': token } });
        const data = await res.json();

        grid.innerHTML = '';
        const rowContainer = grid.closest('.row-container');

        if (data.Items && data.Items.length > 0) {
            if (rowContainer) rowContainer.style.display = ''; // ★ blockを空文字に変更

            data.Items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'poster-card';
                card.onclick = () => navigateToDetails(item.Id);

                const img = document.createElement('img');
                img.loading = 'lazy';

                let thumbType = 'Primary';
                if (item.ImageTags && item.ImageTags.Thumb) {
                    thumbType = 'Thumb';
                } else if (item.BackdropImageTags && item.BackdropImageTags.length > 0) {
                    thumbType = 'Backdrop';
                }
                const thumbUrl = `${SERVER_URL}/Items/${item.Id}/Images/${thumbType}?fillWidth=400&quality=90`;
                const primaryUrl = `${SERVER_URL}/Items/${item.Id}/Images/Primary?fillWidth=400&quality=90`;
                const isPoster = localStorage.getItem('view_mode') === 'poster';

                img.className = 'resume-thumb dynamic-img'; 
                img.dataset.thumb = thumbUrl;
                img.dataset.poster = primaryUrl;
                img.src = isPoster ? primaryUrl : thumbUrl;

                const titleDiv = document.createElement('div');
                titleDiv.className = 'resume-title'; 
                titleDiv.textContent = item.Name;

                card.appendChild(img);
                card.appendChild(titleDiv);

                if (item.DateCreated || item.DateLastContentAdded) {
                    const now = new Date();
                    const diffCreated = item.DateCreated ? Math.ceil(Math.abs(now - new Date(item.DateCreated)) / (1000 * 60 * 60 * 24)) : 999;
                    const diffContent = item.DateLastContentAdded ? Math.ceil(Math.abs(now - new Date(item.DateLastContentAdded)) / (1000 * 60 * 60 * 24)) : 999;

                    let badgeLabel = "";
                    if (diffCreated <= 14) {
                        badgeLabel = "新作";
                    } else if ((item.Type === 'Series' && diffContent <= 14) || (item.Type === 'Episode' && diffCreated <= 14)) {
                        badgeLabel = "新エピソード";
                    }

                    if (badgeLabel) {
                        const badge = document.createElement('div');
                        badge.className = 'home-new-badge';
                        badge.textContent = badgeLabel;
                        card.appendChild(badge);
                    }
                }

                grid.appendChild(card);
            });
            
            if (typeof updateArrowVisibility === 'function') {
                updateArrowVisibility(grid);
            }
        } else {
            if (rowContainer) rowContainer.style.display = 'none';
        }
    } catch (error) {
        const rowContainer = grid.closest('.row-container');
        if (rowContainer) rowContainer.style.display = 'none';
    }
}

function createThumbCard(item) {
    const card = document.createElement('div');
    card.className = 'thumb-card'; 
    card.onclick = () => navigateToDetails(item.Id);

    const img = document.createElement('img');
    img.loading = 'lazy';

    let imgUrl = "";
    if (item.ImageTags && item.ImageTags.Primary) {
        imgUrl = `${SERVER_URL}/Items/${item.Id}/Images/Primary?fillWidth=400&quality=90&tag=${item.ImageTags.Primary}`;
    } else if (item.BackdropImageTags && item.BackdropImageTags.length > 0) {
        imgUrl = `${SERVER_URL}/Items/${item.Id}/Images/Backdrop/0?fillWidth=400&quality=90&tag=${item.BackdropImageTags[0]}`;
    } else {
        imgUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    }

    img.className = 'resume-thumb dynamic-img'; 
    img.src = imgUrl;

    img.onerror = function() {
        this.onerror = null; 
        this.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    };

    card.appendChild(img);
    return card;
}

async function loadMyMediaRow(gridId) {
    try {
        const url = `${SERVER_URL}/Users/${userId}/Views`;
        const res = await fetch(url, { headers: { 'X-Emby-Token': token } });
        const data = await res.json();

        const grid = document.getElementById(gridId);
        if (!grid) return;
        grid.innerHTML = '';

        const platforms = [
            { id: 'prime', name: 'Prime Video', img: 'images/prime.png' },
            { id: 'netflix', name: 'NETFLIX', img: 'images/netflix.png' },
            { id: 'disneyplus', name: 'Disney+', img: 'images/disneyplus.png' },
            { id: 'hulu', name: 'Hulu', img: 'images/hulu.png' },
            { id: 'unext', name: 'U-NEXT', img: 'images/unext.png' }
        ];

        platforms.forEach(p => {
            const pBtn = document.createElement('div');
            pBtn.className = 'hover-card library-card';
            pBtn.innerHTML = `<img src="${p.img}" alt="${p.name}">`;
            pBtn.onclick = () => openGallery(p.id); 
            grid.appendChild(pBtn);
        });

        const hiddenIds = [
            '79e9b7e1cd375e35a5fe8830fba9cc7e',
            '66b1ede0259b8bb28bba691c33588071',
            '8f4c8e9206cad6e86fb6010d6da5bbb8',
            '20dad14c38b4f12ee5a513b3c73266bf',
            'eee6e17c30dc8de4a58d28ed11ae8105'
        ];

        if (data.Items) {
            data.Items.forEach(item => {
                if (hiddenIds.includes(item.Id)) return;
                const card = createLibraryCard(item);
                grid.appendChild(card);
            });
        }

        const personalBtn = document.createElement('div');
        personalBtn.className = 'hover-card library-card';
        personalBtn.style.cssText = `background:linear-gradient(135deg, #8A2BE2, #4B0082); display:flex; align-items:center; justify-content:center;`;
        personalBtn.innerHTML = `
            <div style="text-align:center;">
                <span class="material-symbols-outlined" style="font-size:3rem; color:white;">video_library</span>
                <p style="color:white; font-weight:bold; margin:0;">マイライブラリ</p>
            </div>
        `;
        personalBtn.onclick = () => openGallery('local');
        grid.appendChild(personalBtn);

        if (typeof updateArrowVisibility === 'function') updateArrowVisibility(grid);
    } catch (err) {
        console.error('Error loading my media:', err);
    }
}

function createLibraryCard(item) {
    const card = document.createElement('div');
    card.className = 'hover-card library-card';
    card.style.cursor = 'pointer';
    card.style.minWidth = '250px';
    
    const imgUrl = `${SERVER_URL}/Items/${item.Id}/Images/Primary?fillWidth=400&quality=90`;
    card.innerHTML = `
        <img src="${imgUrl}" style="width:100%; border-radius:12px;">
        <div class="card-title-overlay">${item.Name}</div>
    `;
    
    card.onclick = () => {
        if (typeof window.openDynamicLibrary === 'function') {
            window.openDynamicLibrary(item.Id, item.Name);
        }
    };
    return card;
}

async function loadInlineRecommendation() {
    const container = document.getElementById('inline-promo-container');
    if (!container || typeof SERVER_URL === 'undefined') return;

    try {
        let promoItem = null;
        let lastPlayedId = null;
        let baseName = "";

        let typeQuery = (window.currentMediaType && window.currentMediaType !== 'MyList') ? window.currentMediaType : 'Movie,Series';

        const resumeUrl = `${SERVER_URL}/Users/${userId}/Items/Resume?Limit=1&Recursive=true&IncludeItemTypes=${typeQuery}&Fields=RemoteTrailers,ImageTags&_t=${Date.now()}`;
        const resumeRes = await fetch(resumeUrl, { headers: { 'X-Emby-Token': token }, cache: 'no-store' });
        const resumeData = await resumeRes.json();

        if (resumeData.Items && resumeData.Items.length > 0) {
            lastPlayedId = resumeData.Items[0].Id;
            baseName = resumeData.Items[0].Name;
        } else {
            const historyUrl = `${SERVER_URL}/Users/${userId}/Items?SortBy=DatePlayed&SortOrder=Descending&Filters=IsPlayed&Limit=1&Recursive=true&IncludeItemTypes=${typeQuery}&Fields=RemoteTrailers,ImageTags&_t=${Date.now()}`;
            const historyRes = await fetch(historyUrl, { headers: { 'X-Emby-Token': token }, cache: 'no-store' });
            const historyData = await historyRes.json();
            
            if (historyData.Items && historyData.Items.length > 0) {
                lastPlayedId = historyData.Items[0].Id;
                baseName = historyData.Items[0].Name;
            }
        }

        if (lastPlayedId) {
            const similarUrl = `${SERVER_URL}/Items/${lastPlayedId}/Similar?UserId=${userId}&Limit=10&SortBy=Random&IncludeItemTypes=${typeQuery}&Fields=Overview,ProductionYear,OfficialRating,BackdropImageTags,RemoteTrailers,ImageTags&Filters=IsNotPlayed&_t=${Date.now()}`;
            const similarRes = await fetch(similarUrl, { headers: { 'X-Emby-Token': token }, cache: 'no-store' });
            const similarData = await similarRes.json();
            
            if (similarData.Items && similarData.Items.length > 0) {
                const randomIndex = Math.floor(Math.random() * similarData.Items.length);
                promoItem = similarData.Items[randomIndex];
            }
        }

        if (!promoItem) {
            const trendUrl = `${SERVER_URL}/Users/${userId}/Items?IncludeItemTypes=${typeQuery}&Recursive=true&SortBy=CommunityRating&SortOrder=Descending&Limit=10&Fields=Overview,ProductionYear,OfficialRating,BackdropImageTags,RemoteTrailers,ImageTags&Filters=IsNotPlayed&_t=${Date.now()}`;
            const trendRes = await fetch(trendUrl, { headers: { 'X-Emby-Token': token } });
            const trendData = await trendRes.json();
            
            if (trendData.Items && trendData.Items.length > 0) {
                const randomIndex = Math.floor(Math.random() * trendData.Items.length);
                promoItem = trendData.Items[randomIndex];
            }
        }

        if (promoItem) {
            let bgUrl = '';
            if (promoItem.BackdropImageTags && promoItem.BackdropImageTags.length > 0) {
                bgUrl = `${SERVER_URL}/Items/${promoItem.Id}/Images/Backdrop/0?tag=${promoItem.BackdropImageTags[0]}&maxWidth=1920`;
            } else {
                bgUrl = `${SERVER_URL}/Items/${promoItem.Id}/Images/Primary?maxWidth=1920`;
            }

            document.getElementById('promo-bg-img').src = bgUrl;
            const logoImg = document.getElementById('promo-logo');
            const titleText = document.getElementById('promo-title');

            if (promoItem.ImageTags && promoItem.ImageTags.Logo) {
                logoImg.src = `${SERVER_URL}/Items/${promoItem.Id}/Images/Logo?maxWidth=800&tag=${promoItem.ImageTags.Logo}`;
                logoImg.style.display = 'block';
                titleText.style.display = 'none';
            } else {
                titleText.innerText = promoItem.Name;
                titleText.style.display = 'block';
                logoImg.style.display = 'none';
            }
            
            let videoWrapper = document.getElementById('promo-video-wrapper');
            if (!videoWrapper) {
                videoWrapper = document.createElement('div');
                videoWrapper.id = 'promo-video-wrapper';
                videoWrapper.className = 'promo-video-wrapper';
                const bgImg = document.getElementById('promo-bg-img');
                bgImg.parentNode.insertBefore(videoWrapper, bgImg.nextSibling);
            }

            const wrapperElement = document.getElementById('promo-wrapper');
            let hoverTimer;

            // --- 動画予告の再生・停止共通ロジック ---
            const startPromoVideo = () => {
                if (promoItem.RemoteTrailers && promoItem.RemoteTrailers.length > 0) {
                    const trailerUrl = promoItem.RemoteTrailers[0].Url;
                    const ytMatch = trailerUrl.match(/v=([^#&?]*)/);
                    if (ytMatch) {
                        const vid = ytMatch[1];
                        hoverTimer = setTimeout(() => {
                            videoWrapper.innerHTML = `<iframe src="https://www.youtube.com/embed/${vid}?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=${vid}&iv_load_policy=3&disablekb=1&fs=0&rel=0" frameborder="0" allow="autoplay; encrypted-media"></iframe>`;
                            videoWrapper.style.opacity = '1';
                        }, 800);
                    }
                }
            };

            const stopPromoVideo = () => {
                clearTimeout(hoverTimer);
                videoWrapper.style.opacity = '0';
                setTimeout(() => {
                    if (videoWrapper.style.opacity === '0') {
                        videoWrapper.innerHTML = '';
                    }
                }, 800);
            };

            // デスクトップ：ホバーで再生/停止
            wrapperElement.onmouseenter = startPromoVideo;
            wrapperElement.onmouseleave = stopPromoVideo;

            // モバイル：スクロールして画面に入ったら自動再生 (IntersectionObserver)
            if (window.innerWidth < 768) {
                const observerOptions = {
                    root: null, // ビューポートを基準
                    threshold: 0.5 // 50% 以上表示されたら発火
                };

                const promoObserver = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            // 画面に入った瞬間、デスクトップのホバーと同じロジックで再生開始
                            startPromoVideo();
                        } else {
                            // 画面から出たら即座に停止
                            stopPromoVideo();
                        }
                    });
                }, observerOptions);

                promoObserver.observe(wrapperElement);
            }

            wrapperElement.onclick = () => {
                // 自動再生中にクリックしても遷移できるように
                navigateToDetails(promoItem.Id);
            };

            // ボタン個別のイベント設定
            const promoInfoBtn = document.getElementById('promo-info-btn');
            const promoPlayBtn = document.getElementById('promo-play-btn');

            if (promoInfoBtn) {
                promoInfoBtn.onclick = (e) => {
                    e.stopPropagation(); // カード全体のクリックイベント発動を防ぐ
                    navigateToDetails(promoItem.Id);
                };
            }

            if (promoPlayBtn) {
                promoPlayBtn.onclick = (e) => {
                    e.stopPropagation(); // カード全体のクリックイベント発動を防ぐ
                    playMedia(promoItem.Id);
                };
            }
            container.style.display = ''; // ★ blockを空文字に変更
        }
    } catch (err) {
        console.error('おすすめ枠の取得に失敗:', err);
    }
}

window.addEventListener('load', () => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);

    const currentUserId = typeof userId !== 'undefined' ? userId : 
                          (window.ApiClient ? window.ApiClient.getCurrentUserId() : null);
    
    const GUEST_USER_ID = "56d32ae7b4a347528d854a3fc84b1b31"; 

    if (currentUserId === GUEST_USER_ID) {
        initAllSliders();

        const script = document.createElement('script');
        script.src = 'js/guest-home.js'; 
        script.src += '?v=' + new Date().getTime();
        document.body.appendChild(script);
    } else {
        initAllSliders(); 
        
        if (window.currentMediaType !== 'MyList') {
            loadMyMediaRow('library-grid');
        }

        const scriptsToLoad = ['js/recommend.js', 'js/recommend-s.js', 'js/recommend-scroll.js'];
        scriptsToLoad.forEach(src => {
            const script = document.createElement('script');
            script.src = src;
            document.body.appendChild(script);
        });
        
        const saved = localStorage.getItem('my_custom_recommendations');
        const inputField = document.getElementById('custom-ids-input');
        if (saved && inputField) inputField.value = saved;

        if (window.currentMediaType !== 'MyList') {
            loadInlineRecommendation();
            reloadAllSections(); 
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const backToTopBtn = document.getElementById('back-to-top');
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth' 
            });
        });
    }
});

window.updateHeroContent = function(items) {
    if (!items || items.length === 0) return;
    
    heroItems = items; 
    
    if (typeof setupDots === 'function') {
        setupDots();
    }
    
    if (typeof showSlide === 'function') {
        showSlide(0, true); 
    }
    
    if (typeof startAutoSlide === 'function') {
        startAutoSlide();
    }
};

window.setDynamicNavTitle = function(title) {
    if (title) {
        updatePageTitle(title);
    }

    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    let sepElem = document.getElementById('dynamic-nav-separator');
    let titleElem = document.getElementById('dynamic-nav-title');
    
    if (title) {
        if (!sepElem) {
            sepElem = document.createElement('span');
            sepElem.id = 'dynamic-nav-separator';
            sepElem.style.cssText = 'color: white; opacity: 0.4; margin: 0 4px; font-weight: normal; pointer-events: none; cursor: default; display: flex; align-items: center;';
            sepElem.innerText = '|';
            navLinks.appendChild(sepElem);
        }

        if (!titleElem) {
            titleElem = document.createElement('a');
            titleElem.id = 'dynamic-nav-title';
            titleElem.className = 'active';
            titleElem.style.cssText = 'pointer-events: none; cursor: default;';
            navLinks.appendChild(titleElem);
        }
        
        titleElem.innerText = title;
        
    } else {
        if (sepElem) sepElem.remove();
        if (titleElem) titleElem.remove();
    }
};

window.resetHomeScrollPositions = function() {
    window.scrollTo(0, 0);

    const scrollers = document.querySelectorAll('.emby-scroller, .scrollSlider, .movie-row, .recommendation-row, .card-row');
    
    scrollers.forEach(s => {
        s.scrollLeft = 0;
        s.dataset.currentX = 0;
        s.style.transform = 'translateX(0px)';
        s.dispatchEvent(new Event('scroll', { bubbles: true }));

        if (typeof updateArrowVisibility === 'function') {
            setTimeout(() => {
                updateArrowVisibility(s);
            }, 50);
        }
    });
};

window.infoHero = function() {
    if (currentSlideId) {
        if (typeof navigateToDetails === 'function') {
            navigateToDetails(currentSlideId);
        } else {
            console.error("navigateToDetails 関数が見つかりません。details.js が読み込まれているか確認してください。");
        }
    }
};

// (参考) もし「再生」ボタンも共通の currentSlideId を使いたい場合はこちらも便利です
window.playHero = function() {
    if (currentSlideId) {
        playMedia(currentSlideId);
    }
};