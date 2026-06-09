import os
import sqlite3
import threading
import asyncio
from datetime import datetime
from flask import Flask, render_template, request, jsonify

# Import the scraper function
from research_agent import run_scraper

app = Flask(__name__)
DB_PATH = os.path.join(os.path.dirname(__file__), "jobs.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/jobs")
def get_jobs():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs ORDER BY id DESC")
    jobs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(jobs)

@app.route("/api/jobs/<int:job_id>/status", methods=["POST"])
def update_job_status(job_id):
    data = request.json
    status = data.get("status") # 'applied', 'ignored', 'pending'
    if not status:
        return jsonify({"error": "Status required"}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    applied_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S") if status == "applied" else None
    
    cursor.execute(
        "UPDATE jobs SET status = ?, applied_date = ? WHERE id = ?",
        (status, applied_date, job_id)
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True, "status": status, "applied_date": applied_date})

@app.route("/api/status")
def get_status():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM runs ORDER BY id DESC LIMIT 1")
    last_run = cursor.fetchone()
    conn.close()
    
    if last_run:
        return jsonify(dict(last_run))
    return jsonify({"status": "NEVER_RUN", "timestamp": None})

def background_scrape():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(run_scraper())
    finally:
        loop.close()

@app.route("/api/scrape", methods=["POST"])
def trigger_scrape():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT status FROM runs ORDER BY id DESC LIMIT 1")
    last_run = cursor.fetchone()
    conn.close()
    
    if last_run and last_run['status'] == 'RUNNING':
        return jsonify({"error": "Scraper is already running"}), 400
        
    thread = threading.Thread(target=background_scrape)
    thread.daemon = True
    thread.start()
    
    return jsonify({"success": True, "message": "Scraper started"})

if __name__ == "__main__":
    app.run(debug=True, port=5000)
