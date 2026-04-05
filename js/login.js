/**
 * CHIDACINEMA - Jellyfin Portal Logic (Remember Me Support)
 */

// 🌟 修正：固定値ではなく、保存されたサーバーURLを優先的に読み込むように変更
// もし未設定の場合はデフォルトで /jellyfin-api を使用（Nginx等のリバースプロキシ用）
const JELLYFIN_SERVER_URL = localStorage.getItem('serverUrl') || "/jellyfin-api";
const JELLYSEERR_URL = localStorage.getItem('seerrUrl') || "/seerr-api";

const i18n = {
    jp: {
        title: "サインイン", subtitle: "CHIDACINEMAへおかえりなさい",
        user: "ユーザー名", pass: "パスワード", login: "サインイン",
        guest: "ゲストモードで視聴", switch: "EN",
        msgConnect: "Jellyfinに接続中...", 
        msgError: "パスワードが違うか、ユーザーが見つかりません",
        msgServer: "サーバーに接続できません"
    },
    en: {
        title: "Sign In", subtitle: "Welcome back to CHIDACINEMA",
        user: "Username", pass: "Password", login: "Sign In",
        guest: "Watch in Guest Mode", switch: "JP",
        msgConnect: "Connecting...", 
        msgError: "Invalid username or password",
        msgServer: "Cannot connect to server"
    }
};

let currentLang = 'jp';

function updateUI() {
    const t = i18n[currentLang];
    if(document.querySelector('h1')) document.querySelector('h1').textContent = t.title;
    if(document.querySelector('header p')) document.querySelector('header p').textContent = t.subtitle;
    
    const userLbl = document.querySelector('label[for="user"]');
    if(userLbl) userLbl.textContent = t.user;
    
    const passLbl = document.querySelector('label[for="pass"]');
    if(passLbl) passLbl.textContent = t.pass;

    const loginBtnText = document.querySelector('.primary-signin-btn .btn-text');
    if(loginBtnText) loginBtnText.textContent = t.login;

    const guestBtn = document.getElementById('guest-login-btn');
    if(guestBtn) {
        const span = guestBtn.querySelector('span:not(.material-symbols-outlined)');
        if(span) {
            span.textContent = t.guest;
        } else {
            guestBtn.childNodes[0].textContent = t.guest;
        }
    }

    const langTxt = document.getElementById('lang-text');
    if(langTxt) langTxt.textContent = t.switch;
}

function toggleLanguage() {
    currentLang = (currentLang === 'jp') ? 'en' : 'jp';
    updateUI();
}

document.addEventListener('DOMContentLoaded', () => {
    updateUI();

    const toggleBtn = document.getElementById('toggle-pass');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            const passInput = document.getElementById('pass');
            const isPass = passInput.type === 'password';
            passInput.type = isPass ? 'text' : 'password';
            this.textContent = isPass ? 'visibility_off' : 'visibility';
        });
    }

    const guestBtn = document.getElementById('guest-login-btn');
    if (guestBtn) {
        guestBtn.addEventListener('click', async () => {
            await performLogin("ゲストモード", "");
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = document.getElementById('user').value;
            const pass = document.getElementById('pass').value;
            await performLogin(user, pass);
        });
    }

    async function performLogin(username, password) {
        const msgArea = document.getElementById('login-msg');
        const rememberCheck = document.getElementById('remember');
        // チェックが入っていれば true
        const isRemember = rememberCheck ? rememberCheck.checked : false; 
        const t = i18n[currentLang];
        
        if(!msgArea) return;

        msgArea.style.color = "white";
        msgArea.textContent = t.msgConnect;

        // ログイン前に古いセッションをクリア
        localStorage.clear();
        sessionStorage.clear();

        try {
            const res = await fetch(`${JELLYFIN_SERVER_URL}/Users/AuthenticateByName`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // 🌟 Client を公式名に、DeviceId を再生時と同じ "CHIDA_WEB_PLAYER_02" に統一
                    'X-Emby-Authorization': `MediaBrowser Client="ChidaFilm", Device="Chrome", DeviceId="CHIDA_CINEMA_STATION_01", Version="1.0.0"`
                },
                body: JSON.stringify({ Username: username, Pw: password })
            });
            if (res.ok) {
                const data = await res.json();
                
                // ★ ここが重要：記憶するなら localStorage、しないなら sessionStorage
                const storage = isRemember ? localStorage : sessionStorage;
                
                storage.setItem('token', data.AccessToken);
                storage.setItem('userId', data.SessionInfo.UserId);

                try {
                    console.log("Jellyseerrに同時ログイン中...");
                    const seerrResponse = await fetch(`${JELLYSEERR_URL}/api/v1/auth/jellyfin`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({
                            username: username, // ユーザーが入力したID
                            password: password  // ユーザーが入力したパスワード
                        })
                    });

                    if (seerrResponse.ok) {
                        console.log("Jellyseerrのログイン成功！Cookieを取得しました。");
                    } else {
                        console.error("Jellyseerrのログインに失敗しました");
                    }
                } catch (seerrError) {
                    console.error("Jellyseerrのサーバーに接続できません:", seerrError);
                }
                
                msgArea.style.color = "#4CAF50";
                msgArea.textContent = "Success!";
                
                // 強固なキャッシュを突破させるため、ハッシュ/クエリをつけて最新のindex.htmlを強制取得させる
                const ts = new Date().getTime();
                setTimeout(() => { window.location.replace('index.html'); }, 800);
            } else {
                msgArea.style.color = "#ff4d4d";
                msgArea.textContent = t.msgError;
                const wrapper = document.querySelector('.login-wrapper');
                if (wrapper) {
                    wrapper.classList.add('shake');
                    setTimeout(() => wrapper.classList.remove('shake'), 400);
                }
            }
        } catch (err) {
            msgArea.style.color = "#ff4d4d";
            msgArea.textContent = t.msgServer;
        }
    }
});