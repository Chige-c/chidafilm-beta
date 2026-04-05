/* =====================================================
   mobile.js - CHIDACINEMA スマホ専用スクリプト
   対象: 幅768px以下のスマートフォン
   ===================================================== */

// スマホ幅のみ対象（768px超=PC/タブレット → 全処理をスキップ）
if (window.innerWidth <= 768) {
    document.addEventListener('DOMContentLoaded', function() {
        initMobile();
    });
}

function initMobile() {
    // ============================================================
    // 1. ヒーローセクションの初期化
    // ============================================================
    setupMobileHero();

    // ============================================================
    // 2. 各スライダー行への横スワイプ設定
    // ============================================================
    setupSliderSwipe();

    // ============================================================
    // 3. ナビゲーションバーの物理連動（スクロール同期）
    // ============================================================
    setupScrollHeader();
}

/* ---- 1. ヒーローセクション ---- */
function setupMobileHero() {
    const navbar      = document.getElementById('navbar');
    const heroSection = document.getElementById('hero-section');
    
    // 既存ドット (#hero-dots) の移動処理は廃止。
    // 代わりに index.html に新設した #mobile-hero-dots を直接使用する。

    heroSection.style.cursor = 'pointer';

    // ── スワイプ変数 ──────────────────────────────
    let touchStartX = 0;
    let touchStartY = 0;
    let isSwiping   = false;

    // タッチ開始：座標を記録
    heroSection.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].clientX;
        touchStartY = e.changedTouches[0].clientY;
        isSwiping   = false;
    }, { passive: true });

    // タッチ移動中：横スワイプなら縦スクロールを阻止
    heroSection.addEventListener('touchmove', function(e) {
        const diffX = Math.abs(e.changedTouches[0].clientX - touchStartX);
        const diffY = Math.abs(e.changedTouches[0].clientY - touchStartY);
        // 横方向の移動が縦より大きく、かつキャンセル可能な場合のみ阻止
        if (diffX > diffY && diffX > 10 && e.cancelable) {
            e.preventDefault();
            isSwiping = true;
        }
    }, { passive: false });

    // タッチ終了：50px以上の横移動でスライド切り替え
    heroSection.addEventListener('touchend', function(e) {
        const swipeX = e.changedTouches[0].clientX - touchStartX;
        const swipeY = Math.abs(e.changedTouches[0].clientY - touchStartY);

        if (Math.abs(swipeX) >= 50 && Math.abs(swipeX) > swipeY) {
            isSwiping = true;
            if (swipeX < 0) {
                // 左スワイプ → 次の作品
                if (typeof showSlide === 'function') {
                    showSlide(currentIndex + 1);
                    if (typeof resetTimer === 'function') resetTimer();
                }
            } else {
                // 右スワイプ → 前の作品
                if (typeof showSlide === 'function') {
                    showSlide(currentIndex - 1);
                    if (typeof resetTimer === 'function') resetTimer();
                }
            }
        } else {
            isSwiping = false;
        }
    }, { passive: true });

    // タップで詳細を開く（スワイプと区別）
    heroSection.addEventListener('click', function(e) {
        if (e.target.closest('#mute-toggle')) return;
        if (isSwiping) { isSwiping = false; return; }
        if (typeof infoHero === 'function') infoHero();
    });
}

/* ---- 2. スライダー行のネイティブスクロール適正化 ---- */
function setupSliderSwipe() {
    // 1. スライダー行に対してブラウザ標準の滑らかなスクロールを強制する
    function applyNativeScroll(row) {
        if (!row) return;

        // PC版の handle.js が transform を操作してスクロールを止めてしまうのを
        // JS側からも強制的に阻止する（CSS !important でも稀に上書きされるため）
        row.style.setProperty('transform', 'none', 'important');
        row.style.setProperty('transition', 'none', 'important');
        row.style.setProperty('overflow-x', 'auto', 'important');
        row.style.setProperty('scroll-snap-type', 'x mandatory', 'important');
        row.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
        row.style.setProperty('touch-action', 'pan-x pan-y', 'important'); // 縦横両方の操作をブラウザに任せる

        // 各カードにスナップポイントが設定されていることを保証
        row.querySelectorAll('.poster-card, .resume-card, .thumb-card, .library-card').forEach(card => {
            card.style.setProperty('scroll-snap-align', 'start', 'important');
            card.style.setProperty('flex-shrink', '0', 'important');
        });
    }

    // ページ読み込み時点で存在する全行に適用
    document.querySelectorAll('.movie-row, #resume-grid, #library-grid, #popularity-grid').forEach(applyNativeScroll);

    // 動的に追加される行（非同期ロードされるスライダー）にも自動適用
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType !== 1) return;

                if (node.classList && (
                    node.classList.contains('movie-row') ||
                    ['resume-grid', 'library-grid', 'popularity-grid'].includes(node.id)
                )) {
                    applyNativeScroll(node);
                }

                node.querySelectorAll && node.querySelectorAll(
                    '.movie-row, #resume-grid, #library-grid, #popularity-grid'
                ).forEach(applyNativeScroll);
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

/* ---- 3. ナビゲーションバーの物理連動（スクロール同期） ---- */
function setupScrollHeader() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    let lastScrollY = window.pageYOffset;
    let currentTranslateY = 0;
    const headerHeight = navbar.offsetHeight || 100; // およその高さ

    window.addEventListener('scroll', function() {
        const currentScrollY = window.pageYOffset;
        const deltaY = currentScrollY - lastScrollY;
        const headerHeight = navbar.offsetHeight; // リアルタイムな全高を取得

        // ページ最上部では必ずリセット
        if (currentScrollY <= 0) {
            currentTranslateY = 0;
        } else {
            // スクロールに合わせて位置を動かす (デルタ分を減産)
            // 下スクロール (deltaY > 0) -> translateY はマイナス方向へ
            // 上スクロール (deltaY < 0) -> translateY はプラス方向へ
            currentTranslateY -= deltaY;

            // -headerHeight 〜 0 の範囲に制限
            if (currentTranslateY < -headerHeight) currentTranslateY = -headerHeight;
            if (currentTranslateY > 0) currentTranslateY = 0;
        }

        // 即座に反映 (transform は GPU で処理されるため高速)
        navbar.style.transform = `translateY(${currentTranslateY}px)`;
        lastScrollY = currentScrollY;
    }, { passive: true });
}
