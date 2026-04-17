"""
EduVision backend startup script.

Usage:
  python start.py           # default: port 8000, auto-reload
  python start.py --port 9000
  python start.py --no-reload
"""
import argparse
import subprocess
import sys

parser = argparse.ArgumentParser(description="Start the EduVision backend")
parser.add_argument("--port", type=int, default=8000)
parser.add_argument("--host", default="0.0.0.0")
parser.add_argument("--no-reload", action="store_true")
args = parser.parse_args()

reload_flag = [] if args.no_reload else ["--reload"]

cmd = [
    sys.executable, "-m", "uvicorn",
    "backend.main:app",
    "--host", args.host,
    "--port", str(args.port),
    *reload_flag,
]

print(f"Starting EduVision API on http://localhost:{args.port}")
print(f"Swagger UI: http://localhost:{args.port}/docs")
subprocess.run(cmd)
