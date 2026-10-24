const SUPABASE_URL = 'https://skwsuorigvxwwugpldvn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrd3N1b3JpZ3Z4d3d1Z3BsZHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MDY1NzAsImV4cCI6MjEwODM4MjU3MH0.-5MxD9VIFjANch9J0NMTFT-z-tM7eDDxdA1e4p8NFHc';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let accounts = [];
// Mặc định bật autoLock (true)
let settings = { theme: 'light', password: '', autoLock: true }; 
let currentUser = null;
let deleteIndex = -1;
let isCloudLoaded = false;
let isAppLocked = false;

// Hàm hiển thị thông báo
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
        showNotification("Vui lòng đăng nhập để sử dụng tính năng này!", "error");
        setTimeout(() => { window.location.href = "/login"; }, 1000);
        return false;
    }
    return true;
}

// Thuật toán OTP
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

// Khởi tạo
document.addEventListener('DOMContentLoaded', async () => {
    loadSettings();
    loadData();
    setInterval(updateCodes, 1000);
    await checkUserSession();
});

const accountList = document.querySelector('#accountList .grid');
const emptyState = document.getElementById('emptyState');

function loadSettings() {
    const saved = localStorage.getItem('proton_settings');
    if (saved) {
        try {
            settings = JSON.parse(saved);
            // Đảm bảo biến autoLock luôn tồn tại
            if (settings.autoLock === undefined) settings.autoLock = true; 
            
            applyTheme(settings.theme);
            updateAutoLockUI(); // Cập nhật giao diện nút gạt

            if (settings.password) {
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
        btn.classList.add('bg-roblox');
        btn.classList.remove('bg-gray-300');
        thumb.style.transform = 'translateX(24px)';
    } else {
        btn.classList.remove('bg-roblox');
        btn.classList.add('bg-gray-300');
        thumb.style.transform = 'translateX(0)';
    }
}

function loadData() {
    const saved = localStorage.getItem('proton_accounts');
    if (saved) {
        try { accounts = JSON.parse(saved); } catch(e) { accounts = []; }
        renderAccounts();
    } else toggleEmptyState();
}

function saveData() { localStorage.setItem('proton_accounts', JSON.stringify(accounts)); }

// Đồng bộ
async function checkUserSession() {
    try {
        const { data: { session } } = await db.auth.getSession();
        if (session) {
            currentUser = session.user;
            const displayName = currentUser.email.replace('@myauth.local', '');
            const profileEmailEl = document.getElementById('profileEmail');
            if (profileEmailEl) profileEmailEl.textContent = displayName;
            const iconUser = document.getElementById('iconUser');
            if (iconUser) iconUser.className = "fas fa-user-circle text-roblox text-xl";

            const { data } = await db.from('user_data').select('*').eq('user_id', currentUser.id).maybeSingle();
            if (data) {
                if (data.accounts && data.accounts.length > 0) { accounts = data.accounts; saveData(); renderAccounts(); }
                if (data.settings) { settings = data.settings; saveSettings(); applyTheme(settings.theme); updateAutoLockUI(); }
            }
            isCloudLoaded = true;
        } else { window.location.href = "/login"; }
    } catch (err) { console.warn(err); }
}

async function autoSync() {
    if (!currentUser || !isCloudLoaded) return;
    await db.from('user_data').upsert({ user_id: currentUser.id, accounts: accounts, settings: settings });
}

// Render
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
            <button class="btn-delete absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 rounded-full z-10" onclick="openDeleteModal(${index})">
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
                    <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36"><path class="text-gray-200 dark:text-gray-600" stroke-width="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" /><path class="text-roblox arc" stroke-dasharray="100, 100" stroke-width="3" stroke-linecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" /></svg>
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
    if (isAppLocked) return;
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

// ==========================================
// TÍNH NĂNG TỰ ĐỘNG KHÓA KHI RỜI TAB
// ==========================================
document.addEventListener('visibilitychange', () => {
    // Nếu tab bị ẩn VÀ người dùng có bật autoLock VÀ có cài mật khẩu
    if (document.hidden && settings.autoLock && settings.password) {
        isAppLocked = true;
        document.getElementById('lockScreen').classList.remove('hidden-lock');
        const unlockPass = document.getElementById('unlockPass');
        if (unlockPass) unlockPass.value = '';
        updateCodes(); // Che mã ngay lập tức
    }
});

// ==========================================
// CÁC SỰ KIỆN GIAO DIỆN (Nút bấm)
// ==========================================
// Cài đặt: Nút gạt Theme
document.getElementById('btnToggleTheme')?.addEventListener('click', () => {
    settings.theme = settings.theme === 'light' ? 'dark' : 'light';
    applyTheme(settings.theme);
});

// Cài đặt: Nút gạt AutoLock
document.getElementById('btnToggleAutoLock')?.addEventListener('click', () => {
    settings.autoLock = !settings.autoLock;
    updateAutoLockUI();
});

// Lưu cài đặt
document.getElementById('btnSaveSettings')?.addEventListener('click', () => {
    if (!checkLogin()) return;
    settings.password = document.getElementById('inputPassword').value.trim();
    saveSettings(); autoSync();
    document.getElementById('btnCloseSettings').click();
    showNotification("Đã lưu cài đặt!", "success");
});

// Mở modal Cài đặt
document.getElementById('btnSettings')?.addEventListener('click', () => {
    if (!checkLogin()) return;
    if (isAppLocked) return showNotification("Vui lòng mở khóa ứng dụng để thay đổi cài đặt!", "error");
    
    document.getElementById('inputPassword').value = settings.password;
    updateAutoLockUI(); // Đảm bảo giao diện khớp với biến
    document.getElementById('modalSettings').classList.remove('hidden');
    document.getElementById('modalSettings').classList.add('flex');
    setTimeout(() => { document.getElementById('modalSettingsContent').style.transform = 'scale(1)'; }, 50);
});

// Đóng modal Cài đặt
document.getElementById('btnCloseSettings')?.addEventListener('click', () => {
    document.getElementById('modalSettingsContent').style.transform = 'scale(0.95)';
    setTimeout(() => {
        document.getElementById('modalSettings').classList.add('hidden');
        document.getElementById('modalSettings').classList.remove('flex');
    }, 200);
});

// Mở khóa app
document.getElementById('btnUnlock')?.addEventListener('click', () => {
    const pass = document.getElementById('unlockPass').value.trim();
    if (pass === settings.password) {
        isAppLocked = false; 
        document.getElementById('lockScreen').classList.add('hidden-lock');
        document.getElementById('unlockPass').value = '';
        updateCodes(); 
    } else {
        showNotification("Mật khẩu không chính xác!", "error");
    }
});
document.getElementById('unlockPass')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btnUnlock').click();
});
