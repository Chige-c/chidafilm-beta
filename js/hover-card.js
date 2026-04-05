/* =========================================
   hover-card.js - 最終調整版 (Unknown撲滅 ＆ 完璧同期方式)
   ========================================= */

(function() {
    let hoverTimer = null;
    let videoTimer = null;
    let currentWrapper = null;

    // --- 監視設定 ---
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { 
                    if (isCard(node)) enhanceCard(node);
                    else node.querySelectorAll('.resume-card, .library-card, .poster-card, .thumb-card, .gallery-item').forEach(enhanceCard);
                }
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    
    setTimeout(() => {
        document.querySelectorAll('.resume-card, .library-card, .poster-card, .thumb-card, .gallery-item').forEach(enhanceCard);
    }, 500);

    function isCard(el) {
    return el.classList.contains('resume-card') || 
           el.classList.contains('library-card') || 
           el.classList.contains('poster-card') ||
           el.classList.contains('thumb-card') ||
           el.classList.contains('gallery-item'); // ★追加
}

    // --- カード改造 ---
    function enhanceCard(card) {
    if (card.dataset.hoverEnhanced) return;
    if (card.closest('.movie-card-wrapper')) return;

    // --- ライブラリカード用の特殊処理 (ここは変更なし) ---
    if (card.classList.contains('library-card')) {
        card.dataset.hoverEnhanced = "true";
        if (!card.querySelector('.library-title-overlay')) {
            const img = card.querySelector('img');
            let itemName = img?.alt || card.innerText.trim() || "Library";
            const overlay = document.createElement('div');
            overlay.className = 'library-title-overlay';
            overlay.innerText = itemName;
            card.appendChild(overlay);
        }
        return; 
    }

    // --- VOD / ホーム共通の強化処理 ---
    card.dataset.hoverEnhanced = "true";

    const wrapper = document.createElement('div');
    wrapper.className = 'movie-card-wrapper';
    
    // 元のカードのクラスをラッパーにコピー（thumb-cardやposter-cardなど）
    card.classList.forEach(cls => wrapper.classList.add(cls));

    // ★ IDの取得を強化：data-id があればそれを使い、なければURLから抜く
    const itemId = card.dataset.id;
    const img = card.querySelector('img');
    
    if (itemId) {
        wrapper.dataset.itemId = itemId;
    } else if (img) {
        const match = img.src.match(/Items\/([a-zA-Z0-9]+)\/Images/);
        if (match) wrapper.dataset.itemId = match[1];
    }

    // ラッピング（入れ子にする）
    card.parentNode.insertBefore(wrapper, card);
    wrapper.appendChild(card);

    // ビデオ用、情報パネル用のHTMLを追加
    const videoWrapper = document.createElement('div');
    videoWrapper.className = 'hover-video-wrapper';
    wrapper.appendChild(videoWrapper);

    // タイトル情報を取得（VODの場合は card.dataset.id があるので後で injectCardDetails が通信して埋めてくれます）
    let localTitle = "";
    const textNodes = card.querySelectorAll('[class*="cardText"]'); 
    if (textNodes.length > 0) localTitle = textNodes[0].innerText.trim();

    const infoHtml = `
        <div class="poster-info-panel">
            <div class="poster-title">${localTitle}</div>
            <div class="poster-year"></div>
        </div>
        <div class="hover-details-panel">
            <div class="hover-details-inner">
                <div class="hover-title">${localTitle}</div>
            </div>
        </div>
    `;
    wrapper.insertAdjacentHTML('beforeend', infoHtml);

    // 元のカードのスタイルをリセット（ラッパーに任せるため）
    card.style.cssText = `
        width: 100% !important; height: 100% !important; margin: 0 !important; 
        padding: 0 !important; border: none !important; background: transparent !important;
        transform: none !important; transition: none !important; display: block !important;
    `;

    if (img) {
        img.style.cssText = `
            width: 100% !important; height: 100% !important; object-fit: cover !important;
            margin: 0 !important; border-radius: 15px !important;
        `;
    }

    // イベントの紐付け
    wrapper.addEventListener('click', (e) => {
        // 1. ボタン類（再生・お気に入りボタン）やその中身がクリックされた場合は、詳細ページへ飛ばない
        if (e.target.closest('button') || e.target.closest('.hover-actions') || e.target.closest('.hover-mute-btn')) {
            return; 
        }

        // 2. それ以外の場所（カード全体）をクリックした場合は詳細ページへ
        const itemId = wrapper.dataset.itemId;
        if (itemId && typeof navigateToDetails === 'function') {
            navigateToDetails(itemId);
        }
    });
    wrapper.addEventListener('mouseenter', handleMouseEnter);
    wrapper.addEventListener('mouseleave', handleMouseLeave);

    card.onclick = null;

    
}

    // --- ホバー処理 ---
    function handleMouseEnter(e) {
    const wrapper = e.currentTarget;
    const itemId = wrapper.dataset.itemId;

    if (currentWrapper && currentWrapper !== wrapper) resetCard(currentWrapper);
    currentWrapper = wrapper;

    // 位置ごとのクラス付け替えはバックグラウンドの事前計算（updateAllOrigins）に任せ、
    // ここではDOMの直接操作を行いません（ホバー時の再計算・ピクつき要因をゼロにするため）。

    clearTimeout(hoverTimer);
    clearTimeout(videoTimer);

    // 詳細データの読み込み
    if (itemId && !wrapper.dataset.detailsLoaded) {
        injectCardDetails(wrapper, itemId);
    }

    // トレーラー再生の予約
    hoverTimer = setTimeout(() => {
        if (!document.body.classList.contains('poster-mode')) {
            videoTimer = setTimeout(() => playTrailer(wrapper), 1500);
        }
    }, 300);
}

// マウスが離れた時の処理も更新
function handleMouseLeave(e) {
    const wrapper = e.currentTarget;
    clearTimeout(hoverTimer);
    clearTimeout(videoTimer);
    
    // ★ 修正：マウスが離れた瞬間にクラスを消すとガタつくため、
    // ここでは位置クラス（is-at-left等）は残したままにし、再ホバー時のレイアウト変更を防止します。
    setTimeout(() => {
        // まだマウスが戻っていない場合のみリセット
        if (!wrapper.matches(':hover')) {
            wrapper.style.zIndex = "";
        }
    }, 400); // 0.4秒待機（CSSのtransition時間に合わせる）
    
    resetCard(wrapper);
}
    // --- 詳細データ注入 ---
    async function injectCardDetails(wrapper, itemId) {
        if (typeof SERVER_URL === 'undefined' || typeof userId === 'undefined' || typeof token === 'undefined') return;

        try {
            const fields = "Overview,ProductionYear,CommunityRating,OfficialRating,RemoteTrailers,Genres,UserData";
            const url = `${SERVER_URL}/Users/${userId}/Items/${itemId}?Fields=${fields}`;
            const res = await fetch(url, { headers: { 'X-Emby-Token': token } });
            const item = await res.json();
            
            wrapper.dataset.detailsLoaded = "true";

            const title = item.Name || 'Unknown Title';
            const year = item.ProductionYear || '';
            const overview = item.Overview || "あらすじ情報はありません。";
            const genres = item.Genres ? item.Genres.slice(0,3).join(' • ') : "";
            
            // お気に入り状態の判定
            const isFav = item.UserData && item.UserData.IsFavorite;
            const favIcon = isFav ? 'check' : 'add';
            const favClass = isFav ? 'hover-icon-btn is-favorite' : 'hover-icon-btn';
            const favTitle = isFav ? 'マイリストから削除' : 'マイリストに追加';

            // 🌟 重要な修正：再生状況（続きからか）を正確に判定
            const playPosition = (item.UserData && item.UserData.PlaybackPositionTicks) ? item.UserData.PlaybackPositionTicks : 0;
            const playLabel = playPosition > 0 ? '続けて観る' : '今すぐ観る';
            
            // 1. ポスター用パネルのテキストを更新
            const posterTitleEl = wrapper.querySelector('.poster-title');
            const posterYearEl = wrapper.querySelector('.poster-year');
            if (posterTitleEl) posterTitleEl.innerText = title;
            if (posterYearEl) posterYearEl.innerText = year;

            // 2. サムネモード用の詳細パネルを作成
            const panelInner = wrapper.querySelector('.hover-details-inner');
            if (panelInner) {
                let ratingHtml = '';
                if (item.CommunityRating) {
                    ratingHtml = `
                        <span class="star-rating">
                            <span class="material-symbols-outlined star-icon">star</span>
                            ${item.CommunityRating.toFixed(1)}
                        </span>
                    `;
                }

                panelInner.innerHTML = `
                    <div class="hover-title">${title}</div> 
                    
                    <div class="hover-actions">
                        <button class="hover-icon-btn play" onclick="startPlayback('${itemId}')">
                            <span class="material-symbols-outlined play-icon">play_arrow</span>
                            <span class="play-text">${playLabel}</span>
                        </button>
                        <div class="other-actions">
                            <button class="${favClass}" title="${favTitle}" onclick="window.toggleHoverFavorite('${itemId}', this, event)">
                                <span class="material-symbols-outlined">${favIcon}</span>
                            </button>
                        </div>
                    </div>
                    
                    <div class="hover-meta-row">
                        ${ratingHtml}
                        <span>${year}</span>
                    </div>
                    <div class="hover-genres-text">${genres}</div>
                    <div class="hover-overview-text">${overview}</div>
                `;
            }
            
            if (item.RemoteTrailers && item.RemoteTrailers.length > 0) {
                wrapper.dataset.trailerUrl = item.RemoteTrailers[0].Url;
            }
        } catch (err) { console.error(err); }
    }

    let activeHoverPlayer = null; // 現在再生中のプレーヤーを保持

    function playTrailer(wrapper) {
        const container = wrapper.querySelector('.hover-video-wrapper');
        const trailerUrl = wrapper.dataset.trailerUrl;
        if (!container || !trailerUrl) return;

        const ytMatch = trailerUrl.match(/v=([^#&?]*)/);
        if (!ytMatch) return;
        const vid = ytMatch[1];

        container.style.display = 'block';
        
        // ★ 追加1: 最初は透明にしておき、背景画像だけを見せる
        container.style.opacity = '0';
        container.style.transition = 'opacity 0.6s ease';
        
        // プレーヤーを入れるためのdivを作成
        const playerDiv = document.createElement('div');
        container.innerHTML = '';
        container.appendChild(playerDiv);

        // ミュートボタンを作成して追加
        const muteBtn = document.createElement('button');
        muteBtn.className = 'hover-mute-btn';
        muteBtn.innerHTML = '<span class="material-symbols-outlined">volume_off</span>';
        container.appendChild(muteBtn);

        // YouTube APIを使用してプレーヤーを初期化
        activeHoverPlayer = new YT.Player(playerDiv, {
            height: '100%',
            width: '100%',
            videoId: vid,
            playerVars: {
                autoplay: 1,
                mute: 1,
                controls: 0,
                modestbranding: 1,
                loop: 1,
                playlist: vid,
                iv_load_policy: 3,
                disablekb: 1,
                fs: 0,
                rel: 0,
                enablejsapi: 1,
                origin: window.location.origin
            },
            events: {
                onReady: (event) => {
                    event.target.playVideo();
                    
                    // ミュートボタンのクリックイベント
                    muteBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const icon = muteBtn.querySelector('span');
                        if (activeHoverPlayer.isMuted()) {
                            activeHoverPlayer.unMute();
                            icon.innerText = 'volume_up';
                        } else {
                            activeHoverPlayer.mute();
                            icon.innerText = 'volume_off';
                        }
                    });
                },
                // ★ 追加2: 再生状態を監視して、再生が始まったら表示する
                onStateChange: (event) => {
                    // event.data === 1 は「再生中（Playing）」
                    if (event.data === 1) {
                        // YouTubeのロード中UIが消えたタイミングでフワッと表示！
                        container.style.opacity = '1';
                    }
                }
            }
        });
    }

    function resetCard(wrapper) {
        const container = wrapper.querySelector('.hover-video-wrapper');
        if (container) {
            container.style.display = 'none';
            if (activeHoverPlayer) {
                try {
                    activeHoverPlayer.destroy();
                } catch(e) {}
                activeHoverPlayer = null;
            }
            container.innerHTML = '';
        }
    }

    // ★ ここに以下の 4行を追加します！
    window.initializeHoverEvents = function(container) {
        const target = container || document;
        target.querySelectorAll('.resume-card, .library-card, .poster-card, .thumb-card, .gallery-item').forEach(enhanceCard);
    };

    window.toggleHoverFavorite = async function(itemId, btnElement, event) {
        if (event) event.stopPropagation(); // クリックが裏に貫通するのを防ぐ

        const currentUserId = typeof userId !== 'undefined' ? userId : localStorage.getItem('userId');
        const currentToken = typeof token !== 'undefined' ? token : localStorage.getItem('token');
        const currentServer = typeof SERVER_URL !== 'undefined' ? SERVER_URL : localStorage.getItem('serverUrl');

        const icon = btnElement.querySelector('.material-symbols-outlined');
        const isAdding = icon.innerText.trim() === 'add';

        // 押した瞬間にアニメーションさせる（プチ演出）
        btnElement.style.transform = 'scale(0.8)';
        setTimeout(() => btnElement.style.transform = '', 150);

        try {
            if (isAdding) {
                // 追加処理
                await fetch(`${currentServer}/Users/${currentUserId}/FavoriteItems/${itemId}`, {
                    method: 'POST',
                    headers: { 'X-Emby-Token': currentToken }
                });
                icon.innerText = 'check';
                btnElement.title = 'マイリストから削除';
                btnElement.classList.add('is-favorite');
            } else {
                // 削除処理
                await fetch(`${currentServer}/Users/${currentUserId}/FavoriteItems/${itemId}`, {
                    method: 'DELETE',
                    headers: { 'X-Emby-Token': currentToken }
                });
                icon.innerText = 'add';
                btnElement.title = 'マイリストに追加';
                btnElement.classList.remove('is-favorite');

                // もしマイリスト画面にいるなら、即座に画面から消す連携
                if (window.currentMediaType === 'MyList' && typeof loadMyListItems === 'function') {
                    setTimeout(() => loadMyListItems(), 300); // 演出の余韻を残して更新
                }
            }
        } catch (e) {
            console.error('マイリストの操作に失敗しました:', e);
        }
    };

    // --- スクロール等による「端っこ」の事前計算 ---
    // マウスを乗せた瞬間にクラスを付け替えると「ピクつき」の原因になるため、
    // 0.3秒おきに事前にカードの位置を監視し、クラスを割り当てておきます。
    function updateAllOrigins() {
        const wrappers = document.querySelectorAll('.movie-card-wrapper');
        if (!wrappers.length) return;
        
        const screenWidth = document.documentElement.clientWidth;
        const edgeThreshold = screenWidth * 0.1; // 10%以内なら端

        wrappers.forEach(wrapper => {
            const rect = wrapper.getBoundingClientRect();
            // 画面外のものは計算をスキップして軽量化
            if (rect.right < 0 || rect.left > screenWidth) return; 

            // ホバー中のものは途中で強制的に起点を変えるとピクつくため更新をスキップ
            if (wrapper.matches(':hover') || wrapper.matches('.is-hovering')) return;

            let xOrigin = '50%';
            if (rect.left < edgeThreshold) {
                xOrigin = '0%';
            } else if ((screenWidth - rect.right) < edgeThreshold) {
                xOrigin = '100%';
            }

            // カード（画像部分）の本来の高さを基準にY軸の起点を「固定ピクセル」で指定する。
            // これにより、後から詳細パネルに長文の「あらすじ」が追記されてレイヤー下部がどれだけ膨張しても、
            // 拡大の中心点が下にズレず、画像が「上に跳ね上がる（ピクつく）」現象を完全に防ぐことができます。
            const yOrigin = (rect.height / 2) + 'px';
            const newOrigin = `${xOrigin} ${yOrigin}`;

            if (wrapper.style.transformOrigin !== newOrigin) {
                wrapper.style.transformOrigin = newOrigin;
            }
        });
    }

    // イベントリスナーの代わりに定期的に監視を開始（確実な処理のため）
    setInterval(updateAllOrigins, 300);

})();