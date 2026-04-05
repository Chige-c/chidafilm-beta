/**
 * js/settings.js
 * アカウント＆設定画面の開閉とUIの裏側ロジック
 */

document.addEventListener('DOMContentLoaded', () => {
    // index.html にモーダルHTMLを動的に追加
    const modalHtml = `
    <div id="global-settings-overlay">
        <div class="settings-header-bg"></div>
        <div class="settings-window">
            <div class="settings-header">
                <i class="material-symbols-outlined settings-gear-icon">settings</i>
                <div class="settings-header-text">
                    <h2>設定</h2>
                    <p>体験をカスタマイズし、アカウント設定を管理</p>
                </div>
                <button class="settings-close-btn" id="close-settings-modal"><span class="material-symbols-outlined">close</span></button>
            </div>
            <div class="settings-content">
                
                <!-- アプリ設定 -->
                <div class="settings-group">
                    <div class="settings-group-title">
                        <span class="material-symbols-outlined">play_circle</span>
                        アプリ設定
                    </div>
                    
                    <div class="settings-item">
                        <div class="settings-item-text">
                            <h3>言語</h3>
                            <p>インターフェースの優先言語と言語トラック（オーディオ/字幕）を設定</p>
                        </div>
                        <div class="settings-item-control">
                            <select id="setting-lang" class="settings-select">
                                <option value="ja">JP 日本語</option>
                                <option value="en">EN English</option>
                            </select>
                        </div>
                    </div>

                    <div class="settings-item">
                        <div class="settings-item-text">
                            <h3>カード表示モード</h3>
                            <p>作品リストを縦長のポスターにするか、横長の背景画像（サムネ）にするか</p>
                        </div>
                        <div class="settings-item-control">
                            <div class="segment-group" id="setting-poster-mode">
                                <button class="segment-btn active" data-mode="thumb"><span class="material-symbols-outlined">crop_landscape</span> サムネ</button>
                                <button class="segment-btn" data-mode="poster"><span class="material-symbols-outlined">crop_portrait</span> ポスター</button>
                            </div>
                        </div>
                    </div>

                    <div class="settings-item">
                        <div class="settings-item-text">
                            <h3>スキップ秒数設定</h3>
                            <p>動画再生中の早送り・巻き戻しの秒数</p>
                        </div>
                        <div class="settings-item-control">
                            <select id="setting-skip-duration" class="settings-select">
                                <option value="5">5秒</option>
                                <option value="10" selected>10秒</option>
                                <option value="15">15秒</option>
                                <option value="20">20秒</option>
                                <option value="25">25秒</option>
                                <option value="30">30秒</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- アカウント設定 -->
                <div class="settings-group">
                    <div class="settings-group-title">
                        <span class="material-symbols-outlined">person</span>
                        アカウント設定
                    </div>
                    
                    <div class="settings-item">
                        <div class="settings-item-text">
                            <h3>プロフィールアイコン</h3>
                            <p>Jellyfinサーバーに保存されているアバター画像を変更</p>
                        </div>
                        <div class="settings-item-control">
                            <div class="settings-avatar-preview" id="setting-avatar-preview"></div>
                            <button class="settings-btn-primary" id="btn-upload-avatar">画像を選択</button>
                            <!-- 隠しファイルインプット -->
                            <input type="file" id="setting-avatar-upload" style="display: none;" accept="image/png, image/jpeg, image/webp">
                        </div>
                    </div>

                    <div class="settings-item">
                        <div class="settings-item-text">
                            <h3>アカウント名（表示名）</h3>
                            <p>Jellyfin上のあなたのユーザー名を変更します</p>
                        </div>
                        <div class="settings-item-control">
                            <button class="settings-btn-primary" id="btn-open-username-modal">アカウント名を変更</button>
                        </div>
                    </div>

                    <div class="settings-item">
                        <div class="settings-item-text">
                            <h3>パスワードの変更</h3>
                            <p>ログインに使用するパスワードを更新します</p>
                        </div>
                        <div class="settings-item-control">
                            <button class="settings-btn-primary" id="btn-change-password">パスワードを変更</button>
                        </div>
                    </div>
                </div>

            </div>
        </div>

        <!-- 🌟 アカウント名変更サブモーダル -->
        <div id="username-sub-modal" class="sub-modal-overlay hidden">
            <div class="sub-modal-window">
                <h3>アカウント名を変更</h3>
                <p style="font-size: 0.9rem; color: #aaa; margin-bottom: 20px;">新しく設定したいユーザー名を入力してください。</p>
                <input type="text" id="setting-username-input" class="settings-select" placeholder="新しいアカウント名" style="width: 100%; margin-bottom: 25px; box-sizing: border-box;">
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button id="cancel-username-btn" class="settings-btn-primary">キャンセル</button>
                    <button id="btn-save-username" class="settings-btn-primary" style="background: #e50914; border: none;">保存</button>
                </div>
            </div>
        </div>

        <!-- 🌟 パスワード変更サブモーダル -->
        <div id="password-sub-modal" class="sub-modal-overlay hidden">
            <div class="sub-modal-window">
                <h3>パスワードを変更</h3>
                <p style="font-size: 0.9rem; color: #aaa; margin-bottom: 20px;">セキュリティのため、現在のパスワードと新しいパスワードを入力してください。</p>
                <input type="password" id="current-pw-input" class="settings-select" placeholder="現在のパスワード" style="width: 100%; margin-bottom: 15px; box-sizing: border-box;">
                <input type="password" id="new-pw-input" class="settings-select" placeholder="新しいパスワード" style="width: 100%; margin-bottom: 25px; box-sizing: border-box;">
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button id="cancel-password-btn" class="settings-btn-primary">キャンセル</button>
                    <button id="save-password-btn" class="settings-btn-primary" style="background: #e50914; border: none;">変更を確定</button>
                </div>
            </div>
        </div>
        
        <!-- 🌟 トースト通知（下にポップアップ） -->
        <div id="settings-toast" class="settings-toast hidden"></div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // 要素の取得とイベントリスナーの登録
    const overlay = document.getElementById('global-settings-overlay');
    const closeBtn = document.getElementById('close-settings-modal');

    // モーダルを閉じる
    closeBtn.addEventListener('click', () => {
        window.closeSettingsModal();
    });

    // 背景クリックで閉じる
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) window.closeSettingsModal();
    });

    // --- 🌟 設定値の保存処理（イベントリスナー） ---
    
    // 言語設定
    const langSelect = document.getElementById('setting-lang');
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            localStorage.setItem('settingLanguage', e.target.value);
            // TODO: 今後の動画再生時にこの値を参照する
        });
    }

    // スキップ秒数
    const skipSelect = document.getElementById('setting-skip-duration');
    if (skipSelect) {
        skipSelect.addEventListener('change', (e) => {
            localStorage.setItem('skipDuration', e.target.value);
            // プレーヤーUIが既に読み込まれていれば、アイコン（数字）と跳躍秒数も即座に同期させる
            if (typeof window.updatePlayerSkipUI === 'function') {
                window.updatePlayerSkipUI();
            }
        });
    }

    // サムネ / ポスター切替
    const posterBtns = document.querySelectorAll('#setting-poster-mode .segment-btn');
    posterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // 見た目のアクティブ切り替え
            posterBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            // 値の保存と即時切り替え
            const mode = e.currentTarget.getAttribute('data-mode'); // 'thumb' or 'poster'
            localStorage.setItem('view_mode', mode);
            
            // CSSクラスを切り替えて即座に画面に反映させる（既存の切り替えロジック呼び出し）
            if (typeof toggleListMode === 'function') {
                toggleListMode(mode);
            }
        });
    });

    // --- 🌟 アカウント情報のAPI連携 ---

    // ユーザー名変更モーダルの開閉と保存ボタンの取得
    const userSubModal = document.getElementById('username-sub-modal');
    const btnOpenUsername = document.getElementById('btn-open-username-modal');
    const btnCancelUsername = document.getElementById('cancel-username-btn');
    const btnSaveUsername = document.getElementById('btn-save-username');
    
    if (btnOpenUsername) {
        btnOpenUsername.addEventListener('click', () => {
            // 現在のユーザー名をヘッダーUIから取得、なければlocalStorageから
            const dropdownUsernameEl = document.querySelector('.dropdown-username');
            const currentName = (dropdownUsernameEl && dropdownUsernameEl.textContent) 
                                ? dropdownUsernameEl.textContent.trim() 
                                : (localStorage.getItem('username') || localStorage.getItem('loginUser') || '');
            
            const inputEl = document.getElementById('setting-username-input');
            inputEl.value = currentName;
            
            // ボタンの初期状態（空ならdisable）
            if (btnSaveUsername) {
                btnSaveUsername.disabled = currentName.trim() === '';
                btnSaveUsername.style.opacity = btnSaveUsername.disabled ? '0.5' : '1';
                btnSaveUsername.style.cursor = btnSaveUsername.disabled ? 'not-allowed' : 'pointer';
            }
            
            userSubModal.classList.remove('hidden');
        });
    }
    
    // 入力欄の変更を監視してボタンの有効/無効を切り替え
    const usernameInputEl = document.getElementById('setting-username-input');
    if (usernameInputEl && btnSaveUsername) {
        usernameInputEl.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            btnSaveUsername.disabled = val === '';
            btnSaveUsername.style.opacity = val === '' ? '0.5' : '1';
            btnSaveUsername.style.cursor = val === '' ? 'not-allowed' : 'pointer';
        });
    }

    if (btnCancelUsername) {
        btnCancelUsername.addEventListener('click', () => userSubModal.classList.add('hidden'));
    }

    // ユーザー名の保存
    if (btnSaveUsername) {
        btnSaveUsername.addEventListener('click', async () => {
            const newName = document.getElementById('setting-username-input').value.trim();
            if (!newName) {
                showSettingsToast('ユーザー名を入力してください', false);
                return;
            }
            
            const serverUrl = localStorage.getItem('serverUrl') || '/jellyfin-api';
            const currentToken = localStorage.getItem('token');
            const currentUserId = localStorage.getItem('userId');

            try {
                // まず現在のユーザー情報を取得
                const userRes = await fetch(`${serverUrl}/Users/${currentUserId}`, {
                    headers: { 'X-Emby-Token': currentToken }
                });
                const userData = await userRes.json();
                
                // Nameを書き換えてPOST送信
                userData.Name = newName;
                
                const updateRes = await fetch(`${serverUrl}/Users/${currentUserId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Emby-Token': currentToken },
                    body: JSON.stringify(userData)
                });

                if (updateRes.ok || updateRes.status === 204) {
                    showSettingsToast(`アカウント名を「${newName}」に変更しました`, true);
                    localStorage.setItem('username', newName); // ローカル情報も更新
                    
                    // ヘッダーのドロップダウンUI等も即座に更新する
                    const dropdownUsernameEl = document.querySelector('.dropdown-username');
                    if(dropdownUsernameEl) {
                        dropdownUsernameEl.textContent = newName;
                    }

                    userSubModal.classList.add('hidden');
                } else {
                    showSettingsToast('変更失敗: サーバー設定でユーザー名の変更が許可されていない可能性があります', false);
                }
            } catch (err) {
                console.error(err);
                showSettingsToast('通信エラーが発生しました', false);
            }
        });
    }

    // パスワード変更モーダルの開閉と更新処理
    const passSubModal = document.getElementById('password-sub-modal');
    const btnOpenPass = document.getElementById('btn-change-password');
    const btnCancelPass = document.getElementById('cancel-password-btn');
    const btnSavePass = document.getElementById('save-password-btn');

    if (btnOpenPass) {
        btnOpenPass.addEventListener('click', () => {
            document.getElementById('current-pw-input').value = '';
            document.getElementById('new-pw-input').value = '';
            passSubModal.classList.remove('hidden');
        });
    }
    if (btnCancelPass) {
        btnCancelPass.addEventListener('click', () => passSubModal.classList.add('hidden'));
    }

    if (btnSavePass) {
        btnSavePass.addEventListener('click', async () => {
            const currentPw = document.getElementById('current-pw-input').value;
            const newPw = document.getElementById('new-pw-input').value;

            if (!newPw) {
                showSettingsToast('新しいパスワードを入力してください', false);
                return;
            }

            const serverUrl = localStorage.getItem('serverUrl') || '/jellyfin-api';
            const currentToken = localStorage.getItem('token');
            const currentUserId = localStorage.getItem('userId');

            try {
                const passRes = await fetch(`${serverUrl}/Users/${currentUserId}/Password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Emby-Token': currentToken },
                    body: JSON.stringify({
                        CurrentPw: currentPw,
                        NewPw: newPw
                    })
                });

                if (passRes.ok || passRes.status === 204) {
                    showSettingsToast('パスワードを正常に変更しました！', true);
                    passSubModal.classList.add('hidden');
                } else {
                    showSettingsToast('変更失敗: 現在のパスワードが間違っています', false);
                }
            } catch (err) {
                console.error(err);
                showSettingsToast('通信エラーが発生しました', false);
            }
        });
    }

    // --- 🌟 アバター画像（アイコン）設定のAPI連携 ---
    const btnUploadAvatar = document.getElementById('btn-upload-avatar');
    const avatarInput = document.getElementById('setting-avatar-upload');
    const avatarPreview = document.getElementById('setting-avatar-preview');

    if (btnUploadAvatar && avatarInput) {
        // ボタンクリックで隠しファイルインプットを起動
        btnUploadAvatar.addEventListener('click', () => {
            avatarInput.click();
        });

        // ファイルが選択されたらプレビュー表示＆アップロード処理開始
        avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // ローカルプレビューを先に表示する
            const localPreviewUrl = URL.createObjectURL(file);
            if (avatarPreview) {
                avatarPreview.style.backgroundImage = `url('${localPreviewUrl}')`;
            }

            const serverUrl = localStorage.getItem('serverUrl') || '/jellyfin-api';
            const currentToken = localStorage.getItem('token');
            const currentUserId = localStorage.getItem('userId');

            // アップロード開始のトースト
            showSettingsToast('アイコンをアップロード中...', true);
            
            // base64に変換してからアップロード
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64Data = reader.result.split(',')[1];

                try {
                    // Jellyfinの /Users/{userId}/Images/Primary へPOST送信 (base64)
                    const uploadRes = await fetch(`${serverUrl}/Users/${currentUserId}/Images/Primary`, {
                        method: 'POST',
                        headers: {
                            'X-Emby-Token': currentToken,
                            'Content-Type': file.type || 'image/jpeg'
                        },
                        body: base64Data
                    });

                    if (uploadRes.ok || uploadRes.status === 204) {
                    showSettingsToast('成功: プロフィール画像が変更されました！', true);
                    
                    // ヘッダーやメニューのアイコンを強制更新させる（キャッシュ回避のためタイムスタンプを付与）
                    const freshImgUrl = `${serverUrl}/Users/${currentUserId}/Images/Primary?quality=90&api_key=${currentToken}&_t=${Date.now()}`;
                    
                    // index.html のDOM構造に合わせてアイコン書き換え
                    const profileIconWrappers = [
                        document.getElementById('header-profile-wrapper'),
                        document.getElementById('dropdown-profile-wrapper')
                    ];
                    
                    profileIconWrappers.forEach(wrapper => {
                        if (wrapper) {
                            wrapper.style.backgroundImage = `url('${freshImgUrl}')`;
                            wrapper.style.backgroundSize = 'cover';
                            wrapper.style.backgroundPosition = 'center';
                            // 既存のpersonアイコンを消す
                            const fallbackIcon = wrapper.querySelector('.material-symbols-outlined');
                            if (fallbackIcon) fallbackIcon.style.display = 'none';
                        }
                    });
                    
                } else {
                    const errText = await uploadRes.text();
                    console.error("Upload Error:", uploadRes.status, errText);
                    showSettingsToast('アップロードに失敗しました', false);
                }
            } catch (err) {
                console.error(err);
                showSettingsToast('通信エラーが発生しました', false);
            }
        }; // reader.onloadの手動クローズ

        reader.onerror = () => {
            showSettingsToast('画像の読み込みに失敗しました', false);
        };
        
        });
    }

});

/**
 * トースト通知を表示する関数
 */
function showSettingsToast(message, isSuccess = true) {
    const toast = document.getElementById('settings-toast');
    if (!toast) return;

    toast.textContent = message;
    if (isSuccess) {
        toast.style.background = 'rgba(46, 204, 113, 0.95)'; // 緑
    } else {
        toast.style.background = 'rgba(229, 9, 20, 0.95)'; // 赤
    }

    toast.classList.remove('hidden');
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 300); // アニメーション終了後に完全に隠す
    }, 4000); // 4秒表示
}

// 起動時やモーダルを開いた時に、保存されている設定値をUIに反映する関数
function loadSettingsToUI() {
    // 1. スキップ秒数の復元（デフォルト10秒）
    const storedSkip = localStorage.getItem('skipDuration') || '10';
    const skipSelect = document.getElementById('setting-skip-duration');
    if (skipSelect) skipSelect.value = storedSkip;

    // 2. 言語設定の復元（デフォルト日本語: ja）
    const storedLang = localStorage.getItem('settingLanguage') || 'ja';
    const langSelect = document.getElementById('setting-lang');
    if (langSelect) langSelect.value = storedLang;

    // 3. サムネ/ポスター設定の復元（デフォルト: thumb）
    const storedMode = localStorage.getItem('view_mode') || 'thumb';
    const posterBtns = document.querySelectorAll('#setting-poster-mode .segment-btn');
    // ... loop
    posterBtns.forEach(btn => {
        if (btn.getAttribute('data-mode') === storedMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // 4. (ユーザー名の画面表示は削除されたため処理なし)

    // 5. アバター画像（アイコン）プレビューの初期化
    const currentUserId = localStorage.getItem('userId');
    const currentToken = localStorage.getItem('token');
    const serverUrl = localStorage.getItem('serverUrl') || '/jellyfin-api';
    
    if (currentUserId && currentToken) {
        // 設定画面を開いた時にユーザー情報を取得して画像タグを確認
        fetch(`${serverUrl}/Users/${currentUserId}`, { headers: { 'X-Emby-Token': currentToken } })
            .then(res => res.json())
            .then(user => {
                const avatarPreview = document.getElementById('setting-avatar-preview');
                if (avatarPreview && user.PrimaryImageTag) {
                    const imgUrl = `${serverUrl}/Users/${currentUserId}/Images/Primary?tag=${user.PrimaryImageTag}&quality=90&api_key=${currentToken}`;
                    avatarPreview.style.backgroundImage = `url('${imgUrl}')`;
                }
            })
            .catch(e => console.error('Failed to load avatar:', e));
    }
}

/**
 * 設定モーダルを開く関数（外部から呼ばれる想定）
 */
window.openSettingsModal = function(pushState = true) {
    const overlay = document.getElementById('global-settings-overlay');
    if (overlay) {
        // UIに最新の保存値を反映させてから開く
        loadSettingsToUI();
        overlay.classList.add('show');
        
        // 背景ページのスクロールをロックする
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        
        // 現在のURLパラメータを保持したまま modal=settings を追加
        if (pushState) {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('modal', 'settings');
            history.pushState({ modal: 'settings' }, '', currentUrl.search + currentUrl.hash);
        }
    }
};

/**
 * 設定モーダルを閉じる関数
 */
window.closeSettingsModal = function(backState = true) {
    const overlay = document.getElementById('global-settings-overlay');
    if (overlay) {
        // URLを元に戻す
        if (backState && window.location.search.includes('modal=settings')) {
            window.isClosingSettings = true; // 他の画面の再読み込みをブロックするためのフラグ
            history.back(); // ここでpopstateが発火する
            setTimeout(() => { window.isClosingSettings = false; }, 300);
        }
        
        overlay.classList.remove('show');
        
        // スクロールロックを解除する
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
    }
};

// --- URLとブラウザバックの連動 ---
window.addEventListener('popstate', (e) => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('modal') === 'settings') {
        window.openSettingsModal(false); // 履歴を追加せずに開く
    } else {
        const overlay = document.getElementById('global-settings-overlay');
        if (overlay && overlay.classList.contains('show')) {
            window.closeSettingsModal(false); // 履歴を戻さずに閉じる
            window.isClosingSettings = true; // 他の画面の再読み込みをブロックするためのフラグ
            setTimeout(() => { window.isClosingSettings = false; }, 300);
        }
    }
});

// リロード時等のための初期化チェック
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('modal') === 'settings') {
        // 少しディレイを入れないとUI要素が完全にロードされる前に開く可能性があるため
        setTimeout(() => window.openSettingsModal(false), 500);
    }
});
