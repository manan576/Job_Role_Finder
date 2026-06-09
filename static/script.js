document.addEventListener('DOMContentLoaded', () => {
    // --- Navigation Tabs ---
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const pageTitle = document.getElementById('page-title');

    const tabTitles = {
        'dashboard': 'Dashboard Overview',
        'pending': 'New Opportunities',
        'applied': 'My Applications'
    };

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            navBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));
            
            // Add active class to clicked
            btn.classList.add('active');
            const targetTab = btn.getAttribute('data-tab');
            document.getElementById(`tab-${targetTab}`).classList.add('active');
            pageTitle.textContent = tabTitles[targetTab];
        });
    });

    // --- Data Fetching ---
    function fetchJobs() {
        fetch('/api/jobs')
            .then(res => res.json())
            .then(jobs => {
                renderDashboard(jobs);
                renderPendingJobs(jobs.filter(j => j.status === 'pending'));
                renderAppliedJobs(jobs.filter(j => j.status === 'applied'));
            });
    }

    function fetchStatus() {
        fetch('/api/status')
            .then(res => res.json())
            .then(status => {
                const statusBox = document.querySelector('.system-status');
                const statusText = document.getElementById('scraper-status-text');
                const lastRunText = document.getElementById('last-run-text');

                if (status.status === 'RUNNING') {
                    statusBox.classList.add('running');
                    statusText.textContent = 'Scraper is Running...';
                } else {
                    statusBox.classList.remove('running');
                    statusText.textContent = 'System Idle';
                }

                if (status.timestamp) {
                    const date = new Date(status.timestamp + ' UTC');
                    lastRunText.textContent = `Last run: ${date.toLocaleString()}`;
                }
            });
    }

    // --- Rendering ---
    function renderDashboard(jobs) {
        document.getElementById('stat-total').textContent = jobs.length;
        document.getElementById('stat-pending').textContent = jobs.filter(j => j.status === 'pending').length;
        document.getElementById('stat-applied').textContent = jobs.filter(j => j.status === 'applied').length;
    }

    function renderPendingJobs(jobs) {
        const container = document.getElementById('pending-jobs-container');
        container.innerHTML = '';

        if (jobs.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <i class="fa-solid fa-ghost"></i>
                    <h3>No new opportunities</h3>
                    <p>Trigger the scraper to find more jobs.</p>
                </div>
            `;
            return;
        }

        jobs.forEach(job => {
            const card = document.createElement('div');
            card.className = 'job-card';
            card.innerHTML = `
                <div>
                    <div class="company"><i class="fa-solid fa-building"></i> ${job.company}</div>
                    <h3>${job.title}</h3>
                </div>
                <div>
                    <a href="${job.url}" target="_blank" class="btn-link" style="display:block;"><i class="fa-solid fa-external-link-alt"></i> View Posting</a>
                    <div class="job-actions">
                        <button class="btn-ignore" onclick="updateStatus(${job.id}, 'ignored')">Ignore</button>
                        <button class="btn-apply" onclick="updateStatus(${job.id}, 'applied')">Mark Applied</button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    function renderAppliedJobs(jobs) {
        const container = document.getElementById('applied-jobs-container');
        container.innerHTML = '';

        if (jobs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-folder-open"></i>
                    <h3>No applications yet</h3>
                    <p>Start applying to move jobs here.</p>
                </div>
            `;
            return;
        }

        jobs.forEach(job => {
            const date = new Date(job.applied_date + ' UTC');
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div class="info">
                    <h3>${job.title}</h3>
                    <p>${job.company}</p>
                </div>
                <div class="meta">
                    <span><i class="fa-solid fa-check-circle"></i> Applied</span>
                    <small>${date.toLocaleDateString()}</small>
                </div>
            `;
            container.appendChild(item);
        });
    }

    // --- Actions ---
    window.updateStatus = function(jobId, newStatus) {
        fetch(`/api/jobs/${jobId}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        })
        .then(res => res.json())
        .then(() => fetchJobs());
    };

    document.getElementById('run-scraper-btn').addEventListener('click', () => {
        fetch('/api/scrape', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                } else {
                    fetchStatus();
                }
            });
    });

    // --- Initialization & Polling ---
    fetchJobs();
    fetchStatus();
    setInterval(fetchStatus, 5000); // Poll status every 5s
    setInterval(fetchJobs, 15000); // Poll jobs every 15s in case new ones arrive
});
