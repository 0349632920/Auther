// ==========================================
// FILE FIX.JS - VÁ LỖI TOÀN DIỆN (BẢN CẬP NHẬT)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🛠️ Fix.js đang chạy...");

    // Hàm đóng modal
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

    // Hàm mở modal
    const openModal = (id) => {
        const modal = document.getElementById(id);
        const content = document.getElementById(id + 'Content');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            if (content) setTimeout(() => { content.style.transform = 'scale(1)'; }, 50);
        }
    };

    // ==========================================
    // XỬ LÝ NÚT XÓA (EVENT DELEGATION)
    // ==========================================
    const grid = document.getElementById('sortableGrid');
    if (grid) {
        grid.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.btn-delete');
            if (deleteBtn) {
                e.preventDefault();
                e.stopPropagation();

                if (!currentUser) return showNotification("Vui lòng đăng nhập!", "error");
                if (isAppLocked) return showNotification("Vui lòng mở khóa ứng dụng!", "error");

                // Lấy index từ thuộc tính onclick cũ
                const onclickAttr = deleteBtn.getAttribute('onclick');
                if (onclickAttr) {
                    const match = onclickAttr.match(/openDeleteModal\((\d+)\)/);
                    if (match && match[1]) {
                        const index = parseInt(match[1]);
                        
                        // Cập nhật tên hiển thị trong modal
                        const deleteNameEl = document.getElementById('deleteName');
                        if (deleteNameEl) deleteNameEl.textContent = accounts[index].name;
                        
                        // Lưu index vào biến toàn cục
                        window.deleteIndex = index; 
                        
                        // Mở modal
                        openModal('modalDelete');
                    }
                }
            }
        });
    }

    // ==========================================
    // XỬ LÝ NÚT XÁC NHẬN XÓA (QUAN TRỌNG)
    // ==========================================
    const btnConfirmDelete = document.getElementById('btnConfirmDelete');
    if (btnConfirmDelete) {
        // Xóa tất cả sự kiện cũ để tránh xung đột
        btnConfirmDelete.replaceWith(btnConfirmDelete.cloneNode(true));
        
        // Lấy lại thẻ mới sau khi clone
        const newBtnConfirmDelete = document.getElementById('btnConfirmDelete');
        
        newBtnConfirmDelete.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (window.deleteIndex !== undefined && window.deleteIndex > -1) {
                // Xóa tài khoản khỏi mảng
                accounts.splice(window.deleteIndex, 1);
                
                // Lưu dữ liệu và vẽ lại giao diện
                saveData();
                renderAccounts();
                autoSync();

                showNotification("Đã xóa tài khoản!", "success");
                
                // Đóng modal
                closeModal('modalDelete');
                
                // Reset biến index
                window.deleteIndex = -1;
            }
        });
    }

    // ==========================================
    // XỬ LÝ NÚT HỦY XÓA
    // ==========================================
    const btnCancelDelete = document.getElementById('btnCancelDelete');
    if (btnCancelDelete) {
        btnCancelDelete.replaceWith(btnCancelDelete.cloneNode(true));
        const newBtnCancelDelete = document.getElementById('btnCancelDelete');
        
        newBtnCancelDelete.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeModal('modalDelete');
            window.deleteIndex = -1;
        });
    }
});
