
import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ActionCard from './components/StakingCard';
import RealityCheckDetail from './components/ActiveStakingDetail';
import { AIReviewView } from './components/AIReviewView';
import { ResumeBuilder } from './components/ResumeBuilder';
import { SignalHub } from './components/SignalHub';
import { Templates } from './components/Templates';
import { FeatureDetails } from './components/FeatureDetails';
import { QUICK_ACTIONS } from './constants';
import { ArrowRight, FileCode } from 'lucide-react';
import { AppView, DiagnosticResult } from './types';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('dashboard');
  const [analysisResult, setAnalysisResult] = useState<DiagnosticResult | null>(null);

  return (
    <div className="min-h-screen bg-[#0D0D12] flex antialiased">
      <Sidebar currentView={view} setView={setView} />

      <main className="flex-1 ml-64 flex flex-col min-h-screen relative">
        <Header setView={setView} />

        <div className="flex-1 overflow-y-auto">
          {view === 'dashboard' && (
            <div className="px-10 pb-16">
              <section className="mb-12 mt-8">
                <h1 className="text-5xl font-black text-white mb-2 tracking-tighter">Welcome back, ryan.crawford</h1>
                <p className="text-gray-500 text-lg font-medium">Build and optimize your resume with objective, recruiter-grade insights.</p>
              </section>

              <section className="mb-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {QUICK_ACTIONS.map(action => (
                    <ActionCard 
                      key={action.id} 
                      data={action} 
                      onClick={() => {
                        if (action.id === 'review') setView('ai-review');
                        if (action.id === 'new') setView('resume-builder');
                        if (action.id === 'templates') setView('templates');
                      }}
                    />
                  ))}
                </div>
              </section>

              <section className="mb-10">
                <div 
                  onClick={() => setView('resume-builder')}
                  className="bg-gradient-to-r from-[#16161E] to-[#0D0D12] border border-[#1D1D26] rounded-[2.5rem] p-10 flex items-center justify-between group cursor-pointer hover:border-blue-500/40 transition-all shadow-xl"
                >
                   <div className="flex items-center gap-8">
                      <div className="w-16 h-16 rounded-[1.25rem] bg-blue-600/10 flex items-center justify-center text-blue-500 transition-all group-hover:scale-110">
                         <FileCode size={32} />
                      </div>
                      <div>
                        <h3 className="text-white font-bold text-2xl tracking-tight">Structured Builder Interface</h3>
                        <p className="text-gray-500 text-sm font-medium mt-1">Non-AI construction hub for high-fidelity structural integrity.</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-4">
                     <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest hidden group-hover:block transition-all">Launch Construction</span>
                     <div className="w-12 h-12 rounded-full bg-[#0D0D12] border border-[#1D1D26] flex items-center justify-center text-gray-700 group-hover:text-white group-hover:bg-blue-600 group-hover:border-blue-600 transition-all">
                      <ArrowRight size={22} />
                     </div>
                   </div>
                </div>
              </section>

              <section>
                 <RealityCheckDetail onStart={() => setView('ai-review')} />
              </section>
            </div>
          )}

          {view === 'ai-review' && <AIReviewView onResult={setAnalysisResult} />}
          {view === 'resume-builder' && <ResumeBuilder />}
          {view === 'signal-hub' && <SignalHub result={analysisResult} setView={setView} />}
          {view === 'templates' && <Templates setView={setView} />}
          
          {[
            'recruiter-scan', 
            'rejection-model', 
            'role-saturation', 
            'skill-radar', 
            'longevity-estimate'
          ].includes(view) && (
            <FeatureDetails view={view as any} result={analysisResult} setView={setView} />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
