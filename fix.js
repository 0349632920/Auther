// ==========================================
// FILE FIX.JS - VÁ LỖI NÚT BẤM TOÀN DIỆN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🛠️ Đang chạy Fix.js để đảm bảo các nút hoạt động...");

    // Hàm phụ trợ để mở/đóng Modal
    const openModal = (id) => {
        const modal = document.getElementById(id);
        const content = document.getElementById(id.replace('modal', 'modal') + 'Content'); // VD: modalAdd -> modalAddContent
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            if (content) setTimeout(() => { content.style.transform = 'scale(1)'; }, 50);
        }
    };

    const closeModal = (id) => {
        const modal = document.getElementById(id);
        const content = document.getElementById(id.replace('modal', 'modal') + 'Content');
        if (content) content.style.transform = 'scale(0.95)';
        setTimeout(() => {
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        }, 200);
    };

    // 1. Fix nút Thêm (+ Add)
    const btnAdd = document.getElementById('btnAdd');
    if (btnAdd) {
        btnAdd.onclick = null; // Xóa sự kiện cũ (nếu có)
        btnAdd.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!currentUser) return showNotification("Vui lòng đăng nhập!", "error");
            if (isAppLocked) return showNotification("Vui lòng mở khóa ứng dụng!", "error");
            openModal('modalAdd');
        });
    }

    // 2. Fix nút Đóng Modal Thêm
    const btnCancelAdd = document.getElementById('btnCancelAdd');
    if (btnCancelAdd) {
        btnCancelAdd.onclick = null;
        btnCancelAdd.addEventListener('click', () => closeModal('modalAdd'));
    }
    const btnCloseModal = document.getElementById('btnCloseModal');
    if (btnCloseModal) {
        btnCloseModal.onclick = null;
        btnCloseModal.addEventListener('click', () => closeModal('modalAdd'));
    }

    // 3. Fix nút Lưu (Lưu tài khoản)
    const btnSaveAdd = document.getElementById('btnSaveAdd');
    if (btnSaveAdd) {
        btnSaveAdd.onclick = null;
        btnSaveAdd.addEventListener('click', async (e) => {
            e.preventDefault();
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

    // 4. Fix nút Profile (User)
    const btnUser = document.getElementById('btnUser');
    if (btnUser) {
        btnUser.onclick = null;
        btnUser.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentUser) {
                openModal('modalProfile');
            } else {
                window.location.href = "/login";
            }
        });
    }

    // 5. Fix nút Đóng Profile
    const btnCloseProfile = document.getElementById('btnCloseProfile');
    if (btnCloseProfile) {
        btnCloseProfile.onclick = null;
        btnCloseProfile.addEventListener('click', () => closeModal('modalProfile'));
    }

    // 6. Fix nút Cài đặt (Settings)
    const btnSettings = document.getElementById('btnSettings');
    if (btnSettings) {
        btnSettings.onclick = null;
        btnSettings.addEventListener('click', (e) => {
            e.preventDefault();
            if (!currentUser) return showNotification("Vui lòng đăng nhập!", "error");
            if (isAppLocked) return showNotification("Vui lòng mở khóa ứng dụng!", "error");
            openModal('modalSettings');
        });
    }

    // 7. Fix nút Đóng Cài đặt
    const btnCloseSettings = document.getElementById('btnCloseSettings');
    if (btnCloseSettings) {
        btnCloseSettings.onclick = null;
        btnCloseSettings.addEventListener('click', () => closeModal('modalSettings'));
    }

    // 8. Fix nút Import
    const btnImport = document.getElementById('btnImport');
    if (btnImport) {
        btnImport.onclick = null;
        btnImport.addEventListener('click', (e) => {
            e.preventDefault();
            if (!currentUser) return showNotification("Vui lòng đăng nhập!", "error");
            if (isAppLocked) return showNotification("Vui lòng mở khóa ứng dụng!", "error");
            
            const input = document.createElement('input');
            input.type = 'file'; input.accept = '.json';
            input.onchange = ev => {
                const file = ev.target.files[0];
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

    // 9. Fix nút Đăng xuất
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.onclick = null;
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            openModal('modalLogout');
        });
    }
    
    // 10. Fix nút Đóng Đăng xuất
    const btnCancelLogout = document.getElementById('btnCancelLogout');
    if (btnCancelLogout) {
        btnCancelLogout.onclick = null;
        btnCancelLogout.addEventListener('click', () => closeModal('modalLogout'));
    }

    // 11. Fix nút Xác nhận Đăng xuất
    const btnConfirmLogout = document.getElementById('btnConfirmLogout');
    if (btnConfirmLogout) {
        btnConfirmLogout.onclick = null;
        btnConfirmLogout.addEventListener('click', async (e) => {
            e.preventDefault();
            await db.auth.signOut();
            currentUser = null;
            localStorage.removeItem('proton_accounts');
            localStorage.removeItem('proton_settings');
            sessionStorage.clear();
            window.location.href = "/login";
        });
    }

    // 12. Fix nút Xóa (Thùng rác) - Quan trọng
    window.openDeleteModal = function(index) {
        if (!currentUser) return showNotification("Vui lòng đăng nhập!", "error");
        if (isAppLocked) return showNotification("Vui lòng mở khóa ứng dụng!", "error");
        deleteIndex = index;
        const deleteNameEl = document.getElementById('deleteName');
        if (deleteNameEl) deleteNameEl.textContent = accounts[index].name;
        openModal('modalDelete');
    }
    
    // 13. Fix nút Đóng Xóa
    const btnCancelDelete = document.getElementById('btnCancelDelete');
    if (btnCancelDelete) {
        btnCancelDelete.onclick = null;
        btnCancelDelete.addEventListener('click', () => closeModal('modalDelete'));
    }

    // 14. Fix nút Xác nhận Xóa
    const btnConfirmDelete = document.getElementById('btnConfirmDelete');
    if (btnConfirmDelete) {
        btnConfirmDelete.onclick = null;
        btnConfirmDelete.addEventListener('click', (e) => {
            e.preventDefault();
            if (deleteIndex > -1) {
                accounts.splice(deleteIndex, 1); 
                saveData(); renderAccounts(); autoSync(); 
                showNotification("Đã xóa tài khoản!", "success");
                closeModal('modalDelete');
                deleteIndex = -1;
            }
        });
    }
});
