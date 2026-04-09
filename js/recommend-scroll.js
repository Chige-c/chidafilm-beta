(function() {
    let currentPos = 0;

    function getItemsPerRow() {
        return window.innerWidth <= 1950 ? 5 : 6;
    }

    function init() {
        const grid = document.getElementById('popularity-grid');
        if (!grid) return;
        
        // 親要素（ラッパー）を取得
        const wrapper = grid.parentElement;
        if (!wrapper) return;

        // ★修正1：重複チェックを「ID」で行う（以前はここがクラス指定になっていて機能していませんでした）
        if (wrapper.querySelector('#custom-next-handle')) return;

        const trashSelector = '.custom-handle, .handle-left, .handle-right, #recommend-left-reset-handle, #recommend-right-reset-handle';
        const trash = wrapper.querySelectorAll(trashSelector);
        trash.forEach(h => h.remove());
        
        // グリッドの中に紛れ込んだものも掃除
        grid.querySelectorAll('.custom-handle, .handle-left, .handle-right').forEach(h => h.remove());

        // 現在のスクロール位置を復元
        currentPos = parseInt(grid.dataset.scrollOffset || 0);

        // --- 拡大リセット用関数 ---
        const closeExpanded = () => {
            const exp = grid.querySelector('.recommend-poster-card.is-expanded');
            if (exp) {
                exp.classList.remove('is-expanded');
                if (typeof window.updateRecommendLayout === 'function') window.updateRecommendLayout();
            }
        };

        const resetExpandedState = () => {
            const exp = grid.querySelector('.recommend-poster-card.is-expanded');
            if (exp) exp.classList.remove('is-expanded');
        };

        // --- 左ハンドル ---
        const prev = document.createElement('div');
        prev.id = 'custom-prev-handle';
        prev.className = 'custom-handle prev';
        // 矢印をspanで囲む
        prev.innerHTML = '<span class="handle-arrow">〈</span>';
        
        prev.onmouseenter = closeExpanded;
        prev.onclick = (e) => {
            e.stopPropagation(); e.preventDefault();
            resetExpandedState(); 
            const itemsPerRow = getItemsPerRow();
            currentPos = Math.max(0, currentPos - itemsPerRow);
            updateGrid(grid);
        };

        // --- 右ハンドル ---
        const next = document.createElement('div');
        next.id = 'custom-next-handle';
        next.className = 'custom-handle next';
        // 矢印をspanで囲む
        next.innerHTML = '<span class="handle-arrow">〉</span>';

        next.onmouseenter = closeExpanded;
        next.onclick = (e) => {
            e.stopPropagation(); e.preventDefault();
            resetExpandedState(); 
            const itemsPerRow = getItemsPerRow();
            const totalItems = grid.querySelectorAll('.recommend-poster-card').length;
            
            if (currentPos + itemsPerRow < totalItems) {
                currentPos += itemsPerRow;
                updateGrid(grid);
            }
        };

        // ラッパーに追加
        wrapper.appendChild(prev);
        wrapper.appendChild(next);
        
        // 表示更新
        updateArrowVisibility(currentPos, grid);
    }

    function updateGrid(grid) {
        grid.dataset.scrollOffset = currentPos;
        if (typeof window.updateRecommendLayout === 'function') {
            window.updateRecommendLayout(); 
        }
        updateArrowVisibility(currentPos, grid);
    }

    function updateArrowVisibility(pos, grid) {
        const wrapper = grid.parentElement;
        if (!wrapper) return;
        
        const prev = wrapper.querySelector('#custom-prev-handle');
        const next = wrapper.querySelector('#custom-next-handle');
        if (!prev || !next) return;

        const itemsPerRow = getItemsPerRow();
        const cards = grid.querySelectorAll('.recommend-poster-card');
        const totalItems = cards.length;

        if (totalItems === 0) {
            prev.style.display = 'none';
            next.style.display = 'none';
            return;
        }

        prev.style.display = (pos <= 0) ? 'none' : 'flex';
        next.style.display = (pos + itemsPerRow >= totalItems) ? 'none' : 'flex';
    }

    // 監視設定
    const observer = new MutationObserver(() => {
        // ここでも重複チェックを行い、無ければinitを呼ぶ
        const wrapper = document.getElementById('popularity-grid')?.parentElement;
        if (wrapper && !wrapper.querySelector('#custom-next-handle')) {
            init();
        }
        
        const grid = document.getElementById('popularity-grid');
        if (grid) {
            updateArrowVisibility(parseInt(grid.dataset.scrollOffset || 0), grid);
        }
    });

    const startObserver = () => {
        const grid = document.getElementById('popularity-grid');
        if (grid && grid.parentElement) {
            init(); 
            observer.observe(grid, { childList: true });
        } else {
            setTimeout(startObserver, 500);
        }
    };
    
    startObserver();
    window.addEventListener('resize', () => {
        const grid = document.getElementById('popularity-grid');
        if(grid) updateArrowVisibility(parseInt(grid.dataset.scrollOffset || 0), grid);
    });
})();