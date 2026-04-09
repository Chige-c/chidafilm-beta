const SERVER_URL = "/jellyfin-api";

// データを取ってくる便利な関数
const Jellyfin = {
    async login(user, pass) {
        const res = await fetch(`${SERVER_URL}/Users/AuthenticateByName`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Emby-Authorization': 'MediaBrowser Client="ChidaUI", Device="PC", DeviceId="chida01", Version="1.0"' },
            body: JSON.stringify({ Username: user, Pw: pass })
        });
        return res.ok ? await res.json() : null;
    },

    async getItems(userId, token, type) {
        const res = await fetch(`${SERVER_URL}/Users/${userId}/Items?IncludeItemTypes=${type}&Recursive=true&Fields=Overview,RemoteTrailers&limit=24`, {
            headers: { 'X-Emby-Token': token }
        });
        return await res.json();
    }
};