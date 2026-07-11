import os
import sys
import time
import subprocess
import socket
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
    try:
        with socket.socket(socket.AF_INET6, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            if s.connect_ex(('::1', port)) == 0:
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

def main():
    base_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
    if getattr(sys, 'frozen', False):
        base_dir = os.path.dirname(sys.executable)

    # Fallback to the hardcoded project directory if package.json is missing (e.g. when run from Desktop)
    project_dir = "c:\\Users\\cykab\\Downloads\\cinemax"
    if not os.path.exists(os.path.join(base_dir, "package.json")) and os.path.exists(project_dir):
        base_dir = project_dir

    # Free up port 3000, 3001, and 3232 (CinePro)
    kill_ports([3000, 3001, 3232])

    # Start Vite and API servers silently
    npm_cmd = 'npm.cmd' if os.name == 'nt' else 'npm'
    
    dev_process = subprocess.Popen(
        [npm_cmd, 'run', 'dev'],
        cwd=base_dir,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    )
    
    api_process = subprocess.Popen(
        [npm_cmd, 'run', 'api'],
        cwd=base_dir,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    )

    # Start CinePro Core local server silently if it exists
    cinepro_process = None
    cinepro_dir = os.path.join(base_dir, 'cinepro-core')
    if os.path.exists(cinepro_dir):
        cinepro_process = subprocess.Popen(
            [npm_cmd, 'run', 'dev'],
            cwd=cinepro_dir,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )

    # Wait for servers to wake up
    retries = 20
    while retries > 0:
        ports_ready = is_port_open(3000) and is_port_open(3001)
        if cinepro_process:
            ports_ready = ports_ready and is_port_open(3232)
        if ports_ready:
            break
        time.sleep(0.5)
        retries -= 1

    # Open app window
    window = webview.create_window(
        title='Cinemax Miner',
        url='http://localhost:3000/?tab=scraper',
        width=1366,
        height=768,
        min_size=(1024, 768)
    )
    
    webview.start()

    # Clean up when window closes
    try:
        dev_process.terminate()
        api_process.terminate()
        if cinepro_process:
            cinepro_process.terminate()
    except Exception:
        pass

    kill_ports([3000, 3001, 3232])

if __name__ == '__main__':
    main()
