import os
import asyncio
import re
from dotenv import load_dotenv
from playwright.async_api import async_playwright
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.rate_limiters import InMemoryRateLimiter
from langchain_core.prompts import PromptTemplate

# SQLAlchemy Imports
from database import SessionLocal, engine, Base
from models import Run, Job
from sqlalchemy.exc import IntegrityError

# Load environment variables
load_dotenv()

# Initialize DB tables (SQLAlchemy handles IF NOT EXISTS)
Base.metadata.create_all(bind=engine)

# --- CONFIGURATION ---
TARGET_SITES = [
    {
        "company": "Google",
        "url": "https://www.google.com/about/careers/applications/jobs/results/?q=%22Engineering%22%20OR%20%22Technology%22%20OR%20%22Data%22%20OR%20%22Machine%20Learning%22%20OR%20%22Infrastructure%22%20OR%20%22Internship%22&location=India"
    },
    {
        "company": "Apple",
        "url": "https://jobs.apple.com/en-in/search?search=Engineering%20Machine%20Learning%20Infrastructure%20Internship%20India"
    },
    {
        "company": "Amazon",
        "url": "https://www.amazon.jobs/en/search?base_query=Engineering+OR+Technology+OR+Data+OR+Machine+Learning+OR+Infrastructure+OR+Internship&loc_query=India"
    },
    {
        "company": "Salesforce",
        "url": "https://careers.salesforce.com/en/jobs/?search=Engineering+OR+Technology+OR+Data+OR+Machine+Learning+OR+Infrastructure+OR+Internship&country=India"
    },
    {
        "company": "Microsoft",
        "url": "https://jobs.careers.microsoft.com/global/en/search?q=Engineering%20OR%20Technology%20OR%20Data%20OR%20Machine%20Learning%20OR%20Infrastructure%20OR%20Internship&l=en_us&loc=India"
    }
]

def parse_jobs(content: str, company: str, run_id: int):
    """Parse the LLM response to extract jobs and insert into DB via SQLAlchemy."""
    pattern = re.compile(r"^-\s+(.*?)\s+-\s+(https?://[^\s]+)", re.MULTILINE)
    matches = pattern.findall(content)
    
    if not matches:
        print(f"No jobs matched the regex for {company}.")
        return

    db = SessionLocal()
    count = 0
    
    for title, url in matches:
        url = url.strip("[]()")
        job = Job(company=company, title=title, url=url, run_id=run_id)
        db.add(job)
        try:
            db.commit()
            count += 1
        except IntegrityError:
            # Job URL already exists
            db.rollback()
            
    db.close()
    print(f"Inserted {count} new jobs for {company} into the database.")

async def run_scraper():
    # Record the start of a run
    db = SessionLocal()
    new_run = Run(status="RUNNING")
    db.add(new_run)
    db.commit()
    db.refresh(new_run)
    run_id = new_run.id
    db.close()

    rate_limiter = InMemoryRateLimiter(
        requests_per_second=0.05, 
        check_every_n_seconds=1.0,
        max_bucket_size=1
    )

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        api_key=os.environ.get("GEMINI_API_KEY"),
        rate_limiter=rate_limiter,
        temperature=0.0
    )

    prompt_template = PromptTemplate.from_template(
        """You are an expert technical recruiter and a strict gatekeeper extracting job information from webpage text.
        
        Your task is to extract ONLY roles that strictly meet ALL the following MUST INCLUDE criteria, while strictly filtering out ANY roles that meet the MUST REJECT criteria.
        
        MUST INCLUDE:
        1. The job or internship MUST be based in India.
        2. The job or internship MUST be tech-related (e.g., Software Engineering, AI/ML, Fleet Engineering, Data Analyst, Infrastructure Engineering, etc.).
        3. The target audience MUST strictly be 'Freshers' (Bachelors degree in Computer Science or related, 0 to 1 year of experience, no experience, or Internship).
        
        MUST REJECT:
        Explicitly ignore and reject any job posting that mentions requiring ANY of the following:
        - A 'PhD' or 'Master's Degree'
        - 'Senior', 'Lead', 'Manager', 'Staff', or 'Principal' in the title
        - '2+ years of experience' or more
        
        Here is the raw text and link data scraped from the careers page:
        {page_text}
        
        Please return the job titles and their direct application URLs for ONLY the matching roles. Format your response clearly as a list:
        - [Job Title] - [URL]
        
        If you do not find ANY roles that perfectly match the criteria on this page, simply output: "No suitable entry-level tech roles found for India on this page."
        Do not output any JSON or formatting other than the list. Do not include any roles that were rejected.
        """
    )

    chain = prompt_template | llm

    async def extract_jobs(page, company_name, url):
        print(f"Navigating to {company_name} Careers...")
        await page.goto(url)
        try:
            await page.wait_for_load_state("networkidle", timeout=15000)
        except:
            pass
        await asyncio.sleep(5) 
        
        text = await page.evaluate("document.body.innerText")
        links = await page.evaluate('''() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            return anchors.map(a => a.innerText.trim() + ' : ' + a.href).filter(t => t.length > 5);
        }''')
        
        combined_text = text[:50000] + "\n\nLinks found on page:\n" + "\n".join(links)
        print(f"Extracting data with Gemini for {company_name}...")
        result = await chain.ainvoke({"page_text": combined_text})
        
        parse_jobs(result.content, company_name, run_id)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        for site in TARGET_SITES:
            try:
                await extract_jobs(page, site["company"], site["url"])
            except Exception as e:
                print(f"Failed to scrape {site['company']}: {e}")
            
            print("Waiting 60 seconds to respect API rate limits...")
            await asyncio.sleep(60)
            
        await browser.close()
        
    # Mark run as completed
    db = SessionLocal()
    current_run = db.query(Run).filter(Run.id == run_id).first()
    if current_run:
        current_run.status = "COMPLETED"
        db.commit()
    db.close()
    
    print("Scraping completed!")

if __name__ == "__main__":
    asyncio.run(run_scraper())
