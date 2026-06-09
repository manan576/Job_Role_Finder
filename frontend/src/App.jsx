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
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    // Check if Supabase env vars exist
    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
      setIsConfigured(true);
      fetchJobs();
      fetchStatus();
      
      // Real-time listener could be added here, but polling is fine for simplicity
      const jobsInterval = setInterval(fetchJobs, 15000);
      const statusInterval = setInterval(fetchStatus, 15000);
      
      return () => {
        clearInterval(jobsInterval);
        clearInterval(statusInterval);
      };
    }
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

  const updateJobStatus = async (jobId, newStatus) => {
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
              </h1>
              <UserCircle className="w-10 h-10 text-slate-400" />
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
