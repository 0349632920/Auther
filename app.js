const SUPABASE_URL = 'https://skwsuorigvxwwugpldvn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrd3N1b3JpZ3Z4d3d1Z3BsZHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MDY1NzAsImV4cCI6MjEwODM4MjU3MH0.-5MxD9VIFjANch9J0NMTFT-z-tM7eDDxdA1e4p8NFHc';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let accounts = [];
let settings = { theme: 'light', password: '' };
let currentUser = null;
let deleteIndex = -1;
let isCloudLoaded = false;
let isAppLocked = false;
let currentShareSecret = null;
let autoLockTimer;
let html5QrCode = null; // Biến cho QR Scanner

// ==========================================
// CÁC HÀM TIỆN ÍCH
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
        showNotification("Vui lòng đăng nhập để sử dụng tính năng này!", "error");
        setTimeout(() => { window.location.href = "/login"; }, 1000);
        return false;
    }
    return true;
}

// ==========================================
// TÍNH NĂNG 5: TỰ ĐỘNG KHÓA (AUTO-LOCK)
// ==========================================
function resetAutoLock() {
    if (!settings.password || isAppLocked) return;
    clearTimeout(autoLockTimer);
    autoLockTimer = setTimeout(() => {
        isAppLocked = true;
        document.getElementById('lockScreen').classList.remove('hidden-lock');
        updateCodes(); // Che mã
    }, 5 * 60 * 1000); // 5 phút
}

document.addEventListener('mousemove', resetAutoLock);
document.addEventListener('keydown', resetAutoLock);

// ==========================================
// TÍNH NĂNG 2: MÃ HÓA DỮ LIỆU LOCAL (CRYPTOJS)
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
            applyTheme(settings.theme);
            if (settings.password) {
                isAppLocked = true;
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
// OTP & ĐỒNG BỘ
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

document.addEventListener('DOMContentLoaded', async () => {
    loadSettings();
    loadData();
    setInterval(updateCodes, 1000);
    await checkUserSession();
    
    // TÍNH NĂNG 3: CHIA SẺ
    const urlParams = new URLSearchParams(window.location.search);
    const shareSecret = urlParams.get('share_secret');
    const shareName = urlParams.get('share_name');
    if (shareSecret && shareName) {
        if (confirm(`Bạn có muốn thêm tài khoản "${shareName}" từ link chia sẻ không?`)) {
            accounts.push({ name: shareName, secret: shareSecret });
            saveData(); renderAccounts(); autoSync();
            showNotification("Đã thêm tài khoản từ link chia sẻ!", "success");
        }
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // TÍNH NĂNG 6: KÉO THẢ (SORTABLE)
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
        const { data: { session }, error: sessionError } = await db.auth.getSession();
        if (sessionError) throw sessionError;
        if (session) {
            currentUser = session.user;
            document.getElementById('profileEmail').textContent = currentUser.email.replace('@myauth.local', '');
            document.getElementById('iconUser').className = "fas fa-user-circle text-roblox text-xl";

            const { data, error } = await db.from('user_data').select('*').eq('user_id', currentUser.id).maybeSingle();
            if (!error && data) {
                if (data.accounts && data.accounts.length > 0) {
                    accounts = data.accounts;
                    saveData(); renderAccounts(); 
                }
                if (data.settings) { settings = data.settings; saveSettings(); applyTheme(settings.theme); }
            }
            isCloudLoaded = true;
        } else { window.location.href = "/login"; }
    } catch (err) { console.warn("Lỗi session:", err.message); }
}

async function autoSync() {
    if (!currentUser || !isCloudLoaded) return;
    try {
        await db.from('user_data').upsert({ user_id: currentUser.id, accounts: accounts, settings: settings });
    } catch (err) { console.warn("Lỗi đồng bộ:", err.message); }
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
            if (isAppLocked) {
                showNotification("Vui lòng mở khóa ứng dụng để copy mã!", "error");
                return;
            }
            card.style.transform = 'scale(0.96)';
            setTimeout(() => { card.style.transform = ''; }, 150);
            copyCode(account.secret);
        };
        
        card.innerHTML = `
            <div class="absolute top-4 right-4 flex gap-1 z-10">
                <button class="btn-share w-8 h-8 flex items-center justify-center text-gray-300 hover:text-roblox hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors" onclick="openShareModal('${account.secret}', '${account.name}')" title="Chia sẻ">
                    <i class="fas fa-share-alt text-sm"></i>
                </button>
                <button class="btn-delete w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors" onclick="openDeleteModal(${index})" title="Xóa tài khoản">
                    <i class="fas fa-trash-alt text-sm"></i>
                </button>
            </div>
            <div class="flex items-start justify-between pr-16">
                <div class="flex items-center gap-3.5">
                    <div class="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-800 text-roblox flex items-center justify-center font-bold text-xl border border-gray-200 dark:border-gray-700 group-hover:bg-roblox group-hover:text-white transition-colors duration-300">${account.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <h3 class="font-bold text-gray-800 dark:text-gray-100 text-[17px] leading-tight truncate max-w-[130px]">${account.name}</h3>
                        <p class="text-xs text-gray-400 mt-1 font-semibold">2FA Code</p>
                    </div>
                </div>
            </div>
            <div class="mt-5 flex items-end justify-between">
                <div class="text-[32px] font-mono font-bold tracking-tight text-gray-900 dark:text-white code-display leading-none" data-secret="${account.secret}">------ ------</div>
                <div class="flex flex-col items-end">
                    <span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Next</span>
                    <div class="relative w-9 h-9 flex items-center justify-center shrink-0 mt-1">
                        <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36"><path class="text-gray-200 dark:text-gray-600" stroke-width="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" /><path class="text-roblox arc" stroke-dasharray="100, 100" stroke-width="3.5" stroke-linecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" /></svg>
                    </div>
                    <span class="text-[10px] text-gray-500 font-semibold sec-label mt-1">30s</span>
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
    
    document.querySelectorAll('.code-display').forEach(async el => {
        if (isAppLocked) { el.textContent = "••• •••"; return; }
        const secret = el.getAttribute('data-secret');
        if (!secret) return;
        const code = await generateOTP(secret);
        el.textContent = code !== "Error" ? `${code.slice(0,3)} ${code.slice(3)}` : "Lỗi Key";
    });
    
    document.querySelectorAll('.sec-label').forEach(el => { el.textContent = `${remaining}s`; });
}

async function copyCode(secret) {
    if (isAppLocked) {
        showNotification("Vui lòng mở khóa ứng dụng để copy mã!", "error");
        return;
    }
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
// TÍNH NĂNG 3: CHIA SẺ (MODAL)
// ==========================================
window.openShareModal = function(secret, name) {
    if (!checkLogin()) return;
    currentShareSecret = secret;
    
    // Tạo link share (giả lập mã hóa base64)
    const encodedSecret = btoa(secret);
    const encodedName = encodeURIComponent(name);
    const shareUrl = `${window.location.origin}/?share_secret=${encodedSecret}&share_name=${encodedName}`;
    
    document.getElementById('shareLink').value = shareUrl;
    document.getElementById('modalShare').classList.remove('hidden');
    document.getElementById('modalShare').classList.add('flex');
}

document.getElementById('btnCloseShare').addEventListener('click', () => {
    document.getElementById('modalShare').classList.add('hidden');
    document.getElementById('modalShare').classList.remove('flex');
});

document.getElementById('btnCopyShare').addEventListener('click', () => {
    const link = document.getElementById('shareLink').value;
    navigator.clipboard.writeText(link).then(() => {
        showNotification("Đã copy link chia sẻ!", "success");
        document.getElementById('modalShare').classList.add('hidden');
        document.getElementById('modalShare').classList.remove('flex');
    });
});

// ==========================================
// TÍNH NĂNG 4: QUÉT QR (CAMERA)
// ==========================================
document.getElementById('btnScanQR').addEventListener('click', () => {
    document.getElementById('modalQR').classList.remove('hidden');
    document.getElementById('modalQR').classList.add('flex');
    
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText, decodedResult) => {
            // Xử lý khi quét thành công
            html5QrCode.stop().then(() => {
                document.getElementById('modalQR').classList.add('hidden');
                document.getElementById('modalQR').classList.remove('flex');
                
                // Bóc tách otpauth://
                try {
                    const url = new URL(decodedText);
                    const secret = url.searchParams.get("secret");
                    const issuer = url.searchParams.get("issuer") || url.pathname.split("/").pop();
                    if (secret) {
                        document.getElementById('inputName').value = issuer;
                        document.getElementById('inputSecret').value = secret;
                        showNotification("Đã quét mã QR thành công!", "success");
                    }
                } catch (e) {
                    showNotification("Mã QR không hợp lệ!", "error");
                }
            });
        }
    ).catch(err => {
        showNotification("Không thể bật Camera! Hãy cấp quyền.", "error");
        document.getElementById('modalQR').classList.add('hidden');
        document.getElementById('modalQR').classList.remove('flex');
    });
});

document.getElementById('btnCloseQR').addEventListener('click', () => {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            document.getElementById('modalQR').classList.add('hidden');
            document.getElementById('modalQR').classList.remove('flex');
        });
    } else {
        document.getElementById('modalQR').classList.add('hidden');
        document.getElementById('modalQR').classList.remove('flex');
    }
});

// ==========================================
// TÍNH NĂNG 1: XUẤT FILE (EXPORT)
// ==========================================
document.getElementById('btnExport').addEventListener('click', () => {
    if (!checkLogin()) return;
    if (accounts.length === 0) return showNotification("Không có dữ liệu để xuất!", "error");
    
    const dataStr = JSON.stringify(accounts, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `authenticator_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification("Đã xuất file JSON thành công!", "success");
});

// ==========================================
// CÁC SỰ KIỆN GIAO DIỆN KHÁC
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

document.getElementById('btnCloseProfile').addEventListener('click', () => {
    document.getElementById('modalProfileContent').style.transform = 'scale(0.95)';
    setTimeout(() => {
        document.getElementById('modalProfile').classList.add('hidden');
        document.getElementById('modalProfile').classList.remove('flex');
    }, 200);
});

document.getElementById('btnChangePassword').addEventListener('click', async () => {
    if (!checkLogin()) return;
    const oldPass = document.getElementById('oldPassword').value.trim();
    const newPass = document.getElementById('newPassword').value.trim();
    const userEmail = currentUser.email;

    if (!oldPass) return showNotification("Vui lòng nhập mật khẩu hiện tại!", "error");
    if (!newPass || newPass.length < 6) return showNotification("Mật khẩu mới phải từ 6 ký tự trở lên!", "error");

    try {
        const { error: signInError } = await db.auth.signInWithPassword({ email: userEmail, password: oldPass });
        if (signInError) return showNotification("Mật khẩu hiện tại không chính xác!", "error");

        const { error: updateError } = await db.auth.updateUser({ password: newPass });
        if (updateError) throw updateError;

        showNotification("Đổi mật khẩu thành công!", "success");
        document.getElementById('oldPassword').value = '';
        document.getElementById('newPassword').value = '';
    } catch (err) { showNotification("Lỗi đổi mật khẩu: " + err.message, "error"); }
});

document.getElementById('btnLogout').addEventListener('click', () => {
    if (!checkLogin()) return;
    document.getElementById('modalLogout').classList.remove('hidden');
    document.getElementById('modalLogout').classList.add('flex');
    setTimeout(() => { document.getElementById('modalLogoutContent').style.transform = 'scale(1)'; }, 50);
});

document.getElementById('btnCancelLogout').addEventListener('click', () => {
    document.getElementById('modalLogoutContent').style.transform = 'scale(0.95)';
    setTimeout(() => {
        document.getElementById('modalLogout').classList.add('hidden');
        document.getElementById('modalLogout').classList.remove('flex');
    }, 200);
});

document.getElementById('btnConfirmLogout').addEventListener('click', async () => {
    await db.auth.signOut();
    currentUser = null;
    localStorage.removeItem('proton_accounts');
    localStorage.removeItem('proton_settings');
    sessionStorage.clear();
    window.location.href = "/login";
});

window.openDeleteModal = function(index) {
    if (!checkLogin()) return;
    if (isAppLocked) return showNotification("Vui lòng mở khóa ứng dụng để xóa mã!", "error");
    deleteIndex = index;
    document.getElementById('deleteName').textContent = accounts[index].name;
    document.getElementById('modalDelete').classList.remove('hidden');
    document.getElementById('modalDelete').classList.add('flex');
    setTimeout(() => { document.getElementById('modalDeleteContent').style.transform = 'scale(1)'; }, 50);
}

document.getElementById('btnCancelDelete').addEventListener('click', () => {
    document.getElementById('modalDeleteContent').style.transform = 'scale(0.95)';
    setTimeout(() => {
        document.getElementById('modalDelete').classList.add('hidden');
        document.getElementById('modalDelete').classList.remove('flex');
    }, 200);
});

document.getElementById('btnConfirmDelete').addEventListener('click', () => {
    if (!checkLogin()) return;
    if (deleteIndex > -1) {
        accounts.splice(deleteIndex, 1); 
        saveData(); renderAccounts(); autoSync(); 
        showNotification("Đã xóa tài khoản!", "success");
        document.getElementById('modalDeleteContent').style.transform = 'scale(0.95)';
        setTimeout(() => {
            document.getElementById('modalDelete').classList.add('hidden');
            document.getElementById('modalDelete').classList.remove('flex');
        }, 200);
        deleteIndex = -1;
    }
});

document.getElementById('btnAdd').addEventListener('click', () => {
    if (!checkLogin()) return;
    if (isAppLocked) return showNotification("Vui lòng mở khóa ứng dụng để thêm mã!", "error");
    document.getElementById('modalAdd').classList.remove('hidden');
    document.getElementById('modalAdd').classList.add('flex');
    setTimeout(() => { document.getElementById('modalAddContent').style.transform = 'scale(1)'; }, 50);
});

document.getElementById('btnCancelAdd').addEventListener('click', () => {
    document.getElementById('modalAddContent').style.transform = 'scale(0.95)';
    setTimeout(() => {
        document.getElementById('modalAdd').classList.add('hidden');
        document.getElementById('modalAdd').classList.remove('flex');
    }, 200);
});

document.getElementById('btnCloseModal').addEventListener('click', () => {
    document.getElementById('btnCancelAdd').click();
});

document.getElementById('btnSaveAdd').addEventListener('click', async () => {
    if (!checkLogin()) return;
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
    document.getElementById('btnCancelAdd').click();
});

document.getElementById('btnSettings').addEventListener('click', () => {
    if (!checkLogin()) return;
    if (isAppLocked) return showNotification("Vui lòng mở khóa ứng dụng để thay đổi cài đặt!", "error");
    document.getElementById('modalSettings').classList.remove('hidden');
    document.getElementById('modalSettings').classList.add('flex');
    setTimeout(() => { document.getElementById('modalSettingsContent').style.transform = 'scale(1)'; }, 50);
});

document.getElementById('btnCloseSettings').addEventListener('click', () => {
    document.getElementById('modalSettingsContent').style.transform = 'scale(0.95)';
    setTimeout(() => {
        document.getElementById('modalSettings').classList.add('hidden');
        document.getElementById('modalSettings').classList.remove('flex');
    }, 200);
});

document.getElementById('btnToggleTheme').addEventListener('click', () => {
    settings.theme = settings.theme === 'light' ? 'dark' : 'light';
    applyTheme(settings.theme);
});

document.getElementById('btnSaveSettings').addEventListener('click', () => {
    if (!checkLogin()) return;
    settings.password = document.getElementById('inputPassword').value.trim();
    saveSettings(); autoSync();
    document.getElementById('btnCloseSettings').click();
    showNotification("Đã lưu cài đặt!", "success");
});

document.getElementById('btnImport').addEventListener('click', () => {
    if (!checkLogin()) return;
    if (isAppLocked) return showNotification("Vui lòng mở khóa ứng dụng để Import!", "error");
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.salt && data.content && !data.entries) { 
                    return showNotification("LỖI: File bị MÃ HÓA! Hãy xuất dạng Plain text.", "error"); 
                }
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
                    if (count > 0) { 
                        saveData(); renderAccounts(); autoSync(); 
                        showNotification(`Import thành công ${count} tài khoản!`, "success"); 
                    }
                    else { showNotification("Tất cả tài khoản đã có sẵn.", "error"); }
                } else { showNotification("Không tìm thấy mã 2FA.", "error"); }
            } catch (err) { showNotification("Lỗi đọc file JSON.", "error"); }
        };
        reader.readAsText(file);
    };
    input.click();
});

document.getElementById('btnUnlock').addEventListener('click', () => {
    const pass = document.getElementById('unlockPass').value.trim();
    if (pass === settings.password) {
        isAppLocked = false; 
        document.getElementById('lockScreen').classList.add('hidden-lock');
        document.getElementById('unlockPass').value = '';
        updateCodes(); 
        resetAutoLock(); // Bắt đầu đếm ngược tự động khóa
    } else {
        showNotification("Mật khẩu không chính xác!", "error");
    }
});

document.getElementById('unlockPass').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btnUnlock').click();
});
