/* =========================================
   view-toggle.js - 完璧なロード画面 ＆ スマート待機版
   ========================================= */

// ★ 1. 画像読み込み待機（画面に映っている画像を賢く狙い撃ち）
function waitForImagesToLoad(container) {
    const allImgs = [...container.querySelectorAll('img.dynamic-img')];
    
    // 画面に映っている（またはスクロールしてすぐ見えそうな）画像を抽出
    let targetImgs = allImgs.filter(img => {
        const rect = img.getBoundingClientRect();
        // 画面の高さ + 上下800pxの余裕を持たせる（スクロール直後の分も待機させる）
        return rect.top < window.innerHeight + 800 && rect.bottom > -800;
    });

    // もし抽出できなかった場合は、保険として最初の30枚を待機対象にする
    if (targetImgs.length === 0) {
        targetImgs = allImgs.slice(0, 30);
    }

    if (targetImgs.length === 0) return Promise.resolve();

    return Promise.all(targetImgs.map(img => {
        return new Promise(res => {
            // 既に正常に読み込まれている場合
            if (img.complete && img.naturalWidth > 0) return res();

            // 50ミリ秒ごとに画像の読み込み状況を監視
            const checkInterval = setInterval(() => {
                if (img.complete && img.naturalWidth > 0) {
                    clearInterval(checkInterval);
                    res();
                } 
                else if (img.complete && img.dataset.triedPoster === '1') {
                    clearInterval(checkInterval);
                    res();
                }
            }, 50);

            // 最大待機時間（2.5秒）で強制的に終了して次に進む
            setTimeout(() => {
                clearInterval(checkInterval);
                res();
            }, 2500);
        });
    }));
}

document.addEventListener('DOMContentLoaded', () => {
    const isPoster = localStorage.getItem('view_mode') === 'poster';

    // モード初期化時のクラス付与のみ行う（ボタンの生成は廃止）
    if (isPoster) {
        document.body.classList.add('poster-mode');
    }

    // --- オーバーレイ（ロード画面）の自動生成 ---
    let overlay = document.getElementById('transition-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'transition-overlay';
        document.body.appendChild(overlay);
        
        if (!document.getElementById('loader-style')) {
            const style = document.createElement('style');
            style.id = 'loader-style';
            style.innerHTML = `@keyframes spin { to { transform: rotate(360deg); } }`;
            document.head.appendChild(style);
        }
    }

    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background-color: #141414; z-index: 999999;
        display: none; justify-content: center; align-items: center;
        opacity: 0; transition: opacity 0.2s ease; pointer-events: none;
    `;
    overlay.innerHTML = `<div style="width: 50px; height: 50px; border: 4px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: spin 1s linear infinite;"></div>`;


    function enablePosterMode() {
        document.body.classList.add('poster-mode');
        localStorage.setItem('view_mode', 'poster');
        
        document.querySelectorAll('.dynamic-img').forEach(img => {
            if (img.dataset.poster) img.src = img.dataset.poster;
        });
    }

    function disablePosterMode() {
        document.body.classList.remove('poster-mode');
        localStorage.setItem('view_mode', 'thumb');
        
        document.querySelectorAll('.dynamic-img').forEach(img => {
            if (img.dataset.thumb) img.src = img.dataset.thumb;
        });
    }

    // 🌟 追加：設定画面（外部）から強制的に発火させるためのグローバル関数
    window.toggleListMode = async function(mode) {
        // 現在のモードとリクエストが同じなら何もしない
        const isCurrentlyPoster = document.body.classList.contains('poster-mode');
        if ((mode === 'poster' && isCurrentlyPoster) || (mode === 'thumb' && !isCurrentlyPoster)) return;

        overlay.style.display = 'flex';
        overlay.style.pointerEvents = 'all'; 
        void overlay.offsetWidth; 
        overlay.style.opacity = '1';

        await new Promise(resolve => setTimeout(resolve, 200));

        try {
            if (mode === 'poster') enablePosterMode();
            else disablePosterMode();

            if (document.body.hasAttribute('data-vod') && typeof window.refreshVODGallery === 'function') {
                window.refreshVODGallery();
                const galleryView = document.getElementById('gallery-view');
                if (galleryView) {
                    await waitForImagesToLoad(galleryView);
                }
            } else {
                if (window.forceReloadRecommendLayout) window.forceReloadRecommendLayout();
                if (typeof refreshSliders === 'function') { 
                    refreshSliders(); 
                    setTimeout(refreshSliders, 300); 
                }
                const rows = document.querySelectorAll('.row-container');
                if (rows.length > 0) {
                    await waitForImagesToLoad(rows[0]);
                }
            }

            await new Promise(resolve => setTimeout(resolve, 100));

        } finally {
            overlay.style.opacity = '0';
            overlay.style.pointerEvents = 'none';
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 200); 
        }
    };
});

/**
 * 指定されたビューを表示し、それ以外を隠す関数
 * @param {string} viewId - 表示したい要素のID ('home-view', 'genre-view' など)
 */
function showView(viewId) {
    console.log(`表示の切り替え: ${viewId}`);

    // ★ 1. genre-view をリストに追加
    const allViews = ['home-view', 'gallery-view', 'mylist-view', 'details-view', 'genre-view'];
    allViews.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    if (viewId !== 'details-view' && viewId !== 'genre-view') {
        if (window.location.search.includes('id=') || window.location.search.includes('genre=')) {
            history.pushState({ view: viewId }, '', window.location.pathname);
        }
    }

    const isVOD = document.body.hasAttribute('data-vod');
    const isLibrary = document.body.hasAttribute('data-library');

    // ★ 復元：VODやライブラリじゃない時は属性をリセットする
    if (viewId === 'home-view' || viewId === 'mylist-view') {
        if (!isVOD && !isLibrary) {
            document.body.removeAttribute('data-vod');
            document.body.removeAttribute('data-library');
            document.body.removeAttribute('data-tab');
        }
    }

    // ★ 2. ヒーローセクションとドットの表示制御
    const hero = document.getElementById('hero-section');
    const mobileDots = document.getElementById('mobile-hero-dots');
    
    // ホーム画面、かつマイリスト等の特殊モードでない場合のみヒーローを表示
    const isHome = (viewId === 'home-view');
    const isMylistMode = (window.currentMediaType === 'MyList');
    const shouldShowHero = isHome && !isMylistMode;

    if (hero) hero.style.display = shouldShowHero ? '' : 'none';
    if (mobileDots) mobileDots.style.display = shouldShowHero ? '' : 'none';

    const target = document.getElementById(viewId);
    if (target) {
        target.style.display = 'block';
        window.scrollTo(0, 0);
    }

    const navbar = document.getElementById('navbar');
    if (navbar) {
        // ジャンルページも「黒背景」にする
        if (isVOD || isLibrary || viewId !== 'home-view') {
            navbar.classList.add('nav-scrolled', 'nav-black');
            navbar.classList.remove('nav-transparent');
        } else {
            navbar.classList.remove('nav-scrolled', 'nav-black');
            navbar.classList.add('nav-transparent');
        }
    }
}