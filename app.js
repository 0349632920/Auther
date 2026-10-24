const SUPABASE_URL = 'https://skwsuorigvxwwugpldvn.supabase.co';
const SUPABASE_KEY = 'postgresql://postgres.skwsuorigvxwwugpldvn:[LuongHung0707@123]@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let accounts = [];
let settings = { theme: 'light', password: '', biometricId: null };
let currentUser = null;

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
            applyTheme(settings.theme);
            if (settings.password) document.getElementById('lockScreen').classList.remove('hidden-lock');
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

// Đồng bộ ngầm với Supabase (Lưu tự động)
async function checkUserSession() {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
        currentUser = session.user;
        // Tự động tải dữ liệu từ mây về khi đăng nhập
        const { data, error } = await db.from('user_data').select('*').eq('user_id', currentUser.id).single();
        if (data && data.accounts) {
            accounts = data.accounts;
            saveData(); renderAccounts();
            if (data.settings) { settings = data.settings; saveSettings(); applyTheme(settings.theme); }
        }
    }
}

async function autoSync() {
    if (!currentUser) return;
    await db.from('user_data').upsert({ user_id: currentUser.id, accounts: accounts, settings: settings });
}

// Render
function renderAccounts() {
    accountList.innerHTML = '';
    if (accounts.length === 0) { toggleEmptyState(); return; }
    emptyState.classList.add('hidden');
    
    accounts.forEach((account, index) => {
        const card = document.createElement('div');
        card.className = `card-fade-in bg-white dark:bg-darkcard rounded-[20px] p-5 shadow-soft hover:shadow-hover border border-gray-100 dark:border-gray-800 cursor-pointer group flex flex-col justify-between min-h-[145px] card-anim`;
        card.style.animationDelay = `${index * 0.05}s`;
        card.onclick = () => copyCode(account.secret);
        
        card.innerHTML = `
            <div class="flex items-start justify-between">
                <div class="flex items-center gap-3.5">
                    <div class="w-11 h-11 rounded-2xl bg-gray-50 dark:bg-gray-800 text-proton flex items-center justify-center font-bold text-xl border border-gray-100 dark:border-gray-700 group-hover:bg-proton group-hover:text-white transition-colors duration-300">${account.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <h3 class="font-bold text-gray-800 dark:text-gray-100 text-[17px] leading-tight truncate max-w-[160px]">${account.name}</h3>
                        <p class="text-xs text-gray-400 mt-1 font-medium">One-time password</p>
                    </div>
                </div>
                <div class="relative w-9 h-9 flex items-center justify-center shrink-0">
                    <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36"><path class="text-gray-100 dark:text-gray-700" stroke-width="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" /><path class="text-proton arc" stroke-dasharray="100, 100" stroke-width="3.5" stroke-linecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" /></svg>
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
    toast.classList.add('show');
    clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => { toast.classList.remove('show'); }, 2000);
}

function toggleEmptyState() {
    if (accounts.length === 0) emptyState.classList.remove('hidden');
    else emptyState.classList.add('hidden');
}

// Xử lý Thêm tài khoản
document.getElementById('btnAdd').addEventListener('click', () => {
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

document.getElementById('btnSaveAdd').addEventListener('click', async () => {
    const name = document.getElementById('inputName').value.trim();
    let secret = document.getElementById('inputSecret').value.trim();
    if (!name || !secret) return;
    if (secret.startsWith('otpauth://')) {
        const match = secret.match(/[?&]secret=([^&]+)/);
        if (match) secret = decodeURIComponent(match[1]);
    }
    accounts.push({ name, secret });
    saveData(); renderAccounts(); autoSync(); // Đồng bộ ngầm
    document.getElementById('inputName').value = '';
    document.getElementById('inputSecret').value = '';
    document.getElementById('btnCancelAdd').click();
});
