import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Briefcase, CheckSquare, 
  Building2, ExternalLink, ShieldCheck, 
  Search, CheckCircle2, UserCircle, Command, Activity
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
              className="bg-white p-8 rounded-3xl w-full max-w-md relative shadow-2xl border border-slate-200"
            >
              <button onClick={() => setShowLoginModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors">✕</button>
              <div className="flex justify-center mb-8">
                <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-indigo-600" />
                </div>
              </div>
              <h2 className="text-2xl font-medium tracking-tight text-center mb-2">Admin Authentication</h2>
              <p className="text-slate-500 text-center mb-8 text-sm">Secure access required to mutate pipeline state.</p>
              
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
      
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col z-10">
        <div className="p-8 flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Command className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold tracking-tight text-xl text-slate-900">Nexus</span>
        </div>

        <nav className="flex flex-col gap-1 px-4 flex-grow">
          <NavButton active={activeTab === 'pending'} icon={<Briefcase size={18} />} text="Opportunities" badge={pendingJobs.length} onClick={() => setActiveTab('pending')} />
          <NavButton active={activeTab === 'applied'} icon={<CheckSquare size={18} />} text="Applications" onClick={() => setActiveTab('applied')} />
          <NavButton active={activeTab === 'config'} icon={<Activity size={18} />} text="Pipeline" onClick={() => setActiveTab('config')} />
          
          <div className="my-2 border-t border-slate-100 mx-2" />
          
          <a 
            href="https://vercel.com/manans-projects-38b4f0e7/resumo" 
            target="_blank" 
            rel="noreferrer"
            className="group relative w-full flex flex-col px-4 py-3 rounded-xl transition-all duration-500 font-medium text-slate-500 hover:bg-slate-900 overflow-hidden border border-transparent hover:border-slate-800 hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)]"
          >
            <div className="flex items-center gap-3 relative z-10 transition-transform duration-300 group-hover:-translate-y-0.5">
              <div className="text-slate-400 group-hover:text-white transition-colors duration-300">
                <ExternalLink size={18} />
              </div>
              <span className="text-sm font-bold flex tracking-tight">
                <span className="group-hover:text-white transition-colors duration-300">Resum</span>
                <span className="group-hover:text-red-500 transition-colors duration-300">O</span>
              </span>
            </div>
            <div className="relative z-10 h-0 group-hover:h-8 transition-all duration-500 opacity-0 group-hover:opacity-100 overflow-hidden mt-0 group-hover:mt-2">
              <span className="text-[10px] text-slate-300 leading-tight block">
                Check if your resume is ready for your dream job →
              </span>
            </div>
          </a>
        </nav>

        <div className="p-6 mt-auto border-t border-slate-100 flex flex-col gap-4">
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

          <div className="bg-slate-900 rounded-xl p-5 text-white shadow-xl relative overflow-hidden group border border-slate-800">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Developer Details</h4>
              <p className="text-[11px] text-indigo-300 font-semibold mb-4 leading-relaxed">Agentic AI • Machine Learning • DevOps • Pipelines</p>
              
              <div className="flex flex-col gap-3">
                <div className="flex gap-2 items-start">
                  <span className="text-fuchsia-400 text-xs mt-0.5">🏆</span>
                  <p className="text-[10px] text-slate-300 leading-snug font-medium">Awarded CVSPK Scholarship for 6th rank in IT Dept (2024–25)</p>
                </div>
                <div className="flex gap-2 items-start">
                  <span className="text-emerald-400 text-xs mt-0.5">🏅</span>
                  <p className="text-[10px] text-slate-300 leading-snug font-medium">Winner, Smart India Hackathon 22-23 (Rs. 25K prize, 300+ teams)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden z-10">
        <header className="px-10 py-8 flex justify-between items-center border-b border-slate-200 bg-white/50 backdrop-blur-md">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {activeTab === 'pending' && 'Active Opportunities'}
            {activeTab === 'applied' && 'Application Registry'}
            {activeTab === 'config' && 'Pipeline Configuration'}
          </h1>
          <div className="flex items-center gap-4">
            {session ? (
              <>
                <span className="text-sm text-slate-500 hidden sm:block font-medium">{session.user.email}</span>
                <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm hover:shadow rounded-full text-slate-700 transition-all text-sm font-medium">
                  <UserCircle size={16} /> Logout
                </button>
              </>
            ) : (
              <button onClick={() => setShowLoginModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full transition-colors text-sm font-semibold">
                <ShieldCheck size={16} /> Admin Access
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'pending' && (
              <motion.div key="pending" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {pendingJobs.length === 0 ? (
                  <EmptyState title="No active opportunities" subtitle="The extraction pipeline is awaiting the next cycle." />
                ) : (
                  pendingJobs.map(job => <JobCard key={job.id} job={job} onUpdate={updateJobStatus} />)
                )}
              </motion.div>
            )}

            {activeTab === 'applied' && (
              <motion.div key="applied" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-4 max-w-4xl">
                {appliedJobs.length === 0 ? (
                  <EmptyState title="Registry empty" subtitle="Approved applications will appear here." />
                ) : (
                  appliedJobs.map(job => <AppliedCard key={job.id} job={job} />)
                )}
              </motion.div>
            )}

            {activeTab === 'config' && (
              <motion.div key="config" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-8 max-w-4xl">
                {!pipelineConfig ? (
                  <div className="text-slate-500 py-10">Synchronizing with origin...</div>
                ) : (
                  <>
                    <HoverCard className="p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                          <Activity size={20} />
                        </div>
                        <h3 className="text-lg font-bold tracking-tight">Extraction Protocol</h3>
                      </div>
                      <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-inner">
                        <div className="flex border-b border-slate-200 px-4 py-3 bg-white items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-slate-200" />
                          <div className="w-3 h-3 rounded-full bg-slate-200" />
                          <div className="w-3 h-3 rounded-full bg-slate-200" />
                          <div className="ml-2 text-xs font-mono text-slate-400">prompt_template.txt</div>
                        </div>
                        <pre className="p-6 text-sm text-slate-600 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                          {pipelineConfig.prompt}
                        </pre>
                      </div>
                    </HoverCard>

                    <HoverCard className="p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-fuchsia-50 text-fuchsia-600 rounded-lg group-hover:bg-fuchsia-600 group-hover:text-white transition-colors duration-300">
                          <Building2 size={20} />
                        </div>
                        <h3 className="text-lg font-bold tracking-tight">Target Architecture</h3>
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
                            <a href={site.url.startsWith('http') ? site.url : `https://${site.url}`} target="_blank" rel="noreferrer" key={idx} className="flex items-center gap-4 bg-slate-50 hover:bg-white hover:shadow-md p-4 rounded-xl border border-slate-200 transition-all duration-300 group/item cursor-pointer">
                              <img src={logoUrl} alt={site.company} className="w-8 h-8 rounded-full bg-white border border-slate-200 object-contain p-0.5" onError={(e) => { e.target.style.display = 'none'; }} />
                              <div className="flex flex-col truncate flex-1">
                                <span className="font-semibold text-slate-900 group-hover/item:text-fuchsia-600 transition-colors">{site.company}</span>
                                <span className="text-xs text-slate-500 group-hover/item:text-slate-700 truncate transition-colors">
                                  {site.url}
                                </span>
                              </div>
                              <ExternalLink size={18} className="text-slate-300 group-hover/item:text-fuchsia-500 transition-colors transform group-hover/item:translate-x-1" />
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
      </main>
    </div>
  );
}

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
  let logoUrl = null;
  try {
    const domain = new URL(job.url).hostname.replace('www.', '').replace('jobs.', '').replace('careers.', '');
    logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  } catch(e) {
    const guessedDomain = job.company.toLowerCase().replace(/\s+/g, '') + '.com';
    logoUrl = `https://www.google.com/s2/favicons?domain=${guessedDomain}&sz=128`;
  }

  return (
    <HoverCard className="p-8 flex flex-col justify-between min-h-[240px]">
      <div>
        <div className="flex items-center gap-3 mb-5">
          {logoUrl && <img src={logoUrl} alt={job.company} className="w-8 h-8 rounded-full border border-slate-200 bg-white object-contain p-0.5" onError={(e) => { e.target.style.display = 'none'; }} />}
          <div className="text-indigo-600 text-xs tracking-wider uppercase font-bold bg-indigo-50 px-3 py-1 rounded-full">
            {job.company}
          </div>
        </div>
        <h3 className="text-2xl font-bold tracking-tight leading-snug mb-6 text-slate-900 group-hover:text-indigo-600 transition-colors duration-300">{job.title}</h3>
      </div>
      <div className="flex gap-3 mt-auto">
        <button 
          onClick={() => onUpdate(job.id, 'ignored')}
          className="flex-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 py-3 rounded-xl text-sm font-semibold transition-all hover:shadow-sm"
        >
          Dismiss
        </button>
        <a 
          href={job.url} target="_blank" rel="noreferrer" 
          className="flex-1 bg-slate-900 hover:bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center transition-all shadow-md hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5"
        >
          Inspect
        </a>
        <button 
          onClick={() => onUpdate(job.id, 'applied')}
          className="flex-1 bg-white border border-slate-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 py-3 rounded-xl text-sm font-semibold transition-all hover:shadow-sm"
        >
          Approve
        </button>
      </div>
    </HoverCard>
  );
};

const AppliedCard = ({ job }) => (
  <HoverCard className="p-6 flex justify-between items-center group cursor-default">
    <div className="flex items-center gap-6">
      <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-500 transition-colors duration-300">
        <CheckCircle2 size={20} className="text-emerald-500 group-hover:text-white transition-colors" />
      </div>
      <div>
        <h3 className="text-lg font-bold tracking-tight text-slate-900 group-hover:text-emerald-600 transition-colors">{job.title}</h3>
        <p className="text-slate-500 text-sm mt-1 font-medium">{job.company}</p>
      </div>
    </div>
    <div className="text-right">
      <div className="text-sm text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-full inline-block mb-1">Approved</div>
      <div className="text-xs text-slate-400 font-medium block">
        {job.applied_date ? new Date(job.applied_date).toLocaleDateString() : 'N/A'}
      </div>
    </div>
  </HoverCard>
);

const EmptyState = ({ title, subtitle }) => (
  <div className="col-span-full py-24 flex flex-col items-center justify-center text-center">
    <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-6 shadow-inner">
      <Command className="text-slate-400 w-8 h-8" />
    </div>
    <h3 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">{title}</h3>
    <p className="text-slate-500 text-base max-w-sm">{subtitle}</p>
  </div>
);

export default App;
