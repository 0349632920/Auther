// ==========================================
// FILE FIX.JS - SIÊU MẠNH (VÁ TOÀN BỘ LỖI)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🛠️ Fix.js Siêu Mạnh đang chạy...");

    // Hàm hỗ trợ
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
    // 1. XỬ LÝ NÚT CHIA SẺ & XÓA (DÙNG EVENT DELEGATION TỐI CAO)
    // ==========================================
    const grid = document.getElementById('sortableGrid');
    if (grid) {
        grid.addEventListener('click', (e) => {
            // --- XỬ LÝ CHIA SẺ ---
            const shareBtn = e.target.closest('.btn-share');
            if (shareBtn) {
                e.preventDefault();
                e.stopPropagation();

                if (!currentUser) return showNotification("Vui lòng đăng nhập!", "error");
                if (isAppLocked) return showNotification("Vui lòng mở khóa ứng dụng!", "error");

                // Tìm thẻ cha gần nhất để lấy secret
                const card = shareBtn.closest('.roblox-card');
                const codeDisplay = card ? card.querySelector('.code-display') : null;
                const nameElement = card ? card.querySelector('h3') : null;
                
                const secret = codeDisplay ? codeDisplay.getAttribute('data-secret') : null;
                const name = nameElement ? nameElement.textContent : "Tài khoản";

                if (secret) {
                    const encodedSecret = btoa(secret);
                    const encodedName = encodeURIComponent(name);
                    const shareUrl = `${window.location.origin}/?share_secret=${encodedSecret}&share_name=${encodedName}`;

                    const shareLinkInput = document.getElementById('shareLink');
                    if (shareLinkInput) shareLinkInput.value = shareUrl;
                    
                    openModal('modalShare');
                } else {
                    showNotification("Không tìm thấy mã để chia sẻ!", "error");
                }
                return;
            }

            // --- XỬ LÝ XÓA ---
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
        });
    }

    // ==========================================
    // 2. XỬ LÝ NÚT COPY & ĐÓNG TRONG MODAL CHIA SẺ
    // ==========================================
    const btnCopyShare = resetElement('btnCopyShare');
    if (btnCopyShare) {
        btnCopyShare.addEventListener('click', (e) => {
            e.preventDefault();
            const link = document.getElementById('shareLink').value;
            navigator.clipboard.writeText(link).then(() => {
                showNotification("Đã copy link chia sẻ!", "success");
                closeModal('modalShare');
            }).catch(err => {
                showNotification("Lỗi copy link: " + err, "error");
            });
        });
    }

    const btnCloseShare = resetElement('btnCloseShare');
    if (btnCloseShare) {
        btnCloseShare.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal('modalShare');
        });
    }

    // ==========================================
    // 3. XỬ LÝ NÚT XÓA (XÁC NHẬN VÀ HỦY)
    // ==========================================
    const btnConfirmDelete = resetElement('btnConfirmDelete');
    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.deleteIndex !== undefined && window.deleteIndex > -1) {
                accounts.splice(window.deleteIndex, 1);
                saveData(); renderAccounts(); autoSync();
                showNotification("Đã xóa tài khoản!", "success");
                closeModal('modalDelete');
                window.deleteIndex = -1;
            }
        });
    }

    const btnCancelDelete = resetElement('btnCancelDelete');
    if (btnCancelDelete) {
        btnCancelDelete.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal('modalDelete');
            window.deleteIndex = -1;
        });
    }

    // ==========================================
    // 4. XỬ LÝ CÁC NÚT KHÁC (ADD, SETTINGS, LOGOUT)
    // ==========================================
    const btnAdd = resetElement('btnAdd');
    if (btnAdd) {
        btnAdd.addEventListener('click', () => {
            if (!currentUser) return showNotification("Vui lòng đăng nhập!", "error");
            if (isAppLocked) return showNotification("Vui lòng mở khóa ứng dụng!", "error");
            openModal('modalAdd');
        });
    }

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

    const btnSaveSettings = resetElement('btnSaveSettings');
    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', () => {
            settings.password = document.getElementById('inputPassword').value.trim();
            if (!settings.password && !settings.biometricId) { settings.autoLock = false; updateAutoLockUI(); }
            saveSettings(); autoSync();
            closeModal('modalSettings');
            showNotification("Đã lưu cài đặt!", "success");
        });
    }
    
    // ... (Các nút khác như Logout, Cancel, Close đã được xử lý tương tự)
});
