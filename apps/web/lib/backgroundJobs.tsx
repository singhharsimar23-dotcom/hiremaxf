import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Loader2, CheckCircle2, XCircle, X } from 'lucide-react';

export type JobStatus = 'running' | 'done' | 'error';

export interface BgJob {
  id: string;
  label: string;
  status: JobStatus;
  result?: any;
  error?: string;
  createdAt: number;
}

interface BgCtx {
  jobs: BgJob[];
  startJob: (label: string, fn: () => Promise<any>) => string;
  getJob: (id: string) => BgJob | undefined;
  dismissJob: (id: string) => void;
}

const Ctx = createContext<BgCtx>({ jobs: [], startJob: () => '', getJob: () => undefined, dismissJob: () => {} });

export const useBackgroundJobs = () => useContext(Ctx);

export const BackgroundJobsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<BgJob[]>([]);
  const jobsRef = useRef<BgJob[]>([]);

  const update = (id: string, patch: Partial<BgJob>) => {
    setJobs(prev => {
      const next = prev.map(j => j.id === id ? { ...j, ...patch } : j);
      jobsRef.current = next;
      return next;
    });
  };

  const startJob = useCallback((label: string, fn: () => Promise<any>): string => {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    const job: BgJob = { id, label, status: 'running', createdAt: Date.now() };
    setJobs(prev => { const next = [job, ...prev.slice(0, 9)]; jobsRef.current = next; return next; });
    fn().then(result => update(id, { status: 'done', result }))
       .catch(err => update(id, { status: 'error', error: err?.message || 'Failed' }));
    return id;
  }, []);

  const getJob = useCallback((id: string) => jobsRef.current.find(j => j.id === id), []);
  const dismissJob = useCallback((id: string) => setJobs(prev => prev.filter(j => j.id !== id)), []);

  const visible = jobs.filter(j => j.status === 'running' || (j.status !== 'running' && Date.now() - j.createdAt < 8000));

  return (
    <Ctx.Provider value={{ jobs, startJob, getJob, dismissJob }}>
      {children}
      {/* Toast tray */}
      {visible.length > 0 && (
        <div className="fixed bottom-6 left-6 z-[300] flex flex-col gap-2 max-w-sm">
          {visible.map(job => (
            <div key={job.id} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all animate-in slide-in-from-bottom-2 duration-300 ${
              job.status === 'running' ? 'bg-[#1A1D26]/95 border-blue-500/30' :
              job.status === 'done'    ? 'bg-[#1A1D26]/95 border-green-500/30' :
                                         'bg-[#1A1D26]/95 border-red-500/30'
            }`}>
              {job.status === 'running' && <Loader2 size={14} className="text-blue-400 animate-spin shrink-0" />}
              {job.status === 'done'    && <CheckCircle2 size={14} className="text-green-400 shrink-0" />}
              {job.status === 'error'   && <XCircle size={14} className="text-red-400 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-bold truncate">{job.label}</p>
                {job.status === 'running' && (
                  <div className="mt-1 h-0.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                )}
                {job.status === 'error' && <p className="text-red-400 text-[9px] mt-0.5 truncate">{job.error}</p>}
                {job.status === 'done'  && <p className="text-green-400 text-[9px] mt-0.5">Complete — navigate back to view</p>}
              </div>
              {job.status !== 'running' && (
                <button onClick={() => dismissJob(job.id)} className="text-slate-600 hover:text-white transition-colors shrink-0"><X size={12} /></button>
              )}
            </div>
          ))}
        </div>
      )}
    </Ctx.Provider>
  );
};
