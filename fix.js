// ==========================================
// FILE FIX.JS - VÁ LỖI TOÀN DIỆN CÁC NÚT BẤM
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🛠️ Fix.js đang chạy...");

    // --- CÁC HÀM HỖ TRỢ ĐÓNG/MỞ MODAL ---
    const openModal = (id) => {
        const modal = document.getElementById(id);
        const content = document.getElementById(id + 'Content');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            if (content) setTimeout(() => { content.style.transform = 'scale(1)'; }, 50);
        }
    };

    const closeModal = (id) => {
        const modal = document.getElementById(id);
        const content = document.getElementById(id + 'Content');
        if (content) content.style.transform = 'scale(0.95)';
        setTimeout(() => {
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        }, 200);
    };

    // --- HÀM TẠO LẠI NÚT (Xóa sự kiện cũ để gắn sự kiện mới) ---
    const resetElement = (id) => {
        const el = document.getElementById(id);
        if (el) {
            const newEl = el.cloneNode(true);
            el.replaceWith(newEl);
            return newEl;
        }
        return null;
    };

    // ==========================================
    // 1. XỬ LÝ CÁC NÚT TRÊN THẺ TÀI KHOẢN (XÓA & CHIA SẺ)
    // ==========================================
    const grid = document.getElementById('sortableGrid');
    if (grid) {
        grid.addEventListener('click', (e) => {
            // --- XỬ LÝ NÚT XÓA ---
            const deleteBtn = e.target.closest('.btn-delete');
            if (deleteBtn) {
                e.preventDefault();
                e.stopPropagation();

                if (!currentUser) return showNotification("Vui lòng đăng nhập!", "error");
                if (isAppLocked) return showNotification("Vui lòng mở khóa ứng dụng!", "error");

                const onclickAttr = deleteBtn.getAttribute('onclick');
                if (onclickAttr) {
                    const match = onclickAttr.match(/openDeleteModal\((\d+)\)/);
                    if (match && match[1]) {
                        const index = parseInt(match[1]);
                        const deleteNameEl = document.getElementById('deleteName');
                        if (deleteNameEl) deleteNameEl.textContent = accounts[index].name;
                        
                        window.deleteIndex = index; 
                        openModal('modalDelete');
                    }
                }
                return;
            }

            // --- XỬ LÝ NÚT CHIA SẺ ---
            const shareBtn = e.target.closest('.btn-share');
            if (shareBtn) {
                e.preventDefault();
                e.stopPropagation();

                if (!currentUser) return showNotification("Vui lòng đăng nhập!", "error");
                if (isAppLocked) return showNotification("Vui lòng mở khóa ứng dụng!", "error");

                const onclickAttr = shareBtn.getAttribute('onclick');
                if (onclickAttr) {
                    const match = onclickAttr.match(/openShareModal\('([^']+)', '([^']+)'\)/);
                    if (match && match[1] && match[2]) {
                        const secret = match[1];
                        const name = match[2];
                        const encodedSecret = btoa(secret);
                        const encodedName = encodeURIComponent(name);
                        const shareUrl = `${window.location.origin}/?share_secret=${encodedSecret}&share_name=${encodedName}`;

                        const shareLinkInput = document.getElementById('shareLink');
                        if (shareLinkInput) shareLinkInput.value = shareUrl;
                        
                        openModal('modalShare');
                    }
                }
                return;
            }
        });
    }

    // ==========================================
    // 2. XỬ LÝ NÚT XÁC NHẬN XÓA
    // ==========================================
    const btnConfirmDelete = resetElement('btnConfirmDelete');
    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (window.deleteIndex !== undefined && window.deleteIndex > -1) {
                accounts.splice(window.deleteIndex, 1);
                saveData();
                renderAccounts();
                autoSync();
                showNotification("Đã xóa tài khoản!", "success");
                closeModal('modalDelete');
                window.deleteIndex = -1;
            }
        });
    }

    // Nút Hủy xóa
    const btnCancelDelete = resetElement('btnCancelDelete');
    if (btnCancelDelete) {
        btnCancelDelete.addEventListener('click', () => {
            closeModal('modalDelete');
            window.deleteIndex = -1;
        });
    }

    // ==========================================
    // 3. XỬ LÝ NÚT COPY LINK CHIA SẺ
    // ==========================================
    const btnCopyShare = resetElement('btnCopyShare');
    if (btnCopyShare) {
        btnCopyShare.addEventListener('click', (e) => {
            e.preventDefault();
            const link = document.getElementById('shareLink').value;
            navigator.clipboard.writeText(link).then(() => {
                showNotification("Đã copy link chia sẻ!", "success");
                closeModal('modalShare');
            });
        });
    }

    // Nút Đóng Modal Share
    const btnCloseShare = resetElement('btnCloseShare');
    if (btnCloseShare) {
        btnCloseShare.addEventListener('click', () => closeModal('modalShare'));
    }

    // ==========================================
    // 4. CÁC NÚT KHÁC (ADD, SETTINGS, IMPORT, LOGOUT)
    // ==========================================
    // Nút Add
    const btnAdd = resetElement('btnAdd');
    if (btnAdd) {
        btnAdd.addEventListener('click', () => {
            if (!currentUser) return showNotification("Vui lòng đăng nhập!", "error");
            if (isAppLocked) return showNotification("Vui lòng mở khóa ứng dụng!", "error");
            openModal('modalAdd');
        });
    }

    // Nút Lưu (Add)
    const btnSaveAdd = resetElement('btnSaveAdd');
    if (btnSaveAdd) {
        btnSaveAdd.addEventListener('click', async () => {
            const name = document.getElementById('inputName').value.trim();
            let secret = document.getElementById('inputSecret').value.trim();
            if (!name || !secret) return showNotification("Vui lòng nhập đủ Tên và Mã!", "error");
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
    }
    // Nút Hủy (Add)
    const btnCancelAdd = resetElement('btnCancelAdd');
    if (btnCancelAdd) btnCancelAdd.addEventListener('click', () => closeModal('modalAdd'));

    // Nút Import
    const btnImport = resetElement('btnImport');
    if (btnImport) {
        btnImport.addEventListener('click', () => {
            if (!currentUser || isAppLocked) return;
            const input = document.createElement('input');
            input.type = 'file'; input.accept = '.json';
            input.onchange = e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = event => {
                    try {
                        const data = JSON.parse(event.target.result);
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
                                    if (!extractedAccounts.some(a => a.secret === secret)) extractedAccounts.push({ name, secret });
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
                            if (count > 0) { saveData(); renderAccounts(); autoSync(); showNotification(`Import thành công ${count} tài khoản!`, "success"); }
                            else { showNotification("Tất cả tài khoản đã có sẵn.", "error"); }
                        } else { showNotification("Không tìm thấy mã 2FA.", "error"); }
                    } catch (err) { showNotification("Lỗi đọc file JSON.", "error"); }
                };
                reader.readAsText(file);
            };
            input.click();
        });
    }

    // Nút Settings
    const btnSettings = resetElement('btnSettings');
    if (btnSettings) {
        btnSettings.addEventListener('click', () => {
            if (!currentUser) return showNotification("Vui lòng đăng nhập!", "error");
            if (isAppLocked) return showNotification("Vui lòng mở khóa ứng dụng!", "error");
            document.getElementById('inputPassword').value = settings.password;
            updateAutoLockUI();
            openModal('modalSettings');
        });
    }
    // Nút Đóng Settings
    const btnCloseSettings = resetElement('btnCloseSettings');
    if (btnCloseSettings) btnCloseSettings.addEventListener('click', () => closeModal('modalSettings'));

    // Nút Lưu Settings
    const btnSaveSettings = resetElement('btnSaveSettings');
    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', () => {
            settings.password = document.getElementById('inputPassword').value.trim();
            if (!settings.password) { settings.autoLock = false; updateAutoLockUI(); }
            saveSettings(); autoSync();
            closeModal('modalSettings');
            showNotification("Đã lưu cài đặt!", "success");
        });
    }

    // Nút Logout
    const btnLogout = resetElement('btnLogout');
    if (btnLogout) btnLogout.addEventListener('click', () => openModal('modalLogout'));

    // Nút Hủy Logout
    const btnCancelLogout = resetElement('btnCancelLogout');
    if (btnCancelLogout) btnCancelLogout.addEventListener('click', () => closeModal('modalLogout'));

    // Nút Xác nhận Logout
    const btnConfirmLogout = resetElement('btnConfirmLogout');
    if (btnConfirmLogout) {
        btnConfirmLogout.addEventListener('click', async () => {
            await db.auth.signOut();
            currentUser = null;
            localStorage.removeItem('proton_accounts');
            localStorage.removeItem('proton_settings');
            sessionStorage.clear();
            window.location.href = "/login";
        });
    }
});
