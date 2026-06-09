import json
from research_agent import PROMPT_STRING, TARGET_SITES
from database import SessionLocal
from models import SystemConfig

db = SessionLocal()
config = db.query(SystemConfig).filter(SystemConfig.id == 1).first()
if config:
    config.prompt_text = PROMPT_STRING
    config.target_sites = json.dumps(TARGET_SITES)
else:
    config = SystemConfig(id=1, prompt_text=PROMPT_STRING, target_sites=json.dumps(TARGET_SITES))
    db.add(config)
db.commit()
print("Seeded successfully!")
