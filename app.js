const SUPABASE_URL = 'https://skwsuorigvxwwugpldvn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrd3N1b3JpZ3Z4d3d1Z3BsZHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MDY1NzAsImV4cCI6MjEwODM4MjU3MH0.-5MxD9VIFjANch9J0NMTFT-z-tM7eDDxdA1e4p8NFHc';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let accounts = [];
let settings = { theme: 'light', password: '', autoLock: true, biometricId: null }; 
let currentUser = null;
let deleteIndex = -1;
let isCloudLoaded = false;
let isAppLocked = false;
let autoLockTimer;
let html5QrCode = null;

// ==========================================
// [MỚI] PHÁT HIỆN HỆ ĐIỀU HÀNH & THIẾT BỊ
// ==========================================
const DEVICE = {
    os: 'unknown',          // windows, macos, ios, android, linux, chromeos
    osLabel: 'Không xác định',
    osIcon: 'question-circle',
    browser: 'unknown',
    browserLabel: '',
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    isTouch: false,
    biometricName: 'sinh trắc học',
    biometricLabel: 'sinh trắc học',
    biometricIcon: 'fingerprint',
    webauthnSupported: false,
    platformAuthenticatorAvailable: false,
    isSecureContext: false,
};

function detectDevice() {
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const maxTouch = navigator.maxTouchPoints || 0;

    // --- Touch / Mobile ---
    DEVICE.isTouch = maxTouch > 0 || ('ontouchstart' in window);
    DEVICE.isMobile = /Android|iPhone|iPod|Windows Phone|IEMobile|Opera Mini/i.test(ua) && !/iPad/i.test(ua);
    DEVICE.isTablet = /iPad/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
    DEVICE.isDesktop = !DEVICE.isMobile && !DEVICE.isTablet;

    // --- Hệ điều hành ---
    if (/Windows NT 10|Windows NT 11/i.test(ua)) {
        DEVICE.os = 'windows'; DEVICE.osLabel = 'Windows'; DEVICE.osIcon = 'fa-brands fa-windows';
        DEVICE.biometricName = 'Windows Hello';
        DEVICE.biometricIcon = 'fa-fingerprint';
    } else if (/Windows/i.test(ua)) {
        DEVICE.os = 'windows'; DEVICE.osLabel = 'Windows'; DEVICE.osIcon = 'fa-brands fa-windows';
        DEVICE.biometricName = 'Windows Hello';
        DEVICE.biometricIcon = 'fa-fingerprint';
    } else if (/iPhone|iPod/i.test(ua)) {
        DEVICE.os = 'ios'; DEVICE.osLabel = 'iOS'; DEVICE.osIcon = 'fa-brands fa-apple';
        DEVICE.biometricName = 'Face ID / Touch ID';
        DEVICE.biometricIcon = 'fa-face-smile';
    } else if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && maxTouch > 1)) {
        DEVICE.os = 'ipados'; DEVICE.osLabel = 'iPadOS'; DEVICE.osIcon = 'fa-brands fa-apple';
        DEVICE.biometricName = 'Face ID / Touch ID';
        DEVICE.biometricIcon = 'fa-face-smile';
    } else if (/Mac OS X|Macintosh/i.test(ua)) {
        DEVICE.os = 'macos'; DEVICE.osLabel = 'macOS'; DEVICE.osIcon = 'fa-brands fa-apple';
        DEVICE.biometricName = 'Touch ID';
        DEVICE.biometricIcon = 'fa-fingerprint';
    } else if (/Android/i.test(ua)) {
        DEVICE.os = 'android'; DEVICE.osLabel = 'Android'; DEVICE.osIcon = 'fa-brands fa-android';
        DEVICE.biometricName = 'Vân tay / Khuôn mặt';
        DEVICE.biometricIcon = 'fa-fingerprint';
    } else if (/CrOS/i.test(ua)) {
        DEVICE.os = 'chromeos'; DEVICE.osLabel = 'ChromeOS'; DEVICE.osIcon = 'fa-brands fa-chrome';
        DEVICE.biometricName = 'sinh trắc học';
        DEVICE.biometricIcon = 'fa-fingerprint';
    } else if (/Linux/i.test(ua) || /Linux/i.test(platform)) {
        DEVICE.os = 'linux'; DEVICE.osLabel = 'Linux'; DEVICE.osIcon = 'fa-brands fa-linux';
        DEVICE.biometricName = 'Khóa bảo mật';
        DEVICE.biometricIcon = 'fa-key';
    } else {
        DEVICE.os = 'unknown'; DEVICE.osLabel = 'Không xác định'; DEVICE.osIcon = 'fa-question-circle';
        DEVICE.biometricName = 'sinh trắc học';
        DEVICE.biometricIcon = 'fa-fingerprint';
    }

    // --- Trình duyệt ---
    if (/Edg\//i.test(ua)) { DEVICE.browser = 'edge'; DEVICE.browserLabel = 'Edge'; }
    else if (/OPR\/|Opera/i.test(ua)) { DEVICE.browser = 'opera'; DEVICE.browserLabel = 'Opera'; }
    else if (/Chrome/i.test(ua) && !/Edg|OPR/i.test(ua)) { DEVICE.browser = 'chrome'; DEVICE.browserLabel = 'Chrome'; }
    else if (/Firefox/i.test(ua)) { DEVICE.browser = 'firefox'; DEVICE.browserLabel = 'Firefox'; }
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) { DEVICE.browser = 'safari'; DEVICE.browserLabel = 'Safari'; }
    else { DEVICE.browser = 'other'; DEVICE.browserLabel = 'Khác'; }

    // --- WebAuthn ---
    DEVICE.isSecureContext = window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    DEVICE.webauthnSupported = !!(window.PublicKeyCredential && navigator.credentials);

    // Cập nhật label
    DEVICE.biometricLabel = `Dùng ${DEVICE.biometricName}`;

    console.log('[Device]', {
        os: DEVICE.os, osLabel: DEVICE.osLabel,
        browser: DEVICE.browserLabel,
        mobile: DEVICE.isMobile, tablet: DEVICE.isTablet,
        biometric: DEVICE.biometricName,
        webauthn: DEVICE.webauthnSupported,
        secure: DEVICE.isSecureContext
    });
}

// Áp dụng thông tin thiết bị lên UI
function applyDeviceToUI() {
    // Nút mở khóa sinh trắc học
    const btnLabel = document.getElementById('biometricBtnLabel');
    const btnIcon = document.getElementById('biometricBtnIcon');
    if (btnLabel) btnLabel.textContent = DEVICE.biometricLabel;
    if (btnIcon) btnIcon.className = `fas ${DEVICE.biometricIcon} text-xl`;

    // Badge HĐH
    const badgeHTML = `<i class="${DEVICE.osIcon}"></i> ${DEVICE.osLabel} · ${DEVICE.browserLabel}`;
    const badges = ['osBadgeLock', 'osBadgeSettings'];
    badges.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.innerHTML = badgeHTML; el.classList.remove('hidden'); }
    });

    // Dòng info thiết bị trong Settings
    const infoEl = document.getElementById('osDeviceInfo');
    if (infoEl) {
        const type = DEVICE.isTablet ? 'Máy tính bảng' : (DEVICE.isMobile ? 'Điện thoại' : 'Máy tính');
        infoEl.textContent = `(${type}${DEVICE.isTouch ? ' · Cảm ứng' : ''})`;
    }

    // Text mô tả sinh trắc học trong Settings
    const supportText = document.getElementById('biometricSupportText');
    if (supportText) {
        if (!DEVICE.webauthnSupported) {
            supportText.textContent = 'Thiết bị không hỗ trợ WebAuthn';
        } else if (!DEVICE.isSecureContext) {
            supportText.textContent = 'Cần HTTPS hoặc localhost';
        } else {
            supportText.textContent = `${DEVICE.biometricName} trên ${DEVICE.osLabel}`;
        }
    }

    // Nút setup
    const setupBtn = document.getElementById('btnSetupBiometric');
    if (setupBtn) {
        if (!DEVICE.webauthnSupported || !DEVICE.isSecureContext) {
            setupBtn.disabled = true;
            setupBtn.classList.add('opacity-50', 'cursor-not-allowed');
            setupBtn.textContent = 'Không hỗ trợ';
        } else {
            setupBtn.disabled = false;
            setupBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            setupBtn.textContent = settings.biometricId ? 'Đã cài đặt' : 'Cài đặt';
        }
    }
}

// Kiểm tra máy có authenticator platform (vân tay/khuôn mặt native) không
async function checkPlatformAuthenticator() {
    if (!DEVICE.webauthnSupported) return false;
    try {
        if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
            DEVICE.platformAuthenticatorAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        }
    } catch (e) {
        DEVICE.platformAuthenticatorAvailable = false;
    }
    return DEVICE.platformAuthenticatorAvailable;
}

// Hiện/ẩn nút sinh trắc học theo khả năng máy
async function updateBiometricVisibility() {
    const btn = document.getElementById('btnBiometricUnlock');
    if (!btn) return;

    const supported = await checkPlatformAuthenticator();
    const hasCredential = !!settings.biometricId;

    if (hasCredential && supported && DEVICE.isSecureContext) {
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }

    // Cập nhật lại trạng thái nút setup
    const setupBtn = document.getElementById('btnSetupBiometric');
    if (setupBtn && !setupBtn.disabled) {
        setupBtn.textContent = settings.biometricId ? 'Đã cài đặt' : 'Cài đặt';
    }
}

// ==========================================
// OVERLAY 3 TRẠNG THÁI
// ==========================================
function showHelloLoading(text, subtext) {
    const overlay = document.getElementById('helloLoadingOverlay');
    if (!overlay) return;
    const spinner = document.getElementById('helloSpinner');
    const resultIcon = document.getElementById('helloResultIcon');
    const textEl = document.getElementById('helloLoadingText');
    const subtextEl = document.getElementById('helloLoadingSubtext');

    if (spinner) spinner.classList.remove('hidden');
    if (resultIcon) {
        resultIcon.classList.add('hidden');
        resultIcon.className = 'hello-result-icon hidden';
        resultIcon.innerHTML = '';
    }
    if (textEl) {
        textEl.textContent = text || `Đang xác thực ${DEVICE.biometricName}...`;
        textEl.className = 'hello-loading-text';
    }
    if (subtextEl && subtext !== undefined) subtextEl.textContent = subtext;

    overlay.classList.remove('hidden');
    document.body.classList.add('hello-locked');
}

function showHelloSuccess(text = 'Xác thực thành công!', subtext = 'Đang mở khóa ứng dụng...') {
    const overlay = document.getElementById('helloLoadingOverlay');
    if (!overlay) return;
    const spinner = document.getElementById('helloSpinner');
    const resultIcon = document.getElementById('helloResultIcon');
    const textEl = document.getElementById('helloLoadingText');
    const subtextEl = document.getElementById('helloLoadingSubtext');

    if (spinner) spinner.classList.add('hidden');
    if (resultIcon) {
        resultIcon.classList.remove('hidden');
        resultIcon.className = 'hello-result-icon success';
        resultIcon.innerHTML = '<i class="fas fa-check"></i>';
    }
    if (textEl) {
        textEl.textContent = text;
        textEl.className = 'hello-loading-text text-success';
    }
    if (subtextEl) subtextEl.textContent = subtext;

    overlay.classList.remove('hidden');
    document.body.classList.add('hello-locked');
}

function showHelloError(text = 'Xác thực thất bại!', subtext = 'Vui lòng thử lại') {
    const overlay = document.getElementById('helloLoadingOverlay');
    if (!overlay) return;
    const spinner = document.getElementById('helloSpinner');
    const resultIcon = document.getElementById('helloResultIcon');
    const textEl = document.getElementById('helloLoadingText');
    const subtextEl = document.getElementById('helloLoadingSubtext');

    if (spinner) spinner.classList.add('hidden');
    if (resultIcon) {
        resultIcon.classList.remove('hidden');
        resultIcon.className = 'hello-result-icon error';
        resultIcon.innerHTML = '<i class="fas fa-times"></i>';
    }
    if (textEl) {
        textEl.textContent = text;
        textEl.className = 'hello-loading-text text-error';
    }
    if (subtextEl) subtextEl.textContent = subtext;

    overlay.classList.remove('hidden');
    document.body.classList.add('hello-locked');
}

function hideHelloLoading() {
    const overlay = document.getElementById('helloLoadingOverlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    document.body.classList.remove('hello-locked');
}

window.showHelloLoading = showHelloLoading;
window.showHelloSuccess = showHelloSuccess;
window.showHelloError = showHelloError;
window.hideHelloLoading = hideHelloLoading;

// ==========================================
// HIỂN THỊ THÔNG BÁO
// ==========================================
function showNotification(message, type = 'error') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    const icon = type === 'error' ? '<i class="fas fa-exclamation-circle text-lg"></i>' : '<i class="fas fa-check-circle text-lg"></i>';
    toast.innerHTML = `${icon} <span>${message}</span>`;
    toast.style.backgroundColor = type === 'error' ? '#EF4444' : '#10B981';
    toast.classList.remove('opacity-0', 'translate-y-10');
    toast.classList.add('opacity-100', 'translate-y-0');
    clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-10');
        toast.classList.remove('opacity-100', 'translate-y-0');
    }, 3000);
}

function checkLogin() {
    if (!currentUser) {
        showNotification("Vui lòng đăng nhập!", "error");
        setTimeout(() => { window.location.href = "/login"; }, 1000);
        return false;
    }
    return true;
}

// ==========================================
// TỰ ĐỘNG KHÓA
// ==========================================
function resetAutoLock() {
    if (!settings.password && !settings.biometricId) return;
    if (isAppLocked) return;
    clearTimeout(autoLockTimer);
    autoLockTimer = setTimeout(() => {
        isAppLocked = true;
        document.getElementById('lockScreen')?.classList.remove('hidden-lock');
        updateBiometricVisibility();
        updateCodes();
    }, 5 * 60 * 1000);
}
document.addEventListener('mousemove', resetAutoLock);
document.addEventListener('keydown', resetAutoLock);

// ==========================================
// MÃ HÓA LOCAL
// ==========================================
function encryptData(text, password) {
    if (!password) return text; 
    return CryptoJS.AES.encrypt(text, password).toString();
}
function decryptData(ciphertext, password) {
    if (!password) return ciphertext;
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, password);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (e) { return null; }
}

function loadSettings() {
    const saved = localStorage.getItem('proton_settings');
    if (saved) {
        try {
            settings = JSON.parse(saved);
            if (settings.autoLock === undefined) settings.autoLock = true; 
            applyTheme(settings.theme);
            updateAutoLockUI();
            if (settings.password || settings.biometricId) {
                isAppLocked = true;
                if (document.getElementById('lockScreen')) {
                    document.getElementById('lockScreen').classList.remove('hidden-lock');
                }
            }
        } catch(e) {}
    }
}
function saveSettings() { localStorage.setItem('proton_settings', JSON.stringify(settings)); }

function applyTheme(theme) {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
}

function updateAutoLockUI() {
    const btn = document.getElementById('btnToggleAutoLock');
    const thumb = document.getElementById('autoLockThumb');
    if (!btn || !thumb) return;
    if (settings.autoLock) {
        btn.classList.add('bg-roblox'); btn.classList.remove('bg-gray-300'); thumb.style.transform = 'translateX(24px)';
    } else {
        btn.classList.remove('bg-roblox'); btn.classList.add('bg-gray-300'); thumb.style.transform = 'translateX(0)';
    }
}

function loadData() {
    const saved = localStorage.getItem('proton_accounts');
    if (saved) {
        try {
            let decrypted = saved;
            if (settings.password) {
                decrypted = decryptData(saved, settings.password);
                if (!decrypted) { accounts = []; return; }
            }
            accounts = JSON.parse(decrypted);
        } catch(e) { accounts = []; }
        renderAccounts();
    } else toggleEmptyState();
}

function saveData() {
    const dataStr = JSON.stringify(accounts);
    const encrypted = encryptData(dataStr, settings.password);
    localStorage.setItem('proton_accounts', encrypted);
}

// ==========================================
// THUẬT TOÁN OTP
// ==========================================
const OTP_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(base32) {
    let bits = 0, value = 0, index = 0;
    const output = new Uint8Array(Math.floor(base32.length * 5 / 8));
    for (let i = 0; i < base32.length; i++) {
        const char = base32.charAt(i).toUpperCase();
        if (char === '=') break;
        const val = OTP_ALPHABET.indexOf(char);
        if (val === -1) continue;
        value = (value << 5) | val; bits += 5;
        if (bits >= 8) { output[index++] = (value >>> (bits - 8)) & 0xFF; bits -= 8; }
    }
    return output.subarray(0, index);
}

async function hmacSha1(key, message) {
    const cryptoKey = await window.crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, message);
    return new Uint8Array(signature);
}

async function generateOTP(secret, offset = 0) {
    try {
        let cleanSecret = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
        const key = base32Decode(cleanSecret);
        const epoch = Math.round(new Date().getTime() / 1000.0) + offset;
        const timeStep = Math.floor(epoch / 30);
        const timeBuffer = new Uint8Array(8);
        let temp = timeStep;
        for (let i = 7; i >= 0; i--) { timeBuffer[i] = temp & 0xff; temp = temp >> 8; }
        const hmac = await hmacSha1(key, timeBuffer);
        const offsetIndex = hmac[hmac.length - 1] & 0xf;
        const code = ((hmac[offsetIndex] & 0x7f) << 24 | (hmac[offsetIndex + 1] & 0xff) << 16 | (hmac[offsetIndex + 2] & 0xff) << 8 | (hmac[offsetIndex + 3] & 0xff)) % 1000000;
        return code.toString().padStart(6, '0');
    } catch (e) { return "Error"; }
}

// ==========================================
// REGISTER BIOMETRIC (đa nền tảng)
// ==========================================
async function registerBiometric() {
    if (!DEVICE.webauthnSupported) {
        showNotification(`Thiết bị không hỗ trợ ${DEVICE.biometricName}.`, "error");
        return;
    }
    if (!DEVICE.isSecureContext) {
        showNotification("Cần HTTPS hoặc localhost để dùng sinh trắc học.", "error");
        return;
    }

    showHelloLoading(`Đang kết nối ${DEVICE.biometricName}...`, 'Vui lòng không đóng cửa sổ này');

    try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const options = {
            challenge: challenge,
            rp: { name: "Authenticator", id: window.location.hostname || "localhost" },
            user: {
                id: Uint8Array.from("user-id-" + Date.now(), c => c.charCodeAt(0)),
                name: currentUser?.email || "user@example.com",
                displayName: currentUser?.email?.split('@')[0] || "User"
            },
            pubKeyCredParams: [
                { alg: -7, type: "public-key" },   // ES256
                { alg: -257, type: "public-key" }  // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: "platform",
                userVerification: "required",
                residentKey: "preferred"
            },
            timeout: 60000,
            attestation: "none"
        };

        showHelloLoading(`Đang chờ ${DEVICE.biometricName}...`, 'Hãy làm theo hướng dẫn trên màn hình');
        const credential = await navigator.credentials.create({ publicKey: options });

        settings.biometricId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
        saveSettings();

        showHelloSuccess('Cài đặt thành công!', `Bạn có thể dùng ${DEVICE.biometricName} để mở khóa`);
        showNotification(`Cài đặt ${DEVICE.biometricName} thành công!`, "success");
        setTimeout(() => { hideHelloLoading(); updateBiometricVisibility(); }, 1200);

    } catch (err) {
        console.error('[Biometric Register]', err);
        let msg = 'Cài đặt thất bại!', sub = 'Vui lòng thử lại';
        if (err.name === 'NotAllowedError') { msg = 'Bạn đã hủy cài đặt!'; sub = 'Thao tác đã bị hủy'; }
        else if (err.name === 'SecurityError') { msg = 'Yêu cầu HTTPS!'; sub = 'Sinh trắc học cần HTTPS hoặc localhost'; }
        else if (err.name === 'AbortError') { msg = 'Quá thời gian chờ!'; sub = 'Vui lòng thử lại (60s)'; }
        else if (err.name === 'InvalidStateError') { msg = 'Đã cài đặt rồi!'; sub = 'Thiết bị này đã có credential'; }

        showHelloError(msg, sub);
        showNotification(msg, "error");
        setTimeout(hideHelloLoading, 1500);
    }
}

// ==========================================
// AUTHENTICATE BIOMETRIC (đa nền tảng)
// ==========================================
async function authenticateBiometric() {
    if (!settings.biometricId) return false;

    showHelloLoading(`Đang kết nối ${DEVICE.biometricName}...`, 'Vui lòng không đóng cửa sổ này');

    try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const rawId = new Uint8Array(atob(settings.biometricId).split("").map(c => c.charCodeAt(0)));

        showHelloLoading(`Đang chờ ${DEVICE.biometricName}...`, 'Hãy xác thực để mở khóa');

        await navigator.credentials.get({
            publicKey: {
                challenge: challenge,
                allowCredentials: [{
                    id: rawId,
                    type: 'public-key',
                    transports: ['internal', 'hybrid', 'usb', 'nfc', 'ble']
                }],
                userVerification: "required",
                timeout: 60000
            }
        });

        showHelloSuccess('Xác thực thành công!', 'Đang mở khóa ứng dụng...');
        await new Promise(r => setTimeout(r, 800));
        hideHelloLoading();
        return true;

    } catch (err) {
        console.error('[Biometric Auth]', err);
        let msg = 'Xác thực thất bại!', sub = 'Vui lòng thử lại';
        if (err.name === 'NotAllowedError') { msg = 'Bạn đã hủy xác thực!'; sub = 'Thao tác đã bị hủy'; }
        else if (err.name === 'SecurityError') { msg = 'Yêu cầu HTTPS!'; sub = 'Sinh trắc học cần HTTPS hoặc localhost'; }
        else if (err.name === 'AbortError') { msg = 'Quá thời gian chờ!'; sub = 'Vui lòng thử lại (60s)'; }

        showHelloError(msg, sub);
        showNotification(msg, "error");
        await new Promise(r => setTimeout(r, 1200));
        hideHelloLoading();
        return false;
    }
}

function openModal(id) {
    const modal = document.getElementById(id);
    const content = document.getElementById(id + 'Content');
    if (modal) {
        modal.classList.remove('hidden'); modal.classList.add('flex');
        if (content) setTimeout(() => { content.style.transform = 'scale(1)'; }, 50);
    }
}
function closeModal(id) {
    const modal = document.getElementById(id);
    const content = document.getElementById(id + 'Content');
    if (content) content.style.transform = 'scale(0.95)';
    setTimeout(() => { if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); } }, 200);
}

// ==========================================
// KHỞI TẠO
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Phát hiện thiết bị & HĐH
    detectDevice();
    applyDeviceToUI();

    // 2. Load dữ liệu
    loadSettings();
    loadData();
    applyDeviceToUI(); // cập nhật lại sau khi load settings

    setInterval(updateCodes, 1000);
    await checkUserSession();
    bindAllEvents();

    // 3. Kiểm tra sinh trắc học khả dụng
    await updateBiometricVisibility();

    new Sortable(document.getElementById('sortableGrid'), {
        animation: 150, ghostClass: 'opacity-50',
        onEnd: function (evt) {
            const item = accounts.splice(evt.oldIndex, 1)[0];
            accounts.splice(evt.newIndex, 0, item);
            saveData(); autoSync();
            showNotification("Đã sắp xếp lại!", "success");
        }
    });
});

const accountList = document.getElementById('sortableGrid');
const emptyState = document.getElementById('emptyState');

async function checkUserSession() {
    try {
        const { data: { session } } = await db.auth.getSession();
        if (session) {
            currentUser = session.user;
            document.getElementById('profileEmail').textContent = currentUser.email.replace('@myauth.local', '');
            document.getElementById('iconUser').className = "fas fa-user-circle text-roblox text-xl";

            const { data } = await db.from('user_data').select('*').eq('user_id', currentUser.id).maybeSingle();
            if (data) {
                if (data.accounts && data.accounts.length > 0) { accounts = data.accounts; saveData(); renderAccounts(); }
                if (data.settings) { settings = data.settings; saveSettings(); applyTheme(settings.theme); updateAutoLockUI(); }
            }
            isCloudLoaded = true;
        } else { window.location.href = "/login"; }
    } catch (err) { console.warn("Lỗi session:", err.message); }
}

async function autoSync() {
    if (!currentUser || !isCloudLoaded) return;
    await db.from('user_data').upsert({ user_id: currentUser.id, accounts: accounts, settings: settings });
}

// ==========================================
// RENDER
// ==========================================
function renderAccounts() {
    accountList.innerHTML = '';
    if (accounts.length === 0) { toggleEmptyState(); return; }
    emptyState.classList.add('hidden');
    
    accounts.forEach((account, index) => {
        const card = document.createElement('div');
        card.className = `relative card-fade-in roblox-card p-5 cursor-pointer group flex flex-col justify-between min-h-[145px]`;
        card.style.animationDelay = `${index * 0.05}s`;
        
        card.onclick = (e) => {
            if (e.target.closest('.btn-delete')) return; 
            if (isAppLocked) return showNotification("Vui lòng mở khóa ứng dụng!", "error");
            card.style.transform = 'scale(0.96)';
            setTimeout(() => { card.style.transform = ''; }, 150);
            copyCode(account.secret);
        };
        
        card.innerHTML = `
            <button class="btn-delete absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 rounded-full z-10" title="Xóa">
                <i class="fas fa-trash-alt text-sm"></i>
            </button>
            <div class="flex items-start justify-between pr-8">
                <div class="flex items-center gap-3.5">
                    <div class="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-800 text-roblox flex items-center justify-center font-bold text-xl border border-gray-200 dark:border-gray-700 group-hover:bg-roblox group-hover:text-white transition-colors">${account.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <h3 class="font-bold text-gray-800 dark:text-gray-100 text-[17px] truncate max-w-[130px]">${account.name}</h3>
                        <p class="text-xs text-gray-400 mt-1">2FA Code</p>
                    </div>
                </div>
                <div class="relative w-10 h-10 flex items-center justify-center shrink-0">
                    <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path class="text-gray-200 dark:text-gray-600" stroke-width="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path class="text-roblox arc" stroke-dasharray="100, 100" stroke-width="3" stroke-linecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <span class="absolute text-[10px] font-bold text-gray-600 dark:text-gray-300 sec-label">30</span>
                </div>
            </div>
            <div class="mt-5 flex items-end justify-between">
                <div class="text-[32px] font-mono font-bold tracking-tight text-gray-900 dark:text-white code-display leading-none" data-secret="${account.secret}">------ ------</div>
                <div class="flex flex-col items-end">
                    <span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Next</span>
                    <span class="text-[16px] font-mono font-bold text-gray-500 next-code" data-secret="${account.secret}">------</span>
                </div>
            </div>
        `;
        accountList.appendChild(card);
    });
    updateCodes(); 
}

async function updateCodes() {
    const now = Math.floor(Date.now() / 1000);
    const remaining = 30 - (now % 30);
    const fraction = remaining / 30;
    
    document.querySelectorAll('.arc').forEach(arc => {
        arc.style.strokeDasharray = `${fraction * 100}, 100`;
        if (remaining <= 5) { arc.classList.remove('text-roblox'); arc.classList.add('text-red-500'); }
        else { arc.classList.remove('text-red-500'); arc.classList.add('text-roblox'); }
    });
    document.querySelectorAll('.sec-label').forEach(el => { el.textContent = `${remaining}`; });
    
    document.querySelectorAll('.code-display').forEach(async el => {
        if (isAppLocked) { el.textContent = "••• •••"; return; }
        const secret = el.getAttribute('data-secret');
        if (!secret) return;
        const code = await generateOTP(secret);
        const nextCode = await generateOTP(secret, 30);
        if (code !== "Error") {
            el.textContent = `${code.slice(0,3)} ${code.slice(3)}`;
            const card = el.closest('.roblox-card');
            if (card) {
                const nextEl = card.querySelector('.next-code');
                if (nextEl) nextEl.textContent = `${nextCode.slice(0,3)} ${nextCode.slice(3)}`;
            }
        } else { el.textContent = "Lỗi Key"; }
    });
}

async function copyCode(secret) {
    if (isAppLocked) return showNotification("Vui lòng mở khóa ứng dụng!", "error");
    try {
        const code = await generateOTP(secret);
        if (code !== "Error") {
            await navigator.clipboard.writeText(code);
            showNotification("Đã copy mã!", "success");
        }
    } catch (e) { console.error(e); }
}

function toggleEmptyState() {
    if (accounts.length === 0) emptyState.classList.remove('hidden');
    else emptyState.classList.add('hidden');
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden && settings.autoLock && (settings.password || settings.biometricId)) {
        isAppLocked = true;
        document.getElementById('lockScreen')?.classList.remove('hidden-lock');
        document.getElementById('unlockPass').value = '';
        updateBiometricVisibility();
        updateCodes();
    }
});

// ==========================================
// GẮN SỰ KIỆN
// ==========================================
function bindAllEvents() {
    const bindClick = (id, func) => {
        const el = document.getElementById(id);
        if (el) {
            const newEl = el.cloneNode(true);
            el.replaceWith(newEl);
            newEl.addEventListener('click', func);
        }
    };

    bindClick('btnAdd', () => { if (!checkLogin() || isAppLocked) return; openModal('modalAdd'); });
    bindClick('btnCancelAdd', () => closeModal('modalAdd'));
    bindClick('btnCloseModal', () => closeModal('modalAdd'));

    bindClick('btnSaveAdd', async () => {
        const name = document.getElementById('inputName').value.trim();
        let secret = document.getElementById('inputSecret').value.trim();
        if (!name || !secret) return showNotification("Vui lòng nhập đủ thông tin!", "error");
        if (secret.startsWith('otpauth://')) {
            const match = secret.match(/[?&]secret=([^&]+)/);
            if (match) secret = decodeURIComponent(match[1]);
        }
        accounts.push({ name, secret });
        saveData(); renderAccounts(); autoSync();
        showNotification("Đã thêm tài khoản!", "success");
        document.getElementById('inputName').value = '';
        document.getElementById('inputSecret').value = '';
        closeModal('modalAdd');
    });

    bindClick('btnUser', () => { if (currentUser) openModal('modalProfile'); else window.location.href = "/login"; });
    bindClick('btnCloseProfile', () => closeModal('modalProfile'));

    bindClick('btnSettings', () => {
        if (!checkLogin() || isAppLocked) return;
        document.getElementById('inputPassword').value = settings.password;
        updateAutoLockUI();
        applyDeviceToUI(); // cập nhật badge & text mỗi lần mở
        openModal('modalSettings');
    });
    bindClick('btnCloseSettings', () => closeModal('modalSettings'));
    bindClick('btnToggleTheme', () => { settings.theme = settings.theme === 'light' ? 'dark' : 'light'; applyTheme(settings.theme); });
    bindClick('btnToggleAutoLock', () => {
        if (!settings.password && !settings.biometricId) {
            showNotification("Vui lòng nhập mật khẩu hoặc cài sinh trắc học trước!", "error");
            document.getElementById('inputPassword').focus(); return;
        }
        settings.autoLock = !settings.autoLock; updateAutoLockUI();
    });
    bindClick('btnSaveSettings', () => {
        settings.password = document.getElementById('inputPassword').value.trim();
        if (!settings.password && !settings.biometricId) { settings.autoLock = false; updateAutoLockUI(); }
        saveSettings(); autoSync(); closeModal('modalSettings'); showNotification("Đã lưu cài đặt!", "success");
    });

    bindClick('btnSetupBiometric', registerBiometric);

    bindClick('btnExport', () => {
        if (!checkLogin()) return;
        if (accounts.length === 0) return showNotification("Không có dữ liệu để xuất!", "error");
        const dataStr = JSON.stringify(accounts, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `authenticator_backup_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showNotification("Đã xuất file JSON thành công!", "success");
    });

    const grid = document.getElementById('sortableGrid');
    if (grid) {
        grid.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.btn-delete');
            if (deleteBtn) {
                e.preventDefault(); e.stopPropagation();
                if (!checkLogin() || isAppLocked) return;
                const card = deleteBtn.closest('.roblox-card');
                const index = Array.from(accountList.children).indexOf(card);
                if (index > -1) {
                    document.getElementById('deleteName').textContent = accounts[index].name;
                    window.deleteIndex = index; 
                    openModal('modalDelete');
                }
                return;
            }
        });
    }

    bindClick('btnCancelDelete', () => { closeModal('modalDelete'); window.deleteIndex = -1; });
    bindClick('btnConfirmDelete', () => {
        if (window.deleteIndex !== undefined && window.deleteIndex > -1) {
            accounts.splice(window.deleteIndex, 1);
            saveData(); renderAccounts(); autoSync();
            showNotification("Đã xóa tài khoản!", "success");
            closeModal('modalDelete'); window.deleteIndex = -1;
        }
    });

    bindClick('btnLogout', () => openModal('modalLogout'));
    bindClick('btnCancelLogout', () => closeModal('modalLogout'));
    bindClick('btnConfirmLogout', async () => {
        await db.auth.signOut(); currentUser = null;
        localStorage.removeItem('proton_accounts'); localStorage.removeItem('proton_settings'); sessionStorage.clear();
        window.location.href = "/login";
    });

    bindClick('btnUnlock', async () => {
        const pass = document.getElementById('unlockPass').value.trim();
        if (pass === settings.password) {
            isAppLocked = false; document.getElementById('lockScreen').classList.add('hidden-lock');
            document.getElementById('unlockPass').value = '';
            await updateBiometricVisibility();
            updateCodes(); resetAutoLock(); return;
        }
        if (settings.biometricId) {
            const success = await authenticateBiometric();
            if (success) {
                isAppLocked = false; document.getElementById('lockScreen').classList.add('hidden-lock');
                document.getElementById('unlockPass').value = '';
                await updateBiometricVisibility();
                updateCodes(); resetAutoLock(); showNotification("Mở khóa thành công!", "success"); return;
            }
        }
        showNotification("Mật khẩu không chính xác!", "error");
    });

    const unlockPass = document.getElementById('unlockPass');
    if (unlockPass) {
        unlockPass.replaceWith(unlockPass.cloneNode(true));
        document.getElementById('unlockPass').addEventListener('keypress', (e) => { if (e.key === 'Enter') document.getElementById('btnUnlock').click(); });
    }

    bindClick('btnBiometricUnlock', async () => {
        const success = await authenticateBiometric();
        if (success) {
            isAppLocked = false; document.getElementById('lockScreen').classList.add('hidden-lock');
            document.getElementById('unlockPass').value = '';
            await updateBiometricVisibility();
            updateCodes(); resetAutoLock(); showNotification("Mở khóa thành công!", "success");
        }
    });

    bindClick('btnChangePassword', async () => {
        if (!checkLogin()) return;
        const oldPass = document.getElementById('oldPassword').value.trim();
        const newPass = document.getElementById('newPassword').value.trim();
        if (!oldPass) return showNotification("Vui lòng nhập mật khẩu hiện tại!", "error");
        if (!newPass || newPass.length < 6) return showNotification("Mật khẩu mới phải từ 6 ký tự!", "error");
        try {
            const { error: signInError } = await db.auth.signInWithPassword({ email: currentUser.email, password: oldPass });
            if (signInError) return showNotification("Mật khẩu hiện tại không chính xác!", "error");
            const { error: updateError } = await db.auth.updateUser({ password: newPass });
            if (updateError) throw updateError;
            showNotification("Đổi mật khẩu thành công!", "success");
            document.getElementById('oldPassword').value = ''; document.getElementById('newPassword').value = '';
        } catch (err) { showNotification("Lỗi đổi mật khẩu!", "error"); }
    });
}
