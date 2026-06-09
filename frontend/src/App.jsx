import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, LayoutDashboard, Briefcase, CheckSquare, 
  Building2, ExternalLink, ShieldCheck, 
  Search, CheckCircle2, UserCircle 
} from 'lucide-react';
import { supabase } from './supabase';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [jobs, setJobs] = useState([]);
  const [systemStatus, setSystemStatus] = useState({ status: 'IDLE', timestamp: null });
  const [pipelineConfig, setPipelineConfig] = useState(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [session, setSession] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  useEffect(() => {
    // Check if Supabase env vars exist
    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
      setIsConfigured(true);
      
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    fetchStatus();
    fetchConfig();
    
    const jobsInterval = setInterval(fetchJobs, 15000);
    const statusInterval = setInterval(fetchStatus, 15000);
    
    return () => {
      clearInterval(jobsInterval);
      clearInterval(statusInterval);
    };
  }, []);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('id', { ascending: false });
        
      if (error) throw error;
      if (data) setJobs(data);
    } catch (e) {
      console.error('Failed to fetch jobs:', e.message);
    }
  };

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('runs')
        .select('*')
        .order('id', { ascending: false })
        .limit(1)
        .single();
        
      if (error && error.code !== 'PGRST116') throw error; // ignore no rows error
      if (data) {
        setSystemStatus({ status: data.status, timestamp: data.timestamp });
      }
    } catch (e) {
      console.error('Failed to fetch status:', e.message);
    }
  };

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('system_configs')
        .select('*')
        .eq('id', 1)
        .single();
        
      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setPipelineConfig({
          prompt: data.prompt_text,
          targets: JSON.parse(data.target_sites)
        });
      }
    } catch (e) {
      console.error('Failed to fetch config:', e.message);
    }
  };

  const updateJobStatus = async (jobId, newStatus) => {
    if (!session) {
      setShowLoginModal(true);
      return;
    }
    
    try {
      const appliedDate = newStatus === 'applied' ? new Date().toISOString() : null;
      const { error } = await supabase
        .from('jobs')
        .update({ status: newStatus, applied_date: appliedDate })
        .eq('id', jobId);
        
      if (error) throw error;
      fetchJobs(); // Refresh immediately
    } catch (e) {
      console.error('Failed to update job:', e.message);
      alert('Failed to update job status. Check console.');
    }
  };

  // Derived state
  const pendingJobs = jobs.filter(j => j.status === 'pending');
  const appliedJobs = jobs.filter(j => j.status === 'applied');

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });
    if (error) setAuthError(error.message);
    setIsAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="glass p-8 rounded-2xl max-w-md text-center">
          <Bot className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Supabase Required</h2>
          <p className="text-slate-400 mb-6">
            Please add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your frontend/.env file to connect to the cloud.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="bg-gradient-animated" />

      {/* Login Modal */}
      {showLoginModal && !session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass p-8 rounded-2xl w-full max-w-md relative border border-slate-700/50 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>
            <div className="flex justify-center mb-6">
              <ShieldCheck className="w-16 h-16 text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
            </div>
            <h2 className="text-3xl font-bold text-center mb-2">Admin Access Required</h2>
            <p className="text-slate-400 text-center mb-8">Please log in to modify the live database.</p>
            
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
                <input 
                  type="email" 
                  required
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
                  placeholder="admin@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
                <input 
                  type="password" 
                  required
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
                  placeholder="••••••••"
                />
              </div>
              {authError && (
                <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  {authError}
                </div>
              )}
              <button 
                type="submit" 
                disabled={isAuthLoading}
                className="mt-4 w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
              >
                {isAuthLoading ? 'Authenticating...' : 'Log In'}
              </button>
            </form>
          </div>
        </div>
      )}
      
      <div className="h-screen w-screen p-4 md:p-8 flex items-center justify-center">
        <div className="glass w-full max-w-[1400px] h-full max-h-[900px] rounded-3xl flex overflow-hidden">
          
          {/* Sidebar */}
          <aside className="w-72 border-r border-slate-700/50 bg-slate-900/40 p-6 flex flex-col">
            <div className="flex items-center gap-3 text-2xl font-extrabold mb-12">
              <Bot className="w-8 h-8 text-blue-500" />
              <span>Job<span className="text-blue-500">Tracker</span></span>
            </div>

            <nav className="flex flex-col gap-2 flex-grow">
              <NavButton 
                active={activeTab === 'dashboard'} 
                icon={<LayoutDashboard />} 
                text="Dashboard" 
                onClick={() => setActiveTab('dashboard')} 
              />
              <NavButton 
                active={activeTab === 'pending'} 
                icon={<Briefcase />} 
                text="Opportunities" 
                badge={pendingJobs.length}
                onClick={() => setActiveTab('pending')} 
              />
              <NavButton 
                active={activeTab === 'applied'} 
                icon={<CheckSquare />} 
                text="Applications" 
                onClick={() => setActiveTab('applied')} 
              />
              <NavButton 
                active={activeTab === 'config'} 
                icon={<Bot />} 
                text="Pipeline Config" 
                onClick={() => setActiveTab('config')} 
              />
            </nav>

            <div className="mt-auto">
              <div className="bg-slate-950/50 rounded-xl p-4 mb-4 border border-slate-800/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${systemStatus.status === 'RUNNING' ? 'bg-purple-500 animate-pulse shadow-[0_0_10px_#a855f7]' : 'bg-green-500 shadow-[0_0_10px_#22c55e]'}`} />
                  <span className="font-semibold text-sm">
                    {systemStatus.status === 'RUNNING' ? 'Scraper Running...' : 'Agent Sleeping'}
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  Last cloud run: {systemStatus.timestamp ? new Date(systemStatus.timestamp).toLocaleString() : 'Never'}
                </div>
              </div>

              <div className="w-full bg-slate-800/50 border border-blue-500/30 text-blue-400 p-4 rounded-xl flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-bold">Cloud Autopilot</p>
                  <p className="text-xs text-slate-400">Scheduled for 12:00 PM</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 flex flex-col p-8 overflow-hidden relative">
            <header className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold">
                {activeTab === 'dashboard' && 'Serverless Dashboard'}
                {activeTab === 'pending' && 'New Opportunities'}
                {activeTab === 'applied' && 'My Applications'}
                {activeTab === 'config' && 'Pipeline Architecture'}
              </h1>
              <div className="flex items-center gap-4">
                {session ? (
                  <>
                    <div className="text-sm text-slate-400 hidden sm:block">
                      {session?.user?.email}
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors"
                    >
                      <UserCircle className="w-5 h-5" />
                      <span className="text-sm font-semibold">Logout</span>
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setShowLoginModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-400 transition-colors"
                  >
                    <ShieldCheck className="w-5 h-5" />
                    <span className="text-sm font-semibold">Admin Login</span>
                  </button>
                )}
              </div>
            </header>

            <div className="flex-1 overflow-y-auto pr-2 pb-8 custom-scrollbar">
              <AnimatePresence mode="wait">
                {activeTab === 'dashboard' && (
                  <motion.div 
                    key="dashboard"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-6"
                  >
                    <StatCard icon={<Search className="w-8 h-8 text-blue-500" />} title="Total Extracted" value={jobs.length} />
                    <StatCard icon={<Briefcase className="w-8 h-8 text-orange-500" />} title="Pending Review" value={pendingJobs.length} />
                    <StatCard icon={<CheckCircle2 className="w-8 h-8 text-green-500" />} title="Applications Sent" value={appliedJobs.length} highlight />
                  </motion.div>
                )}

                {activeTab === 'pending' && (
                  <motion.div 
                    key="pending"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="grid grid-cols-1 xl:grid-cols-2 gap-6"
                  >
                    {pendingJobs.length === 0 ? (
                      <EmptyState icon={<Bot className="w-16 h-16" />} title="No new opportunities" subtitle="The agent will find more roles at 12 PM." />
                    ) : (
                      pendingJobs.map(job => (
                        <JobCard key={job.id} job={job} onUpdate={updateJobStatus} />
                      ))
                    )}
                  </motion.div>
                )}

                {activeTab === 'applied' && (
                  <motion.div 
                    key="applied"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col gap-4"
                  >
                    {appliedJobs.length === 0 ? (
                      <EmptyState icon={<CheckSquare className="w-16 h-16" />} title="No applications yet" subtitle="Start applying to move jobs here." />
                    ) : (
                      appliedJobs.map(job => (
                        <AppliedCard key={job.id} job={job} />
                      ))
                    )}
                  </motion.div>
                )}

                {activeTab === 'config' && (
                  <motion.div 
                    key="config"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col gap-6"
                  >
                    {!pipelineConfig ? (
                      <div className="text-slate-400 text-center py-10">Loading configuration from database...</div>
                    ) : (
                      <>
                        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
                          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Bot className="w-6 h-6 text-blue-500" />
                            AI Extraction Prompt
                          </h3>
                          <p className="text-slate-400 text-sm mb-4">This exact prompt is fed to Gemini 2.5 Flash via LangChain to parse the headless Chromium DOM. (Synced live from the backend python agent).</p>
                          <pre className="bg-slate-900/80 p-4 rounded-xl text-green-400 text-sm overflow-x-auto whitespace-pre-wrap font-mono border border-slate-700/50 shadow-inner">
                            {pipelineConfig.prompt}
                          </pre>
                        </div>

                        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
                          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Building2 className="w-6 h-6 text-orange-500" />
                            Automated Target Endpoints
                          </h3>
                          <p className="text-slate-400 text-sm mb-4">The Playwright agent automatically navigates and bypasses SPA rendering on these URLs daily.</p>
                          <ul className="flex flex-col gap-3">
                            {pipelineConfig.targets.map((site, idx) => (
                              <li key={idx} className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-700/30">
                                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                                <div className="flex flex-col truncate">
                                  <span className="font-bold text-slate-200">{site.company} Careers</span>
                                  <a href={site.url} target="_blank" rel="noreferrer" className="text-sm text-blue-400 hover:text-blue-300 truncate transition-colors">
                                    {site.url}
                                  </a>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </main>

        </div>
      </div>
    </div>
  );
}

// Components
const NavButton = ({ active, icon, text, badge, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 ${
      active 
        ? 'bg-blue-500/10 text-blue-400 border-l-4 border-blue-500' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`}
  >
    <div className="flex items-center gap-3">
      {icon}
      <span className="font-semibold">{text}</span>
    </div>
    {badge !== undefined && badge > 0 && (
      <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">{badge}</span>
    )}
  </button>
);

const StatCard = ({ icon, title, value, highlight }) => (
  <div className={`p-6 rounded-2xl border ${highlight ? 'bg-green-500/5 border-green-500/20' : 'bg-slate-800/30 border-slate-700/50'} flex items-center gap-5 transition-transform hover:-translate-y-1`}>
    <div className={`p-4 rounded-xl ${highlight ? 'bg-green-500/10' : 'bg-slate-900/50'}`}>
      {icon}
    </div>
    <div>
      <h3 className="text-slate-400 font-medium mb-1">{title}</h3>
      <p className="text-4xl font-extrabold">{value}</p>
    </div>
  </div>
);

const JobCard = ({ job, onUpdate }) => (
  <motion.div layout className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 flex flex-col justify-between hover:border-blue-500/50 hover:shadow-[0_10px_30px_-10px_rgba(59,130,246,0.2)] transition-all">
    <div>
      <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm mb-3 tracking-wider uppercase">
        <Building2 className="w-4 h-4" /> {job.company}
      </div>
      <h3 className="text-xl font-bold leading-tight mb-6">{job.title}</h3>
    </div>
    <div className="flex flex-col gap-3">
      <a 
        href={job.url} 
        target="_blank" 
        rel="noreferrer" 
        className="w-full bg-slate-900/50 hover:bg-slate-900 text-center py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors border border-slate-700/50"
      >
        <ExternalLink className="w-4 h-4" /> View Posting
      </a>
      <div className="flex gap-3">
        <button 
          onClick={() => onUpdate(job.id, 'ignored')}
          className="flex-1 border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white py-3 rounded-xl font-semibold transition-colors"
        >
          Ignore
        </button>
        <button 
          onClick={() => onUpdate(job.id, 'applied')}
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-semibold transition-colors shadow-lg shadow-blue-500/20"
        >
          Mark Applied
        </button>
      </div>
    </div>
  </motion.div>
);

const AppliedCard = ({ job }) => (
  <div className="bg-green-500/5 border border-green-500/20 p-5 rounded-2xl flex justify-between items-center">
    <div>
      <h3 className="text-lg font-bold mb-1">{job.title}</h3>
      <p className="text-slate-400 flex items-center gap-2">
        <Building2 className="w-4 h-4" /> {job.company}
      </p>
    </div>
    <div className="text-right">
      <div className="text-green-400 font-bold flex items-center justify-end gap-2 mb-1">
        <CheckCircle2 className="w-4 h-4" /> Applied
      </div>
      <div className="text-sm text-slate-400">
        {job.applied_date ? new Date(job.applied_date).toLocaleDateString() : 'N/A'}
      </div>
    </div>
  </div>
);

const EmptyState = ({ icon, title, subtitle }) => (
  <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-500 text-center">
    <div className="mb-4 opacity-50">{icon}</div>
    <h3 className="text-2xl font-bold text-slate-300 mb-2">{title}</h3>
    <p>{subtitle}</p>
  </div>
);

export default App;
