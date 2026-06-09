from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional
import asyncio

import models
from database import engine, get_db
from research_agent import run_scraper

# Create DB tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Job Tracker API")

# Configure CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Schemas for API responses
class JobSchema(BaseModel):
    id: int
    company: str
    title: str
    url: str
    status: str
    applied_date: Optional[datetime] = None

    class Config:
        from_attributes = True

class StatusUpdate(BaseModel):
    status: str

@app.get("/api/jobs", response_model=List[JobSchema])
def get_jobs(db: Session = Depends(get_db)):
    return db.query(models.Job).order_by(models.Job.id.desc()).all()

@app.post("/api/jobs/{job_id}/status")
def update_job_status(job_id: int, status_update: StatusUpdate, db: Session = Depends(get_db)):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    job.status = status_update.status
    if job.status == "applied":
        job.applied_date = datetime.now()
    else:
        job.applied_date = None
        
    db.commit()
    return {"success": True, "status": job.status}

@app.get("/api/status")
def get_status(db: Session = Depends(get_db)):
    last_run = db.query(models.Run).order_by(models.Run.id.desc()).first()
    if last_run:
        return {"status": last_run.status, "timestamp": last_run.timestamp}
    return {"status": "NEVER_RUN", "timestamp": None}

from apscheduler.schedulers.background import BackgroundScheduler
import pytz

def run_scraper_sync():
    """Helper to run async scraper in background task"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(run_scraper())
    finally:
        loop.close()

def scheduled_job():
    # Make sure we don't start multiple scrapers if one is running
    db = next(get_db())
    last_run = db.query(models.Run).order_by(models.Run.id.desc()).first()
    if last_run and last_run.status == "RUNNING":
        return
    run_scraper_sync()

# Start scheduler
scheduler = BackgroundScheduler(timezone=pytz.timezone('Asia/Kolkata'))
# Run every day at 12:00 PM IST
scheduler.add_job(scheduled_job, 'cron', hour=12, minute=0)
scheduler.start()

@app.post("/api/scrape")
def trigger_scrape(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    last_run = db.query(models.Run).order_by(models.Run.id.desc()).first()
    if last_run and last_run.status == "RUNNING":
        raise HTTPException(status_code=400, detail="Scraper is already running")
        
    background_tasks.add_task(run_scraper_sync)
    return {"success": True, "message": "Scraper started"}
