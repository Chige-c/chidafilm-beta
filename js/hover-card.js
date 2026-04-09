/* =========================================
   hover-card.js - 究極滑らか版 (IntersectionObserver 採用)
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
               el.classList.contains('gallery-item');
    }

    // --- カード改造 ---
    function enhanceCard(card) {
        if (card.dataset.hoverEnhanced) return;
        if (card.closest('.movie-card-wrapper')) return;

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

        card.dataset.hoverEnhanced = "true";

        const wrapper = document.createElement('div');
        wrapper.className = 'movie-card-wrapper';
        
        card.classList.forEach(cls => wrapper.classList.add(cls));

        const itemId = card.dataset.id;
        const img = card.querySelector('img');
        
        if (itemId) {
            wrapper.dataset.itemId = itemId;
        } else if (img) {
            const match = img.src.match(/Items\/([a-zA-Z0-9]+)\/Images/);
            if (match) wrapper.dataset.itemId = match[1];
        }

        card.parentNode.insertBefore(wrapper, card);
        wrapper.appendChild(card);

        const videoWrapper = document.createElement('div');
        videoWrapper.className = 'hover-video-wrapper';
        wrapper.appendChild(videoWrapper);

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

        wrapper.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('.hover-actions') || e.target.closest('.hover-mute-btn')) {
                return; 
            }
            const itemId = wrapper.dataset.itemId;
            if (itemId && typeof navigateToDetails === 'function') {
                navigateToDetails(itemId);
            }
        });
        wrapper.addEventListener('mouseenter', handleMouseEnter);
        wrapper.addEventListener('mouseleave', handleMouseLeave);

        card.onclick = null;

        // 【究極滑らか対策1】最初の一回目のガクつきを防ぐため、高さを事前保存
        requestAnimationFrame(() => {
            const h = wrapper.offsetHeight;
            if (h > 0) wrapper.dataset.baseHeight = h;
        });

        // 【究極滑らか対策2】端っこ判定Observerに登録
        if (typeof edgeObserver !== 'undefined') {
            edgeObserver.observe(wrapper);
        }
    }

    // --- ホバー処理 ---
    function handleMouseEnter(e) {
        const wrapper = e.currentTarget;
        const itemId = wrapper.dataset.itemId;

        // 強制リセット: 前の残像や縮小中状態を即座に消す
        wrapper.classList.remove('is-shrinking', 'is-hovered');
        wrapper.style.zIndex = "";

        if (currentWrapper && currentWrapper !== wrapper) resetCard(currentWrapper);
        currentWrapper = wrapper;

        // 起点の確定（垂直方向のピクつきを完全に封じる）
        const baseH = wrapper.dataset.baseHeight || wrapper.offsetHeight;
        if (baseH > 0) {
            const yOrigin = (baseH / 2) + 'px';
            wrapper.style.setProperty('--y-origin', yOrigin);
        }

        // 次の描画フレームで拡大を開始（少しだけ待機時間を設けて負荷分散と誤爆防止）
        clearTimeout(wrapper.scaleTimer);
        wrapper.scaleTimer = setTimeout(() => {
            if (currentWrapper === wrapper) {
                wrapper.classList.add('is-hovered');
            }
        }, 150);

        clearTimeout(hoverTimer);
        clearTimeout(videoTimer);

        if (itemId && !wrapper.dataset.detailsLoaded) {
            injectCardDetails(wrapper, itemId);
        }

        hoverTimer = setTimeout(() => {
            if (!document.body.classList.contains('poster-mode')) {
                videoTimer = setTimeout(() => playTrailer(wrapper), 1500);
            }
        }, 300);
    }

    function handleMouseLeave(e) {
        const wrapper = e.currentTarget;
        clearTimeout(hoverTimer);
        clearTimeout(videoTimer);
        clearTimeout(wrapper.scaleTimer);
        
        wrapper.classList.remove('is-hovered');
        wrapper.classList.add('is-shrinking');
        
        setTimeout(() => {
            if (!wrapper.matches(':hover')) {
                wrapper.classList.remove('is-shrinking');
                wrapper.style.zIndex = "";
            }
        }, 250); 
        
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
            const isFav = item.UserData && item.UserData.IsFavorite;
            const favIcon = isFav ? 'check' : 'add';
            const favClass = isFav ? 'hover-icon-btn is-favorite' : 'hover-icon-btn';
            const favTitle = isFav ? 'マイリストから削除' : 'マイリストに追加';
            const playPosition = (item.UserData && item.UserData.PlaybackPositionTicks) ? item.UserData.PlaybackPositionTicks : 0;
            const playLabel = playPosition > 0 ? '続けて観る' : '今すぐ観る';
            
            const posterTitleEl = wrapper.querySelector('.poster-title');
            const posterYearEl = wrapper.querySelector('.poster-year');
            if (posterTitleEl) posterTitleEl.innerText = title;
            if (posterYearEl) posterYearEl.innerText = year;

            const panelInner = wrapper.querySelector('.hover-details-inner');
            if (panelInner) {
                let ratingHtml = '';
                if (item.CommunityRating) {
                    ratingHtml = `<span class="star-rating"><span class="material-symbols-outlined star-icon">star</span>${item.CommunityRating.toFixed(1)}</span>`;
                }
                panelInner.innerHTML = `
                    <div class="hover-title">${title}</div> 
                    <div class="hover-actions">
                        <button class="hover-icon-btn play" onclick="startPlayback('${itemId}')">
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" class="play-icon"><path fill="currentColor" d="M8 17.175V6.825q0-.425.3-.713t.7-.287q.125 0 .263.037t.262.113l8.15 5.175q.225.15.338.375t.112.475t-.112.475t-.338.375l-8.15 5.175q-.125.075-.262.113T9 18.175q-.4 0-.7-.288t-.3-.712"/></svg>
                            <span class="play-text">${playLabel}</span>
                        </button>
                        <div class="other-actions">
                            <button class="${favClass}" title="${favTitle}" onclick="window.toggleHoverFavorite('${itemId}', this, event)">
                                <span class="material-symbols-outlined">${favIcon}</span>
                            </button>
                        </div>
                    </div>
                    <div class="hover-meta-row">${ratingHtml}<span>${year}</span></div>
                    <div class="hover-genres-text">${genres}</div>
                    <div class="hover-overview-text">${overview}</div>
                `;
            }
            if (item.RemoteTrailers && item.RemoteTrailers.length > 0) {
                wrapper.dataset.trailerUrl = item.RemoteTrailers[0].Url;
            }
        } catch (err) { console.error(err); }
    }

    let activeHoverPlayer = null;

    function playTrailer(wrapper) {
        const container = wrapper.querySelector('.hover-video-wrapper');
        const trailerUrl = wrapper.dataset.trailerUrl;
        if (!container || !trailerUrl) return;
        const ytMatch = trailerUrl.match(/v=([^#&?]*)/);
        if (!ytMatch) return;
        const vid = ytMatch[1];
        container.style.display = 'block';
        container.style.opacity = '0';
        container.style.transition = 'opacity 0.6s ease';
        const playerDiv = document.createElement('div');
        container.innerHTML = '';
        container.appendChild(playerDiv);
        const muteBtn = document.createElement('button');
        muteBtn.className = 'hover-mute-btn';
        muteBtn.innerHTML = '<span class="material-symbols-outlined">volume_off</span>';
        container.appendChild(muteBtn);

        activeHoverPlayer = new YT.Player(playerDiv, {
            height: '100%', width: '100%', videoId: vid,
            playerVars: { autoplay: 1, mute: 1, controls: 0, modestbranding: 1, loop: 1, playlist: vid, iv_load_policy: 3, disablekb: 1, fs: 0, rel: 0, enablejsapi: 1, origin: window.location.origin },
            events: {
                onReady: (event) => {
                    event.target.playVideo();
                    muteBtn.addEventListener('click', (e) => {
                        e.preventDefault(); e.stopPropagation();
                        const icon = muteBtn.querySelector('span');
                        if (activeHoverPlayer.isMuted()) { activeHoverPlayer.unMute(); icon.innerText = 'volume_up'; }
                        else { activeHoverPlayer.mute(); icon.innerText = 'volume_off'; }
                    });
                },
                onStateChange: (event) => { if (event.data === 1) container.style.opacity = '1'; }
            }
        });
    }

    function resetCard(wrapper) {
        const container = wrapper.querySelector('.hover-video-wrapper');
        if (container) {
            container.style.display = 'none';
            if (activeHoverPlayer) {
                try { activeHoverPlayer.destroy(); } catch(e) {}
                activeHoverPlayer = null;
            }
            container.innerHTML = '';
        }
    }

    window.initializeHoverEvents = function(container) {
        const target = container || document;
        target.querySelectorAll('.resume-card, .library-card, .poster-card, .thumb-card, .gallery-item').forEach(enhanceCard);
    };

    window.toggleHoverFavorite = async function(itemId, btnElement, event) {
        if (event) event.stopPropagation();
        const currentUserId = typeof userId !== 'undefined' ? userId : localStorage.getItem('userId');
        const currentToken = typeof token !== 'undefined' ? token : localStorage.getItem('token');
        const currentServer = typeof SERVER_URL !== 'undefined' ? SERVER_URL : localStorage.getItem('serverUrl');
        const icon = btnElement.querySelector('.material-symbols-outlined');
        const isAdding = icon.innerText.trim() === 'add';
        btnElement.style.transform = 'scale(0.8)';
        setTimeout(() => btnElement.style.transform = '', 150);
        try {
            if (isAdding) {
                await fetch(`${currentServer}/Users/${currentUserId}/FavoriteItems/${itemId}`, { method: 'POST', headers: { 'X-Emby-Token': currentToken } });
                icon.innerText = 'check'; btnElement.title = 'マイリストから削除'; btnElement.classList.add('is-favorite');
            } else {
                await fetch(`${currentServer}/Users/${currentUserId}/FavoriteItems/${itemId}`, { method: 'DELETE', headers: { 'X-Emby-Token': currentToken } });
                icon.innerText = 'add'; btnElement.title = 'マイリストに追加'; btnElement.classList.remove('is-favorite');
                if (window.currentMediaType === 'MyList' && typeof loadMyListItems === 'function') { setTimeout(() => loadMyListItems(), 300); }
            }
        } catch (e) { console.error('マイリストの操作に失敗しました:', e); }
    };

    // --- 【究極滑らか対策3】IntersectionObserver による端っこ判定 ---
    // ホバーするずっと前に端かどうかのクラスを付けておくことで、CSS側で起点を瞬時に決められます。
    const edgeObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const wrapper = entry.target;
            const rect = entry.boundingClientRect;
            const screenWidth = window.innerWidth;
            
            wrapper.classList.remove('is-at-left', 'is-at-right');

            // 2.5%のパディング + 余裕(40px)
            const threshold = (screenWidth * 0.025) + 40;
            if (rect.left < threshold) {
                wrapper.classList.add('is-at-left');
            } else if (rect.right > (screenWidth - threshold)) {
                wrapper.classList.add('is-at-right');
            }
        });
    }, { 
        threshold: Array.from({length: 21}, (_, i) => i / 20) 
    });

})();