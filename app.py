from flask import Flask, request, jsonify, send_from_directory, redirect, Response
import urllib.request
from flask_cors import CORS
import yt_dlp
import mysql.connector
import os
import time

app = Flask(__name__, static_folder='.')
CORS(app)

# ─── DB Config — reads Railway env vars automatically ─────────────────────────
# Railway MySQL plugin injects: MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE
DB_CONFIG = {
    'host':     os.environ.get('MYSQLHOST',     'localhost'),
    'port':     int(os.environ.get('MYSQLPORT', '3306')),
    'user':     os.environ.get('MYSQLUSER',     'root'),
    'password': os.environ.get('MYSQLPASSWORD', '8268'),
    'database': os.environ.get('MYSQLDATABASE', 'birthday_db'),
}

# ─── Static Routes ────────────────────────────────────────────────────────────
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory(app.static_folder, path)

# ─── DB Helper ────────────────────────────────────────────────────────────────
def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

def ensure_tables():
    """Create tables if they don't exist (runs on first request to Railway MySQL)."""
    try:
        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS config (
                id               INT AUTO_INCREMENT PRIMARY KEY,
                photo_path       VARCHAR(255) DEFAULT 'assets/default_photo.png',
                default_song_id  VARCHAR(50)  DEFAULT '1pSPZAGeO3w',
                admin_password   VARCHAR(255) DEFAULT 'love2026'
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS photos (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                path       VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Seed default config row if missing
        cursor.execute("""
            INSERT INTO config (id, photo_path, default_song_id, admin_password)
            VALUES (1, 'assets/default_photo.png', '1pSPZAGeO3w', 'love2026')
            ON DUPLICATE KEY UPDATE id=1
        """)
        conn.commit()
        conn.close()
    except Exception as e:
        print(f'[ensure_tables] Warning: {e}')

# Run table setup once at startup
try:
    ensure_tables()
except Exception as e:
    print(f'[startup] DB not ready yet: {e} — will retry on first request')

# ─── API Routes ───────────────────────────────────────────────────────────────
@app.route('/api/config', methods=['GET'])
def get_config():
    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT photo_path, default_song_id FROM config LIMIT 1")
        config = cursor.fetchone()
        cursor.execute("SELECT id, path FROM photos ORDER BY created_at DESC")
        photos = cursor.fetchall()
        conn.close()
        return jsonify({
            'photo_path':       config['photo_path']      if config else 'assets/default_photo.png',
            'default_song_id':  config['default_song_id'] if config else '1pSPZAGeO3w',
            'photos':           photos
        })
    except Exception as e:
        print(f'[get_config] Error: {e}')
        return jsonify({
            'photo_path':      'assets/default_photo.png',
            'default_song_id': '1pSPZAGeO3w',
            'photos':          []
        })

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data     = request.json
        password = data.get('password', '')
        conn     = get_db_connection()
        cursor   = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT admin_password FROM config WHERE admin_password = %s LIMIT 1",
            (password,)
        )
        admin = cursor.fetchone()
        conn.close()
        if admin:
            return jsonify({'status': 'success'})
        return jsonify({'status': 'error', 'message': 'Invalid password'}), 401
    except Exception as e:
        print(f'[login] Error: {e}')
        return jsonify({'status': 'error', 'message': 'Server error'}), 500

@app.route('/api/upload', methods=['POST'])
def upload_photo():
    try:
        if 'photo' not in request.files:
            files = request.files.getlist('photos')
            if not files:
                return jsonify({'status': 'error', 'message': 'No files'}), 400
        else:
            files = [request.files['photo']]

        # Ensure assets directory exists
        assets_dir = os.path.join(app.static_folder, 'assets')
        os.makedirs(assets_dir, exist_ok=True)

        conn        = get_db_connection()
        cursor      = conn.cursor()
        saved_paths = []

        for file in files:
            if not file.filename:
                continue
            filename  = f'gf_photo_{int(time.time() * 1000)}_{file.filename}'
            save_path = os.path.join(assets_dir, filename)
            file.save(save_path)
            path = f'assets/{filename}'
            cursor.execute("INSERT INTO photos (path) VALUES (%s)", (path,))
            saved_paths.append(path)

        conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'paths': saved_paths})
    except Exception as e:
        print(f'[upload_photo] Error: {e}')
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/photo/<int:photo_id>', methods=['DELETE'])
def delete_photo(photo_id):
    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT path FROM photos WHERE id = %s", (photo_id,))
        photo  = cursor.fetchone()
        if photo:
            file_path = os.path.join(app.static_folder, photo['path'])
            if os.path.exists(file_path):
                os.remove(file_path)
            cursor.execute("DELETE FROM photos WHERE id = %s", (photo_id,))
            conn.commit()
        conn.close()
        return jsonify({'status': 'success'})
    except Exception as e:
        print(f'[delete_photo] Error: {e}')
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/photo/all', methods=['DELETE'])
def delete_all_photos():
    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT path FROM photos")
        photos = cursor.fetchall()
        for photo in photos:
            file_path = os.path.join(app.static_folder, photo['path'])
            if os.path.exists(file_path):
                os.remove(file_path)
        cursor.execute("DELETE FROM photos")
        conn.commit()
        conn.close()
        return jsonify({'status': 'success'})
    except Exception as e:
        print(f'[delete_all_photos] Error: {e}')
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/settings', methods=['POST'])
def update_settings():
    try:
        data    = request.json
        song_id = data.get('song_id', '')
        conn    = get_db_connection()
        cursor  = conn.cursor()
        cursor.execute("UPDATE config SET default_song_id = %s WHERE id = 1", (song_id,))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success'})
    except Exception as e:
        print(f'[update_settings] Error: {e}')
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/stream/<video_id>')
def get_audio_stream(video_id):
    try:
        ydl_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            url = info.get('url')
            if not url:
                return jsonify({'error': 'No URL found'}), 404

            req = urllib.request.Request(url)
            req.add_header('User-Agent', 'Mozilla/5.0')
            response = urllib.request.urlopen(req)

            def generate():
                while True:
                    chunk = response.read(8192)
                    if not chunk:
                        break
                    yield chunk

            headers = {
                'Content-Type': response.headers.get('Content-Type', 'audio/webm'),
                'Accept-Ranges': 'bytes'
            }
            if 'Content-Length' in response.headers:
                headers['Content-Length'] = response.headers['Content-Length']

            return Response(generate(), headers=headers)
            
    except Exception as e:
        print(f'[stream] Error: {e}')
        return jsonify({'error': str(e)}), 500

# ─── Health Check ─────────────────────────────────────────────────────────────
@app.route('/health')
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 30000))
    app.run(host='0.0.0.0', port=port, debug=False)
