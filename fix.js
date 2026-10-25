// ==========================================
// FILE FIX.JS - VÁ LỖI NÚT BẤM TOÀN DIỆN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🛠️ Đang chạy Fix.js để đảm bảo các nút hoạt động...");

    const openModal = (id) => {
        const modal = document.getElementById(id);
        const content = document.getElementById(id + 'Content'); // Sửa lại cách lấy ID content
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

    // 1. Nút Thêm
    document.getElementById('btnAdd')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (!currentUser) return showNotification("Vui lòng đăng nhập!", "error");
        if (isAppLocked) return showNotification("Vui lòng mở khóa ứng dụng!", "error");
        openModal('modalAdd');
    });

    document.getElementById('btnCancelAdd')?.addEventListener('click', () => closeModal('modalAdd'));
    document.getElementById('btnCloseModal')?.addEventListener('click', () => closeModal('modalAdd'));

    document.getElementById('btnSaveAdd')?.addEventListener('click', async (e) => {
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

    // 2. Nút Profile
    document.getElementById('btnUser')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentUser) openModal('modalProfile');
        else window.location.href = "/login";
    });
    document.getElementById('btnCloseProfile')?.addEventListener('click', () => closeModal('modalProfile'));

    // 3. Nút Settings
    document.getElementById('btnSettings')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (!currentUser) return showNotification("Vui lòng đăng nhập!", "error");
        if (isAppLocked) return showNotification("Vui lòng mở khóa ứng dụng!", "error");
        document.getElementById('inputPassword').value = settings.password;
        updateAutoLockUI();
        openModal('modalSettings');
    });
    document.getElementById('btnCloseSettings')?.addEventListener('click', () => closeModal('modalSettings'));

    document.getElementById('btnToggleTheme')?.addEventListener('click', () => {
        settings.theme = settings.theme === 'light' ? 'dark' : 'light';
        applyTheme(settings.theme);
    });

    document.getElementById('btnToggleAutoLock')?.addEventListener('click', () => {
        if (!settings.password) {
            showNotification("Vui lòng nhập mật khẩu bên dưới trước!", "error");
            document.getElementById('inputPassword').focus();
            return;
        }
        settings.autoLock = !settings.autoLock;
        updateAutoLockUI();
    });

    document.getElementById('btnSaveSettings')?.addEventListener('click', () => {
        settings.password = document.getElementById('inputPassword').value.trim();
        if (!settings.password) { settings.autoLock = false; updateAutoLockUI(); }
        saveSettings(); autoSync();
        closeModal('modalSettings');
        showNotification("Đã lưu cài đặt!", "success");
    });

    // 4. Nút Logout
    document.getElementById('btnLogout')?.addEventListener('click', () => openModal('modalLogout'));
    document.getElementById('btnCancelLogout')?.addEventListener('click', () => closeModal('modalLogout'));
    document.getElementById('btnConfirmLogout')?.addEventListener('click', async () => {
        await db.auth.signOut();
        currentUser = null;
        localStorage.removeItem('proton_accounts');
        localStorage.removeItem('proton_settings');
        sessionStorage.clear();
        window.location.href = "/login";
    });

    // ==========================================
    // 5. FIX NÚT XÓA BẰNG EVENT DELEGATION (QUAN TRỌNG)
    // ==========================================
    // Lắng nghe sự kiện click trên toàn bộ thẻ chứa danh sách tài khoản
    document.getElementById('sortableGrid')?.addEventListener('click', (e) => {
        // Kiểm tra xem phần tử được click có phải là nút xóa (hoặc nằm trong nút xóa) không
        const deleteBtn = e.target.closest('.btn-delete');
        if (deleteBtn) {
            e.preventDefault();
            e.stopPropagation(); // Ngăn việc copy mã khi bấm nút xóa

            if (!currentUser) return showNotification("Vui lòng đăng nhập!", "error");
            if (isAppLocked) return showNotification("Vui lòng mở khóa ứng dụng!", "error");

            // Lấy index từ thuộc tính onclick cũ (VD: "openDeleteModal(2)")
            const onclickAttr = deleteBtn.getAttribute('onclick');
            if (onclickAttr) {
                const match = onclickAttr.match(/openDeleteModal\((\d+)\)/);
                if (match && match[1]) {
                    const index = parseInt(match[1]);
                    
                    // Hiển thị Modal xác nhận xóa
                    const deleteNameEl = document.getElementById('deleteName');
                    if (deleteNameEl) deleteNameEl.textContent = accounts[index].name;
                    
                    deleteIndex = index; // Gán index toàn cục
                    openModal('modalDelete');
                }
            }
        }
    });

    // 6. Nút Đóng và Xác nhận Xóa
    document.getElementById('btnCancelDelete')?.addEventListener('click', () => closeModal('modalDelete'));

    document.getElementById('btnConfirmDelete')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (deleteIndex > -1) {
            accounts.splice(deleteIndex, 1); 
            saveData(); renderAccounts(); autoSync(); 
            showNotification("Đã xóa tài khoản!", "success");
            closeModal('modalDelete');
            deleteIndex = -1;
        }
    });
});
