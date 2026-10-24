const SUPABASE_URL = 'https://skwsuorigvxwwugpldvn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrd3N1b3JpZ3Z4d3d1Z3BsZHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MDY1NzAsImV4cCI6MjEwODM4MjU3MH0.-5MxD9VIFjANch9J0NMTFT-z-tM7eDDxdA1e4p8NFHc';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let accounts = [];
let settings = { theme: 'light', password: '' };
let currentUser = null;
let deleteIndex = -1;

// ==========================================
// HÀM KIỂM TRA ĐĂNG NHẬP (GUARD)
// ==========================================
function checkLogin() {
    if (!currentUser) {
        alert("Vui lòng đăng nhập để sử dụng tính năng này!");
        window.location.href = "/login";
        return false;
    }
    return true;
}

// ==========================================
// THUẬT TOÁN TẠO MÃ OTP
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
// KHỞI TẠO
// ==========================================
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
            applyTheme(settings.theme);
            if (settings.password && document.getElementById('lockScreen')) {
                document.getElementById('lockScreen').classList.remove('hidden-lock');
            }
        } catch(e) {}
    }
}

function saveSettings() { localStorage.setItem('proton_settings', JSON.stringify(settings)); }

function applyTheme(theme) {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
}

function loadData() {
    const saved = localStorage.getItem('proton_accounts');
    if (saved) {
        try { accounts = JSON.parse(saved); } catch(e) { accounts = []; }
        renderAccounts();
    } else toggleEmptyState();
}

function saveData() { localStorage.setItem('proton_accounts', JSON.stringify(accounts)); }

// ==========================================
// ĐỒNG BỘ & SESSION
// ==========================================
async function checkUserSession() {
    try {
        const { data: { session }, error: sessionError } = await db.auth.getSession();
        if (sessionError) throw sessionError;
        
        if (session) {
            currentUser = session.user;
            const displayName = currentUser.email.replace('@myauth.local', '');
            const profileEmailEl = document.getElementById('profileEmail');
            if (profileEmailEl) profileEmailEl.textContent = displayName;
            
            const iconUser = document.getElementById('iconUser');
            if (iconUser) iconUser.className = "fas fa-user-circle text-roblox text-xl";

            const { data, error } = await db.from('user_data').select('*').eq('user_id', currentUser.id).single();
            if (!error && data && data.accounts) {
                accounts = data.accounts;
                saveData(); renderAccounts();
                if (data.settings) { settings = data.settings; saveSettings(); applyTheme(settings.theme); }
            }
        }
    } catch (err) { console.warn("Lỗi session:", err.message); }
}

async function autoSync() {
    if (!currentUser) return;
    try {
        await db.from('user_data').upsert({ user_id: currentUser.id, accounts: accounts, settings: settings });
    } catch (err) { console.warn("Lỗi đồng bộ:", err.message); }
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
            card.style.transform = 'scale(0.96)';
            setTimeout(() => { card.style.transform = ''; }, 150);
            copyCode(account.secret);
        };
        
        card.innerHTML = `
            <button class="btn-delete absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors z-10" onclick="openDeleteModal(${index})" title="Xóa tài khoản">
                <i class="fas fa-trash-alt text-sm"></i>
            </button>
            <div class="flex items-start justify-between pr-8">
                <div class="flex items-center gap-3.5">
                    <div class="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-800 text-roblox flex items-center justify-center font-bold text-xl border border-gray-200 dark:border-gray-700 group-hover:bg-roblox group-hover:text-white transition-colors duration-300">${account.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <h3 class="font-bold text-gray-800 dark:text-gray-100 text-[17px] leading-tight truncate max-w-[130px]">${account.name}</h3>
                        <p class="text-xs text-gray-400 mt-1 font-semibold">2FA Code</p>
                    </div>
                </div>
                <div class="relative w-9 h-9 flex items-center justify-center shrink-0">
                    <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36"><path class="text-gray-200 dark:text-gray-600" stroke-width="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" /><path class="text-roblox arc" stroke-dasharray="100, 100" stroke-width="3.5" stroke-linecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" /></svg>
                </div>
            </div>
            <div class="mt-5 flex items-end justify-between">
                <div class="text-[32px] font-mono font-bold tracking-tight text-gray-900 dark:text-white code-display leading-none" data-secret="${account.secret}">------ ------</div>
                <div class="flex flex-col items-end"><span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider next-label">Next</span><span class="text-sm text-gray-500 dark:text-gray-400 font-semibold sec-label">30s</span></div>
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
    document.querySelectorAll('.code-display').forEach(async el => {
        const secret = el.getAttribute('data-secret');
        if (!secret) return;
        const code = await generateOTP(secret);
        el.textContent = code !== "Error" ? `${code.slice(0,3)} ${code.slice(3)}` : "Lỗi Key";
    });
    document.querySelectorAll('.sec-label').forEach(el => { el.textContent = `${remaining}s`; });
}

async function copyCode(secret) {
    try {
        const code = await generateOTP(secret);
        if (code !== "Error") {
            await navigator.clipboard.writeText(code);
            showToast();
        }
    } catch (e) { console.error(e); }
}

function showToast() {
    const toast = document.getElementById('toast');
    toast.classList.remove('opacity-0', 'translate-y-10');
    toast.classList.add('opacity-100', 'translate-y-0');
    clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-10');
        toast.classList.remove('opacity-100', 'translate-y-0');
    }, 2000);
}

function toggleEmptyState() {
    if (accounts.length === 0) emptyState.classList.remove('hidden');
    else emptyState.classList.add('hidden');
}

// ==========================================
// SỰ KIỆN NGƯỜI DÙNG & PROFILE
// ==========================================
const btnUser = document.getElementById('btnUser');
if (btnUser) {
    btnUser.addEventListener('click', () => {
        if (currentUser) {
            const modal = document.getElementById('modalProfile');
            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                setTimeout(() => { document.getElementById('modalProfileContent').style.transform = 'scale(1)'; }, 50);
            }
        } else { window.location.href = "/login"; }
    });
}

const btnCloseProfile = document.getElementById('btnCloseProfile');
if (btnCloseProfile) {
    btnCloseProfile.addEventListener('click', () => {
        document.getElementById('modalProfileContent').style.transform = 'scale(0.95)';
        setTimeout(() => {
            const modal = document.getElementById('modalProfile');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 200);
    });
}

const btnChangePassword = document.getElementById('btnChangePassword');
if (btnChangePassword) {
    btnChangePassword.addEventListener('click', async () => {
        if (!checkLogin()) return; // Kiểm tra đăng nhập
        
        const newPass = document.getElementById('newPassword').value.trim();
        if (!newPass || newPass.length < 6) return alert("Mật khẩu phải từ 6 ký tự!");
        try {
            const { error } = await db.auth.updateUser({ password: newPass });
            if (error) throw error;
            alert("Đổi mật khẩu thành công!");
            document.getElementById('newPassword').value = '';
        } catch (err) { alert("Lỗi đổi mật khẩu: " + err.message); }
    });
}

// ==========================================
// XỬ LÝ ĐĂNG XUẤT (CÓ XÁC NHẬN)
// ==========================================
const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        if (!checkLogin()) return; // Kiểm tra đăng nhập

        const modalLogout = document.getElementById('modalLogout');
        modalLogout.classList.remove('hidden');
        modalLogout.classList.add('flex');
        setTimeout(() => { document.getElementById('modalLogoutContent').style.transform = 'scale(1)'; }, 50);
    });
}

const btnCancelLogout = document.getElementById('btnCancelLogout');
if (btnCancelLogout) {
    btnCancelLogout.addEventListener('click', () => {
        document.getElementById('modalLogoutContent').style.transform = 'scale(0.95)';
        setTimeout(() => {
            const modalLogout = document.getElementById('modalLogout');
            modalLogout.classList.add('hidden');
            modalLogout.classList.remove('flex');
        }, 200);
    });
}

const btnConfirmLogout = document.getElementById('btnConfirmLogout');
if (btnConfirmLogout) {
    btnConfirmLogout.addEventListener('click', async () => {
        await db.auth.signOut();
        currentUser = null;
        document.getElementById('modalLogoutContent').style.transform = 'scale(0.95)';
        setTimeout(() => {
            const modalLogout = document.getElementById('modalLogout');
            modalLogout.classList.add('hidden');
            modalLogout.classList.remove('flex');
            window.location.reload();
        }, 200);
    });
}

// ==========================================
// CÁC SỰ KIỆN XÓA, THÊM, CÀI ĐẶT KHÁC
// ==========================================
window.openDeleteModal = function(index) {
    if (!checkLogin()) return; // Kiểm tra đăng nhập

    deleteIndex = index;
    document.getElementById('deleteName').textContent = accounts[index].name;
    document.getElementById('modalDelete').classList.remove('hidden');
    document.getElementById('modalDelete').classList.add('flex');
    setTimeout(() => { document.getElementById('modalDeleteContent').style.transform = 'scale(1)'; }, 50);
}

const btnCancelDelete = document.getElementById('btnCancelDelete');
if (btnCancelDelete) {
    btnCancelDelete.addEventListener('click', () => {
        document.getElementById('modalDeleteContent').style.transform = 'scale(0.95)';
        setTimeout(() => {
            document.getElementById('modalDelete').classList.add('hidden');
            document.getElementById('modalDelete').classList.remove('flex');
        }, 200);
    });
}

const btnConfirmDelete = document.getElementById('btnConfirmDelete');
if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener('click', () => {
        if (!checkLogin()) return; // Kiểm tra đăng nhập

        if (deleteIndex > -1) {
            accounts.splice(deleteIndex, 1); 
            saveData(); renderAccounts(); autoSync(); 
            document.getElementById('modalDeleteContent').style.transform = 'scale(0.95)';
            setTimeout(() => {
                document.getElementById('modalDelete').classList.add('hidden');
                document.getElementById('modalDelete').classList.remove('flex');
            }, 200);
            deleteIndex = -1;
        }
    });
}

const btnAdd = document.getElementById('btnAdd');
if (btnAdd) {
    btnAdd.addEventListener('click', () => {
        if (!checkLogin()) return; // Kiểm tra đăng nhập

        document.getElementById('modalAdd').classList.remove('hidden');
        document.getElementById('modalAdd').classList.add('flex');
        setTimeout(() => { document.getElementById('modalAddContent').style.transform = 'scale(1)'; }, 50);
    });
}

const btnCancelAdd = document.getElementById('btnCancelAdd');
if (btnCancelAdd) {
    btnCancelAdd.addEventListener('click', () => {
        document.getElementById('modalAddContent').style.transform = 'scale(0.95)';
        setTimeout(() => {
            document.getElementById('modalAdd').classList.add('hidden');
            document.getElementById('modalAdd').classList.remove('flex');
        }, 200);
    });
}

const btnCloseModal = document.getElementById('btnCloseModal');
if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
        document.getElementById('btnCancelAdd').click();
    });
}

const btnSaveAdd = document.getElementById('btnSaveAdd');
if (btnSaveAdd) {
    btnSaveAdd.addEventListener('click', async () => {
        if (!checkLogin()) return; // Kiểm tra đăng nhập

        const name = document.getElementById('inputName').value.trim();
        let secret = document.getElementById('inputSecret').value.trim();
        if (!name || !secret) return;
        if (secret.startsWith('otpauth://')) {
            const match = secret.match(/[?&]secret=([^&]+)/);
            if (match) secret = decodeURIComponent(match[1]);
        }
        accounts.push({ name, secret });
        saveData(); renderAccounts(); autoSync();
        document.getElementById('inputName').value = '';
        document.getElementById('inputSecret').value = '';
        document.getElementById('btnCancelAdd').click();
    });
}

const btnSettings = document.getElementById('btnSettings');
if (btnSettings) {
    btnSettings.addEventListener('click', () => {
        if (!checkLogin()) return; // Kiểm tra đăng nhập

        document.getElementById('modalSettings').classList.remove('hidden');
        document.getElementById('modalSettings').classList.add('flex');
        setTimeout(() => { document.getElementById('modalSettingsContent').style.transform = 'scale(1)'; }, 50);
    });
}

const btnCloseSettings = document.getElementById('btnCloseSettings');
if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', () => {
        document.getElementById('modalSettingsContent').style.transform = 'scale(0.95)';
        setTimeout(() => {
            document.getElementById('modalSettings').classList.add('hidden');
            document.getElementById('modalSettings').classList.remove('flex');
        }, 200);
    });
}

const btnToggleTheme = document.getElementById('btnToggleTheme');
if (btnToggleTheme) {
    btnToggleTheme.addEventListener('click', () => {
        settings.theme = settings.theme === 'light' ? 'dark' : 'light';
        applyTheme(settings.theme);
    });
}

const btnSaveSettings = document.getElementById('btnSaveSettings');
if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', () => {
        if (!checkLogin()) return; // Kiểm tra đăng nhập

        settings.password = document.getElementById('inputPassword').value.trim();
        saveSettings(); autoSync();
        document.getElementById('btnCloseSettings').click();
        alert("Đã lưu cài đặt!");
    });
}

// ==========================================
// IMPORT FILE JSON
// ==========================================
const btnImport = document.getElementById('btnImport');
if (btnImport) {
    btnImport.addEventListener('click', () => {
        if (!checkLogin()) return; // Kiểm tra đăng nhập

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
                        if (count > 0) { saveData(); renderAccounts(); autoSync(); alert(`Import thành công ${count} tài khoản!`); }
                        else { alert("Tất cả tài khoản đã có sẵn."); }
                    } else { alert("Không tìm thấy mã 2FA."); }
                } catch (err) { alert("Lỗi đọc file JSON."); }
            };
            reader.readAsText(file);
        };
        input.click();
    });
}

// ==========================================
// MÀN HÌNH KHÓA
// ==========================================
const btnUnlock = document.getElementById('btnUnlock');
if (btnUnlock) {
    btnUnlock.addEventListener('click', () => {
        const pass = document.getElementById('unlockPass').value.trim();
        if (pass === settings.password) {
            document.getElementById('lockScreen').classList.add('hidden-lock');
            document.getElementById('unlockPass').value = '';
        } else {
            alert("Mật khẩu không chính xác!");
        }
    });
}

const unlockPassInput = document.getElementById('unlockPass');
if (unlockPassInput) {
    unlockPassInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('btnUnlock').click();
    });
}
