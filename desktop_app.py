import os
import sys
import time
import subprocess
import socket
import threading
from http.server import SimpleHTTPRequestHandler, HTTPServer
import webview

def is_port_open(port):
    for host in ('127.0.0.1', 'localhost'):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(0.5)
                if s.connect_ex((host, port)) == 0:
                    return True
        except Exception:
            pass
    return False

def kill_ports(ports):
    for port in ports:
        try:
            cmd = 'netstat -aon | findstr "LISTENING"'
            output = subprocess.check_output(cmd, shell=True).decode('utf-8')
            for line in output.splitlines():
                parts = line.strip().split()
                if len(parts) >= 5:
                    local_addr = parts[1]
                    if local_addr.endswith(f':{port}'):
                        pid = parts[-1]
                        subprocess.run(f'taskkill /f /pid {pid}', shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass

class SPAHandler(SimpleHTTPRequestHandler):
    """
    HTTP handler to serve React SPA (single page app) correctly.
    If a file is not found, fallback to index.html for React routing.
    """
    def do_GET(self):
        # Prevent caching of React assets during local dev/run
        self.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        self.headers['Pragma'] = 'no-cache'
        self.headers['Expires'] = '0'

        path = self.translate_path(self.path)
        if not os.path.exists(path) or os.path.isdir(path):
            self.path = '/index.html'
        return super().do_GET()

def start_local_server(directory, port):
    os.chdir(directory)
    server = HTTPServer(('127.0.0.1', port), SPAHandler)
    server.serve_forever()

def main():
    base_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
    if getattr(sys, 'frozen', False):
        base_dir = os.path.dirname(sys.executable)

    # Fallback to hardcoded project directory if package.json is missing
    project_dir = "c:\\Users\\cykab\\Downloads\\cinemax"
    if not os.path.exists(os.path.join(base_dir, "package.json")) and os.path.exists(project_dir):
        base_dir = project_dir

    dist_dir = os.path.join(base_dir, 'dist')
    if not os.path.exists(dist_dir):
        print(f"[Error] Khong tim thay thu muc build 'dist' tai: {dist_dir}")
        print("Vui long chay 'npm run build' truoc khi bat app.")
        sys.exit(1)

    # Free up port 3000 and 3001
    kill_ports([3000, 3001])

    # 1. Start Python thread to serve React build files (dist/) on port 3000
    server_thread = threading.Thread(target=start_local_server, args=(dist_dir, 3000), daemon=True)
    server_thread.start()
    print("[Desktop App] Da khoi dong Python HTTP Server phuc vu UI tai port 3000")

    # 2. Start local Node.js API Scraper Server on port 3001
    node_cmd = 'node'
    api_script = os.path.join(base_dir, 'scripts', 'dev-api.cjs')
    
    api_process = subprocess.Popen(
        [node_cmd, api_script],
        cwd=base_dir,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    )
    print("[Desktop App] Da khoi dong API Scraper Server tai port 3001")

    # Wait for both servers to be ready
    retries = 20
    while retries > 0:
        if is_port_open(3000) and is_port_open(3001):
            break
        time.sleep(0.5)
        retries -= 1

    # 3. Open dedicated Scraper Dashboard UI window
    window = webview.create_window(
        title='Cinemax Scraper Controller',
        url='http://localhost:3000/?tab=scraper',
        width=1280,
        height=720,
        min_size=(1024, 700)
    )
    
    webview.start()

    # Clean up background API server when GUI closes
    try:
        api_process.terminate()
    except Exception:
        pass
    kill_ports([3000, 3001])

if __name__ == '__main__':
    main()
