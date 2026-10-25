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
let pendingShareSecret = null;
let pendingShareName = null;

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

function resetAutoLock() {
    if (!settings.password || isAppLocked) return;
    clearTimeout(autoLockTimer);
    autoLockTimer = setTimeout(() => {
        isAppLocked = true;
        document.getElementById('lockScreen')?.classList.remove('hidden-lock');
        updateCodes();
    }, 5 * 60 * 1000);
}
document.addEventListener('mousemove', resetAutoLock);
document.addEventListener('keydown', resetAutoLock);

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

function processPendingShare() {
    if (!pendingShareSecret || !pendingShareName) return;
    if (isAppLocked) return;

    const isDuplicate = accounts.some(a => a.secret === pendingShareSecret || a.name === pendingShareName);
    
    if (isDuplicate) {
        showNotification(`Tài khoản "${pendingShareName}" đã có sẵn trong danh sách!`, "error");
        pendingShareSecret = null;
        pendingShareName = null;
        window.history.replaceState({}, document.title, window.location.pathname);
    } else {
        document.getElementById('shareConfirmName').textContent = pendingShareName;
        document.getElementById('modalShareConfirm').classList.remove('hidden');
        document.getElementById('modalShareConfirm').classList.add('flex');
        setTimeout(() => { document.getElementById('modalShareConfirmContent').style.transform = 'scale(1)'; }, 50);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    loadSettings();
    loadData();
    setInterval(updateCodes, 1000);
    await checkUserSession();
    
    const urlParams = new URLSearchParams(window.location.search);
    const shareSecret = urlParams.get('share_secret');
    const shareName = urlParams.get('share_name');
    if (shareSecret && shareName) {
        pendingShareSecret = atob(shareSecret);
        pendingShareName = shareName;
        if (!isAppLocked) processPendingShare();
    }
    
    new Sortable(document.getElementById('sortableGrid'), {
        animation: 150,
        ghostClass: 'opacity-50',
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

function renderAccounts() {
    accountList.innerHTML = '';
    if (accounts.length === 0) { toggleEmptyState(); return; }
    emptyState.classList.add('hidden');
    
    accounts.forEach((account, index) => {
        const card = document.createElement('div');
        card.className = `relative card-fade-in roblox-card p-5 cursor-pointer group flex flex-col justify-between min-h-[145px]`;
        card.style.animationDelay = `${index * 0.05}s`;
        
        card.onclick = (e) => {
            if (e.target.closest('.btn-delete') || e.target.closest('.btn-share')) return; 
            if (isAppLocked) return showNotification("Vui lòng mở khóa ứng dụng để copy mã!", "error");
            card.style.transform = 'scale(0.96)';
            setTimeout(() => { card.style.transform = ''; }, 150);
            copyCode(account.secret);
        };
        
        card.innerHTML = `
            <div class="absolute top-4 right-4 flex gap-1 z-10">
                <button class="btn-share w-8 h-8 flex items-center justify-center text-gray-300 hover:text-roblox rounded-full" onclick="openShareModal('${account.secret}', '${account.name}')" title="Chia sẻ">
                    <i class="fas fa-share-alt text-sm"></i>
                </button>
                <button class="btn-delete w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 rounded-full" onclick="openDeleteModal(${index})" title="Xóa">
                    <i class="fas fa-trash-alt text-sm"></i>
                </button>
            </div>
            <div class="flex items-start justify-between pr-16">
                <div class="flex items-center gap-3.5">
                    <div class="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-800 text-roblox flex items-center justify-center font-bold text-xl border border-gray-200 dark:border-gray-700 group-hover:bg-roblox group-hover:text-white transition-colors">${account.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <h3 class="font-bold text-gray-800 dark:text-gray-100 text-[17px] truncate max-w-[130px]">${account.name}</h3>
                        <p class="text-xs text-gray-400 mt-1">2FA Code</p>
                    </div>
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

// WEBAUTHN FUNCTIONS
async function registerBiometric() {
    if (!window.PublicKeyCredential) {
        showNotification("Trình duyệt không hỗ trợ Windows Hello.", "error");
        return;
    }
    try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const publicKeyCredentialCreationOptions = {
            challenge: challenge,
            rp: { name: "Authenticator Clone", id: window.location.hostname || "localhost" },
            user: {
                id: Uint8Array.from("user-id-123", c => c.charCodeAt(0)),
                name: "user@example.com",
                displayName: "User",
            },
            pubKeyCredParams: [{ alg: -7, type: "public-key" }],
            authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
            timeout: 60000,
            attestation: "direct"
        };
        const credential = await navigator.credentials.create({ publicKey: publicKeyCredentialCreationOptions });
        const credId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
        settings.biometricId = credId;
        saveSettings();
        showNotification("Cài đặt Windows Hello thành công!", "success");
    } catch (err) {
        showNotification("Lỗi cài đặt Vân tay. Hãy chắc chắn bạn đang dùng HTTPS.", "error");
    }
}

async function authenticateBiometric() {
    if (!settings.biometricId) return false;
    try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const rawId = new Uint8Array(atob(settings.biometricId).split("").map(c => c.charCodeAt(0)));
        const publicKeyCredentialRequestOptions = {
            challenge: challenge,
            allowCredentials: [{ id: rawId, type: 'public-key', transports: ['internal'] }],
            userVerification: "required",
            timeout: 60000,
        };
        await navigator.credentials.get({ publicKey: publicKeyCredentialRequestOptions });
        return true;
    } catch (err) {
        return false;
    }
}

document.getElementById('btnSetupBiometric')?.addEventListener('click', registerBiometric);
