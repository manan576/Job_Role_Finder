from database import SessionLocal
from models import Job

db = SessionLocal()

# Check if jobs exist
existing_jobs = db.query(Job).count()

if existing_jobs == 0:
    jobs = [
        Job(company="Google", title="Software Engineering Intern, Summer 2026", url="https://careers.google.com/jobs/results/123", status="pending"),
        Job(company="Apple", title="Machine Learning Engineer (0-1 Yrs)", url="https://jobs.apple.com/en-us/details/456", status="pending"),
        Job(company="Stripe", title="Frontend Developer, New Grad", url="https://stripe.com/jobs/789", status="pending")
    ]
    db.bulk_save_objects(jobs)
    db.commit()
    print("Seeded 3 fake jobs!")
else:
    print("Database already has jobs, no need to seed.")
db.close()
