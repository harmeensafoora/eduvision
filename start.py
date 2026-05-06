"""
EduVision startup script — launches the backend API and a static frontend server.

Usage:
  python start.py                      # backend :8000, frontend :8080
  python start.py --port 9000          # backend :9000, frontend :8080
  python start.py --frontend-port 3000 # backend :8000, frontend :3000
  python start.py --no-reload          # disable uvicorn auto-reload
  python start.py --no-frontend        # backend only
"""
import argparse
import subprocess
import sys
import threading
from pathlib import Path

parser = argparse.ArgumentParser(description="Start EduVision")
parser.add_argument("--port", type=int, default=8000)
parser.add_argument("--host", default="0.0.0.0")
parser.add_argument("--frontend-port", type=int, default=8080)
parser.add_argument("--no-reload", action="store_true")
parser.add_argument("--no-frontend", action="store_true")
args = parser.parse_args()

reload_flag = [] if args.no_reload else ["--reload"]

backend_cmd = [
    sys.executable, "-m", "uvicorn",
    "backend.main:app",
    "--host", args.host,
    "--port", str(args.port),
    *reload_flag,
]

frontend_dir = Path(__file__).parent / "frontend"

def run_frontend():
    subprocess.run(
        [sys.executable, "-m", "http.server", str(args.frontend_port),
         "--directory", str(frontend_dir)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

print(f"Backend API:  http://localhost:{args.port}")
print(f"Swagger UI:   http://localhost:{args.port}/docs")
if not args.no_frontend:
    print(f"Frontend:     http://localhost:{args.frontend_port}/index.html")
    t = threading.Thread(target=run_frontend, daemon=True)
    t.start()
else:
    print("Frontend:     (not started)")

try:
    subprocess.run(backend_cmd)
except KeyboardInterrupt:
    pass
