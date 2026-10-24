// Cấu hình Supabase
const SUPABASE_URL = 'https://skswuorigvxwwugpldvn.supabase.co';
const SUPABASE_KEY = 'postgresql://postgres.skwsuorigvxwwugpldvn:[LuongHung0707@123]@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let accounts = [];
let settings = { theme: 'light', password: '', biometricId: null };
let currentUser = null;

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
        value = (value << 5) | val;
        bits += 5;
        if (bits >= 8) { output[index++] = (value >>> (bits - 8)) & 0xFF; bits -= 8; }
    }
    return output.subarray(0, index);
}

async function hmacSha1(key, message) {
    const cryptoKey = await window.crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, message);
    return new Uint8Array(signature);
}

async function generateOTP(secret) {
    try {
        let cleanSecret = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
        const key = base32Decode(cleanSecret);
        const epoch = Math.round(new Date().getTime() / 1000.0);
        const timeStep = Math.floor(epoch / 30);
        const timeBuffer = new Uint8Array(8);
        let temp = timeStep;
        for (let i = 7; i >= 0; i--) { timeBuffer[i] = temp & 0xff; temp = temp >> 8; }
        const hmac = await hmacSha1(key, timeBuffer);
        const offset = hmac[hmac.length - 1] & 0xf;
        const code = ((hmac[offset] & 0x7f) << 24 | (hmac[offset + 1] & 0xff) << 16 | (hmac[offset + 2] & 0xff) << 8 | (hmac[offset + 3] & 0xff)) % 1000000;
        return code.toString().padStart(6, '0');
    } catch (e) { return "Error"; }
}

// ==========================================
// KHỞI TẠO & TẢI DỮ LIỆU
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    loadSettings();
    loadData();
    setInterval(updateCodes, 1000);
    checkUserSession();
});

const accountList = document.querySelector('#accountList .grid');
const emptyState = document.getElementById('emptyState');

function loadSettings() {
    const saved = localStorage.getItem('proton_settings');
    if (saved) {
        try {
            settings = JSON.parse(saved);
            applyTheme(settings.theme);
            if (settings.password) document.getElementById('lockScreen').classList.remove('hidden-lock');
            if (settings.biometricId) document.getElementById('btnBiometricUnlock').classList.remove('hidden');
        } catch(e) {}
    }
}

function saveSettings() {
    localStorage.setItem('proton_settings', JSON.stringify(settings));
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.getElementById('themeThumb').style.transform = 'translateX(24px)';
        document.getElementById('btnToggleTheme').classList.add('bg-proton');
        document.getElementById('btnToggleTheme').classList.remove('bg-gray-200');
    } else {
        document.documentElement.classList.remove('dark');
        document.getElementById('themeThumb').style.transform = 'translateX(0)';
        document.getElementById('btnToggleTheme').classList.remove('bg-proton');
        document.getElementById('btnToggleTheme').classList.add('bg-gray-200');
    }
}

function loadData() {
    const saved = localStorage.getItem('proton_accounts');
    if (saved) {
        try { accounts = JSON.parse(saved); } catch(e) { accounts = []; }
        renderAccounts();
    } else {
        toggleEmptyState();
    }
}

function saveData() {
    localStorage.setItem('proton_accounts', JSON.stringify(accounts));
}

// ==========================================
// SUPABASE AUTH & SYNC
// ==========================================
async function checkUserSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        updateAccountUI();
    }
}

function updateAccountUI() {
    if (currentUser) {
        document.getElementById('accountLoggedOut').classList.add('hidden');
        document.getElementById('accountLoggedIn').classList.remove('hidden');
        document.getElementById('lblUserEmail').textContent = currentUser.email;
    } else {
        document.getElementById('accountLoggedOut').classList.remove('hidden');
        document.getElementById('accountLoggedIn').classList.add('hidden');
    }
}

document.getElementById('btnLogin').addEventListener('click', async () => {
    const email = document.getElementById('inputEmail').value;
    const password = document.getElementById('inputPassAuth').value;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Lỗi đăng nhập: " + error.message);
    else {
        currentUser = data.user;
        updateAccountUI();
        alert("Đăng nhập thành công!");
    }
});

document.getElementById('btnRegister').addEventListener('click', async () => {
    const email = document.getElementById('inputEmail').value;
    const password = document.getElementById('inputPassAuth').value;
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) alert("Lỗi đăng ký: " + error.message);
    else alert("Đăng ký thành công! Hãy đăng nhập.");
});

document.getElementById('btnLogout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    currentUser = null;
    updateAccountUI();
});

document.getElementById('btnSyncUpload').addEventListener('click', async () => {
    if (!currentUser) return;
    try {
        const { error } = await supabase.from('user_data').upsert({
            user_id: currentUser.id,
            accounts: accounts,
            settings: settings
        });
        if (error) throw error;
        alert("Đã đồng bộ dữ liệu lên Mây thành công!");
    } catch (err) { alert("Lỗi đồng bộ: " + err.message); }
});

document.getElementById('btnSyncDownload').addEventListener('click', async () => {
    if (!currentUser) return;
    try {
        const { data, error } = await supabase.from('user_data').select('*').eq('user_id', currentUser.id).single();
        if (error && error.code !== 'PGRST116') throw error;
        
        if (data) {
            if (data.accounts) { accounts = data.accounts; saveData(); renderAccounts(); }
            if (data.settings) { settings = data.settings; saveSettings(); applyTheme(settings.theme); }
            alert("Đã tải dữ liệu từ Mây thành công!");
            document.getElementById('modalAccount').classList.add('hidden');
            document.getElementById('modalAccount').classList.remove('flex');
        } else {
            alert("Tài khoản này chưa có dữ liệu trên Mây.");
        }
    } catch (err) { alert("Lỗi tải dữ liệu: " + err.message); }
});

document.getElementById('btnAccount').addEventListener('click', () => {
    updateAccountUI();
    document.getElementById('modalAccount').classList.remove('hidden');
    document.getElementById('modalAccount').classList.add('flex');
    setTimeout(() => { document.getElementById('modalAccountContent').style.transform = 'scale(1)'; }, 50);
});
document.getElementById('btnCloseAccount').addEventListener('click', () => {
    document.getElementById('modalAccountContent').style.transform = 'scale(0.95)';
    setTimeout(() => {
        document.getElementById('modalAccount').classList.add('hidden');
        document.getElementById('modalAccount').classList.remove('flex');
    }, 200);
});

// ==========================================
// CÁC HÀM GIAO DIỆN
// ==========================================
function renderAccounts() {
    accountList.innerHTML = '';
    if (accounts.length === 0) { toggleEmptyState(); return; }
    emptyState.classList.add('hidden');
    
    accounts.forEach((account, index) => {
        const card = document.createElement('div');
        card.className = `card-fade-in bg-white dark:bg-darkcard rounded-[20px] p-5 shadow-soft hover:shadow-hover border border-gray-100 dark:border-gray-800 cursor-pointer group flex flex-col justify-between min-h-[145px] card-anim`;
        card.style.animationDelay = `${index * 0.05}s`;
        card.onclick = (e) => {
            card.style.transform = 'scale(0.96)';
            setTimeout(() => { card.style.transform = ''; }, 150);
            copyCode(account.secret);
        };
        
        card.innerHTML = `
            <div class="flex items-start justify-between">
                <div class="flex items-center gap-3.5">
                    <div class="w-11 h-11 rounded-2xl bg-gray-50 dark:bg-gray-800 text-proton flex items-center justify-center font-bold text-xl border border-gray-100 dark:border-gray-700 group-hover:bg-proton group-hover:text-white transition-colors duration-300">
                        ${account.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 class="font-bold text-gray-800 dark:text-gray-100 text-[17px] leading-tight truncate max-w-[160px]">${account.name}</h3>
                        <p class="text-xs text-gray-400 mt-1 font-medium">One-time password</p>
                    </div>
                </div>
                <div class="relative w-9 h-9 flex items-center justify-center shrink-0">
                    <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path class="text-gray-100 dark:text-gray-700" stroke-width="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path class="text-proton arc" stroke-dasharray="100, 100" stroke-width="3.5" stroke-linecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                </div>
            </div>
            <div class="mt-5 flex items-end justify-between">
                <div class="text-[32px] font-mono font-bold tracking-tight text-gray-900 dark:text-white code-display leading-none" data-secret="${account.secret}">
                    ------ ------
                </div>
                <div class="flex flex-col items-end">
                    <span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider next-label">Next</span>
                    <span class="text-sm text-gray-500 dark:text-gray-400 font-semibold sec-label">30s</span>
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
        if (remaining <= 5) { arc.classList.remove('text-proton'); arc.classList.add('text-red-500'); }
        else { arc.classList.remove('text-red-500'); arc.classList.add('text-proton'); }
    });

    document.querySelectorAll('.code-display').forEach(async el => {
        const secret = el.getAttribute('data-secret');
        if (!secret) return;
        const code = await generateOTP(secret);
        el.textContent = code !== "Error" ? `${code.slice(0,3)} ${code.slice(3)}` : "Lỗi Key";
    });
    document.querySelectorAll('.sec-label').forEach(el => { el.textContent = `${remaining}s`; });
}

// SỬA LỖI NÚT COPY TRÊN HTTPS/RENDER
async function copyCode(secret) {
    try {
        const code = await generateOTP(secret);
        if (code !== "Error") {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(code);
            } else {
                // Cơ chế dự phòng cho trình duyệt chặn Clipboard
                const textArea = document.createElement("textarea");
                textArea.value = code;
                textArea.style.position = "absolute";
                textArea.style.left = "-999999px";
                document.body.prepend(textArea);
                textArea.select();
                try { document.execCommand('copy'); } catch (error) { console.error(error); }
                textArea.remove();
            }
            showToast();
        }
    } catch (e) { console.error("Lỗi copy: ", e); }
}

function showToast() {
    const toast = document.getElementById('toast');
    toast.classList.add('show');
    clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => { toast.classList.remove('show'); }, 2000);
}

document.getElementById('searchInput').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const cards = accountList.querySelectorAll('.card-anim');
    cards.forEach((card, index) => {
        card.style.display = accounts[index].name.toLowerCase().includes(query) ? 'flex' : 'none';
    });
});

function toggleEmptyState() {
    if (accounts.length === 0) {
        emptyState.classList.remove('hidden');
        setTimeout(() => { emptyState.style.opacity = 1; }, 50);
    } else {
        emptyState.classList.add('hidden');
        emptyState.style.opacity = 0;
    }
}

// Modal Add
function openModal() {
    document.getElementById('modalAdd').classList.remove('hidden');
    document.getElementById('modalAdd').classList.add('flex');
    setTimeout(() => { document.getElementById('modalAddContent').style.transform = 'scale(1)'; }, 50);
}
function closeModal() {
    document.getElementById('modalAddContent').style.transform = 'scale(0.95)';
    setTimeout(() => {
        document.getElementById('modalAdd').classList.add('hidden');
        document.getElementById('modalAdd').classList.remove('flex');
    }, 200);
}
document.getElementById('btnAdd').addEventListener('click', openModal);
document.getElementById('btnCancelAdd').addEventListener('click', closeModal);
document.getElementById('btnCloseModal').addEventListener('click', closeModal);

document.getElementById('btnSaveAdd').addEventListener('click', async () => {
    const name = document.getElementById('inputName').value.trim();
    let secret = document.getElementById('inputSecret').value.trim();
    if (!name || !secret) { alert("Vui lòng nhập đủ Tên và Mã!"); return; }
    if (secret.startsWith('otpauth://')) {
        const match = secret.match(/[?&]secret=([^&]+)/);
        if (match) secret = decodeURIComponent(match[1]);
    }
    if (await generateOTP(secret) === "Error") { alert("Secret Key không hợp lệ!"); return; }
    accounts.push({ name, secret });
    saveData(); renderAccounts();
    document.getElementById('inputName').value = '';
    document.getElementById('inputSecret').value = '';
    closeModal();
});

// Import JSON
document.getElementById('btnImport').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.salt && data.content && !data.entries) { alert("LỖI: File bị MÃ HÓA!"); return; }
                let extractedAccounts = [];
                function scanObject(obj) {
                    if (!obj) return;
                    if (Array.isArray(obj)) { obj.forEach(item => scanObject(item)); return; }
                    if (typeof obj === 'object') {
                        let name = obj.name || obj.title || obj.issuer || "Tài khoản";
                        let secret = obj.secret || obj.key || null;
                        let uri = obj.uri || obj.otpauth || null;
                        if (!secret && uri && typeof uri === 'string') {
                            const match = uri.match(/[?&]secret=([^&]+)/);
                            if (match) secret = decodeURIComponent(match[1]);
                        }
                        if (secret && typeof secret === 'string') {
                            if (!extractedAccounts.some(a => a.secret === secret)) extractedAccounts.push({ name: name, secret: secret });
                        }
                        for (let key in obj) if (typeof obj[key] === 'object') scanObject(obj[key]);
                    }
                }
                scanObject(data);
                let count = 0;
                if (extractedAccounts.length > 0) {
                    extractedAccounts.forEach(newAcc => {
                        if (!accounts.find(a => a.secret === newAcc.secret || a.name === newAcc.name)) {
                            accounts.push(newAcc); count++;
                        }
                    });
                    if (count > 0) { saveData(); renderAccounts(); alert(`Import thành công ${count} tài khoản!`); }
                    else { alert("Tất cả tài khoản đã có sẵn."); }
                } else { alert("Không tìm thấy mã 2FA."); }
            } catch (err) { alert("Lỗi đọc file JSON."); }
        };
        reader.readAsText(file);
    };
    input.click();
});

// Settings
document.getElementById('btnSettings').addEventListener('click', () => {
    document.getElementById('inputPassword').value = settings.password || '';
    document.getElementById('modalSettings').classList.remove('hidden');
    document.getElementById('modalSettings').classList.add('flex');
    setTimeout(() => { document.getElementById('modalSettingsContent').style.transform = 'scale(1)'; }, 50);
});
function closeSettings() {
    document.getElementById('modalSettingsContent').style.transform = 'scale(0.95)';
    setTimeout(() => {
        document.getElementById('modalSettings').classList.add('hidden');
        document.getElementById('modalSettings').classList.remove('flex');
    }, 200);
}
document.getElementById('btnCloseSettings').addEventListener('click', closeSettings);
document.getElementById('btnToggleTheme').addEventListener('click', () => {
    settings.theme = settings.theme === 'light' ? 'dark' : 'light';
    applyTheme(settings.theme);
});
document.getElementById('btnSaveSettings').addEventListener('click', () => {
    settings.password = document.getElementById('inputPassword').value.trim();
    saveSettings();
    closeSettings();
    alert("Đã lưu cài đặt!");
});

// WebAuthn
async function registerBiometric() {
    if (!window.PublicKeyCredential) { alert("Trình duyệt không hỗ trợ Windows Hello."); return; }
    try {
        const challenge = new Uint8Array(32); window.crypto.getRandomValues(challenge);
        const credential = await navigator.credentials.create({
            publicKey: {
                challenge: challenge, rp: { name: "HungAuth", id: window.location.hostname || "localhost" },
                user: { id: Uint8Array.from("user-id-123", c => c.charCodeAt(0)), name: "user@example.com", displayName: "User" },
                pubKeyCredParams: [{ alg: -7, type: "public-key" }],
                authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" }
            }
        });
        settings.biometricId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
        saveSettings();
        alert("Đã kích hoạt Windows Hello thành công!");
    } catch (err) { alert("Lỗi cài đặt Vân tay."); }
}
async function authenticateBiometric() {
    if (!settings.biometricId) return false;
    try {
        const challenge = new Uint8Array(32); window.crypto.getRandomValues(challenge);
        const rawId = new Uint8Array(atob(settings.biometricId).split("").map(c => c.charCodeAt(0)));
        await navigator.credentials.get({
            publicKey: { challenge: challenge, allowCredentials: [{ id: rawId, type: 'public-key' }], userVerification: "required" }
        });
        return true;
    } catch (err) { return false; }
}
document.getElementById('btnSetupBiometric').addEventListener('click', registerBiometric);
document.getElementById('btnBiometricUnlock').addEventListener('click', async () => {
    if (await authenticateBiometric()) document.getElementById('lockScreen').classList.add('hidden-lock');
    else alert("Xác thực thất bại.");
});
document.getElementById('btnUnlock').addEventListener('click', () => {
    if (document.getElementById('unlockPass').value === settings.password) {
        document.getElementById('lockScreen').classList.add('hidden-lock');
    } else alert("Mật khẩu không chính xác!");
});
