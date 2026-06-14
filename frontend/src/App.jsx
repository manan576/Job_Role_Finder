import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Briefcase, CheckSquare, 
  Building2, ExternalLink, ShieldCheck, 
  Search, CheckCircle2, UserCircle, Command, 
  Activity, Menu, X
} from 'lucide-react';
import { supabase } from './supabase';

const HoverCard = ({ children, className = "" }) => {
  return (
    <div
      className={`group relative rounded-2xl bg-white border border-slate-200 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(99,102,241,0.12)] hover:border-indigo-500/30 overflow-hidden ${className}`}
    >
      <div className="relative h-full z-10">{children}</div>
    </div>
  );
};

function App() {
  const [activeTab, setActiveTab] = useState('pending');
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
      setIsConfigured(true);
      supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
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

  // Close sidebar on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase.from('jobs').select('*').order('id', { ascending: false });
      if (!error && data) setJobs(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase.from('runs').select('*').order('id', { ascending: false }).limit(1).single();
      if (!error && data) setSystemStatus({ status: data.status, timestamp: data.timestamp });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase.from('system_configs').select('*').eq('id', 1).single();
      if (!error && data) {
        setPipelineConfig({ prompt: data.prompt_text, targets: JSON.parse(data.target_sites) });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateJobStatus = async (jobId, newStatus) => {
    if (!session) return setShowLoginModal(true);
    try {
      const appliedDate = newStatus === 'applied' ? new Date().toISOString() : null;
      await supabase.from('jobs').update({ status: newStatus, applied_date: appliedDate }).eq('id', jobId);
      fetchJobs();
    } catch (e) {
      console.error(e);
    }
  };

  const pendingJobs = jobs.filter(j => j.status === 'pending');
  const appliedJobs = jobs.filter(j => j.status === 'applied');

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    if (error) setAuthError(error.message);
    setIsAuthLoading(false);
  };

  const handleLogout = async () => await supabase.auth.signOut();

  const handleNavClick = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false); // auto-close on mobile
  };

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Command className="w-12 h-12 text-indigo-500 mx-auto mb-6" />
          <h2 className="text-2xl font-medium tracking-tight mb-2 text-slate-900">Configuration Required</h2>
          <p className="text-slate-500">Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex text-slate-900 bg-slate-50 selection:bg-indigo-500/30 selection:text-indigo-900">
      
      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && !session && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-white p-6 sm:p-8 rounded-3xl w-full max-w-md relative shadow-2xl border border-slate-200"
            >
              <button onClick={() => setShowLoginModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors">✕</button>
              <div className="flex justify-center mb-6 sm:mb-8">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-indigo-50 flex items-center justify-center">
                  <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-600" />
                </div>
              </div>
              <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-center mb-2">Admin Authentication</h2>
              <p className="text-slate-500 text-center mb-6 sm:mb-8 text-sm">Secure access required to mutate pipeline state.</p>
              
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div>
                  <input 
                    type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400"
                    placeholder="Email address"
                  />
                </div>
                <div>
                  <input 
                    type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400"
                    placeholder="Password"
                  />
                </div>
                {authError && <div className="text-red-600 text-sm py-2 px-3 bg-red-50 rounded-lg border border-red-100">{authError}</div>}
                <button 
                  type="submit" disabled={isAuthLoading}
                  className="mt-2 w-full bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50 font-medium py-3.5 rounded-xl transition-all shadow-lg hover:shadow-[0_8px_20px_rgb(0,0,0,0.15)]"
                >
                  {isAuthLoading ? 'Authenticating...' : 'Authenticate'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>
      
      {/* Sidebar */}
      <aside className={`
        fixed md:relative z-40 md:z-20
        w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm h-screen
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex flex-col h-full overflow-y-auto">
          <div className="p-6 flex-shrink-0">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
                  <Building2 size={24} className="text-white" />
                </div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight">Nexus</h1>
              </div>
              {/* Close button for mobile */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>   
          
          <nav className="flex flex-col gap-1 px-4 flex-shrink-0">
          <NavButton active={activeTab === 'pending'} icon={<Briefcase size={18} />} text="Opportunities" badge={pendingJobs.length} onClick={() => handleNavClick('pending')} />
          <NavButton active={activeTab === 'applied'} icon={<CheckSquare size={18} />} text="Applications" onClick={() => handleNavClick('applied')} />
          <NavButton active={activeTab === 'config'} icon={<Activity size={18} />} text="Pipeline" onClick={() => handleNavClick('config')} />
          
          <div className="my-2 border-t border-slate-100 mx-2" />
          
          <a 
            href="https://resumo-two.vercel.app/" 
            target="_blank" 
            rel="noreferrer"
            className="group relative w-full flex flex-col px-4 py-3 rounded-xl transition-all duration-500 font-medium text-slate-500 hover:bg-slate-900 overflow-hidden border border-transparent hover:border-slate-800 hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)]"
          >
            <div className="flex items-center justify-between relative z-10 transition-transform duration-300 group-hover:-translate-y-0.5 w-full">
              <div className="flex items-center gap-3">
                <div className="text-slate-400 group-hover:text-white transition-colors duration-300">
                  <ExternalLink size={18} />
                </div>
                <span className="text-sm font-bold flex tracking-tight">
                  <span className="group-hover:text-white transition-colors duration-300">Resum</span>
                  <span className="group-hover:text-red-500 transition-colors duration-300">O</span>
                </span>
              </div>
              <span className="text-[8px] uppercase tracking-widest text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                Built by the same dev
              </span>
            </div>
            <div className="relative z-10 h-0 group-hover:h-8 transition-all duration-500 opacity-0 group-hover:opacity-100 overflow-hidden mt-0 group-hover:mt-2">
              <span className="text-[10px] text-slate-300 leading-tight block">
                Check if your resume is ready for your dream job
              </span>
            </div>
          </a>
        </nav>

        <div className="p-4 sm:p-6 mt-auto border-t border-slate-100 flex flex-col gap-4 flex-shrink-0">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${systemStatus.status === 'RUNNING' ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'}`} />
              <span className="text-sm font-medium text-slate-700">
                {systemStatus.status === 'RUNNING' ? 'Active Extraction' : 'System Idle'}
              </span>
            </div>
            <div className="text-xs text-slate-500 ml-4">
              Sync: {systemStatus.timestamp ? new Date(systemStatus.timestamp).toLocaleTimeString() : 'N/A'}
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-slate-200 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/80 to-fuchsia-50/80 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Developer Details</h4>
              
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-sm font-bold text-slate-900 leading-tight">Manan Bhateja</p>
                  <p className="text-xs text-slate-500 font-medium">NSUT IT 2027</p>
                </div>
                <a href="https://github.com/manan576" target="_blank" rel="noreferrer" className="text-slate-700 bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 p-1.5 rounded-lg transition-colors border border-slate-200 hover:border-indigo-200 shadow-sm">
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                </a>
              </div>
              
              <p className="text-[11px] text-fuchsia-600 font-semibold leading-relaxed">Agentic AI • Machine Learning • DevOps • Pipelines</p>
            </div>
          </div>
        </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden z-10 w-full">
        <header className="px-4 sm:px-6 md:px-10 py-4 sm:py-6 md:py-8 flex justify-between items-center border-b border-slate-200 bg-white/50 backdrop-blur-md gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors flex-shrink-0"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-slate-900 truncate">
            {activeTab === 'pending' && 'Active Opportunities'}
            {activeTab === 'applied' && 'Application Registry'}
            {activeTab === 'config' && 'Pipeline Configuration'}
          </h1>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {session ? (
              <>
                <span className="text-sm text-slate-500 hidden lg:block font-medium">{session.user.email}</span>
                <button onClick={handleLogout} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm hover:shadow rounded-full text-slate-700 transition-all text-xs sm:text-sm font-medium">
                  <UserCircle size={16} /> <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <button onClick={() => setShowLoginModal(true)} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full transition-colors text-xs sm:text-sm font-semibold">
                <ShieldCheck size={16} /> <span className="hidden sm:inline">Login</span>
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'pending' && (
              <motion.div key="pending" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {pendingJobs.length === 0 ? (
                  <EmptyState title="No active opportunities" subtitle="The extraction pipeline is awaiting the next cycle." />
                ) : (
                  pendingJobs.map(job => <JobCard key={job.id} job={job} onUpdate={updateJobStatus} />)
                )}
              </motion.div>
            )}

            {activeTab === 'applied' && (
              <motion.div key="applied" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-3 sm:gap-4 max-w-4xl">
                {appliedJobs.length === 0 ? (
                  <EmptyState title="Registry empty" subtitle="Approved applications will appear here." />
                ) : (
                  appliedJobs.map(job => <AppliedCard key={job.id} job={job} />)
                )}
              </motion.div>
            )}

            {activeTab === 'config' && (
              <motion.div key="config" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-6 sm:gap-8 max-w-4xl">
                {!pipelineConfig ? (
                  <div className="text-slate-500 py-10">Synchronizing with origin...</div>
                ) : (
                  <>
                    <HoverCard className="p-5 sm:p-8">
                      <div className="flex items-center gap-3 mb-4 sm:mb-6">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                          <Activity size={20} />
                        </div>
                        <h3 className="text-base sm:text-lg font-bold tracking-tight">Extraction Protocol</h3>
                      </div>
                      <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-inner">
                        <div className="flex border-b border-slate-200 px-3 sm:px-4 py-2 sm:py-3 bg-white items-center gap-2">
                          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-slate-200" />
                          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-slate-200" />
                          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-slate-200" />
                          <div className="ml-2 text-[10px] sm:text-xs font-mono text-slate-400">prompt_template.txt</div>
                        </div>
                        <pre className="p-4 sm:p-6 text-xs sm:text-sm text-slate-600 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                          {pipelineConfig.prompt}
                        </pre>
                      </div>
                    </HoverCard>

                    <HoverCard className="p-5 sm:p-8">
                      <div className="flex items-center gap-3 mb-4 sm:mb-6">
                        <div className="p-2 bg-fuchsia-50 text-fuchsia-600 rounded-lg group-hover:bg-fuchsia-600 group-hover:text-white transition-colors duration-300">
                          <Building2 size={20} />
                        </div>
                        <h3 className="text-base sm:text-lg font-bold tracking-tight">Target Architecture</h3>
                      </div>
                      <ul className="flex flex-col gap-3">
                        {pipelineConfig.targets.map((site, idx) => {
                          let logoUrl = null;
                          try {
                            const domain = new URL(site.url).hostname.replace('www.', '').replace('jobs.', '').replace('careers.', '');
                            logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                          } catch(e) {
                            const guessedDomain = site.company.toLowerCase().replace(/\s+/g, '') + '.com';
                            logoUrl = `https://www.google.com/s2/favicons?domain=${guessedDomain}&sz=128`;
                          }
                          return (
                            <a href={site.url.startsWith('http') ? site.url : `https://${site.url}`} target="_blank" rel="noreferrer" key={idx} className="flex items-center gap-3 sm:gap-4 bg-slate-50 hover:bg-white hover:shadow-md p-3 sm:p-4 rounded-xl border border-slate-200 transition-all duration-300 group/item cursor-pointer">
                              <img src={logoUrl} alt={site.company} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-slate-200 object-contain p-0.5 flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                              <div className="flex flex-col truncate flex-1 min-w-0">
                                <span className="font-semibold text-sm sm:text-base text-slate-900 group-hover/item:text-fuchsia-600 transition-colors">{site.company}</span>
                                <span className="text-[11px] sm:text-xs text-slate-500 group-hover/item:text-slate-700 truncate transition-colors">
                                  {site.url}
                                </span>
                              </div>
                              <ExternalLink size={18} className="text-slate-300 group-hover/item:text-fuchsia-500 transition-colors transform group-hover/item:translate-x-1 flex-shrink-0 hidden sm:block" />
                            </a>
                          );
                        })}
                      </ul>
                    </HoverCard>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden flex border-t border-slate-200 bg-white/80 backdrop-blur-md safe-bottom">
          <MobileNavButton
            active={activeTab === 'pending'}
            icon={<Briefcase size={20} />}
            label="Opportunities"
            badge={pendingJobs.length}
            onClick={() => setActiveTab('pending')}
          />
          <MobileNavButton
            active={activeTab === 'applied'}
            icon={<CheckSquare size={20} />}
            label="Applied"
            onClick={() => setActiveTab('applied')}
          />
          <MobileNavButton
            active={activeTab === 'config'}
            icon={<Activity size={20} />}
            label="Pipeline"
            onClick={() => setActiveTab('config')}
          />
        </nav>
      </main>
    </div>
  );
}

const MobileNavButton = ({ active, icon, label, badge, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors relative ${
      active ? 'text-indigo-600' : 'text-slate-400'
    }`}
  >
    {active && (
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-600 rounded-full" />
    )}
    <div className="relative">
      {icon}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1.5 -right-2.5 bg-indigo-600 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">{badge > 9 ? '9+' : badge}</span>
      )}
    </div>
    <span className="text-[10px] font-semibold tracking-tight">{label}</span>
  </button>
);

const NavButton = ({ active, icon, text, badge, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 font-medium ${
      active 
        ? 'bg-slate-100 text-slate-900 shadow-sm' 
        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
    }`}
  >
    <div className="flex items-center gap-3">
      <div className={`${active ? 'text-indigo-600' : 'text-slate-400'}`}>{icon}</div>
      <span className="text-sm">{text}</span>
    </div>
    {badge !== undefined && badge > 0 && (
      <span className="bg-indigo-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">{badge}</span>
    )}
  </button>
);

const colorMap = {
  indigo: 'text-indigo-600 bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white',
  fuchsia: 'text-fuchsia-600 bg-fuchsia-50 group-hover:bg-fuchsia-600 group-hover:text-white',
  emerald: 'text-emerald-600 bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white',
};

const StatCard = ({ icon, title, value, color }) => (
  <HoverCard className="p-8 flex flex-col justify-between h-44">
    <div className="flex justify-between items-start">
      <div className={`p-3 rounded-xl transition-colors duration-300 shadow-sm ${colorMap[color]}`}>
        {icon}
      </div>
    </div>
    <div>
      <p className="text-4xl font-bold tracking-tight mt-4 text-slate-900">{value}</p>
      <h3 className="text-slate-500 text-sm mt-1 font-medium">{title}</h3>
    </div>
  </HoverCard>
);

const JobCard = ({ job, onUpdate }) => {
  const guessedDomain = job.company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
  const logoUrl = `https://www.google.com/s2/favicons?domain=${guessedDomain}&sz=128`;

  return (
    <HoverCard className="p-5 sm:p-8 flex flex-col justify-between min-h-[200px] sm:min-h-[240px]">
      <div>
        <div className="flex items-center gap-3 mb-3 sm:mb-5">
          {logoUrl && <img src={logoUrl} alt={job.company} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-slate-200 bg-white object-contain p-0.5" onError={(e) => { e.target.style.display = 'none'; }} />}
          <div className="text-indigo-600 text-[11px] sm:text-xs tracking-wider uppercase font-bold bg-indigo-50 px-2.5 sm:px-3 py-1 rounded-full">
            {job.company}
          </div>
        </div>
        <h3 className="text-xl sm:text-2xl font-bold tracking-tight leading-snug mb-4 sm:mb-6 text-slate-900 group-hover:text-indigo-600 transition-colors duration-300">{job.title}</h3>
      </div>
      <div className="flex gap-2 sm:gap-3 mt-auto">
        <button 
          onClick={() => onUpdate(job.id, 'ignored')}
          className="flex-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all hover:shadow-sm"
        >
          Dismiss
        </button>
        <a 
          href={job.url} target="_blank" rel="noreferrer" 
          className="flex-1 bg-slate-900 hover:bg-indigo-600 text-white py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center transition-all shadow-md hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5"
        >
          Inspect
        </a>
        <button 
          onClick={() => onUpdate(job.id, 'applied')}
          className="flex-1 bg-white border border-slate-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all hover:shadow-sm"
        >
          Approve
        </button>
      </div>
    </HoverCard>
  );
};

const AppliedCard = ({ job }) => {
  const guessedDomain = job.company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
  const logoUrl = `https://www.google.com/s2/favicons?domain=${guessedDomain}&sz=128`;

  return (
  <HoverCard className="p-4 sm:p-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-6 group cursor-default">
    <div className="flex items-center gap-3 sm:gap-6 min-w-0">
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200 overflow-hidden p-1 flex-shrink-0">
        <img src={logoUrl} alt={job.company} className="w-full h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
      </div>
      <div className="min-w-0">
        <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 group-hover:text-emerald-600 transition-colors truncate">{job.title}</h3>
        <p className="text-slate-500 text-sm mt-0.5 sm:mt-1 font-medium">{job.company}</p>
      </div>
    </div>
    <div className="text-left sm:text-right flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0 flex-shrink-0 pl-12 sm:pl-0">
      <div className="text-xs sm:text-sm text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-full inline-block sm:mb-1">Approved</div>
      <div className="text-xs text-slate-400 font-medium">
        {job.applied_date ? new Date(job.applied_date).toLocaleDateString() : 'N/A'}
      </div>
    </div>
  </HoverCard>
  );
};
const EmptyState = ({ title, subtitle }) => (
  <div className="col-span-full py-16 sm:py-24 flex flex-col items-center justify-center text-center px-4">
    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4 sm:mb-6 shadow-inner">
      <Command className="text-slate-400 w-6 h-6 sm:w-8 sm:h-8" />
    </div>
    <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mb-2">{title}</h3>
    <p className="text-slate-500 text-sm sm:text-base max-w-sm">{subtitle}</p>
  </div>
);

export default App;
