/* =========================================
   recommend.js - 高速並び替え＆レイアウト即時更新
   ========================================= */

/* --- js/recommend.js の createRecommendCard 関数を修正 --- */

function createRecommendCard(item, index) {
    const card = document.createElement('div');
    card.className = 'recommend-poster-card';
    card.dataset.itemId = item.Id;

    // 1. カード全体をクリックしたら詳細ページへ飛ぶように変更
    card.onclick = () => {
        if (typeof navigateToDetails === 'function') {
            navigateToDetails(item.Id);
        }
    };

    const posterUrl = `${SERVER_URL}/Items/${item.Id}/Images/Primary?fillWidth=500&quality=90`;
    const thumbUrl = `${SERVER_URL}/Items/${item.Id}/Images/Backdrop?quality=90`;
    
    let logoHtml = '';
    if (item.ImageTags && item.ImageTags.Logo) {
        const logoUrl = `${SERVER_URL}/Items/${item.Id}/Images/Logo?maxWidth=300&tag=${item.ImageTags.Logo}`;
        logoHtml = `<img class="recommend-logo" src="${logoUrl}" alt="${item.Name}">`;
    }

    card.innerHTML = `
        <div class="recommend-thumb-wrapper">
            <div class="rank-number">${index + 1}</div>
            <img class="recommend-poster-img" src="${posterUrl}" alt="${item.Name}">
            <img class="recommend-thumb-img" src="${thumbUrl}">
            <div class="recommend-info-container">
                ${logoHtml}
                <button class="recommend-play-button" onclick="event.stopPropagation(); playMedia('${item.Id}')">
                    <span class="material-symbols-outlined">play_arrow</span>今すぐ観る
                </button>
            </div>
        </div>
    `;
    return card;
}

// --- メイン表示関数 ---
async function loadMyRecommendations(manualIds = null) {
    const grid = document.getElementById('popularity-grid');
    if (!grid) return;

    // ★修正：「カードが1枚以上ある時」だけDOM更新を行う（Pタグをカードと誤認しないようにする）
    if (manualIds !== null && grid.querySelectorAll('.recommend-poster-card').length > 0) {
        await updateGridDOM(manualIds);
        return;
    }

    try {
        let ids;
        if (manualIds !== null) {
            ids = manualIds;
        } else {
            // ★ 修正：サーバーからJSONファイルの中身を取得する
            try {
                const res = await fetch('/api/recommendations');
                const data = await res.json();
                ids = data.ids || '';
            } catch (e) {
                ids = '';
            }
        }
        if (!ids || ids.trim() === '') {
            grid.innerHTML = '<p style="padding:20px; color:gray;">おすすめを設定してください</p>';
            return;
        }

        const idArray = ids.split(',').map(id => id.trim()).filter(id => id !== '');
        const cleanIds = idArray.join(',');
        
        const url = `${SERVER_URL}/Users/${userId}/Items?Ids=${cleanIds}&Fields=PrimaryImageAspectRatio,ImageTags&Recursive=true`;
        const res = await fetch(url, { headers: { 'X-Emby-Token': token } });
        const data = await res.json();
        
        const sortedItems = idArray.map(id => data.Items.find(item => item.Id === id)).filter(Boolean);

        // ここで grid.innerHTML = '' となるので、Pタグは綺麗に消えます
        grid.innerHTML = '';
        sortedItems.forEach((item, index) => {
            const card = createRecommendCard(item, index);
            grid.appendChild(card);
        });

        if (typeof window.forceReloadRecommendLayout === 'function') window.forceReloadRecommendLayout();

    } catch (err) { console.error("Load Error:", err); }
}

// --- ★新機能：通信なしで並び替え & 即レイアウト更新 ---
async function updateGridDOM(idsStr) {
    const grid = document.getElementById('popularity-grid');
    if (!grid) return;

    const emptyMsg = grid.querySelector('p');
    if (emptyMsg) emptyMsg.remove();

    // ★重要：すべてのIDをトリミング
    const idArray = idsStr.split(',').map(id => id.trim()).filter(id => id !== '');


    if (idArray.length === 0) {
        grid.innerHTML = '<p style="padding:20px; color:gray;">おすすめを設定してください</p>';
        if (typeof window.forceReloadRecommendLayout === 'function') window.forceReloadRecommendLayout();
        return;
    }
    
    const currentCards = Array.from(grid.querySelectorAll('.recommend-poster-card'));
    const cardMap = new Map();
    currentCards.forEach(c => cardMap.set(c.dataset.itemId, c));

    // 新規IDがあれば取得
    const newItemsIds = idArray.filter(id => !cardMap.has(id));
    if (newItemsIds.length > 0) {
        try {
            const url = `${SERVER_URL}/Users/${userId}/Items?Ids=${newItemsIds.join(',')}&Fields=PrimaryImageAspectRatio,ImageTags&Recursive=true`;
            const res = await fetch(url, { headers: { 'X-Emby-Token': token } });
            const data = await res.json();
            data.Items.forEach(item => {
                const newCard = createRecommendCard(item, 0);
                cardMap.set(item.Id, newCard);
            });
        } catch (e) { console.error(e); }
    }

    // 正しい順番で再配置（既存のカードを移動させる）
    idArray.forEach((id, index) => {
        const card = cardMap.get(id);
        if (card) {
            const rank = card.querySelector('.rank-number');
            if (rank) rank.textContent = index + 1;
            grid.appendChild(card);
        }
    });

    currentCards.forEach(c => {
        if (!idArray.includes(c.dataset.itemId)) c.remove();
    });

    if (typeof window.forceReloadRecommendLayout === 'function') window.forceReloadRecommendLayout();
}


// --- 管理機能 ---

async function autoSave() {
    const rawIds = document.getElementById('custom-ids-input').value;
    const cleanIds = rawIds.split(',').map(id => id.trim()).filter(id => id !== '').join(',');
    document.getElementById('custom-ids-input').value = cleanIds;

    try {
        await fetch('/api/recommendations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: cleanIds })
        });
    } catch (e) {
        console.error("保存エラー:", e);
    }
    
    loadMyRecommendations(cleanIds); 

    const status = document.getElementById('save-status-text');
    if (status) {
        status.innerText = "変更を反映しました";
        status.classList.add('show');
        setTimeout(() => status.classList.remove('show'), 2000);
    }
}

// --- その他の管理画面操作（変更なし） ---
function addIdToInput(id) {
    const input = document.getElementById('custom-ids-input');
    let idArray = input.value.trim().split(',').filter(i => i);
    if (!idArray.includes(id)) {
        idArray.push(id);
        input.value = idArray.join(',');
        renderAdminListFromInput(); 
        autoSave(); 
    } else {
        alert("追加済みです");
    }
    document.getElementById('admin-search-results').innerHTML = '';
    document.getElementById('admin-search-input').value = '';
}

function removeItem(index) {
    const input = document.getElementById('custom-ids-input');
    // ★分割時にトリミングを追加
    let ids = input.value.split(',').map(id => id.trim()).filter(id => id !== "");
    ids.splice(index, 1);
    input.value = ids.join(',');
    renderAdminListFromInput();
    autoSave(); 
}

function moveItem(index, direction) {
    const input = document.getElementById('custom-ids-input');
    // ★分割時にトリミングを追加
    let ids = input.value.split(',').map(id => id.trim()).filter(id => id !== "");
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= ids.length) return;

    const temp = ids[index];
    ids[index] = ids[targetIndex];
    ids[targetIndex] = temp;

    input.value = ids.join(',');
    renderAdminListFromInput(); 
    autoSave(); 
}

async function renderAdminListFromInput() {
    const idsStr = document.getElementById('custom-ids-input').value;
    const ids = idsStr ? idsStr.split(',').map(id => id.trim()).filter(id => id !== '') : [];
    const grid = document.getElementById('admin-current-list');

    if (ids.length === 0) {
        grid.innerHTML = '<p style="color:gray; padding:20px;">リストが空です</p>';
        return;
    }
    
    try {
        const url = `${SERVER_URL}/Users/${userId}/Items?Ids=${ids.join(',')}&Fields=PrimaryImageAspectRatio`;
        const res = await fetch(url, { headers: { 'X-Emby-Token': token } });
        const data = await res.json();
        const sortedItems = ids.map(id => data.Items.find(item => item.Id === id)).filter(i => i);

        grid.innerHTML = '';
        sortedItems.forEach((item, index) => {
            const thumbUrl = `${SERVER_URL}/Items/${item.Id}/Images/Primary?quality=60`;
            const card = document.createElement('div');
            card.className = 'admin-edit-card';
            card.innerHTML = `
                <button class="delete-btn-top" onclick="removeItem(${index})" title="削除"><span class="material-symbols-outlined">delete</span></button>
                <img src="${thumbUrl}" alt="">
                <div class="admin-card-info"><span class="title">${item.Name}</span></div>
                <div class="admin-card-btns">
                    <button onclick="moveItem(${index}, -1)" ${index === 0 ? 'disabled' : ''}><span class="material-symbols-outlined">arrow_back</span></button>
                    <button onclick="moveItem(${index}, 1)" ${index === sortedItems.length - 1 ? 'disabled' : ''}><span class="material-symbols-outlined">arrow_forward</span></button>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (e) { console.error(e); }
}

async function searchItemsForAdmin() {
    const searchTerm = document.getElementById('admin-search-input').value;
    const resultsDiv = document.getElementById('admin-search-results');
    if (searchTerm.length < 2) { resultsDiv.innerHTML = ''; return; }
    try {
        const url = `${SERVER_URL}/Users/${userId}/Items?SearchTerm=${encodeURIComponent(searchTerm)}&Recursive=true&IncludeItemTypes=Movie,Series&Limit=10&Fields=PrimaryImageAspectRatio`;
        const res = await fetch(url, { headers: { 'X-Emby-Token': token } });
        const data = await res.json();
        resultsDiv.innerHTML = '';
        data.Items.forEach(item => {
            const thumbUrl = `${SERVER_URL}/Items/${item.Id}/Images/Primary?fillWidth=100&quality=60`;
            const itemDiv = document.createElement('div');
            itemDiv.className = 'admin-search-item';
            itemDiv.innerHTML = `<img src="${thumbUrl}" alt=""><span>${item.Name}</span><button onclick="addIdToInput('${item.Id}')">追加</button>`;
            resultsDiv.appendChild(itemDiv);
        });
    } catch (err) {}
}

async function renderAdminList() {
    try {
        // ★ 修正：歯車マークを開いた時も、サーバーのJSONから最新状態を取得する
        const resConfig = await fetch('/api/recommendations');
        const config = await resConfig.json();
        document.getElementById('custom-ids-input').value = config.ids || "";
        renderAdminListFromInput();
    } catch (e) {}
}

window.onclick = function(event) {
    if (event.target == document.getElementById('admin-screen')) toggleAdminPanel();
}

window.addEventListener('load', () => { loadMyRecommendations(); });

