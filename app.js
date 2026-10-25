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
// [MỚI] WINDOWS HELLO LOADING OVERLAY
// Hỗ trợ 3 trạng thái: loading / success / error
// ==========================================
function showHelloLoading(text, subtext) {
    const overlay = document.getElementById('helloLoadingOverlay');
    if (!overlay) return;

    const spinner = document.getElementById('helloSpinner');
    const resultIcon = document.getElementById('helloResultIcon');
    const textEl = document.getElementById('helloLoadingText');
    const subtextEl = document.getElementById('helloLoadingSubtext');

    // Reset về trạng thái loading
    if (spinner) spinner.classList.remove('hidden');
    if (resultIcon) {
        resultIcon.classList.add('hidden');
        resultIcon.className = 'hello-result-icon hidden';
        resultIcon.innerHTML = '';
    }
    if (textEl) {
        textEl.textContent = text || 'Đang xác thực Windows Hello...';
        textEl.className = 'hello-loading-text';
    }
    if (subtextEl && subtext !== undefined) subtextEl.textContent = subtext;

    overlay.classList.remove('hidden');
    document.body.classList.add('hello-locked');
}

// [MỚI] Hiển thị trạng thái THÀNH CÔNG (tích xanh lá)
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

// [MỚI] Hiển thị trạng thái THẤT BẠI (X đỏ)
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
// HÀM HIỂN THỊ THÔNG BÁO
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
        if (settings.biometricId) document.getElementById('btnBiometricUnlock')?.classList.remove('hidden');
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
                    if (settings.biometricId) {
                        document.getElementById('btnBiometricUnlock')?.classList.remove('hidden');
                    }
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
// THUẬT TOÁN OTP & WEBAUTHN
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
// [MỚI] REGISTER BIOMETRIC — có overlay + tích xanh/X đỏ
// ==========================================
async function registerBiometric() {
    if (!window.PublicKeyCredential) {
        showNotification("Trình duyệt không hỗ trợ Windows Hello.", "error");
        return;
    }

    // Bước 1: hiện overlay loading
    showHelloLoading('Đang kết nối Windows Hello...', 'Vui lòng không đóng cửa sổ này');

    try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const publicKeyCredentialCreationOptions = {
            challenge: challenge,
            rp: { name: "Authenticator Clone", id: window.location.hostname || "localhost" },
            user: { id: Uint8Array.from("user-id-123", c => c.charCodeAt(0)), name: "user@example.com", displayName: "User" },
            pubKeyCredParams: [{ alg: -7, type: "public-key" }],
            authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
            timeout: 60000,
            attestation: "direct"
        };

        // Bước 2: chờ Windows Hello
        showHelloLoading('Đang chờ quét vân tay / khuôn mặt...', 'Hãy làm theo hướng dẫn trên màn hình');
        const credential = await navigator.credentials.create({ publicKey: publicKeyCredentialCreationOptions });

        // Bước 3: lưu
        settings.biometricId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
        saveSettings();

        // Bước 4: THÀNH CÔNG → hiện tích xanh
        showHelloSuccess('Cài đặt thành công!', 'Bạn có thể dùng Windows Hello để mở khóa');
        showNotification("Cài đặt Windows Hello thành công!", "success");
        setTimeout(hideHelloLoading, 1200);

    } catch (err) {
        // THẤT BẠI → hiện X đỏ
        console.error('[Windows Hello Register]', err);
        let msg = 'Lỗi cài đặt Vân tay.';
        let sub = 'Vui lòng thử lại';

        if (err.name === 'NotAllowedError') {
            msg = 'Bạn đã hủy đăng ký!';
            sub = 'Thao tác đã bị hủy bỏ';
        } else if (err.name === 'SecurityError') {
            msg = 'Yêu cầu HTTPS!';
            sub = 'Windows Hello cần HTTPS hoặc localhost';
        } else if (err.name === 'AbortError') {
            msg = 'Quá thời gian chờ!';
            sub = 'Vui lòng thử lại (60s)';
        }

        showHelloError(msg, sub);
        showNotification(msg, "error");
        setTimeout(hideHelloLoading, 1500);
    }
}

// ==========================================
// [MỚI] AUTHENTICATE BIOMETRIC — có overlay + tích xanh/X đỏ
// ==========================================
async function authenticateBiometric() {
    if (!settings.biometricId) return false;

    // Bước 1: hiện overlay loading
    showHelloLoading('Đang kết nối Windows Hello...', 'Vui lòng không đóng cửa sổ này');

    try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const rawId = new Uint8Array(atob(settings.biometricId).split("").map(c => c.charCodeAt(0)));

        // Bước 2: chờ Windows Hello
        showHelloLoading('Đang chờ xác thực Windows Hello...', 'Hãy quét vân tay hoặc khuôn mặt');

        await navigator.credentials.get({
            publicKey: {
                challenge: challenge,
                allowCredentials: [{ id: rawId, type: 'public-key', transports: ['internal'] }],
                userVerification: "required",
                timeout: 60000
            }
        });

        // Bước 3: THÀNH CÔNG → hiện tích xanh, đợi 800ms rồi ẩn
        showHelloSuccess('Xác thực thành công!', 'Đang mở khóa ứng dụng...');
        await new Promise(r => setTimeout(r, 800));
        hideHelloLoading();
        return true;

    } catch (err) {
        // THẤT BẠI → hiện X đỏ, đợi 1200ms rồi ẩn
        console.error('[Windows Hello Auth]', err);
        let msg = 'Xác thực thất bại!';
        let sub = 'Vui lòng thử lại';

        if (err.name === 'NotAllowedError') {
            msg = 'Bạn đã hủy xác thực!';
            sub = 'Thao tác đã bị hủy bỏ';
        } else if (err.name === 'SecurityError') {
            msg = 'Yêu cầu HTTPS!';
            sub = 'Windows Hello cần HTTPS hoặc localhost';
        } else if (err.name === 'AbortError') {
            msg = 'Quá thời gian chờ!';
            sub = 'Vui lòng thử lại (60s)';
        }

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
    loadSettings();
    loadData();
    setInterval(updateCodes, 1000);
    await checkUserSession();
    bindAllEvents();
    
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
// RENDER GIAO DIỆN
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
        if (settings.biometricId) document.getElementById('btnBiometricUnlock')?.classList.remove('hidden');
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
        openModal('modalSettings');
    });
    bindClick('btnCloseSettings', () => closeModal('modalSettings'));
    bindClick('btnToggleTheme', () => { settings.theme = settings.theme === 'light' ? 'dark' : 'light'; applyTheme(settings.theme); });
    bindClick('btnToggleAutoLock', () => {
        if (!settings.password && !settings.biometricId) {
            showNotification("Vui lòng nhập mật khẩu hoặc cài Vân tay trước!", "error");
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
            document.getElementById('unlockPass').value = ''; document.getElementById('btnBiometricUnlock')?.classList.add('hidden');
            updateCodes(); resetAutoLock(); return;
        }
        if (settings.biometricId) {
            const success = await authenticateBiometric();
            if (success) {
                isAppLocked = false; document.getElementById('lockScreen').classList.add('hidden-lock');
                document.getElementById('unlockPass').value = ''; document.getElementById('btnBiometricUnlock')?.classList.add('hidden');
                updateCodes(); resetAutoLock(); showNotification("Mở khóa bằng Vân tay thành công!", "success"); return;
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
            document.getElementById('unlockPass').value = ''; document.getElementById('btnBiometricUnlock')?.classList.add('hidden');
            updateCodes(); resetAutoLock(); showNotification("Mở khóa bằng Vân tay thành công!", "success");
        }
        // Nếu thất bại, authenticateBiometric() đã hiện X đỏ + toast, không cần báo thêm
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
