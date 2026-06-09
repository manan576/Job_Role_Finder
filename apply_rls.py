import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("DATABASE_URL")
if not db_url:
    print("No DATABASE_URL found")
    exit(1)

engine = create_engine(db_url)

with engine.connect() as conn:
    # Enable RLS
    conn.execute(text("ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;"))
    conn.execute(text("ALTER TABLE runs ENABLE ROW LEVEL SECURITY;"))
    
    # Drop existing policies if any to prevent errors
    # Drop existing policies if any to prevent errors
    try:
        conn.execute(text("DROP POLICY IF EXISTS \"Allow authenticated access\" ON jobs;"))
        conn.execute(text("DROP POLICY IF EXISTS \"Allow authenticated access\" ON runs;"))
        conn.execute(text("DROP POLICY IF EXISTS \"Allow public read\" ON jobs;"))
        conn.execute(text("DROP POLICY IF EXISTS \"Allow public read\" ON runs;"))
        conn.execute(text("DROP POLICY IF EXISTS \"Allow authenticated write\" ON jobs;"))
        conn.execute(text("DROP POLICY IF EXISTS \"Allow authenticated write\" ON runs;"))
        conn.execute(text("DROP POLICY IF EXISTS \"Allow auth insert\" ON jobs;"))
        conn.execute(text("DROP POLICY IF EXISTS \"Allow auth update\" ON jobs;"))
        conn.execute(text("DROP POLICY IF EXISTS \"Allow auth delete\" ON jobs;"))
        conn.execute(text("DROP POLICY IF EXISTS \"Allow auth insert\" ON runs;"))
        conn.execute(text("DROP POLICY IF EXISTS \"Allow auth update\" ON runs;"))
        conn.execute(text("DROP POLICY IF EXISTS \"Allow auth delete\" ON runs;"))
    except:
        pass

    # Create policies for Public Read
    conn.execute(text("CREATE POLICY \"Allow public read\" ON jobs FOR SELECT USING (true);"))
    conn.execute(text("CREATE POLICY \"Allow public read\" ON runs FOR SELECT USING (true);"))

    # Create policies for Authenticated Write (INSERT, UPDATE, DELETE)
    conn.execute(text("CREATE POLICY \"Allow auth insert\" ON jobs FOR INSERT TO authenticated WITH CHECK (true);"))
    conn.execute(text("CREATE POLICY \"Allow auth update\" ON jobs FOR UPDATE TO authenticated USING (true);"))
    conn.execute(text("CREATE POLICY \"Allow auth delete\" ON jobs FOR DELETE TO authenticated USING (true);"))
    
    conn.execute(text("CREATE POLICY \"Allow auth insert\" ON runs FOR INSERT TO authenticated WITH CHECK (true);"))
    conn.execute(text("CREATE POLICY \"Allow auth update\" ON runs FOR UPDATE TO authenticated USING (true);"))
    conn.execute(text("CREATE POLICY \"Allow auth delete\" ON runs FOR DELETE TO authenticated USING (true);"))

    conn.commit()
    print("Row Level Security and Policies applied successfully!")
