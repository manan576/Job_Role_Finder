# Nexus: Autonomous Job Opportunity Extraction Pipeline

Nexus is an enterprise-grade, autonomous pipeline designed to semantically extract, filter, and track job opportunities from dynamic company career portals. It leverages Large Language Models (LLMs) to bypass brittle traditional web scraping, and presents the data on a stunning, premium React dashboard.

---

## 🏗️ Full Architecture Pipeline

1. **Trigger:** A GitHub Action CRON job fires automatically at 12:00 PM UTC daily.
2. **Orchestration:** The GitHub runner executes the Python orchestrator (`research_agent.py`).
3. **Data Fetching:** SQLAlchemy queries the Supabase PostgreSQL database to fetch the dynamic `SystemConfig` (which dictates Target URLs and the LLM Extraction Prompt).
4. **Navigation:** Playwright spins up a headless Chromium browser to execute JavaScript and fully render dynamic Single Page Applications (SPAs).
5. **DOM Extraction:** The Python script extracts the rendered text and links from the DOM.
6. **Semantic Parsing:** The raw DOM text is passed through a **LangChain** pipeline to Google Gemini 2.5 Flash. The LLM acts as a semantic parser, extracting jobs based on strict natural language criteria (e.g., "entry level tech roles in India, strictly NO 2+ years experience").
7. **Persistence:** Extracted opportunities and system telemetry (Run Status) are bulk-inserted into PostgreSQL via SQLAlchemy.
8. **Alerting (Slack):** If any new jobs are inserted, the orchestrator formats a markdown payload and fires a Slack Webhook, instantly alerting the user on their devices.
9. **Security:** Supabase Row Level Security (RLS) ensures that the public can only read data, while mutations (Approve/Dismiss) require Admin JWT Authentication.
10. **Presentation:** A Vercel-hosted React application dynamically renders the data using Framer Motion and TailwindCSS for a premium, interactive aesthetic.

---

## 📂 Codebase Structure

```text
Job Role Finder/
├── .github/workflows/
│   └── scraper.yml        # The CRON job that triggers the python agent daily
├── frontend/              # React SPA (Vite + Tailwind + Framer Motion)
│   ├── src/
│   │   ├── App.jsx        # The entire premium UI, layout, and Supabase listeners
│   │   ├── index.css      # Custom Tailwind styling & scrollbars
│   │   └── supabase.js    # Supabase client initialization
│   ├── tailwind.config.js # Theming and layout configurations
│   └── package.json       # Node dependencies
├── database.py            # SQLAlchemy engine and session management
├── models.py              # PostgreSQL schema definitions (Job, Run, SystemConfig)
├── research_agent.py      # The CORE backend brain: Playwright + LangChain + Gemini
├── apply_rls.py           # Script to enforce Supabase Row Level Security
├── create_table.py        # Script to bootstrap the database schema
├── seed_fake_jobs.py      # Utility to populate dummy data for UI testing
└── requirements.txt       # Python dependencies
```

---

## 🛠️ Tech Stack & Role of Each

- **Python (SQLAlchemy):** The core orchestrator language for backend scripting and ORM database management.
- **LangChain:** Used in `research_agent.py` to seamlessly chain `PromptTemplates`, `ChatGoogleGenerativeAI`, and an `InMemoryRateLimiter` together.
- **Playwright (Async):** Handles complex browser automation, bypassing the limitations of simple HTTP requests to render dynamic React/Vue job boards.
- **Google Gemini 2.5 Flash:** The AI agent. Replaces traditional DOM parsing by visually/semantically understanding the webpage structure.
- **Slack Webhooks:** Handles real-time push notifications so the user never has to manually check the dashboard.
- **Supabase (PostgreSQL):** The database layer. Chosen for strict relational schemas, built-in Authentication, and declarative security (RLS).
- **GitHub Actions:** Serverless compute for the daily CRON job.
- **React + Vite:** The frontend framework chosen for rapid development and high-performance client-side routing.
- **TailwindCSS + Framer Motion:** Used to create an ultra-premium, interactive, and responsive UI.
- **Vercel:** Edge-network hosting for the React frontend.

---

## 🧠 Architecture Choices: Why We Chose What We Chose

### 1. The Major Decision: Autonomous LLM Browsing vs. Playwright DOM Extraction
**The Problem:** Dynamic job boards (like Workday) require clicking "Load More" buttons, typing into search bars, and navigating complex UI flows. 
- **Alternative 1 (Rejected):** Use an Autonomous AI Agent framework (like `browser-use`) where the LLM is given control of the mouse and keyboard to click around the website until it finds jobs. **Why we rejected it:** It is incredibly slow, highly token-expensive, non-deterministic, and frequently gets stuck in loops or blocked by captchas. 
- **Alternative 2 (Chosen):** Use **Playwright** to strictly navigate to pre-configured, highly specific Search URLs (e.g., URLs that already have "India" and "Software Engineering" applied as URL parameters). We then let Playwright wait for the network to idle, extract the raw `innerText` and `<a>` tags, and feed *that* to the LLM. 
- **Why it won:** It is 100x faster, perfectly deterministic, extremely cheap on tokens, and avoids complex AI hallucination loops.

### 2. Why use LangChain?
While we could have used the raw Google GenAI SDK, **LangChain** was chosen for its built-in robustness. Specifically:
- **`InMemoryRateLimiter`**: Easily prevents us from hitting Gemini's strict rate limits (Requests Per Minute) by pacing out the requests dynamically.
- **LCEL (LangChain Expression Language)**: Allowed us to elegantly pipe the `PromptTemplate` directly into the `ChatGoogleGenerativeAI` model using the `|` operator, keeping the core scraping loop clean.

### 3. LLM Semantic Parsing vs. Traditional Scraping (BeautifulSoup/Scrapy)
- **Why chosen:** Job boards constantly update their UI, changing HTML class names and div structures. Traditional regex/XPath scrapers break weekly. LLMs "read" the page like a human, looking for the *meaning* of the text, making the pipeline virtually immune to UI changes.
- **Alternatives rejected:** BeautifulSoup, Scrapy, Selenium.

### 4. GitHub Actions vs. AWS Lambda / Heroku
- **Why chosen:** Playwright requires heavy, OS-level browser binaries to run. AWS Lambda has strict size limits (250MB) and deploying headless browsers requires custom Docker images. GitHub Actions provides Ubuntu runners with massive compute for free, making Playwright setup effortless.
- **Alternatives rejected:** AWS Lambda, Heroku, DigitalOcean Droplets (too expensive to run 24/7 for a daily 5-minute task).

### 5. Supabase (PostgreSQL) vs. Firebase / MongoDB
- **Why chosen:** We have relational data: A `SystemConfig` dictates the `Runs`, and `Runs` extract `Jobs`. SQL ensures data integrity. Furthermore, Supabase's Row Level Security (RLS) allowed us to implement Admin-only writes without needing to build a custom backend Node.js server.
- **Alternatives rejected:** Firebase (NoSQL is bad for complex filtering), Custom Node.js/Express backend (unnecessary boilerplate).

### 6. LLM Model Selection (Gemini 2.5 Flash)
- **Why chosen:** When passing raw DOM text (which contains massive amounts of inline CSS, links, and text), you need a model with a **massive context window**. Gemini 2.5 Flash provides a 1M+ token context window, parses it natively at incredibly fast speeds ("Flash"), and is extremely cost-effective for large-scale ingestion.
- **Alternatives rejected:** 
  - **GPT-4o:** Excellent reasoning, but significantly more expensive to run daily on massive HTML strings.
  - **Open-source (Llama 3 70B):** Would require setting up dedicated GPU compute nodes (e.g., RunPod, AWS EC2), defeating the serverless, zero-maintenance goal of the project.

---

## 📊 Observability & Monitoring

A core tenet of this pipeline is that it must run autonomously without silent failures. We built strict observability into the architecture:

1. **System Telemetry (Heartbeats):** Every time the GitHub Action fires, it creates a new record in the PostgreSQL `runs` table with a `RUNNING` status and a timestamp. When the extraction completes, it updates to `COMPLETED`. 
2. **Dashboard Integration:** The React frontend subscribes to this `runs` table. A pulsing indicator in the bottom-left of the sidebar immediately visually tells the user if the backend is currently actively extracting data or if it is idle, along with the timestamp of the last successful sync.
3. **Push Alerting:** We do not rely on the user manually checking the dashboard. The Python orchestrator natively integrates with a **Slack Incoming Webhook**, pushing formatted Markdown summaries of newly discovered jobs directly to the user's mobile device the second they are found.
4. **Future Tracing Integration:** To scale observability further, we plan to integrate **LangSmith** to monitor LLM token consumption/costs per run, and **Sentry** to capture stack traces if Playwright fails to load a specific DOM.

---

## 🚀 Scaling the System (System Design Interview Prep)

If an interviewer asks: *"How would you scale this to scrape 10,000 companies every hour?"*

### Problem 1: Synchronous Compute Bottlenecks
Right now, the Python script iterates through companies one by one. 10,000 companies would take days.
- **How to fix:** Move to an asynchronous distributed architecture. 
- **Services to use:** Use a Message Broker like **Apache Kafka** or **RabbitMQ / AWS SQS**. The CRON job dumps 10,000 URLs into the queue. A fleet of horizontal **Celery Workers** (hosted on AWS ECS or Kubernetes) consume the URLs and run Playwright in parallel.

### Problem 2: IP Bans & Bot Detection
At scale, companies utilizing Cloudflare or Datadome will instantly ban the GitHub Actions IP address.
- **How to fix:** Integrate proxy rotation.
- **Services to use:** Use residential rotating proxy networks like **BrightData** or **Oxylabs**. Inject these proxy configs into the Playwright browser context so every request looks like a real human from a different location.

### Problem 3: LLM Rate Limits & Cost
Calling Gemini for 10,000 massive DOM trees will hit API limits and cost thousands of dollars.
- **How to fix:** Implement a pre-filtering heuristic layer.
- **Services to use:** Before sending the HTML to the LLM, use a fast, cheap regex/NLP script to check if the page even contains keywords like "Software", "Engineer", or "India". If not, drop the page. Only send highly probable pages to the expensive LLM.

### Problem 4: Frontend Database Load
If the database has 500,000 jobs, the React app will crash trying to fetch them all.
- **How to fix:** Implement Server-Side Pagination and Caching.
- **Services to use:** Add **Redis** to cache the top 100 most recent jobs. Update the Supabase query to use cursor-based pagination so the frontend only loads 20 jobs at a time.

---

## 💡 Important Interview Questions & Answers

**Q: "Why did you put the API Keys in the frontend `.env` but use GitHub Secrets for the backend?"**
*A: "The frontend `.env` only holds the Supabase 'Anon Public Key', which is perfectly safe to expose to the browser because the database is secured via Row Level Security (RLS) policies. The backend requires the Gemini API Key, which is highly sensitive and must never touch the frontend, hence it resides purely in GitHub Secrets."*

**Q: "What happens if a career page is built in React and takes 5 seconds to load its data?"**
*A: "Traditional HTTP scrapers would just capture a blank `<div id="root"></div>`. By using Playwright, a real Chromium browser executes the React JavaScript and waits for the network idle state, ensuring the DOM is fully populated before the LLM reads it."*

**Q: "How do you handle duplicate jobs being extracted day after day?"**
*A: "Currently, the system relies on manual review (Dismiss/Approve). However, to scale, I would create a composite unique constraint in PostgreSQL on `(company, title, url)`. When doing bulk inserts, I would use an `ON CONFLICT DO NOTHING` upsert strategy to seamlessly ignore duplicates."*

---

## 💻 Local Setup & Installation

To run this architecture on your local machine:

### 1. Database Setup
1. Create a free project on [Supabase](https://supabase.com).
2. Get your `Project URL` and `anon public key`.
3. Get your `PostgreSQL Connection String` (URI).

### 2. Backend (Python Orchestrator)
```bash
# Clone the repository
git clone https://github.com/manan576/Job_Role_Finder.git
cd "Job Role Finder"

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium

# Create the required tables & RLS policies
python create_table.py
python apply_rls.py

# Run the agent
python research_agent.py
```

### 3. Frontend (React Dashboard)
```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

---

## 🔐 Environment Variables

You need two `.env` files for this project to work securely.

**Backend: `Job Role Finder/.env`**
```env
DATABASE_URL="postgresql://postgres.[YOUR_PROJECT]:[PASSWORD]@aws-0-region.pooler.supabase.com:6543/postgres"
GEMINI_API_KEY="your_google_ai_studio_key"
SLACK_WEBHOOK_URL="your_slack_incoming_webhook_url"
```

**Frontend: `Job Role Finder/frontend/.env`**
```env
VITE_SUPABASE_URL="https://[YOUR_PROJECT].supabase.co"
VITE_SUPABASE_ANON_KEY="your_anon_public_key"
```

---

## 🔮 Future Roadmap

- **Vector Embeddings:** Implement RAG (Retrieval-Augmented Generation) by converting job descriptions into embeddings (using `text-embedding-004`) and storing them in Supabase `pgvector` to semantically match the user's uploaded resume against the job description.
- **Auto-Applying Agents:** Connect `browser-use` to autonomously fill out the Workday/Greenhouse application forms for "Approved" jobs.
- **Analytics Dashboard:** Add a charts tab to track conversion rates (Pending -> Applied -> Interview -> Offer) using `Recharts`.
