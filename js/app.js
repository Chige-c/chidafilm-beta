let token = localStorage.getItem('token') || sessionStorage.getItem('token');
let userId = localStorage.getItem('userId') || sessionStorage.getItem('userId');

if (!token || !userId) {
    window.location.href = 'login.html';
}

function handleLogout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'login.html';
}

function updateGlassEffect() {
    // ターゲットのバーではなく、大元の body にクラスをつける
    if (window.scrollY > 50) {
        document.body.classList.add('is-scrolled');
    } else {
        document.body.classList.remove('is-scrolled');
    }
}
window.addEventListener('scroll', updateGlassEffect);
window.addEventListener('DOMContentLoaded', updateGlassEffect);