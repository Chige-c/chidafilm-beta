/**
 * Account Menu Management (account-menu.js)
 * Fetches user profile data from Jellyfin and updates the dropdown menu icons.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 確実に変数を取得する（ログイン状況や別JSのグローバル変数を参照）
    const currentUserId = localStorage.getItem('userId') || sessionStorage.getItem('userId') || (typeof userId !== 'undefined' ? userId : null);
    const currentToken = localStorage.getItem('token') || sessionStorage.getItem('token') || (typeof token !== 'undefined' ? token : null);
    const currentServerUrl = typeof SERVER_URL !== 'undefined' ? SERVER_URL : (localStorage.getItem('serverUrl') || '/jellyfin-api');

    if (!currentUserId || !currentToken) return;

    try {
        const res = await fetch(`${currentServerUrl}/Users/${currentUserId}`, {
            headers: { 'X-Emby-Token': currentToken }
        });
        
        if (!res.ok) throw new Error("ユーザー情報の取得に失敗しました");
        const user = await res.json();

        // 1. ユーザー名の更新
        const usernameEl = document.querySelector('.dropdown-username');
        if (usernameEl) {
            usernameEl.innerText = user.Name || 'User';
        }

        // 2. プロフィール画像タグの取得
        // ※ HasPrimaryImage ではなく PrimaryImageTag の有無のみで堅牢に判定する
        const imageTag = user.PrimaryImageTag;

        // 対象となる要素を取得
        const headerIconImg = document.getElementById('header-profile-img');
        const headerIconFallback = document.getElementById('header-profile-fallback');
        
        const dropdownIconImg = document.getElementById('dropdown-profile-img');
        const dropdownIconFallback = document.getElementById('dropdown-profile-fallback');

        if (imageTag) {
            // Jellyfinに画像が設定されている場合：画像を表示して、アイコンを隠す
            const currentImgUrl = `${currentServerUrl}/Users/${currentUserId}/Images/Primary?tag=${imageTag}&quality=90&api_key=${currentToken}`;
            
            const headerWrapper = document.getElementById('header-profile-wrapper');
            if (headerWrapper) {
                headerWrapper.style.backgroundImage = `url("${currentImgUrl}")`;
                if(headerIconFallback) headerIconFallback.style.display = 'none';
            }
            
            const dropdownWrapper = document.getElementById('dropdown-profile-wrapper');
            if (dropdownWrapper) {
                dropdownWrapper.style.backgroundImage = `url("${currentImgUrl}")`;
                if(dropdownIconFallback) dropdownIconFallback.style.display = 'none';
            }
        } else {
            // 画像が設定されていない場合：フォールバックのアイコンを表示
            const headerWrapper = document.getElementById('header-profile-wrapper');
            if (headerWrapper) headerWrapper.style.backgroundImage = 'none';
            
            const dropdownWrapper = document.getElementById('dropdown-profile-wrapper');
            if (dropdownWrapper) dropdownWrapper.style.backgroundImage = 'none';
            
            if (headerIconFallback) headerIconFallback.style.display = 'block';
            if (dropdownIconFallback) dropdownIconFallback.style.display = 'block';
        }

        // --- ドロップダウンのクリック設定 ---
        const dropdownContainer = document.querySelector('.dropdown-container');
        const profileIcon = document.getElementById('header-profile-wrapper');

        if (dropdownContainer && profileIcon) {
            // アイコンクリックで開閉
            profileIcon.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropdownContainer.classList.toggle('active');
            });

            // メニュー外側クリックで閉じる
            document.addEventListener('click', (e) => {
                if (!dropdownContainer.contains(e.target)) {
                    dropdownContainer.classList.remove('active');
                }
            });
        }

        // --- 「プロフィールを管理」クリック設定 ---
        const userInfoArea = document.querySelector('.dropdown-user-info');
        if (userInfoArea) {
            userInfoArea.style.cursor = 'pointer';
            userInfoArea.addEventListener('click', () => {
                if (dropdownContainer) dropdownContainer.classList.remove('active');
                
                if (typeof openSettingsModal === 'function') {
                    openSettingsModal();
                    // 開いた後、アカウント設定部分にスクロール
                    setTimeout(() => {
                        const accountSection = document.getElementById('btn-open-username-modal');
                        if (accountSection) {
                            accountSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            
                            // 視覚的にわかりやすく光らせる
                            const group = accountSection.closest('.settings-group');
                            if (group) {
                                group.style.transition = 'box-shadow 0.3s ease-out';
                                group.style.boxShadow = '0 0 25px rgba(229, 9, 20, 0.6)';
                                setTimeout(() => {
                                    group.style.boxShadow = 'none';
                                }, 1500);
                            }
                        }
                    }, 350); // モーダルが開くのを待つ
                }
            });
        }

    } catch (err) {
        console.error("プロフィール画像の取得エラー:", err);
    }
});
