import os
from datetime import datetime
from flask import Flask, jsonify, send_from_directory, make_response

app = Flask(__name__, static_folder='.', static_url_path='')

# Hàm phụ trợ để thêm header chống cache vào mọi file trả về
def no_cache_response(filepath, filename):
    response = make_response(send_from_directory(filepath, filename))
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

# ==========================================
# HEALTH CHECK — Đặt trước catch-all để không bị nuốt
# ==========================================
@app.route('/health', methods=['GET', 'HEAD'])
def health():
    return jsonify({
        "status": "ok",
        "service": "h-secure",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }), 200

# ==========================================
# CÁC ROUTE CỦA BẠN (GIỮ NGUYÊN)
# ==========================================
@app.route('/')
def index():
    return no_cache_response('.', 'index.html')

@app.route('/login')
def login_page():
    return no_cache_response('.', 'login.html')

@app.route('/register')
def register_page():
    return no_cache_response('.', 'register.html')

# ==========================================
# CATCH-ALL — Đặt cuối cùng
# ==========================================
@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(path):
        return no_cache_response('.', path)
    return no_cache_response('.', 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
