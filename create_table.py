import os
from sqlalchemy import create_engine
from dotenv import load_dotenv
from models import SystemConfig

load_dotenv()
db_url = os.environ.get("DATABASE_URL")
if not db_url:
    print("No DATABASE_URL found")
    exit(1)

engine = create_engine(db_url)
SystemConfig.__table__.create(engine, checkfirst=True)
print("SystemConfig table created successfully!")
