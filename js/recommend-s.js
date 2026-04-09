/* =========================================
   recommend-s.js - 完了版（ハンドルサイズ微調整）
   ========================================= */
(function() {
    let globalOpenTimer = null; 
    let videoTimer = null; 
    let stickyShift = 0;    
    let activeCardPlayer = null; 
    let isResizeListenerAdded = false;

    // トークン取得
    function getAuthToken() {
        if (typeof token !== 'undefined' && token) return token;
        if (window.token) return window.token;
        if (window.ApiClient && typeof window.ApiClient.accessToken === 'function') {
            return window.ApiClient.accessToken();
        }
        return localStorage.getItem('jellyfin_accesstoken') || '';
    }

    // --- レイアウト初期化 ---
    function initRecommendLayout() {
        const grid = document.getElementById('popularity-grid');
        if (!grid) return;

        Object.assign(grid.style, {
            position: 'relative', display: 'block', whiteSpace: 'nowrap', 
            overflow: 'visible', width: '100%', backgroundColor: 'transparent'
        });
        if (grid.parentElement) grid.parentElement.style.overflow = 'visible';

        const SIDE_PADDING_RATE = 0.02575;
        const GAP = 10;
        const ASPECT_RATIO_POSTER = 1.5;
        
        const EXPAND_SPEED = '0.45s';

        function getItemsPerRow() {
            if (window.innerWidth < 768) return 2.1; // モバイルは 2.1枚表示
            return window.innerWidth <= 1950 ? 5 : 6;
        }

        // ★修正：左ハンドル（戻るボタン）のデザイン微調整
        function updateLeftHandle() {
            let handle = document.getElementById('recommend-left-reset-handle');
            if (!handle) {
                handle = document.createElement('div');
                handle.id = 'recommend-left-reset-handle';
                handle.className = 'custom-handle'; 

                Object.assign(handle.style, {
                    position: 'absolute', left: '0', top: '0', bottom: '0',
                    width: '4%', zIndex: '200', cursor: 'pointer',
                    display: 'none', alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(to right, rgba(0,0,0,0.7), transparent)',
                    color: 'white', 
                    // ★修正：サイズをピクセルで明示的に指定（他のハンドルと合わせる）
                    fontSize: '50px', 
                    transition: 'background 0.3s ease, opacity 0.3s ease'
                });
                
                // アイコンのサイズも強制的に合わせる
                handle.innerHTML = '<span class="material-symbols-outlined" style="font-size: 50px;">arrow_back_ios</span>';
                
                handle.onmouseenter = () => {
                    handle.style.background = 'linear-gradient(to right, rgba(0,0,0,0.9), transparent)';
                    stickyShift = 0;
                    updateLayout();
                    setTimeout(checkHoverAfterReset, 500);
                };
                handle.onmouseleave = () => {
                    handle.style.background = 'linear-gradient(to right, rgba(0,0,0,0.7), transparent)';
                };
                
                if (grid.parentElement) {
                    grid.parentElement.style.position = 'relative'; 
                    grid.parentElement.appendChild(handle);
                }
            }

            const scrollOffset = parseInt(grid.dataset.scrollOffset || 0);
            
            if (stickyShift > 10 && scrollOffset === 0) {
                handle.style.display = 'flex';
            } else {
                handle.style.display = 'none';
            }
        }

        function checkHoverAfterReset() {
            const hoveredCard = grid.querySelector('.recommend-poster-card:hover');
            if (hoveredCard) {
                hoveredCard.dispatchEvent(new Event('mouseenter'));
            }
        }

        function updateLayout() {
            // ★追加：モバイル環境（768px未満）では複雑な絶対配置を停止し、CSS(flex)に任せる
            if (window.innerWidth < 768) {
                const currentCards = Array.from(grid.querySelectorAll('.recommend-poster-card'));
                currentCards.forEach(card => {
                    // インラインスタイルをリセットして CSS（mobile.css）の設定を有効にする
                    card.style.position = '';
                    card.style.left = '';
                    card.style.width = '';
                    card.style.height = '';
                    card.style.transition = '';
                    card.style.opacity = '';
                    card.style.zIndex = '';
                });
                grid.style.height = 'auto';
                return;
            }

            const currentCards = Array.from(grid.querySelectorAll('.recommend-poster-card'));
            if (!currentCards.length) return;

            // 1. モード判定
            const isPosterMode = document.body.classList.contains('poster-mode');
            const ASPECT_RATIO = 1.5;

            const itemsPerRow = getItemsPerRow();
            const scrollOffset = parseInt(grid.dataset.scrollOffset || 0);
            const windowWidth = window.innerWidth;
            const screenLeftEdge = windowWidth * SIDE_PADDING_RATE;
            const screenRightLimit = windowWidth * (1 - SIDE_PADDING_RATE);

            // 2. 基本の幅を計算
            const baseWidth = (windowWidth - (windowWidth * SIDE_PADDING_RATE * 2) - (GAP * (itemsPerRow - 1))) / itemsPerRow;
            
            // 3. 高さを計算（二重宣言を削除し、動的な比率を適用）
            const posterHeight = baseWidth * ASPECT_RATIO;
            
            // 4. 拡大時の幅（ポスターなら16:9、サムネなら1.5倍に設定）
            const expandedWidth = posterHeight * (16 / 9);
            const growth = expandedWidth - baseWidth;

            grid.style.height = `${posterHeight + 40}px`;
            
            const expandedIdx = currentCards.findIndex(c => c.classList.contains('is-expanded'));

            // 5. はみ出し補正の計算
            if (expandedIdx === -1) {
                stickyShift = 0;
            } else {
                const originalLeft = screenLeftEdge + (expandedIdx * (baseWidth + GAP)) - (scrollOffset * (baseWidth + GAP));
                const potentialRight = originalLeft + expandedWidth;
                const overflow = potentialRight - screenRightLimit;
                let currentRequiredShift = 0;
                if (overflow > 0) currentRequiredShift = overflow;
                if (currentRequiredShift > stickyShift) stickyShift = currentRequiredShift;
            }

            // 6. 各カードへの配置適用
            currentCards.forEach((card, index) => {
                const relativeIdx = index - scrollOffset;
                const absoluteLeft = screenLeftEdge + (index * (baseWidth + GAP));
                const scrollShift = scrollOffset * (baseWidth + GAP);
                
                let targetLeft = absoluteLeft - scrollShift - stickyShift;
                let targetWidth = baseWidth;
                let opacity = (relativeIdx < -1 || relativeIdx > itemsPerRow) ? 0 : 1;

                if (expandedIdx !== -1 && opacity > 0) {
                    if (index === expandedIdx) {
                        targetWidth = expandedWidth;
                    } else if (index > expandedIdx) {
                        targetLeft += growth;
                    }
                }

                Object.assign(card.style, {
                    display: 'block', 
                    opacity: opacity,
                    pointerEvents: opacity === 0 ? 'none' : 'auto',
                    left: `${targetLeft}px`, 
                    width: `${targetWidth}px`, 
                    height: `${posterHeight}px`,
                    zIndex: (index === expandedIdx) ? '101' : (20 - Math.abs(relativeIdx)).toString(),
                    transition: `width ${EXPAND_SPEED} cubic-bezier(0.4, 0, 0.2, 1), left ${EXPAND_SPEED} cubic-bezier(0.4, 0, 0.2, 1), opacity ${EXPAND_SPEED} ease`
                });

                // 画像の切り替え
                const isThisExpanded = (index === expandedIdx);
                const pImg = card.querySelector('.recommend-poster-img');
                const tImg = card.querySelector('.recommend-thumb-img');
                
                if (pImg) {
                    pImg.style.width = `${baseWidth}px`;
                    pImg.style.opacity = isThisExpanded ? '0' : '1';
                }
                if (tImg) {
                    tImg.style.width = `${expandedWidth}px`;
                    tImg.style.opacity = isThisExpanded ? '1' : '0';
                    tImg.style.left = '0';
                }
            });

            updateLeftHandle();
        }


        window.updateRecommendLayout = updateLayout;


        // --- YouTube関連 ---
        function extractYouTubeId(url) {
            if (!url) return null;
            const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
            return (match && match[2].length === 11) ? match[2] : null;
        }

        async function getYouTubeIdFromJellyfin(itemId) {
            const token = getAuthToken();
            if (!token) return null;
            try {
                const res = await fetch(`${SERVER_URL}/Users/${userId}/Items/${itemId}`, {
                    headers: { 'X-Emby-Token': token, 'Accept': 'application/json' }
                });
                if (!res.ok) return null;
                const data = await res.json();
                if (data.RemoteTrailers && data.RemoteTrailers.length > 0) {
                    return extractYouTubeId(data.RemoteTrailers[0].Url);
                }
            } catch (e) {}
            return null;
        }

        async function playYouTubeTrailer(card) {
            if (card.querySelector('.youtube-preview-container')) return;
            let itemId = card.dataset.itemId;
            
            const videoId = await getYouTubeIdFromJellyfin(itemId);
            
            if (!card.matches(':hover') || !card.classList.contains('is-expanded')) return;
            if (!videoId) return;

            // ==============================================================
            // ★ 追加：ロゴ、再生ボタン、順位番号などを動画（z-index:10）よりも手前（15）に引き上げる
            const infoContainer = card.querySelector('.recommend-info-container');
            if (infoContainer) {
                // positionが指定されていない場合はrelativeを追加してz-indexを効かせる
                if (window.getComputedStyle(infoContainer).position === 'static') {
                    infoContainer.style.position = 'relative';
                }
                infoContainer.style.zIndex = '15';
            }
            
            const rankNumber = card.querySelector('.rank-number');
            if (rankNumber) {
                if (window.getComputedStyle(rankNumber).position === 'static') {
                    rankNumber.style.position = 'relative';
                }
                rankNumber.style.zIndex = '15';
            }
            // ==============================================================

            const wrapper = document.createElement('div');
            wrapper.className = 'youtube-preview-container';
            Object.assign(wrapper.style, {
                position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
                zIndex: '5', borderRadius: '4px', overflow: 'hidden', opacity: '0',
                transition: 'opacity 0.6s ease', pointerEvents: 'none'
            });

            const container = card.querySelector('.recommend-thumb-wrapper') || card;
            const muteBtn = document.createElement('div');
            muteBtn.className = 'card-mute-btn';
            
            Object.assign(muteBtn.style, {
                position: 'absolute', bottom: '25px', right: '25px', width: '50px', height: '50px',
                borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', 
                zIndex: '20', pointerEvents: 'auto',
                opacity: '0',                      
                transition: 'opacity 0.6s ease'    
            });
            
            muteBtn.innerHTML = '<span class="material-symbols-outlined" style="color:white;font-size:28px;">volume_off</span>';
            
            muteBtn.onclick = (e) => {
                e.stopPropagation();
                if (activeCardPlayer && activeCardPlayer.isMuted) {
                    if (activeCardPlayer.isMuted()) { activeCardPlayer.unMute(); muteBtn.innerHTML='<span class="material-symbols-outlined" style="color:white;font-size:28px;">volume_up</span>'; }
                    else { activeCardPlayer.mute(); muteBtn.innerHTML='<span class="material-symbols-outlined" style="color:white;font-size:28px;">volume_off</span>'; }
                }
            };
            container.appendChild(muteBtn);

            const playerDiv = document.createElement('div');
            const uniqueId = `yt-player-${itemId}-${Date.now()}`;
            playerDiv.id = uniqueId;
            wrapper.appendChild(playerDiv);
            container.appendChild(wrapper);

            if (typeof YT !== 'undefined' && YT.Player) {
                activeCardPlayer = new YT.Player(playerDiv, { 
                    videoId: videoId, 
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
                        onStateChange: (e) => {
                            // 動画が動き出した瞬間(1)に、動画とミュートボタンを「同時に」表示！
                            if (e.data === 1) { 
                                wrapper.style.opacity = '1';
                                wrapper.style.zIndex = '10'; // 動画本体は10（情報コンテナは15なので下になる）
                                
                                muteBtn.style.opacity = '1'; 
                            }
                        }
                    }
                });
            }
        }

        function stopYouTubeTrailer(card) {
            if (activeCardPlayer) {
                try { activeCardPlayer.destroy(); } catch(e){}
                activeCardPlayer = null;
            }
            const wrapper = card.querySelector('.youtube-preview-container');
            if (wrapper) wrapper.remove();
            const btn = card.querySelector('.card-mute-btn');
            if (btn) btn.remove();
        }

        function isCardFullyVisible(card) {
            const rect = card.getBoundingClientRect();
            const screenLeftEdge = window.innerWidth * SIDE_PADDING_RATE;
            return rect.left >= (screenLeftEdge - 10);
        }

        // --- イベント設定 ---
        function setupEvents() {
            const currentCards = grid.querySelectorAll('.recommend-poster-card');
            
            currentCards.forEach((card) => {
                if (card.dataset.eventAttached === 'true') return;
                card.dataset.eventAttached = 'true';

                card.onmouseenter = () => {
                    clearTimeout(globalOpenTimer);
                    clearTimeout(videoTimer);

                    if (!isCardFullyVisible(card)) return;
                    
                    globalOpenTimer = setTimeout(() => {
                        if (!card.matches(':hover')) return;
                        if (!isCardFullyVisible(card)) return;

                        const allCards = grid.querySelectorAll('.recommend-poster-card');
                        allCards.forEach(c => {
                            if (c !== card) {
                                c.classList.remove('is-expanded');
                                stopYouTubeTrailer(c);
                            }
                        });
                        
                        card.classList.add('is-expanded');
                        updateLayout();

                        videoTimer = setTimeout(() => {
                            if (card.matches(':hover') && card.classList.contains('is-expanded')) {
                                playYouTubeTrailer(card);
                            }
                        }, 900); 
                    }, 500);
                };

                card.onmouseleave = () => {
                    clearTimeout(globalOpenTimer);
                    clearTimeout(videoTimer);
                    stopYouTubeTrailer(card);
                };
            });

            grid.onmouseleave = () => {
                clearTimeout(globalOpenTimer);
                clearTimeout(videoTimer);
                const allCards = grid.querySelectorAll('.recommend-poster-card');
                allCards.forEach(c => stopYouTubeTrailer(c));
                allCards.forEach(c => c.classList.remove('is-expanded'));
                updateLayout();
            };
        }

        setupEvents();
        updateLayout();
        
        if (!isResizeListenerAdded) {
            window.addEventListener('resize', () => updateLayout());
            isResizeListenerAdded = true;
        }
    }

    // 外部公開メソッド
    window.forceReloadRecommendLayout = function() {
        if (activeCardPlayer) {
            try { activeCardPlayer.destroy(); } catch(e){}
            activeCardPlayer = null;
        }
        stickyShift = 0;
        initRecommendLayout();
        if (typeof window.updateRecommendLayout === 'function') {
            window.updateRecommendLayout();
        }
    };

    const checkGrid = setInterval(() => {
        if (document.getElementById('popularity-grid')) {
            clearInterval(checkGrid);
            initRecommendLayout();
        }
    }, 500);
})();