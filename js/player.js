/**
 * player.js - 完全版（トリックプレータイル・字幕・キーボード対応）
 */

let introData = null;
let currentEpisodeList = [];

async function initPlayerUI() {
    try {
        const response = await fetch('player-ui.html');
        if (!response.ok) throw new Error('Player UI file not found');
        const html = await response.text();
        
        document.getElementById('player-root').innerHTML = html;
        console.log("✅ Player UI Loaded Successfully");
        
        // 🌟 2. UIを流し込んだ後に、イベント登録関数を呼び出す
        setupPlayerEventListeners(); 
        
    } catch (err) {
        console.error("❌ Player UIの読み込み失敗:", err);
    }
}
async function fetchIntroSkip(itemId) {
    const serverUrl = typeof SERVER_URL !== 'undefined' ? SERVER_URL : localStorage.getItem('serverUrl');
    const currentToken = localStorage.getItem('token');
    introData = null; // 取得前に一度リセット
    
    try {
        // 🌟 修正：正しい intro-skipper プラグインのエンドポイント
        const res = await fetch(`${serverUrl}/Episode/${itemId}/IntroTimestamps`, { 
            headers: { 'X-Emby-Token': currentToken } 
        });
        
        if (res.ok) {
            introData = await res.json();
            console.log("🎬 イントロ情報取得成功:", introData);
        } else {
            console.log("ℹ️ このエピソードにはイントロ情報がありません（ステータス:", res.status, ")");
        }
    } catch (e) { 
        console.error("❌ イントロ取得失敗:", e);
    }
}

// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', initPlayerUI);

let hlsInstance = null;
let currentPlayItemId = null;
let progressInterval = null;
let isInitialPlaySent = false;
let uiTimeout = null;

// 🌟 ストリーム情報を保持するグローバル変数
let currentMediaSource = null;
let currentSessionId = null;
let currentAudioIndex = null;
let currentSubtitleIndex = -1; // -1はオフ
let isBurnInMode = false;
let isSwitchingStream = false;
let trickplayManifest = null;
let isDragging = false;
let volumeIndicatorTimeout = null;
let currentQualityBitrate = 140000000; // 初期値（自動/最高）
let currentMaxHeight = 0;
let isAutoMode = true;
let currentPlayerSeriesId = null; 
let currentPlayerSeasonId = null;
const ICON_VOLUME_ON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1em' height='1em' viewBox='0 0 24 24'%3E%3Cpath fill='white' d='M19 11.975q0-2.075-1.1-3.787t-2.95-2.563q-.375-.175-.55-.537t-.05-.738q.15-.4.538-.575t.787 0Q18.1 4.85 19.55 7.063T21 11.974t-1.45 4.913t-3.875 3.287q-.4.175-.788 0t-.537-.575q-.125-.375.05-.737t.55-.538q1.85-.85 2.95-2.562t1.1-3.788M7 15H4q-.425 0-.712-.288T3 14v-4q0-.425.288-.712T4 9h3l3.3-3.3q.475-.475 1.088-.213t.612.938v11.15q0 .675-.612.938T10.3 18.3zm9.5-3q0 1.05-.475 1.988t-1.25 1.537q-.25.15-.513.013T14 15.1V8.85q0-.3.263-.437t.512.012q.775.625 1.25 1.575t.475 2'/%3E%3C/svg%3E";

const ICON_VOLUME_MUTE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1em' height='1em' viewBox='0 0 24 24'%3E%3Cpath fill='white' d='M16.775 19.575q-.275.175-.55.325t-.575.275q-.375.175-.762 0t-.538-.575q-.15-.375.038-.737t.562-.538q.1-.05.188-.1t.187-.1L12 14.8v2.775q0 .675-.612.938T10.3 18.3L7 15H4q-.425 0-.712-.288T3 14v-4q0-.425.288-.712T4 9h2.2L2.1 4.9q-.275-.275-.275-.7t.275-.7t.7-.275t.7.275l17 17q.275.275.275.7t-.275.7t-.7.275t-.7-.275zm2.225-7.6q0-2.075-1.1-3.787t-2.95-2.563q-.375-.175-.55-.537t-.05-.738q.15-.4.538-.575t.787 0Q18.1 4.85 19.55 7.05T21 11.975q0 .825-.15 1.638t-.425 1.562q-.2.55-.612.688t-.763.012t-.562-.45t-.013-.75q.275-.65.4-1.312T19 11.975m-4.225-3.55Q15.6 8.95 16.05 10t.45 2v.25q0 .125-.025.25q-.05.325-.35.425t-.55-.15L14.3 11.5q-.15-.15-.225-.337T14 10.775V8.85q0-.3.263-.437t.512.012M9.75 6.95Q9.6 6.8 9.6 6.6t.15-.35l.55-.55q.475-.475 1.087-.213t.613.938V8q0 .35-.3.475t-.55-.125z'/%3E%3C/svg%3E";

let lastVolume = 1;
const fullIconPath = `<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h2m10 0h2a2 2 0 0 1 2 2v2m0 10v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/></g>`;
const normalIconPath = `<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M7 3v2a2 2 0 0 1-2 2H3m14-4v2a2 2 0 0 0 2 2h2M7 21v-2a2 2 0 0 0-2-2H3m14 4v-2a2 2 0 0 1 2-2h2"/></g>`;
const playPath = "M8 5.14v14c0 .86.94 1.39 1.67.95l11-7c.7-.44.7-1.46 0-1.9l-11-7c-.73-.44-1.67.09-1.67.95";
const pausePath = "M6 6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zm8 0a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z";

window.updatePlayerSkipUI = function() {
    const duration = parseInt(localStorage.getItem('skipDuration')) || 10;
    const rwBtn = document.getElementById('player-rewind-btn');
    const fwBtn = document.getElementById('player-forward-btn');
    const rwText = document.getElementById('player-rewind-text');
    const fwText = document.getElementById('player-forward-text');

    if (rwBtn) rwBtn.onclick = () => skip(-duration);
    if (fwBtn) fwBtn.onclick = () => skip(duration);
    if (rwText) rwText.textContent = duration;
    if (fwText) fwText.textContent = duration;
};

function setupPlayerEventListeners() { 
    window.updatePlayerSkipUI();
    const videoPlayer = document.getElementById('main-video-player');
    if (!videoPlayer) {
        console.error("❌ main-video-playerが見つかりません");
        return;
    }

    const closePlayerBtn = document.getElementById('close-player-btn');
    const uiOverlay = document.getElementById('player-ui');
    const seekBar = document.getElementById('seek-bar-container');
    const seekThumb = document.getElementById('seek-thumb');
    const preview = document.getElementById('seek-preview-container');
    const previewImg = document.getElementById('seek-preview-image');
    const previewTime = document.getElementById('seek-preview-time');


     function updateSeekUI(e) {
        const rect = seekBar.getBoundingClientRect();
        let x = e.clientX - rect.left;
        x = Math.max(0, Math.min(x, rect.width)); // 範囲内に収める
        const percent = (x / rect.width) * 100;

        document.getElementById('seek-bar-progress').style.width = `${percent}%`;
        if (seekThumb) seekThumb.style.left = `${x}px`;

        return (x / rect.width) * videoPlayer.duration;
    }

    // 🌟 マウス操作：押したとき
    seekBar.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // 🌟 左クリック(0)以外は無視
        isDragging = true;
        seekBar.classList.add('dragging'); 
        updateSeekUI(e);
    });

    // 🌟 追加：シークバー周辺での右クリックメニューを禁止
    const seekWrapper = document.querySelector('.seek-wrapper');
    if (seekWrapper) {
        seekWrapper.addEventListener('contextmenu', e => e.preventDefault());
    }

    // 🌟 マウス操作：動かしているとき（window全体で監視）
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        updateSeekUI(e);
    });

    // 🌟 マウス操作：離したとき
    window.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        seekBar.classList.remove('dragging');
        
        const targetTime = updateSeekUI(e);
        videoPlayer.currentTime = targetTime; // 離した瞬間に動画を飛ばす
    });

    videoPlayer.addEventListener('timeupdate', () => {
        if (!videoPlayer.duration || isNaN(videoPlayer.duration) || isDragging) return;

        const current = videoPlayer.currentTime;
        const duration = videoPlayer.duration;
        const remaining = duration - current;

        // 🌟 1. イントロスキップ判定の修正
        const skipBtn = document.getElementById('skip-intro-btn');
        if (skipBtn && introData && introData.Valid) { // Valid: true が返ってくる仕様
            
            // プラグインが指定する「ボタン表示開始/終了時間」を使う（なければ実際のイントロ開始/終了時間）
            const showAt = introData.ShowSkipPromptAt || introData.IntroStart;
            const hideAt = introData.HideSkipPromptAt || introData.IntroEnd;
            const skipTo = introData.IntroEnd; // 飛ぶ先はイントロの終わり

            if (current >= showAt && current < hideAt) {
                if (skipBtn.classList.contains('hidden')) {
                    skipBtn.classList.remove('hidden');
                    skipBtn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation(); 
                        videoPlayer.currentTime = skipTo; // イントロ終了位置へスキップ
                        skipBtn.classList.add('hidden');
                    };
                }
            } else {
                skipBtn.classList.add('hidden');
            }
        }

        // 🌟 2. 次のエピソード通知（残り30秒）
        const nextCard = document.getElementById('next-up-card');
        if (nextCard && duration - current < 30 && duration > 60) {
            const currentIndex = currentEpisodeList.findIndex(ep => ep.Id === currentPlayItemId);
            if (currentIndex !== -1 && currentIndex < currentEpisodeList.length - 1) {
                const nextEpisode = currentEpisodeList[currentIndex + 1];
                document.getElementById('next-up-title').innerText = nextEpisode.Name;
                
                if (nextCard.classList.contains('hidden')) {
                    nextCard.classList.remove('hidden');
                    // 🌟 修正：ここも伝播を防止し、即座に反応させる
                    nextCard.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        switchEpisodeInPlayer(nextEpisode.Id);
                    };
                }
            }
        } else if (nextCard) {
            nextCard.classList.add('hidden');
        }

        // --- シークバー更新（既存のまま） ---
        const percent = (current / duration) * 100;
        const rect = seekBar.getBoundingClientRect();
        document.getElementById('seek-bar-progress').style.width = `${percent}%`;
        if (seekThumb) {
            seekThumb.style.left = `${(percent / 100) * rect.width}px`;
        }
        const timeRemainingEl = document.getElementById('time-remaining');
        if (timeRemainingEl) timeRemainingEl.innerText = `-${formatTime(remaining)}`;
    });

    videoPlayer.onended = () => {
        const currentIndex = currentEpisodeList.findIndex(ep => ep.Id === currentPlayItemId);
        if (currentIndex !== -1 && currentIndex < currentEpisodeList.length - 1) {
            // 🌟 修正：自動再生時もラグを減らすため即座に呼ぶ
            switchEpisodeInPlayer(currentEpisodeList[currentIndex + 1].Id);
        }
    };

    closePlayerBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // 2. 履歴の制御と画面遷移
        if (window.isDirectPlay) {
            // 🌟 追加：URLリロードなどにより背景画面が空っぽの場合は、「全描画モード」で詳細ページを構築する
            window.isDirectPlay = false; 
            window.isReturningFromPlayer = false; // 爆速モード（再描画ブロック）をさせない
            
            const targetId = currentPlayItemId || document.getElementById('main-video-player').dataset.itemId;
            
            // まずプレイヤーを消す
            closeEntirePlayerUI();
            
            // 安全のため、Homeと巨大ポスター(hero)を消してDetailsに枠を切り替える
            const heroSection = document.getElementById('hero-section');
            const homeView = document.getElementById('home-view');
            const detailsView = document.getElementById('details-view');
            if (heroSection) heroSection.style.display = 'none';
            if (homeView) homeView.style.display = 'none';
            if (detailsView) detailsView.style.display = 'block';
            
            // 履歴とURLを詳細画面のもの（?id=xxx）に置き換えて詳細画面を描画
            history.replaceState({ modal: 'home' }, '', `?id=${targetId}`);
            if (typeof showDetails === 'function') {
                showDetails(targetId);
            } else {
                window.location.href = `/?id=${targetId}`; // エラー回避
            }
        } else {
            // 通常時: 1つ前の画面に戻す
            // 背景は裏側で保たれているため、「爆速モード」でサッと戻す
            window.isReturningFromPlayer = true; 
            
            if (window.history.state && window.history.state.modal === 'player') {
                window.history.back();
            }
            closeEntirePlayerUI();
            
            // 0.5秒後にフラグを解除（他の無駄なリロードを確実に弾き切るため）
            setTimeout(() => {
                window.isReturningFromPlayer = false;
            }, 500);
        }
    };

    let lastPreviewRequestTime = 0;

    // 🌟 プレビュー（トリックプレー）のロジック
   seekBar.addEventListener('mousemove', (e) => {
        if (!videoPlayer.duration || isNaN(videoPlayer.duration)) return;

        const rect = seekBar.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = Math.min(Math.max(0, x), rect.width) / rect.width;
        const targetTime = percent * videoPlayer.duration;
        // 🌟 画像があるかないかのスイッチ判断
        const hasTrickplay = trickplayManifest && trickplayManifest.fallback === false;
        let leftPosForTime = x; // 時間表示のデフォルト位置はマウス直下

        if (preview) {
            if (hasTrickplay) {
                // 【スイッチ：ON】画像がある場合は枠を表示
                preview.style.setProperty('display', 'block', 'important');

                // アスペクト比の設定
                const vW = videoPlayer.videoWidth || 1920;
                const vH = videoPlayer.videoHeight || 1080;
                preview.style.aspectRatio = `${vW / vH}`;
                preview.style.width = 'unset';

                // 枠の位置計算（はみ出し防止）
                // 先に display: block を当てないと offsetWidth が 0 になるためここで計算
                const currentPreviewWidth = preview.offsetWidth || 160;
                const halfWidth = currentPreviewWidth / 2;
                let leftPos = x;
                if (leftPos < halfWidth) leftPos = halfWidth;
                if (leftPos > rect.width - halfWidth) leftPos = rect.width - halfWidth;
                preview.style.left = `${leftPos}px`;
                leftPosForTime = leftPos; // 🌟 時間テキストも画像の中央に合わせて止めるために上書き

                // 🌟 背景画像の計算ロジック
                const intervalSeconds = (trickplayManifest.Interval || 100000000) / 10000000;
                const totalIndex = Math.floor(targetTime / intervalSeconds);
                const tilesPerRow = 10;
                const tilesPerCol = 10;
                const sheetIndex = Math.floor(totalIndex / 100);
                const indexOnSheet = totalIndex % 100;
                const col = indexOnSheet % tilesPerRow;
                const row = Math.floor(indexOnSheet / tilesPerRow);

                const serverUrl = typeof SERVER_URL !== 'undefined' ? SERVER_URL : (localStorage.getItem('serverUrl') || "/jellyfin-api");
                const currentToken = localStorage.getItem('token') || sessionStorage.getItem('token');
                
                const tWidth = trickplayManifest.Width;
                const imageUrl = `${serverUrl}/Videos/${currentPlayItemId}/Trickplay/${tWidth}/${sheetIndex}.jpg?api_key=${currentToken}&MediaSourceId=${currentPlayItemId}`;

                preview.style.backgroundImage = `url("${imageUrl}")`;
                preview.style.backgroundSize = `${tilesPerRow * 100}% ${tilesPerCol * 100}%`;
                
                const posX = (col / (tilesPerRow - 1)) * 100;
                const posY = (row / (tilesPerCol - 1)) * 100;
                preview.style.backgroundPosition = `${posX}% ${posY}%`;

            } else {
                // 【スイッチ：OFF】画像がない作品は枠を強制非表示
                preview.style.setProperty('display', 'none', 'important');
                preview.style.backgroundImage = 'none';
            }
        }

        // 🌟 1. 時間表示の更新（常に表示し、画像がある場合は同調・無ければマウス追従）
        if (previewTime) {
            previewTime.style.setProperty('display', 'block', 'important');
            previewTime.innerText = formatTime(targetTime);
            previewTime.style.left = `${leftPosForTime}px`; 
        }
    });

    seekBar.addEventListener('mouseleave', () => {
        if (preview) {
            // 🌟 修正：ここも !important で強力に消す
            preview.style.setProperty('display', 'none', 'important');
            preview.style.backgroundImage = 'none'; 
        }
        if (previewTime) {
            // 🌟 修正：文字も !important で強力に消す
            previewTime.style.setProperty('display', 'none', 'important');
        }
    });

    uiOverlay.addEventListener('click', (e) => {
    const isMenu = e.target.closest('.player-popup-menu');
    const isControl = e.target.closest('.player-bottom-panel');
    const isButton = e.target.closest('button');
    const isCloseBtn = e.target.closest('.close-player-btn');

    // 🌟 修正：現在メニューが開いているかチェック
    const isAnyMenuOpen = !document.getElementById('audio-menu').classList.contains('hidden') || 
                              !document.getElementById('subtitle-menu').classList.contains('hidden') ||
                              !document.getElementById('settings-menu').classList.contains('hidden') ||
                              !document.getElementById('episode-menu').classList.contains('hidden'); // ← 🌟これを追加

        // 「メニューを開いている時」は togglePlay を絶対に実行させない
        if (!isMenu && !isControl && !isButton && !isCloseBtn && !isAnyMenuOpen) {
            togglePlay();
        }
    });

    videoPlayer.addEventListener('play', () => {
        updatePlayPauseIcon();
        if (isInitialPlaySent) reportPlayback('Progress'); 
    });

    videoPlayer.addEventListener('pause', () => {
        updatePlayPauseIcon();
        reportPlayback('Progress');
    });

    videoPlayer.addEventListener('seeked', () => reportPlayback('Progress'));
    videoPlayer.addEventListener('ended', () => reportPlayback('Stopped'));
    

   window.resetIdleTimer = function() {
        if (!uiOverlay || uiOverlay.classList.contains('is-loading')) return;

        uiOverlay.classList.remove('idle');
        clearTimeout(uiTimeout);
        uiTimeout = setTimeout(() => { 
            // 動画が再生中の時のみ、3秒後にアイドル(非表示)状態にする
            if (!videoPlayer.paused) uiOverlay.classList.add('idle'); 
        }, 3000);
    };

    // 🌟 2. マウスを動かした時に関数を実行
    document.addEventListener('mousemove', window.resetIdleTimer);

    

    

    document.addEventListener('click', (e) => {
        // 🌟 もし右コントロール内（ボタンやメニュー）以外をクリックしたらメニューを隠す
        if (!e.target.closest('.right-controls') && !e.target.closest('.episode-menu-header')) {
            const audioMenu = document.getElementById('audio-menu');
            const subtitleMenu = document.getElementById('subtitle-menu');
            const settingsMenu = document.getElementById('settings-menu');
            const episodeMenu = document.getElementById('episode-menu'); // 🌟 追加
            
            if (audioMenu && !audioMenu.classList.contains('hidden')) audioMenu.classList.add('hidden');
            if (subtitleMenu && !subtitleMenu.classList.contains('hidden')) subtitleMenu.classList.add('hidden');
            if (settingsMenu && !settingsMenu.classList.contains('hidden')) settingsMenu.classList.add('hidden');
            if (episodeMenu && !episodeMenu.classList.contains('hidden')) episodeMenu.classList.add('hidden'); // 🌟 追加
        }
    });

    // 🌟 エピソードボタンのクリックイベント（設定メニュー紐付けの下あたりに追加）
    const epBtn = document.getElementById('episode-menu-btn');
    if (epBtn) {
        epBtn.onclick = (e) => {
            e.stopPropagation();
            toggleMenu('episode-menu'); // 他のメニューを閉じてこれを開く
            if (currentPlayerSeriesId) {
                // 開いた時にリストを読み込む
                loadPlayerEpisodes(currentPlayerSeriesId, currentPlayerSeasonId);
            }
        };
    }

    const popupMenus = document.querySelectorAll('.player-popup-menu');
    popupMenus.forEach(menu => {
        menu.addEventListener('click', (e) => { e.stopPropagation(); });
    });

     const settingsBtn = document.getElementById('settings-menu-btn');
    
    if (settingsBtn) {
        settingsBtn.onclick = (e) => {
            e.stopPropagation();
            toggleMenu('settings-menu');
            switchSettingsView('main'); // 開くときは常にメイン画面から
        };
    }

    // メインメニュー内の各項目をクリックした時の動き
    const qBtn = document.getElementById('menu-quality-btn');
    if (qBtn) qBtn.onclick = () => switchSettingsView('quality');

    const aBtn = document.getElementById('menu-aspect-btn');
    if (aBtn) aBtn.onclick = () => switchSettingsView('aspect');

    const sBtn = document.getElementById('menu-subtitle-btn');
    if (sBtn) sBtn.onclick = () => switchSettingsView('subtitle');

    // 再生情報パネルの表示
    const statsBtn = document.getElementById('menu-stats-btn');
    if (statsBtn) {
        statsBtn.onclick = () => {
            document.getElementById('playback-stats-overlay').classList.remove('hidden');
            document.getElementById('settings-menu').classList.add('hidden'); // メニューは閉じる
            startStatsUpdate(); // 後ほど作る「情報更新ループ」を開始
        };
    }

    // 再生情報の閉じるボタン
    const closeStatsBtn = document.getElementById('close-stats-btn');
    if (closeStatsBtn) {
        closeStatsBtn.onclick = () => {
            document.getElementById('playback-stats-overlay').classList.add('hidden');
            stopStatsUpdate(); // 更新を止める
        };
    }

    

    // 🌟 UI（バーの長さとツマミの位置）を更新する共通関数
   

setupAspectMenu();
initSubtitleSettings();





} // <-- DOMContentLoaded 終了

window.addEventListener('popstate', (event) => {
    const playerContainer = document.getElementById('player-container');
    if (!event.state || event.state.modal !== 'player') {
        if (playerContainer && !playerContainer.classList.contains('hidden')) {
            closeEntirePlayerUI(); 
        }
    }
});

async function fetchTrickplayManifest(itemId) {
    const serverUrl = typeof SERVER_URL !== 'undefined' ? SERVER_URL : (localStorage.getItem('serverUrl') || "/jellyfin-api");
    const currentToken = localStorage.getItem('token') || sessionStorage.getItem('token');
    
    trickplayManifest = null;

    try {
        // 🌟 修正：検証ツールで100%成功した「GETリクエスト（デフォルト）」に完全に合わせる
        // （HEADリクエストがサーバーに弾かれていたのが原因です）
        const testUrl = `${serverUrl}/Videos/${itemId}/Trickplay/320/0.jpg?api_key=${currentToken}&MediaSourceId=${itemId}`;
        const res = await fetch(testUrl); // method: 'HEAD' を削除し、通常のGETにする

        if (res.ok) {
            trickplayManifest = {
                Width: 320,
                Interval: 100000000, // 10秒（Jellyfin標準）
                fallback: false
            };
            console.log("✅ トリックプレー画像（320px）を確認しました。");
        } else {
            // 320がダメなら390も一応確認
            const testUrl390 = `${serverUrl}/Videos/${itemId}/Trickplay/390/0.jpg?api_key=${currentToken}&MediaSourceId=${itemId}`;
            const res390 = await fetch(testUrl390); // こちらも通常のGETにする
            
            if (res390.ok) {
                trickplayManifest = { Width: 390, Interval: 100000000, fallback: false };
                console.log("✅ トリックプレー画像（390px）を確認しました。");
            } else {
                throw new Error("No Trickplay images found");
            }
        }
    } catch (e) {
        console.warn("⚠️ トリックプレー画像が見つかりません。時間のみモードになります。");
        trickplayManifest = { fallback: true };
    }
}

async function startPlayback(itemId) {
    const playerContainer = document.getElementById('player-container');
    document.body.classList.add('player-active');
    const uiOverlay = document.getElementById('player-ui');
    const loader = document.getElementById('player-loading-overlay');

    if (typeof stopBgCarousel === 'function') stopBgCarousel();
    if (typeof cleanupDetailsTrailer === 'function') cleanupDetailsTrailer();

    // 履歴追加（すでにURLが ?play= なら push せず replace で重複を防ぐ）
    const isAlreadyPlayUrl = new URLSearchParams(window.location.search).has('play');
    if (!playerContainer.classList.contains('hidden') || isAlreadyPlayUrl) {
        history.replaceState({ modal: 'player' }, '', `?play=${itemId}`);
    } else {
        history.pushState({ modal: 'player' }, '', `?play=${itemId}`);
    }

    const serverUrl = typeof SERVER_URL !== 'undefined' ? SERVER_URL : localStorage.getItem('serverUrl'); 
    const currentToken = localStorage.getItem('token'); 
    const currentUserId = localStorage.getItem('userId');
    const t = Date.now();

    try {
        // 1. 🌟 最初にアイテムの詳細情報を取得（背景やタイトルのために必要）
        const itemRes = await fetch(`${serverUrl}/Users/${currentUserId}/Items/${itemId}?_t=${t}`, { 
            headers: { 'X-Emby-Token': currentToken } 
        });
        const itemData = await itemRes.json();

        fetchIntroSkip(itemId);

        // 🌟 エピソードならリストを保存（オートプレイ用）
        if (itemData.Type === 'Episode') {
            const listRes = await fetch(`${serverUrl}/Shows/${itemData.SeriesId}/Episodes?seasonId=${itemData.SeasonId}&UserId=${currentUserId}`, { headers: { 'X-Emby-Token': currentToken } });
            const listData = await listRes.json();
            currentEpisodeList = listData.Items;
        }

        // 🌟 追加：エピソードボタンの表示・非表示判定
        const episodeBtn = document.getElementById('episode-menu-btn');
        if (itemData.Type === 'Episode') {
            currentPlayerSeriesId = itemData.SeriesId;
            currentPlayerSeasonId = itemData.SeasonId;
            if (episodeBtn) episodeBtn.classList.remove('hidden');
        } else {
            currentPlayerSeriesId = null;
            currentPlayerSeasonId = null;
            if (episodeBtn) episodeBtn.classList.add('hidden');
        }

        // 2. 🌟 背景画像と作品タイトルの設定
        if (serverUrl && currentToken) {
            // シリーズ背景を優先
            const backdropId = itemData.SeriesId || itemData.ParentBackdropItemId || itemId;
            const backdropUrl = `${serverUrl}/Items/${backdropId}/Images/Backdrop?maxWidth=1920&api_key=${currentToken}`;
            
            playerContainer.style.backgroundColor = '#000';
            playerContainer.style.backgroundImage = `url("${backdropUrl}")`;
            playerContainer.style.backgroundSize = 'contain';
            playerContainer.style.backgroundPosition = 'center';
            playerContainer.style.backgroundRepeat = 'no-repeat';
            
            const titleEl = document.getElementById('player-item-title');
            if (titleEl) {
                let fullTitle = itemData.Name;
                if (itemData.SeriesName) {
                    const epInfo = (itemData.ParentIndexNumber && itemData.IndexNumber) 
                                   ? ` S${itemData.ParentIndexNumber}:E${itemData.IndexNumber}` 
                                   : "";
                    fullTitle = `${itemData.SeriesName}${epInfo} - ${itemData.Name}`;
                }
                titleEl.innerText = fullTitle;
                
                // 🌟 追加：ブラウザのタブ名も再生中の作品名に更新する
                if (typeof updatePageTitle === 'function') {
                    updatePageTitle(fullTitle);
                } else {
                    document.title = `${fullTitle} - ChidaCinema`;
                }
            }

            playerContainer.classList.add('is-loading');
            uiOverlay.classList.add('idle'); 
            if (loader) loader.style.display = 'flex';
        }

        // 3. 🌟 再生対象のIDを特定（シリーズ/シーズンの場合は最初のエピソードを探す）
        let targetId = itemId;
        if (itemData.Type === 'Series' || itemData.Type === 'Season') {
            const seriesId = (itemData.Type === 'Series') ? itemId : itemData.SeriesId;
            const episodesRes = await fetch(`${serverUrl}/Users/${currentUserId}/Items?ParentId=${seriesId}&Recursive=true&IncludeItemTypes=Episode&SortBy=SortName&SortOrder=Ascending&Limit=1&_t=${t}`, { 
                headers: { 'X-Emby-Token': currentToken } 
            });
            const episodesData = await episodesRes.json();
            if (episodesData.Items && episodesData.Items.length > 0) targetId = episodesData.Items[0].Id;
        }
        
        currentPlayItemId = targetId;

        if (!currentEpisodeList || currentEpisodeList.length === 0 || itemData.Type !== 'Episode') {
    const targetItemRes = await fetch(`${serverUrl}/Users/${currentUserId}/Items/${targetId}?Fields=SeriesId,SeasonId`, { headers: { 'X-Emby-Token': currentToken } });
    const targetItemData = await targetItemRes.json();
    
    if (targetItemData.SeriesId && targetItemData.SeasonId) {
        const listRes = await fetch(`${serverUrl}/Shows/${targetItemData.SeriesId}/Episodes?seasonId=${targetItemData.SeasonId}&UserId=${currentUserId}`, { headers: { 'X-Emby-Token': currentToken } });
        const listData = await listRes.json();
        currentEpisodeList = listData.Items;
    }
}

        // 4. 🌟 再生位置（続きから）の取得
        const targetRes = await fetch(`${serverUrl}/Users/${currentUserId}/Items/${targetId}?Fields=MediaSources&_t=${t}`, { 
            headers: { 'X-Emby-Token': currentToken } 
        });
        const targetData = await targetRes.json();
        const startTicks = targetData.UserData?.PlaybackPositionTicks || 0;
        const startTimeSeconds = startTicks / 10000000;

        // 🌟 追加：バージョンのリストから、デフォルト（一番最初）のソースIDを特定する
        let defaultSourceId = targetId; // 万が一リストが無い場合の保険
        if (targetData.MediaSources && targetData.MediaSources.length > 0) {
            defaultSourceId = targetData.MediaSources[0].Id;
        }

        // --- 5. 🌟 PlaybackInfoの取得 ---
        const authHeader = `MediaBrowser Client="ChidaFilm", Device="Chrome", DeviceId="CHIDA_CINEMA_STATION_01", Version="1.0.0", Token="${currentToken}"`;
        // URLからは MaxStreamingBitrate を消してスッキリさせます（bodyの方にまとめるため）
        const pbUrl = `${serverUrl}/Items/${targetId}/PlaybackInfo?UserId=${currentUserId}`;

        const pbRes = await fetch(pbUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Emby-Authorization': authHeader },
            body: JSON.stringify({
                UserId: currentUserId, 
                IsPlayback: true, 
                AutoOpenLiveStream: true, 
                MaxStreamingBitrate: 140000000,
                MediaSourceId: defaultSourceId, // 🌟 ここで「デフォルトのバージョン」を強制指定！
                DeviceProfile: {
                    Name: "ChidaFilm High Quality", MaxStreamingBitrate: 140000000,
                    DirectPlayProfiles: [{ Container: "mp4,m4v,mov,mkv,webm,ts", Type: "Video", VideoCodec: "h264,hevc,h265,vp9,av1", AudioCodec: "aac,mp3,opus,flac,ac3,dts" }],
                    CodecProfiles: [{ Type: "Video", Codec: "h264", Conditions: [{ Condition: "LessThanEqual", Property: "VideoBitDepth", Value: "10", IsRequired: false }, { Condition: "LessThanEqual", Property: "VideoLevel", Value: "51", IsRequired: false }] }],
                    TranscodingProfiles: [{ Container: "ts", Type: "Video", VideoCodec: "h264", AudioCodec: "aac", Protocol: "hls", MaxVideoWidth: 3840, MaxVideoHeight: 2160, BreakOnNonKeyFrames: true }]
                }
            })
        });

        const pbData = await pbRes.json();
        currentMediaSource = pbData.MediaSources[0];
        currentSessionId = pbData.PlaySessionId;
        
        // --- 🌟 言語設定による音声・字幕の自動決定 ---
        currentAudioIndex = currentMediaSource.DefaultAudioStreamIndex !== undefined ? currentMediaSource.DefaultAudioStreamIndex : null;
        currentSubtitleIndex = currentMediaSource.DefaultSubtitleStreamIndex !== undefined ? currentMediaSource.DefaultSubtitleStreamIndex : -1;
        
        const preferredLang = localStorage.getItem('settingLanguage') || 'ja'; // デフォルトは日本語
        const langCode3 = preferredLang === 'ja' ? 'jpn' : 'eng';
        
        let foundPreferredAudio = false;
        let foundPreferredSub = false;

        if (currentMediaSource.MediaStreams) {
            for (let stream of currentMediaSource.MediaStreams) {
                // 優先音声の検索
                if (stream.Type === 'Audio' && !foundPreferredAudio) {
                    if (stream.Language === preferredLang || stream.Language === langCode3 || (stream.Title && stream.Title.includes(preferredLang === 'ja' ? '日本' : 'English'))) {
                        currentAudioIndex = stream.Index;
                        foundPreferredAudio = true;
                    }
                }
                // 優先字幕の検索
                if (stream.Type === 'Subtitle' && !foundPreferredSub) {
                    if (stream.Language === preferredLang || stream.Language === langCode3 || (stream.Title && stream.Title.includes(preferredLang === 'ja' ? '日本' : 'English'))) {
                        currentSubtitleIndex = stream.Index;
                        foundPreferredSub = true;
                    }
                }
            }
        }
        console.log(`[Language Setting] Preferred: ${preferredLang}, AudioIndex: ${currentAudioIndex}, SubIndex: ${currentSubtitleIndex}`);

        // 6. 🌟 再生準備
        fetchTrickplayManifest(currentPlayItemId);
        playerContainer.classList.remove('hidden');
        buildStreamMenus(); 
        loadAndPlayHls(startTimeSeconds); 

        isInitialPlaySent = true;
        await reportPlayback('Playing');
        
        if (progressInterval) clearInterval(progressInterval);
        progressInterval = setInterval(() => { 
            if (!document.getElementById('main-video-player').paused) reportPlayback('Progress'); 
        }, 10000);
        updateEpisodeNavigation();

    } catch (err) { 
        console.error("再生失敗:", err); 
    }
}

async function loadAndPlayHls(startTime, fetchNewInfo = false) {
    const playerContainer = document.getElementById('player-container');
    if (playerContainer) playerContainer.classList.add('is-loading');
    const videoPlayer = document.getElementById('main-video-player');
    isSwitchingStream = true; 
    const snapshot = document.getElementById('player-snapshot');
    const serverUrl = typeof SERVER_URL !== 'undefined' ? SERVER_URL : (localStorage.getItem('serverUrl') || "/jellyfin-api"); 
    
    const currentToken = localStorage.getItem('token') || sessionStorage.getItem('token');
    const currentUserId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
    
    if (!currentUserId || !currentToken) return;

    if (fetchNewInfo) captureVideoSnapshot();

    const loader = document.getElementById('player-loading-overlay'); 
    if (loader) loader.style.display = 'flex';

    videoPlayer.pause(); 

    if (fetchNewInfo) {
        const subStream = currentMediaSource ? currentMediaSource.MediaStreams.find(s => s.Index === currentSubtitleIndex) : null;
        const isText = isTextSubtitle(subStream);

        const authHeader = `MediaBrowser Client="ChidaFilm", Device="Chrome", DeviceId="CHIDA_CINEMA_STATION_01", Version="1.0.0", Token="${currentToken}"`;
        const pbUrl = `${serverUrl}/Items/${currentPlayItemId}/PlaybackInfo?UserId=${currentUserId}`;
        
        try {
            const pbRes = await fetch(pbUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Emby-Authorization': authHeader },
                body: JSON.stringify({
    UserId: currentUserId, 
    IsPlayback: true, 
    AutoOpenLiveStream: true, 
    // 🌟 固定値(80000000)をやめて、選択されたビットレートを反映！
    MaxStreamingBitrate: currentQualityBitrate, 
    AudioStreamIndex: currentAudioIndex !== null ? currentAudioIndex : undefined,
    SubtitleStreamIndex: (currentSubtitleIndex !== -1 && !isText) ? currentSubtitleIndex : undefined,
    DeviceProfile: {
        // 🌟 ここも反映！
        MaxStreamingBitrate: currentQualityBitrate
    }
})
            });
            const pbData = await pbRes.json();
            currentMediaSource = pbData.MediaSources[0];
            currentSessionId = pbData.PlaySessionId;
            buildStreamMenus();
        } catch (e) { console.error(e); }
    }

    // 🌟 修正2: AudioChannels=2 を外し、より安全な TranscodingMaxAudioChannels=2 に変更。
    // VideoCodec も hevc (H.265) を許容するように追加。
    let reqWidth = 3840;
    if (currentMaxHeight === 1080) reqWidth = 1920;
    else if (currentMaxHeight === 720) reqWidth = 1280;
    else if (currentMaxHeight === 480) reqWidth = 854;
    else if (currentMaxHeight === 360) reqWidth = 640;

    let streamUrl = `${serverUrl}/Videos/${currentPlayItemId}/master.m3u8?` + 
    `api_key=${currentToken}&DeviceId=CHIDA_CINEMA_STATION_01&MediaSourceId=${currentMediaSource.Id}&PlaySessionId=${currentSessionId}&` +
    `VideoCodec=h264,hevc&AudioCodec=aac,mp3&` +
    `VideoBitrate=${currentQualityBitrate}&` + 
    `MaxWidth=${reqWidth}&MaxHeight=${currentMaxHeight || 2160}&` + // 🌟 reqWidthを使うように変更
    `AudioBitrate=320000&TranscodingMaxAudioChannels=2&SegmentContainer=ts&_t=${Date.now()}`;

    if (currentAudioIndex !== null && currentAudioIndex !== undefined) streamUrl += `&AudioStreamIndex=${currentAudioIndex}`;
    
    isBurnInMode = false; 
    if (currentSubtitleIndex !== -1) {
        const subStream = currentMediaSource.MediaStreams.find(s => s.Index === currentSubtitleIndex);
        if (subStream && !isTextSubtitle(subStream)) {
            streamUrl += `&SubtitleStreamIndex=${currentSubtitleIndex}&SubtitleMethod=Encode`;
            isBurnInMode = true;
        }
    }

    // 🌟 修正3: 古い通信をブラウザの根本から完全に断ち切る
    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }
    videoPlayer.removeAttribute('src'); // ビデオタグの中身を空にする
    videoPlayer.load(); // ブラウザの通信キャッシュをリセット

    if (Hls.isSupported()) {
        hlsInstance = new Hls({ 
            enableWorker: true, 
            abrEwmaDefaultEstimate: 80000000, 
            startLevel: -1, 
            xhrSetup: (xhr) => { xhr.setRequestHeader('X-Emby-Token', currentToken); } 
        });

        // 🌟 ここで画質変更のイベントを登録する（名前を hlsInstance に統一）
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
            videoPlayer.currentTime = startTime;
            videoPlayer.play().catch(e => console.warn("再生ブロック:", e));
            
            setupQualityMenu(hlsInstance);

            if (isAutoMode) {
                hlsInstance.currentLevel = -1; // -1は「回線に合わせて自動調整」
            } else {
                // 🌟 手動モード：送られてきたプレイリスト(data.levels)の中から、
                // 指定した高さ(currentMaxHeight)に一番近い画質を探し出す
                let targetLevel = -1;
                let minDiff = Infinity;
                
                data.levels.forEach((level, index) => {
                    const diff = Math.abs(level.height - currentMaxHeight);
                    if (diff < minDiff) {
                        minDiff = diff;
                        targetLevel = index;
                    }
                });

                if (targetLevel !== -1) {
                    hlsInstance.currentLevel = targetLevel; // 🌟 ここで画質を「強制固定（ロック）」！
                    console.log(`🎬 画質を固定しました: レベル ${targetLevel} (${data.levels[targetLevel].height}p)`);
                }
            }
        });

        // 🌟 修正：一番下にあった LEVEL_SWITCHED をここに移動
        hlsInstance.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
            const currentLabel = document.getElementById('current-quality-label');
            if (currentLabel) {
                // 🌟 自動モードの時だけ「自動 (XXp)」と上書き。手動の時はラベルを勝手に変えない！
                if (isAutoMode) {
                    const height = hlsInstance.levels[data.level].height;
                    currentLabel.innerText = `自動 (${height}p)`;
                }
            }
        });

        hlsInstance.loadSource(streamUrl);
        hlsInstance.attachMedia(videoPlayer);
    }

    videoPlayer.onplaying = () => {
        const loader = document.getElementById('player-loading-overlay');
        const playerContainer = document.getElementById('player-container');
        const uiOverlay = document.getElementById('player-ui');
        const bigIconOverlay = document.getElementById('big-icon-overlay'); // 🌟 追加：アイコン要素を取得

        if (loader) loader.style.display = 'none';
        if (snapshot) snapshot.classList.add('hidden');
        
        // 🌟 【修正】ロード画面の封印を解く前に、アニメーション状態を強制リセット
        // これをしないと、is-loading が外れた瞬間に CSS アニメーションが誤爆します
        if (bigIconOverlay) {
            bigIconOverlay.classList.remove('animate');
        }

        // 🌟 動画が始まったら「背景画像」を消す
        if (playerContainer) {
            playerContainer.classList.remove('is-loading');
            playerContainer.style.backgroundImage = 'none';
        }
        if (uiOverlay) {
            uiOverlay.classList.remove('idle');
        }

        isSwitchingStream = false;
        // false を渡すことで、ここでもアニメーションを発火させないようにしている
        updatePlayPauseIcon(false); 
        setTimeout(() => { setupNativeSubtitles(); }, 200);
    };

    
    
    setupNativeSubtitles();
}

function buildStreamMenus() {
    const audioList = document.getElementById('audio-list');
    const subtitleList = document.getElementById('subtitle-list');
    
    // 🌟 ボタン要素を取得
    const audioBtn = document.getElementById('audio-menu-btn');
    const subtitleBtn = document.getElementById('subtitle-menu-btn');

    if(!audioList || !subtitleList) return;
    
    audioList.innerHTML = ''; 
    subtitleList.innerHTML = '';

    if(!currentMediaSource || !currentMediaSource.MediaStreams) return;

    // 🌟 音声と字幕の数をカウント
    const audioStreams = currentMediaSource.MediaStreams.filter(s => s.Type === 'Audio');
    const subtitleStreams = currentMediaSource.MediaStreams.filter(s => s.Type === 'Subtitle');

    // 🌟 条件1: 音声が1つ以下の場合は音声ボタンを隠す
    if (audioBtn) {
        audioBtn.style.display = (audioStreams.length <= 1) ? 'none' : 'flex';
    }

    // 🌟 条件2: 字幕が0の場合は字幕ボタンを隠す
    if (subtitleBtn) {
        subtitleBtn.style.display = (subtitleStreams.length === 0) ? 'none' : 'flex';
    }

    // ❌ 注意：前回追加した「条件3（subCustomizeBtnを隠す）」は削除しました。
    // これを隠すとPGSSUBの時に言語切り替え自体ができなくなるためです。

    const offLi = document.createElement('li');
    offLi.innerText = 'オフ';
    offLi.className = currentSubtitleIndex === -1 ? 'active' : '';
    offLi.onclick = () => changeStream('subtitle', -1);
    subtitleList.appendChild(offLi);

    currentMediaSource.MediaStreams.forEach(stream => {
        const li = document.createElement('li');
        let title = stream.Title || stream.DisplayTitle || stream.Language || 'Unknown';
        li.innerText = title;

        if (stream.Type === 'Audio') {
            li.className = currentAudioIndex === stream.Index ? 'active' : '';
            li.onclick = () => changeStream('audio', stream.Index);
            audioList.appendChild(li);
        } else if (stream.Type === 'Subtitle') {
            li.className = currentSubtitleIndex === stream.Index ? 'active' : '';
            li.onclick = () => changeStream('subtitle', stream.Index);
            subtitleList.appendChild(li);
        }
    });

    // 🌟 修正：右ペイン（カスタマイズメニュー）を強力に非表示にする
    const rightPane = document.querySelector('.subtitle-pane-right');
    const divider = document.querySelector('.subtitle-pane-divider');
    const subtitleMenu = document.getElementById('subtitle-menu'); // 🌟 メニューの大枠を取得

    // 現在選ばれている字幕ストリームを取得
    const activeStream = currentSubtitleIndex !== -1 
        ? currentMediaSource.MediaStreams.find(s => s.Index === currentSubtitleIndex) 
        : null;

    // テキスト字幕かどうかを判定
    const isText = activeStream ? isTextSubtitle(activeStream) : false;

    if (currentSubtitleIndex === -1 || !isText) {
        // ❌ 画像字幕 または オフ（右側を非表示）
        if (rightPane) rightPane.style.display = 'none';
        if (divider) divider.style.display = 'none';
        
        // 🌟 修正：具体的な数値と「!important」を使って、CSSの指定をねじ伏せて強制的に縮める
        if (subtitleMenu) {
            subtitleMenu.style.setProperty('width', '250px', 'important');
            subtitleMenu.style.setProperty('min-width', '250px', 'important');
        }
    } else {
        // ⭕ テキスト字幕（右側を表示）
        if (rightPane) rightPane.style.display = ''; 
        if (divider) divider.style.display = '';
        
        // 🌟 追加：メニュー全体の幅を元の広いサイズに戻す（空文字にすれば元のCSSに戻ります）
        if (subtitleMenu) {
            subtitleMenu.style.width = ''; 
            subtitleMenu.style.minWidth = ''; 
        }
    }
}

function changeStream(type, index) {
    const videoPlayer = document.getElementById('main-video-player');
    const currentTime = videoPlayer.currentTime;

    if (type === 'audio') {
        currentAudioIndex = index;
        buildStreamMenus(); 
        loadAndPlayHls(currentTime, true); 
        document.getElementById('audio-menu').classList.add('hidden');
        return;
    }

    if (type === 'subtitle') {
        currentSubtitleIndex = index;
        buildStreamMenus();
        
        const newStream = currentMediaSource.MediaStreams.find(s => s.Index === index);
        const isNewTextOrOff = (index === -1) || isTextSubtitle(newStream);

        if (isNewTextOrOff && !isBurnInMode) {
            applyTextSubtitle(index);
        } else {
            loadAndPlayHls(currentTime, true);
        }
        document.getElementById('subtitle-menu').classList.add('hidden');
    }
}

function togglePlay() {
    const videoPlayer = document.getElementById('main-video-player');
    if (videoPlayer.paused) { videoPlayer.play(); } else { videoPlayer.pause(); }
    updatePlayPauseIcon(true);
}

function toggleMenu(menuId) {
    const target = document.getElementById(menuId);
    const isHidden = target.classList.contains('hidden');
    document.getElementById('audio-menu').classList.add('hidden');
    document.getElementById('subtitle-menu').classList.add('hidden');
    document.getElementById('settings-menu').classList.add('hidden');
    document.getElementById('episode-menu').classList.add('hidden');
    if (isHidden) target.classList.remove('hidden');
}


function changeVolume(val) {
    const videoPlayer = document.getElementById('main-video-player');
    const icon = document.getElementById('volume-icon');
    const range = document.getElementById('volume-range');
    
    if (!videoPlayer) return;

    // 範囲外を防止
    val = Math.max(0, Math.min(1, val));

    videoPlayer.volume = val;
    videoPlayer.muted = (val == 0);

    if (icon) icon.src = (val == 0) ? ICON_VOLUME_MUTE : ICON_VOLUME_ON;
    if (range) range.value = val;
    if (val > 0) lastVolume = val;

    // 🌟 通知を表示
    showVolumeNotification(val);
}

// 🌟 ミュート切り替えの処理
function toggleMute() {
    const videoPlayer = document.getElementById('main-video-player');
    const icon = document.getElementById('volume-icon');
    const range = document.getElementById('volume-range');
    
    if (!videoPlayer) return;

    if (videoPlayer.muted || videoPlayer.volume === 0) {
        // ミュート解除
        videoPlayer.muted = false;
        videoPlayer.volume = lastVolume > 0 ? lastVolume : 0.5;
        if (range) range.value = videoPlayer.volume;
        if (icon) icon.src = ICON_VOLUME_ON;
    } else {
        // ミュート設定
        videoPlayer.muted = true;
        if (range) range.value = 0;
        if (icon) icon.src = ICON_VOLUME_MUTE;
    }
}


function showVolumeNotification(volume) {
    // 🌟 id="volume-indicator" を持つ要素を取得
    const indicator = document.getElementById('volume-indicator');
    if (!indicator) return;

    const barFill = document.getElementById('indicator-bar-fill');
    const percentText = document.getElementById('indicator-percent');
    const icon = indicator.querySelector('.volume-big-icon');

    const percent = Math.round(volume * 100);
    if (barFill) barFill.style.width = `${percent}%`;
    if (percentText) percentText.innerText = `${percent}%`;

    // アイコンの切り替え
    if (icon) {
        if (percent === 0) icon.innerText = 'volume_off';
        else if (percent < 50) icon.innerText = 'volume_down';
        else icon.innerText = 'volume_up';
    }

    // 表示用のクラスを追加
    indicator.classList.add('show');

    clearTimeout(volumeIndicatorTimeout);
    volumeIndicatorTimeout = setTimeout(() => {
        indicator.classList.remove('show');
    }, 1500);
}


function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0:00";

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
        // 🌟 1時間以上の場合： H:MM:SS (例 1:27:00)
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    } else {
        // 1時間未満の場合： M:SS (例 25:30)
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
}

async function reportPlayback(state, manualTime = null) {
    if (!currentPlayItemId || !currentSessionId || !currentMediaSource) return;

    const videoPlayer = document.getElementById('main-video-player');
    const serverUrl = typeof SERVER_URL !== 'undefined' ? SERVER_URL : (localStorage.getItem('serverUrl') || "/jellyfin-api");
    const currentToken = localStorage.getItem('token') || sessionStorage.getItem('token');
    
    const endpoint = (state === 'Playing') ? 'Playing' : `Playing/${state}`;
    const url = `${serverUrl}/Sessions/${endpoint}`;

    const authHeader = `MediaBrowser Client="ChidaFilm", Device="Chrome", DeviceId="CHIDA_CINEMA_STATION_01", Version="1.0.0", Token="${currentToken}"`;
    
    const time = (manualTime !== null) ? manualTime : videoPlayer.currentTime;
    const positionTicks = Math.floor(time * 10000000);

    try {
        return await fetch(url, {
            method: 'POST',
            keepalive: true, // 🌟 追加：ブラウザを閉じても通信を完了させる魔法のオプション
            headers: { 
                'X-Emby-Authorization': authHeader,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                ItemId: currentPlayItemId,
                MediaSourceId: currentMediaSource.Id,
                PositionTicks: positionTicks,
                PlaySessionId: currentSessionId,
                IsPaused: videoPlayer.paused,
                PlayMethod: 'DirectStream',
                CanSeek: true
            })
        });
    } catch (e) {
        console.error("❌ 再生報告エラー:", e);
    }
}

async function closeEntirePlayerUI() {
    const videoPlayer = document.getElementById('main-video-player');
    const playerContainer = document.getElementById('player-container');
    document.body.classList.remove('player-active');

    if (uiTimeout) {
        clearTimeout(uiTimeout);
        uiTimeout = null;
    }

    if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.log("Fullscreen exit error:", err));
    }

    const savedTime = videoPlayer.currentTime;

    // UIを隠し、再生を止める
    playerContainer.classList.add('hidden');
    playerContainer.style.backgroundImage = 'none';
    videoPlayer.pause();

    if (currentPlayItemId) {
        console.log(`⏳ 停止位置を裏側で保存中...`);
        await reportPlayback('Progress', savedTime);
        await reportPlayback('Stopped', savedTime); 
        if (typeof refreshDetailsPlaybackState === 'function') {
    // currentPlayItemId を使うか、必要に応じて適切なIDを渡します
    const idToUpdate = window.currentViewingSeriesId || currentPlayItemId; 
    refreshDetailsPlaybackState(idToUpdate);
}
    }

    if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
    currentPlayItemId = null;
    isInitialPlaySent = false;
    trickplayManifest = null;

    console.log("✅ 保存完了（バックグラウンド）");

    // 🌟 4. 保存が完全に終わってから、ホームの「続けて観る」だけを静かに更新する
    if (typeof loadResumeItems === 'function') {
        loadResumeItems();
    }

    stopStatsUpdate();
}



function setupNativeSubtitles() {
    const videoPlayer = document.getElementById('main-video-player');
    const serverUrl = "/jellyfin-api";
    const currentToken = localStorage.getItem('token') || sessionStorage.getItem('token');
    
    videoPlayer.innerHTML = ''; 
    if (!currentMediaSource || !currentMediaSource.MediaStreams) return;

    for (let i = 0; i < videoPlayer.textTracks.length; i++) {
        videoPlayer.textTracks[i].mode = 'disabled';
    }

    currentMediaSource.MediaStreams.forEach(stream => {
        if (stream.Type === 'Subtitle' && isTextSubtitle(stream)) {
            const track = document.createElement('track');
            track.kind = 'subtitles';
            track.label = stream.Index.toString();
            track.srclang = stream.Language;
            track.src = `${serverUrl}/Videos/${currentPlayItemId}/${currentMediaSource.Id}/Subtitles/${stream.Index}/0/Stream.vtt?api_key=${currentToken}`;
            track.mode = 'disabled';
            if (Number(stream.Index) === Number(currentSubtitleIndex) && !isBurnInMode) { track.default = true; }
            videoPlayer.appendChild(track);
        }
    });

    setTimeout(() => {
        const tracks = videoPlayer.textTracks;
        for (let i = 0; i < tracks.length; i++) {
            if (Number(tracks[i].label) === Number(currentSubtitleIndex) && !isBurnInMode) {
                tracks[i].mode = 'showing';
            } else {
                tracks[i].mode = 'disabled';
            }
        }
    }, 50);
}

function applyTextSubtitle(index) {
    const videoPlayer = document.getElementById('main-video-player');
    for (let i = 0; i < videoPlayer.textTracks.length; i++) {
        const track = videoPlayer.textTracks[i];
        track.mode = (track.label === index.toString()) ? 'showing' : 'hidden';
    }
}

function isTextSubtitle(stream) {
    if (!stream) return false;
    
    const codec = (stream.Codec || '').toLowerCase();
    
    // ❌ 1. 画像ベースの字幕コーデックなら、問答無用で「false（テキストではない）」にする
    if (['pgssub', 'dvdsub', 'vobsub', 'dvbsub'].includes(codec)) {
        return false;
    }

    // ⭕ 2. テキストベースの字幕コーデックなら「true」
    if (['srt', 'subrip', 'vtt', 'webvtt', 'ass', 'ssa', 'mov_text'].includes(codec)) {
        return true;
    }

    // 3. どちらにも当てはまらないマイナー形式の場合は、Jellyfinの判定に従う
    return stream.IsTextSubtitleFormat === true;
}

function captureVideoSnapshot() {
    const video = document.getElementById('main-video-player');
    const canvas = document.getElementById('player-snapshot');
    if (!video || !canvas || video.videoWidth === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.classList.remove('hidden');
}

function toggleFullscreen() {
    const container = document.getElementById('player-container');
    const fullscreenIcon = document.getElementById('fullscreen-icon');
    
    if (!document.fullscreenElement) {
        container.requestFullscreen()
            .then(() => { if (fullscreenIcon) fullscreenIcon.innerHTML = normalIconPath; })
            .catch(err => console.error(err));
    } else {
        document.exitFullscreen()
            .then(() => { if (fullscreenIcon) fullscreenIcon.innerHTML = fullIconPath; });
    }
}

document.addEventListener('fullscreenchange', () => {
    const fullscreenIcon = document.getElementById('fullscreen-icon');
    const fullIconPath = `<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h2m10 0h2a2 2 0 0 1 2 2v2m0 10v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/></g>`;
    const normalIconPath = `<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M7 3v2a2 2 0 0 1-2 2H3m14-4v2a2 2 0 0 0 2 2h2M7 21v-2a2 2 0 0 0-2-2H3m14 4v-2a2 2 0 0 1 2-2h2"/></g>`;
    if (!document.fullscreenElement) { fullscreenIcon.innerHTML = fullIconPath; } else { fullscreenIcon.innerHTML = normalIconPath; }
});

function skip(seconds) {
    const videoPlayer = document.getElementById('main-video-player');
    if (!videoPlayer || isNaN(videoPlayer.duration)) return;
    
    // 🌟 ユーザーが設定画面で選んだスキップ秒数を取得（デフォルト10秒）
    const storedSkip = localStorage.getItem('skipDuration');
    const userSkipAmount = storedSkip ? parseInt(storedSkip, 10) : 10;
    
    // 引数のマイナス・プラスを見て方向を維持しつつ、設定秒数を適用する
    const actualSeconds = seconds < 0 ? -userSkipAmount : userSkipAmount;
    
    let newTime = videoPlayer.currentTime + actualSeconds;
    if (newTime < 0) newTime = 0;
    if (newTime > videoPlayer.duration) newTime = videoPlayer.duration;
    videoPlayer.currentTime = newTime;
}

function updatePlayPauseIcon(showAnimation = true) {
    const playerContainer = document.getElementById('player-container');
    // 🌟 修正：ストリーム切り替え中、または「ロード中」ならアニメーションを表示しない
    const uiOverlay = document.getElementById('player-ui');
    if (!playerContainer || playerContainer.classList.contains('is-loading') || isSwitchingStream) {
    return; 
}

    const videoPlayer = document.getElementById('main-video-player');
    const playPausePath = document.getElementById('play-pause-path');
    const bigIconOverlay = document.getElementById('big-icon-overlay');
    const bigIconPath = document.getElementById('big-icon-path');

    if (!playPausePath) return;

    const isPaused = videoPlayer.paused;
    const currentPath = isPaused ? playPath : pausePath;
    playPausePath.setAttribute('d', currentPath);

    if (showAnimation && bigIconOverlay && bigIconPath) {
        bigIconPath.setAttribute('d', currentPath);
        bigIconOverlay.classList.remove('animate');
        void bigIconOverlay.offsetWidth; // リフローを強制してアニメーションをリセット
        bigIconOverlay.classList.add('animate');
    }
}

document.addEventListener('keydown', (e) => {
    const playerContainer = document.getElementById('player-container');
    const videoPlayer = document.getElementById('main-video-player');
    
    if (playerContainer.classList.contains('hidden')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (typeof window.resetIdleTimer === 'function') {
        window.resetIdleTarget = e.target; // フォーカス対策が必要な場合用
        window.resetIdleTimer();
    }

    if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const percent = parseInt(e.key) / 10;
        const targetTime = videoPlayer.duration * percent;
        captureVideoSnapshot();
        const loader = document.getElementById('player-loading-overlay');
        if (loader) loader.style.display = 'flex';
        videoPlayer.currentTime = targetTime;
        return;
    }

    switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); skip(-10); break;
        case 'ArrowRight': e.preventDefault(); skip(10); break;
        // 🌟 追加：音量操作（1回につき 0.02 ずつ変更）
        case 'ArrowUp':
            e.preventDefault();
            changeVolume(videoPlayer.volume + 0.02);
            break;
        case 'ArrowDown':
            e.preventDefault();
            changeVolume(videoPlayer.volume - 0.02);
            break;
        case ' ': e.preventDefault(); togglePlay(); break;
        case 'f':
        case 'F': e.preventDefault(); toggleFullscreen(); break;
    }
});

// 🌟 設定メニュー内の表示切り替え関数
function switchSettingsView(viewName) {
    const mainView = document.getElementById('settings-main-view');
    const qualityView = document.getElementById('settings-quality-view');
    const aspectView = document.getElementById('settings-aspect-view');
    const subtitleView = document.getElementById('settings-subtitle-view');

    // 一旦すべて隠す
    if (mainView) mainView.classList.add('hidden');
    if (qualityView) qualityView.classList.add('hidden');
    if (aspectView) aspectView.classList.add('hidden');
    if (subtitleView) subtitleView.classList.add('hidden');

    // 指定されたビューだけ表示
    const target = document.getElementById(`settings-${viewName}-view`);
    if (target) target.classList.remove('hidden');
}

// 🌟 設定ボタンとメニューの紐付け
document.addEventListener('DOMContentLoaded', () => {
   
});

function setupQualityMenu(hlsInstance) {
    const qualityList = document.getElementById('quality-list');
    const currentLabel = document.getElementById('current-quality-label');
    if (!qualityList || !currentMediaSource) return;

    // 🌟 1. 動画本来の解像度（高さと【横幅】の両方）を取得
    let nativeHeight = currentMediaSource.Height || 0;
    let nativeWidth = currentMediaSource.Width || 0;
    
    if ((nativeHeight === 0 || nativeWidth === 0) && currentMediaSource.MediaStreams) {
        const videoStream = currentMediaSource.MediaStreams.find(s => s.Type === 'Video');
        if (videoStream) {
            nativeHeight = videoStream.Height || 0;
            nativeWidth = videoStream.Width || 0;
        }
    }

    // 🌟 シネマスコープ（21:9等）対策：横幅基準で「画質クラス」を補正する
    let logicalHeight = nativeHeight;
    if (nativeWidth >= 3800) logicalHeight = Math.max(logicalHeight, 2160); // 4Kクラス
    else if (nativeWidth >= 1900) logicalHeight = Math.max(logicalHeight, 1080); // 1080pクラス
    else if (nativeWidth >= 1200) logicalHeight = Math.max(logicalHeight, 720); // 720pクラス
    else if (nativeWidth >= 800) logicalHeight = Math.max(logicalHeight, 480); // 480pクラス

    console.log(`🎬 実際の解像度: ${nativeWidth}x${nativeHeight} -> 判定クラス: ${logicalHeight}p`);

    qualityList.innerHTML = '';

    const qualityOptions = [
        { label: '4K (2160p)', height: 2160, bitrate: 40000000 },
        { label: '1080p', height: 1080, bitrate: 8000000 },
        { label: '720p', height: 720, bitrate: 3000000 },
        { label: '480p', height: 480, bitrate: 1500000 },
        { label: '360p', height: 360, bitrate: 700000 }
    ];

    // 🌟 「自動」の項目を作成
    const autoLi = document.createElement('li');
    autoLi.innerText = '自動';
    autoLi.className = isAutoMode ? 'active' : '';
    autoLi.onclick = () => handleQualitySelect(autoLi, '自動', 0, 140000000);
    qualityList.appendChild(autoLi);

    // 🌟 動画の解像度に合わせて選択肢を追加
    qualityOptions.forEach(opt => {
        // nativeHeightではなく、補正した logicalHeight を使って判定！
        if (logicalHeight > 0 && opt.height > logicalHeight) return;

        const li = document.createElement('li');
        li.innerText = opt.label;
        
        const isActive = !isAutoMode && currentMaxHeight === opt.height;
        li.className = isActive ? 'active' : '';

        li.onclick = () => handleQualitySelect(li, opt.label, opt.height, opt.bitrate);
        qualityList.appendChild(li);
    });

    // 🌟 クリックされた時の処理
    function handleQualitySelect(element, labelText, height, bitrate) {
        const items = qualityList.querySelectorAll('li');
        items.forEach(el => el.classList.remove('active'));
        element.classList.add('active');

        // クリックした瞬間にラベルを「1080p」などに確定させる
        if (currentLabel) {
            currentLabel.innerText = labelText;
        }

        isAutoMode = (height === 0);
        currentMaxHeight = height;
        currentQualityBitrate = bitrate;

        const videoPlayer = document.getElementById('main-video-player');
        loadAndPlayHls(videoPlayer.currentTime, true);
        
        switchSettingsView('main');
    }
}



   


function setupAspectMenu() {
    const aspectList = document.getElementById('aspect-list');
    const currentLabel = document.getElementById('current-aspect-label');
    const video = document.getElementById('main-video-player');
    
    if (!aspectList || !video) return;

    const items = aspectList.querySelectorAll('li');
    items.forEach(item => {
        item.onclick = () => {
            const mode = item.getAttribute('data-aspect'); // default, cover, fill
            const resText = item.innerText;

            // 1. UIの「チェック状態」を更新
            items.forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            
            // 2. メインメニューのラベルを更新
            if (currentLabel) currentLabel.innerText = resText;

            // 3. ビデオの見た目を変更
            if (mode === 'cover') {
                // ズームして画面を埋める（比率維持、端が切れる）
                video.style.objectFit = 'cover';
            } else if (mode === 'fill') {
                // 画面いっぱいに引き伸ばす（比率無視、歪む）
                video.style.objectFit = 'fill';
            } else {
                // 標準（比率維持、黒帯あり）
                video.style.objectFit = 'contain';
            }

            // メイン設定画面に戻る
            switchSettingsView('main');
        };
    });
}




let statsInterval = null;

function startStatsUpdate() {
    stopStatsUpdate();
    const statsPanel = document.getElementById('playback-stats-overlay');
    
    statsInterval = setInterval(() => {
        if (statsPanel.classList.contains('hidden') || !currentMediaSource) return;

        const video = document.getElementById('main-video-player');
        
        // 1. 解像度とバッファ（既存）
        document.getElementById('stat-resolution').innerText = `${video.videoWidth} x ${video.videoHeight}`;
        if (video.buffered.length > 0) {
            const bufferLen = (video.buffered.end(video.buffered.length - 1) - video.currentTime).toFixed(1);
            document.getElementById('stat-buffer').innerText = `${bufferLen} 秒`;
        }

        // 2. HLS/画質情報（既存）
        if (hlsInstance && hlsInstance.levels[hlsInstance.currentLevel]) {
            const level = hlsInstance.levels[hlsInstance.currentLevel];
            document.getElementById('stat-bitrate').innerText = `${(level.bitrate / 1000000).toFixed(2)} Mbps`;
            document.getElementById('stat-mode').innerText = `${hlsInstance.autoLevelEnabled ? "自動" : "固定"} (${level.height}p)`;
        }

        // 🌟 3. プレイ方法（URLにtranscodeが含まれるか）
        const isTranscode = video.src.includes('transcode') || video.src.includes('master.m3u8');
        document.getElementById('stat-play-method').innerText = isTranscode ? "トランスコード" : "直接再生";

        // 🌟 4. ストリームタイプ
        document.getElementById('stat-stream-type').innerText = "HLS (Adaptive)";

        // 🌟 5. ドロップフレーム（コマ落ち数）
        if (video.getVideoPlaybackQuality) {
            const quality = video.getVideoPlaybackQuality();
            document.getElementById('stat-dropped-frames').innerText = quality.droppedVideoFrames;
        }

        // 🌟 6. コンテナ / サイズ / コーデック (MediaSourceから取得)
        let containerRaw = (currentMediaSource.Container || "Unknown").toLowerCase();
let displayContainer = containerRaw;

if (containerRaw.includes('mp4')) {
    displayContainer = "MP4";
} else if (containerRaw.includes('mkv') || containerRaw.includes('matroska')) {
    displayContainer = "MKV";
} else if (containerRaw === 'mov') {
    // MOV単体の場合も、JellyfinではMP4を指していることが多いので
    // もし拡張子がmp4ならMP4と出すのが親切ですが、まずは大文字にするだけで対応
    displayContainer = "MOV / MP4"; 
} else {
    displayContainer = containerRaw.toUpperCase();
}

document.getElementById('stat-container').innerText = displayContainer;
        
        // ファイルサイズをGB/MBに変換
        const sizeInBytes = currentMediaSource.Size || 0;
        const sizeDisplay = sizeInBytes > 1024**3 
            ? (sizeInBytes / 1024**3).toFixed(2) + " GB" 
            : (sizeInBytes / 1024**2).toFixed(2) + " MB";
        document.getElementById('stat-file-size').innerText = sizeDisplay;

        // ビデオコーデックをMediaStreamsから探す
        const vStream = currentMediaSource.MediaStreams.find(s => s.Type === 'Video');
        document.getElementById('stat-codec').innerText = vStream ? vStream.Codec.toUpperCase() : "-";

    }, 1000);
}

function stopStatsUpdate() {
    if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
    }
}

// --- 字幕カスタマイズの初期化 ---
function initSubtitleSettings() {
    const sizeSlider = document.getElementById('sub-size-slider');
    const posSlider = document.getElementById('sub-pos-slider');
    const bgToggle = document.getElementById('sub-bg-toggle');
    
    const sizeDisplay = document.getElementById('sub-size-display');
    const posDisplay = document.getElementById('sub-pos-display');

    if (!sizeSlider || !posSlider || !bgToggle) return;

    // 🌟 localStorage から設定を読み込む
    const savedSize = localStorage.getItem('chidafilm_sub_size') || '100';
    const savedPos = localStorage.getItem('chidafilm_sub_pos') || '10';
    const savedBg = localStorage.getItem('chidafilm_sub_bg') !== 'false'; // デフォルトtrue

    // UIに反映
    sizeSlider.value = savedSize;
    posSlider.value = savedPos;
    bgToggle.checked = savedBg;
    sizeDisplay.textContent = `${savedSize}%`;
    posDisplay.textContent = `${savedPos}%`;

    // 変更イベント：スライダー
    const handleInput = (slider, display, storageKey) => {
        const val = slider.value;
        display.textContent = `${val}%`;
        localStorage.setItem(storageKey, val); // 🌟 保存
        applySubtitleStyles();
    };

    sizeSlider.addEventListener('input', () => handleInput(sizeSlider, sizeDisplay, 'chidafilm_sub_size'));
    posSlider.addEventListener('input', () => handleInput(posSlider, posDisplay, 'chidafilm_sub_pos'));
    
    // 変更イベント：背景トグル
    bgToggle.addEventListener('change', () => {
        localStorage.setItem('chidafilm_sub_bg', bgToggle.checked); // 🌟 保存
        applySubtitleStyles();
    });

    // 初回適用
    applySubtitleStyles();
}

function applySubtitleStyles() {
    const sizeSlider = document.getElementById('sub-size-slider');
    const posSlider = document.getElementById('sub-pos-slider');
    const bgToggle = document.getElementById('sub-bg-toggle');

    if (!sizeSlider || !posSlider) return;

    const size = sizeSlider.value;
    const pos = posSlider.value; // 0〜100の値
    const hasBg = bgToggle.checked;

    let styleEl = document.getElementById('subtitle-dynamic-style');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'subtitle-dynamic-style';
        document.head.appendChild(styleEl);
    }

    styleEl.innerHTML = `
        /* 1. 字幕の見た目 */
        #main-video-player::cue {
            font-size: ${size / 100}em !important;
            background-color: ${hasBg ? 'rgba(0,0,0,0.8)' : 'transparent'} !important;
            color: white !important;
            text-shadow: 0px 0px 6px rgba(0,0,0,1), 0px 0px 2px rgba(0,0,0,1) !important;
        }

        /* 2. 字幕の親枠のクリッピング（はみ出たら消える現象）を解除 */
        #main-video-player::-webkit-media-text-track-container {
            overflow: visible !important;
        }

        /* 3. 字幕の位置を transform で上に押し上げる (pos が 90 なら画面の90%上へ) */
        #main-video-player::-webkit-media-text-track-display {
            transform: translateY(-${pos}vh) !important;
            overflow: visible !important;
        }
    `;
}



// ==========================================
// 🌟 プレーヤー内エピソード選択機能（リッチUI対応版）
// ==========================================

// メイン画面とシーズン選択画面の切り替え
window.switchEpisodeView = function(viewName) {
    const mainView = document.getElementById('episode-main-view');
    const seasonView = document.getElementById('episode-season-view');
    if (!mainView || !seasonView) return;

    if (viewName === 'season') {
        mainView.classList.add('hidden');
        seasonView.classList.remove('hidden');
    } else {
        seasonView.classList.add('hidden');
        mainView.classList.remove('hidden');
    }
};

async function loadPlayerEpisodes(seriesId, targetSeasonId) {
    const serverUrl = typeof SERVER_URL !== 'undefined' ? SERVER_URL : localStorage.getItem('serverUrl');
    const currentToken = localStorage.getItem('token');
    const currentUserId = localStorage.getItem('userId');
    
    const seasonList = document.getElementById('player-season-list');
    const episodeList = document.getElementById('player-episode-list');
    const currentSeasonLabel = document.getElementById('current-season-label');

    if (!seasonList || !episodeList) return;

    episodeList.innerHTML = '<li style="color:#aaa; padding:20px;">読み込み中...</li>';

    try {
        // 1. 🌟 シーズン一覧を取得してリストを作成
        const seasonsRes = await fetch(`${serverUrl}/Shows/${seriesId}/Seasons?UserId=${currentUserId}`, { headers: { 'X-Emby-Token': currentToken } });
        const seasonsData = await seasonsRes.json();
        
        seasonList.innerHTML = '';
        let actualSeasonId = targetSeasonId;

        seasonsData.Items.forEach(season => {
            if (!actualSeasonId) actualSeasonId = season.Id;
            if (season.Id === actualSeasonId && currentSeasonLabel) {
                currentSeasonLabel.innerText = season.Name;
            }

            const li = document.createElement('li');
            const isSelected = (season.Id === actualSeasonId);
            
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.style.justifyContent = 'flex-start';
            li.style.gap = '8px';
            li.style.cursor = 'pointer';
            li.style.padding = '12px 15px';
            li.style.transition = 'background 0.2s ease';
            if (isSelected) li.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';

            li.onmouseenter = () => { if (!isSelected) li.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; };
            li.onmouseleave = () => { if (!isSelected) li.style.backgroundColor = 'transparent'; };

            // 🌟 修正：選択中の時だけチェックマークを入れ、それ以外は文字だけにする
            li.innerHTML = `
                ${isSelected ? '<span class="material-symbols-outlined" style="font-size: 1.2rem; color: #FFFFFF;">check</span>' : ''}
                <span style="color: ${isSelected ? '#FFFFFF' : '#ccc'}; font-weight: ${isSelected ? 'bold' : 'normal'};">${season.Name}</span>
            `;
            
            li.onclick = () => {
                if (currentSeasonLabel) currentSeasonLabel.innerText = season.Name;
                loadPlayerEpisodes(seriesId, season.Id);
                switchEpisodeView('main');
            };
            seasonList.appendChild(li);
        });

        // 2. 🌟 選択されたシーズンのエピソード一覧を取得
        const epsRes = await fetch(`${serverUrl}/Shows/${seriesId}/Episodes?seasonId=${actualSeasonId}&UserId=${currentUserId}&Fields=Overview`, { headers: { 'X-Emby-Token': currentToken } });
        const epsData = await epsRes.json();

        let expandedEpisodeId = currentPlayItemId;

        // 🌟 修正①：引数に shouldScroll を追加し、スクロール対象の要素を記憶する
        const renderEpisodeList = (shouldScroll = false) => {
            episodeList.innerHTML = '';
            let targetLi = null; // スクロール対象を保持する変数

            epsData.Items.forEach(ep => {
                const li = document.createElement('li');
                const isCurrent = (ep.Id === currentPlayItemId);
                const isExpanded = (ep.Id === expandedEpisodeId);

                // 🌟 現在展開されている（再生中などの）要素を記憶しておく
                if (isExpanded) targetLi = li;

                const imgUrl = `${serverUrl}/Items/${ep.Id}/Images/Primary?maxWidth=300&api_key=${currentToken}`;
                const runtimeStr = ep.RunTimeTicks ? formatTime(ep.RunTimeTicks / 10000000) : "";
                const overview = ep.Overview || "あらすじがありません。";
                const epNumber = ep.IndexNumber ? `${ep.IndexNumber}. ` : '';

                if (isExpanded) {
                    // 🌟 展開表示（画像＋あらすじ）
                    li.style.backgroundColor = isCurrent ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
                    if (isCurrent) li.style.borderLeft = '3px solid #FFFFFF'; 

                    li.innerHTML = `
                        <div class="episode-thumbnail-container">
                            <img src="${imgUrl}" alt="Episode Thumbnail" onerror="this.style.display='none'">
                        </div>
                        <div class="episode-info">
                            <div class="episode-title" style="display: flex; align-items: center; gap: 6px;">
                                ${isCurrent ? '<span class="material-symbols-outlined" style="font-size: 1.2rem; color: #FFFFFF;">check</span>' : ''}
                                ${epNumber}${ep.Name}
                            </div>
                            <div class="episode-desc">${runtimeStr} ${runtimeStr ? '•' : ''} ${overview}</div>
                        </div>
                    `;

                    li.onclick = () => {
                        if (!isCurrent) {
                            document.getElementById('episode-menu').classList.add('hidden');
                            switchEpisodeInPlayer(ep.Id);
                        }
                    };
                } else {
                    // 🌟 コンパクト表示（テキストのみ）
                    li.style.alignItems = 'center';
                    
                    li.innerHTML = `
                        <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; padding: 5px 0;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                ${isCurrent ? '<span class="material-symbols-outlined" style="font-size: 1.2rem; color: #FFFFFF;">check</span>' : ''}
                                <span style="font-size: 1rem; color: ${isCurrent ? '#FFFFFF' : '#ddd'}; font-weight: ${isCurrent ? 'bold' : 'normal'};">${epNumber}${ep.Name}</span>
                            </div>
                            <span style="font-size: 0.85rem; color: #888;">${runtimeStr}</span>
                        </div>
                    `;

                    li.onclick = () => {
                        expandedEpisodeId = ep.Id;
                        renderEpisodeList(false); // 🌟 手動でクリックして展開した時は勝手にスクロールさせない
                    };
                }
                episodeList.appendChild(li);
            });

            // 🌟 修正②：リストが描き終わった直後に、自動でフワッとスクロールさせる
            if (shouldScroll && targetLi) {
                setTimeout(() => {
                    targetLi.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 50); // HTMLに配置されるのをほんの少し(0.05秒)待つのがコツ
            }
        };

        // 🌟 初回読み込み時のみ true を渡して、自動スクロールを発動させる！
        renderEpisodeList(true);

    } catch (e) {
        console.error("エピソード読み込みエラー:", e);
        episodeList.innerHTML = '<li style="color:red; padding:20px;">読み込みに失敗しました</li>';
    }
}

// 🌟 プレーヤー内で別エピソードに切り替える処理
async function switchEpisodeInPlayer(newEpisodeId) {
    const videoPlayer = document.getElementById('main-video-player');
    const loader = document.getElementById('player-loading-overlay');
    
    // 🌟 1. UIを即座に「ロード中」にする（これが体感速度に直結します）
    if (loader) loader.style.display = 'flex';
    captureVideoSnapshot(); // 前の話の最後のコマをバックグラウンドにする

    // 🌟 2. 保存通信は await しない（バックグラウンドで投げるだけ）
    if (currentPlayItemId && !videoPlayer.paused) {
        reportPlayback('Progress');
        reportPlayback('Stopped');
    }
    
    // 3. 通信のリセット
    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }
    videoPlayer.pause();
    videoPlayer.removeAttribute('src');
    videoPlayer.load();

    // 4. 新しいエピソードの再生
    console.log(`🎬 高速切り替え実行: ${newEpisodeId}`);
    
    // 🌟 修正：await を追加して、読み込み完了を待ってからボタンを更新する
    await startPlayback(newEpisodeId);
    updateEpisodeNavigation(); 
}

/**
 * 🌟 追加：前後ボタンの表示と動作を更新する関数
 */
function updateEpisodeNavigation() {
    const prevBtn = document.getElementById('prev-episode-btn');
    const nextBtn = document.getElementById('next-episode-btn');
    if (!prevBtn || !nextBtn) return;

    // 🌟 修正：リストがまだ無い場合はボタンを隠して終了
    if (!currentEpisodeList || currentEpisodeList.length <= 1) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        return;
    }

    const currentIndex = currentEpisodeList.findIndex(e => e.Id === currentPlayItemId);

    // 🌟 デバッグ用ログ（うまく出ない時はこれを見てください）
    console.log(`🎬 ナビ更新: 現在のインデックス ${currentIndex} / 全 ${currentEpisodeList.length} 件`);

    // (以下、onclick 等の処理は既存のままでOKです)
    if (currentIndex > 0) {
        prevBtn.style.display = 'flex';
        prevBtn.onclick = (e) => {
            e.stopPropagation();
            switchEpisodeInPlayer(currentEpisodeList[currentIndex - 1].Id);
        };
    } else {
        prevBtn.style.display = 'none';
    }

    // 次のエピソードボタンの設定
    if (currentIndex !== -1 && currentIndex < currentEpisodeList.length - 1) {
        nextBtn.style.display = 'flex';
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            switchEpisodeInPlayer(currentEpisodeList[currentIndex + 1].Id);
        };
    } else {
        nextBtn.style.display = 'none';
    }
}
// 🌟 追記：タブを閉じる・リロードする瞬間に再生位置を保存する
window.addEventListener('beforeunload', () => {
    const videoPlayer = document.getElementById('main-video-player');
    // プレイヤーが表示されており、かつ再生中の場合に保存を実行
    if (currentPlayItemId && videoPlayer && !videoPlayer.paused) {
        // 同期的に実行される必要があるため、awaitせず即座に投げる
        reportPlayback('Stopped');
    }
});