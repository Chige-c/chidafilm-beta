/* =========================================
   notification.js - 最終修正版
   ========================================= */

const SEERR_API_KEY = 'MTc3MDMyMDE5MDg4N2MzMTExZmYzLTBmNzMtNGJkOC04ZGNjLTQ4ZDQ1NTk3OTVkNw=='; 

document.addEventListener('DOMContentLoaded', async () => {
    initNotificationUI();
    await syncNotifLogFromServer();
    checkAllNotifications();
    setInterval(checkAllNotifications, 300000);
});

function initNotificationUI() {
    const bell = document.getElementById('notification-bell');
    const menu = document.getElementById('notification-menu');
    const markRead = document.getElementById('mark-all-read');

    if (bell && menu) {
        bell.onclick = (e) => {
            e.stopPropagation();
            menu.classList.toggle('active');
            if (menu.classList.contains('active')) {
                saveLastCheckTime();
                updateNotificationBadge(null);
            }
        };
    }

    if (markRead) {
        markRead.onclick = () => {
            document.getElementById('notification-list').innerHTML = 
                '<div class="no-notif">通知はありません</div>';
            saveLastCheckTime();
            updateNotificationBadge(null);
        };
    }

    document.onclick = (e) => {
        if (menu && !menu.contains(e.target) && e.target !== bell) {
            menu.classList.remove('active');
        }
    };
}

async function checkAllNotifications() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const lastCheckStored = localStorage.getItem('lastNotificationCheck');
    const lastCheck = lastCheckStored ? new Date(lastCheckStored) : weekAgo;

    const list = document.getElementById('notification-list');
    if (!list) return;

    let notifications = [];
    let unreadSpecificCount = 0; 
    let hasUnreadNormal = false; 

    const currentUserId = (localStorage.getItem('userId') || sessionStorage.getItem('userId'))?.replace(/-/g, '').toLowerCase();

    try {
        // --- 1. Jellyseerr リクエスト完了通知の取得 ---
        const seerrRes = await fetch('/seerr-api/api/v1/request?take=10&filter=available', {
            headers: { 'X-Api-Key': SEERR_API_KEY }
        });
        
        if (seerrRes.ok) {
            const data = await seerrRes.json();
            for (const req of data.results) {
                const updated = new Date(req.updatedAt);
                const reqUser = req.requestedBy?.jellyfinUserId?.replace(/-/g, '').toLowerCase();
                const isMyRequest = currentUserId && reqUser === currentUserId;

                // ID比較のデバッグ用（なぜチャイルド・プレイが出るか確認するため）
                if (req.media && req.media.tmdbId === 10501) { // チャイルド・プレイのTMDB ID例
                    console.log("DEBUG [Seerr ID]:", reqUser, " [Current ID]:", currentUserId);
                }

                if (isMyRequest && updated > weekAgo) {
                    let jfTitle = "リクエスト作品";
                    let jfId = null;

                    if (req.media && req.media.tmdbId) {
                        try {
                            const tmdbIdStr = req.media.tmdbId.toString();
                            const tvdbIdStr = req.media.tvdbId ? req.media.tvdbId.toString() : null;

                            // AnyProviderIdEquals で絞り込みつつ、確実のためFields=ProviderIdsを付与
                            const searchRes = await fetch(`/jellyfin-api/Items?Recursive=true&IncludeItemTypes=Movie,Series&AnyProviderIdEquals=tmdb.${tmdbIdStr}&Fields=ProviderIds`, {
                                headers: { 'X-Emby-Token': token }
                            });
                            const searchData = await searchRes.json();
                            
                            // 検索パラメータが無視されて全件返ってきた場合にも備え、JavaScript側でProviderIdを厳密に照合する
                            if (searchData.Items && searchData.Items.length > 0) {
                                const matchedItem = searchData.Items.find(item => {
                                    if (!item.ProviderIds) return false;
                                    const matchTmdb = item.ProviderIds.Tmdb === tmdbIdStr;
                                    const matchTvdb = tvdbIdStr && item.ProviderIds.Tvdb === tvdbIdStr;
                                    return matchTmdb || matchTvdb;
                                });

                                if (matchedItem) {
                                    jfTitle = matchedItem.Name;
                                    jfId = matchedItem.Id;
                                } else {
                                    // 厳密なID一致が存在しない場合は、Overseerrのリクエスト情報をフォールバックに利用
                                    jfTitle = req.media.tmdbId ? "リクエストした作品" : "リクエスト作品";
                                }
                            }
                        } catch (e) { console.error("Jellyfin検索エラー:", e); }
                    }

                    const isUnread = (updated > lastCheck) && (!getReadLog().includes(jfId));
                    if (isUnread) unreadSpecificCount++;

                    notifications.push({
                        title: `${jfTitle} が視聴可能になりました`,
                        time: updated,
                        type: 'specific',
                        isUnread: isUnread,
                        id: jfId,
                        // サムネ（Backdrop）を使用
                        thumbUrl: jfId ? `/jellyfin-api/Items/${jfId}/Images/Backdrop?maxWidth=300&quality=80` : null,
                        fallbackUrl: jfId ? `/jellyfin-api/Items/${jfId}/Images/Primary?maxWidth=120&quality=80` : null
                    });
                }
            }
        }

        // --- 2. Jellyfin 新着作品の取得 ---
        const jfRes = await fetch(`/jellyfin-api/Users/${userId}/Items?IncludeItemTypes=Movie,Series&Limit=15&Recursive=true&SortBy=DateLastContentAdded&SortOrder=Descending&Fields=DateCreated,DateLastContentAdded`, {
            headers: { 'X-Emby-Token': token }
        });
        
        if (jfRes.ok) {
            const data = await jfRes.json();
            data.Items.forEach(item => {
                // 日付データの安全な取得（NaN対策）
                const rawDate = item.DateLastContentAdded || item.DateCreated || item.PremiereDate;
                const created = rawDate ? new Date(rawDate) : new Date(0);
                
                const isUnread = (created > lastCheck) && (!getReadLog().includes(item.Id));
                if (isUnread) hasUnreadNormal = true;

                notifications.push({
                    title: `新着: ${item.Name}`,
                    time: created,
                    type: 'normal',
                    isUnread: isUnread,
                    id: item.Id,
                    // サムネ（Backdrop）を使用
                    thumbUrl: `/jellyfin-api/Items/${item.Id}/Images/Backdrop?maxWidth=300&quality=80`,
                    fallbackUrl: `/jellyfin-api/Items/${item.Id}/Images/Primary?maxWidth=120&quality=80`
                });
            });
        }

        // 3. ソートと絞り込み
        notifications.sort((a, b) => b.time - a.time);
        const finalNotifications = notifications.slice(0, 10);

        // 4. ピックアップ結果のLog（ソート後）
        console.log("🔔 通知リスト確定:", finalNotifications.map(n => ({
            "タイトル": n.title,
            "状態": n.isUnread ? '🔴未読' : '⚪既読',
            "時刻": n.time.toLocaleString(),
            "ID": n.id
        })));

        renderNotificationList(finalNotifications);
        
        if (unreadSpecificCount > 0) {
            updateNotificationBadge('specific', unreadSpecificCount);
        } else if (hasUnreadNormal) {
            updateNotificationBadge('normal');
        } else {
            updateNotificationBadge(null);
        }

    } catch (err) {
        console.error('通知取得エラー:', err);
    }
}

// --- 既読管理 (Account Log) ---
const getLogKey = () => {
    const currentUserId = (localStorage.getItem('userId') || sessionStorage.getItem('userId'))?.replace(/-/g, '').toLowerCase();
    return `notif_log_${currentUserId || 'guest'}`;
};

// 既読リストを取得
function getReadLog() {
    return JSON.parse(localStorage.getItem(getLogKey()) || '[]');
}

// ============== サーバー同期ロジック ==============
async function syncNotifLogFromServer() {
    const userId = (localStorage.getItem('userId') || sessionStorage.getItem('userId'))?.replace(/-/g, '').toLowerCase() || 'guest';
    try {
        const res = await fetch(`/api/notif-log/${userId}?_t=${Date.now()}`);
        if (res.ok) {
            const data = await res.json();
            if (data.log && Array.isArray(data.log)) {
                localStorage.setItem(`notif_log_${userId}`, JSON.stringify(data.log));
            }
            if (data.lastCheck) {
                localStorage.setItem('lastNotificationCheck', data.lastCheck);
            }
        }
    } catch (err) {
        console.log("サーバー上の通知ログはまだありません", err);
    }
}

function saveNotifLogToServer() {
    const userId = (localStorage.getItem('userId') || sessionStorage.getItem('userId'))?.replace(/-/g, '').toLowerCase() || 'guest';
    const log = getReadLog();
    const lastCheck = localStorage.getItem('lastNotificationCheck') || null;

    fetch('/api/notif-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId, log: log, lastCheck: lastCheck })
    }).catch(e => console.error("通知ログイン保存エラー", e));
}
// ===============================================

// 特定の作品を既読にする
function markAsRead(id) {
    if (!id) return;
    const log = getReadLog();
    if (!log.includes(id)) {
        log.push(id);
        localStorage.setItem(getLogKey(), JSON.stringify(log));
        saveNotifLogToServer();
        checkAllNotifications(); // バッジと表示を更新
    }
}

// すべてを既読にする（全IDをログへ）
function markAllAsReadLog(notifications) {
    const allIds = notifications.map(n => n.id).filter(id => id);
    localStorage.setItem(getLogKey(), JSON.stringify(allIds));
    saveNotifLogToServer();
    checkAllNotifications();
}

function saveLastCheckTime() {
    localStorage.setItem('lastNotificationCheck', new Date().toISOString());
    saveNotifLogToServer();
}

// --- レンダリング関数の修正 ---
function renderNotificationList(items) {
    const list = document.getElementById('notification-list');
    const readLog = getReadLog();

    if (items.length === 0) {
        list.innerHTML = '<div class="no-notif">新しい通知はありません</div>';
        return;
    }

    list.innerHTML = items.map(item => {
        const isActuallyRead = readLog.includes(item.id);
        const placeholderIcon = item.type === 'specific' ? 'priority_high' : 'movie';
        
        // ★ 関数名を確認してください：navigateToDetails か MapsToDetails か
        const clickAction = `markAsRead('${item.id}'); ${item.id ? `navigateToDetails('${item.id}');` : ''} document.getElementById('notification-menu').classList.remove('active');`;

        const badgeHTML = !isActuallyRead 
            ? (item.type === 'specific' ? '<span class="notif-type-badge">①</span>' : '<span class="notif-type-dot"></span>')
            : '';

        return `
            <div class="notification-item" onclick="${clickAction}">
                <div class="notif-content">
                    <p class="notif-title" style="${!isActuallyRead ? 'font-weight: bold; color: #fff;' : 'color: #aaa;'}">${item.title}</p>
                    <span class="notif-time">${timeAgo(item.time)}</span>
                </div>
                <div class="notif-thumb-container">
                    ${item.thumbUrl 
                        ? `<img src="${item.thumbUrl}" onerror="this.src='${item.fallbackUrl || ''}'" class="notif-thumb" alt="">` 
                        : `<div class="notif-thumb-placeholder"><span class="material-symbols-outlined">${placeholderIcon}</span></div>`
                    }
                    ${badgeHTML}
                </div>
            </div>
        `;
    }).join('');

    const markReadBtn = document.getElementById('mark-all-read');
    if (markReadBtn) {
        markReadBtn.onclick = () => markAllAsReadLog(items);
    }
}

function timeAgo(date) {
    // NaN対策: 日付が不正な場合は空文字を返す
    if (!date || isNaN(date.getTime()) || date.getTime() === 0) return '';
    
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'たった今';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}時間前`;
    return `${Math.floor(hours / 24)}日前`;
}

// (updateNotificationBadge, saveLastCheckTime は変更なし)
function updateNotificationBadge(type, value) {
    const badge = document.getElementById('notification-badge');
    if (!badge) return;

    if (!type) {
        badge.style.display = 'none';
        return;
    }

    badge.style.display = 'flex';
    if (type === 'specific') {
        badge.textContent = value;
        badge.classList.add('badge-num');
        badge.classList.remove('badge-dot');
    } else {
        badge.textContent = '';
        badge.classList.add('badge-dot');
        badge.classList.remove('badge-num');
    }
}
