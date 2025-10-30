from flask import Flask, jsonify
import subprocess
import threading
import os
import sys
from pathlib import Path

app = Flask(__name__)

def run_batch_async():
    # Fire-and-forget: run the batch script with the current Python interpreter
    repo_root = Path(__file__).resolve().parents[1]
    script_path =  "batch_matching.py"
    subprocess.Popen([sys.executable, str(script_path)])

@app.post("/run")
def run_batch():
    threading.Thread(target=run_batch_async, daemon=True).start()
    return jsonify({"status": "started"}), 202

@app.get("/healthz")
def health():
    return jsonify({"ok": True}), 200

# CORS for browser-triggered requests
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = '*'
    return response

@app.route('/run', methods=['OPTIONS'])
def run_options():
    return ('', 204)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)


