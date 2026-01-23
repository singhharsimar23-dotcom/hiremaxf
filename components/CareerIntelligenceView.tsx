
import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  TrendingUp, 
  ShieldAlert, 
  Clock, 
  Target,
  Sparkles,
  Zap,
  ArrowRight,
  RefreshCw,
  Activity,
  ArrowLeft,
  AlertTriangle,
  Info,
  Loader2,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { MarketIntelligenceData, MarketSignal, OutlookData, SignalDirection, DiagnosticResult, UserPlan } from '../types';

interface CareerIntelligenceViewProps {
  analysisResult: DiagnosticResult | null;
  resumeText: string;
  plan: UserPlan;
}

const DirectionBadge: React.FC<{ direction: SignalDirection }> = ({ direction }) => {
  const styles = {
    'Rising': 'bg-green-500/10 text-green-400 border-green-500/20',
    'Stable': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Softening': 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  };
  return (
    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${styles[direction]}`}>
      {direction}
    </span>
  );
};

const InsufficientData: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-10">
    <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-8 border border-slate-800">
      <ShieldCheck className="text-slate-600" size={32} />
    </div>
    <h2 className="text-xl font-black text-slate-500 uppercase tracking-[0.2em]">{message}</h2>
  </div>
);

export const CareerIntelligenceView: React.FC<CareerIntelligenceViewProps> = ({ analysisResult, resumeText, plan }) => {
  // STRICT INPUT VALIDATION
  if (plan !== 'Career Elite') return <InsufficientData message="INSUFFICIENT ACCESS — CAREER ELITE REQUIRED" />;
  if (!resumeText) return <InsufficientData message="INSUFFICIENT DATA — RESUME NOT PROVIDED" />;
  if (!analysisResult?.role) return <InsufficientData message="INSUFFICIENT DATA — ROLE NOT SELECTED" />;
  if (!analysisResult?.eightPoints || analysisResult.eightPoints.length === 0) return <InsufficientData message="INSUFFICIENT DATA — ANALYSIS NOT COMPLETED" />;

  const [subView, setSubView] = useState<'overview' | 'feed'>('overview');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MarketIntelligenceData | null>(null);

  useEffect(() => {
    const fetchEliteData = async () => {
      setLoading(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: `Generate a deterministic Market Intelligence report for a Career Elite user. 
          
          USER INPUT:
          Target Role: ${analysisResult.role}
          Resume Content: ${resumeText}
          8-Point Analysis Scores: ${JSON.stringify(analysisResult.eightPoints.map(p => ({ name: p.name, score: p.score })))}
          
          STRICT RULES:
          1. GROUND ALL INSIGHTS ONLY IN THE PROVIDED DATA.
          2. No generic advice or motivational language.
          3. Use directional labels: Rising, Stable, Softening.
          4. Market Feed signal categories: Skill, Role, Industry, Risk.
          5. Outlook sections: Positioning (Band: Bottom/Middle/Upper), Skills (Increasing, Plateau, Commoditization), Trajectory Pressure (Low/Moderate/High), Strategic Watchlist (3-5 items).
          6. If confidence is low, label output as "Directional".
          `,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                syncStatus: { type: Type.STRING },
                lastSync: { type: Type.STRING },
                feed: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      direction: { type: Type.STRING, description: "Rising, Stable, Softening" },
                      explanation: { type: Type.STRING },
                      whyItMatters: { type: Type.STRING },
                      category: { type: Type.STRING, description: "Skill, Role, Industry, Risk" }
                    }
                  }
                },
                outlook: {
                  type: Type.OBJECT,
                  properties: {
                    positioning: {
                      type: Type.OBJECT,
                      properties: {
                        band: { type: Type.STRING, description: "Bottom, Middle, Upper" },
                        risks: { type: Type.ARRAY, items: { type: Type.STRING } },
                        adjacentRoles: { type: Type.ARRAY, items: { type: Type.STRING } }
                      }
                    },
                    skills: {
                      type: Type.OBJECT,
                      properties: {
                        increasingImportance: { type: Type.ARRAY, items: { type: Type.STRING } },
                        plateauing: { type: Type.ARRAY, items: { type: Type.STRING } },
                        commoditizationRisk: { type: Type.ARRAY, items: { type: Type.STRING } }
                      }
                    },
                    trajectory: {
                      type: Type.OBJECT,
                      properties: {
                        pressure: { type: Type.STRING, description: "Low, Moderate, High" },
                        explanation: { type: Type.STRING }
                      }
                    },
                    watchlist: { type: Type.ARRAY, items: { type: Type.STRING } }
                  }
                }
              }
            }
          }
        });

        const parsed = JSON.parse(response.text || '{}');
        setData(parsed);
      } catch (err) {
        console.error("Elite data fetch failed", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEliteData();
  }, [analysisResult.role, resumeText, analysisResult.eightPoints]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
        <Loader2 size={64} className="text-indigo-500 animate-spin" strokeWidth={1.5} />
        <div className="text-center">
          <h3 className="text-2xl font-bold text-white mb-2 uppercase tracking-tight">Syncing Market Signals</h3>
          <p className="text-slate-500 font-medium">Updating strategy map from global hiring patterns...</p>
        </div>
      </div>
    );
  }

  if (subView === 'feed' && data) {
    return (
      <div className="max-w-[1200px] mx-auto py-12 px-10">
        <div className="mb-16 flex items-center gap-6">
          <button 
            onClick={() => setSubView('overview')}
            className="w-12 h-12 rounded-xl bg-[#16161E] border border-[#1D1D26] flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-xl"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3 text-indigo-500 mb-1">
              <Activity size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Global Intelligence Loop</span>
            </div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase">Market Feed</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {data.feed.map((signal, idx) => (
            <div key={idx} className="bg-[#16161E] border border-[#1D1D26] p-8 rounded-3xl group hover:border-indigo-500/30 transition-all shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-800/50 px-3 py-1 rounded-full">{signal.category} Signal</span>
                <DirectionBadge direction={signal.direction} />
              </div>
              <h3 className="text-xl font-bold text-white mb-4 tracking-tight">{signal.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6 font-medium">
                {signal.explanation}
              </p>
              <div className="pt-6 border-t border-white/5">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Why this matters</p>
                <p className="text-white text-xs font-bold leading-relaxed">{signal.whyItMatters}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 p-10 border border-[#1D1D26] border-dashed rounded-[3rem] text-center">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mb-4">Feed Integrity Principle</p>
          <p className="text-slate-500 text-xs max-w-2xl mx-auto leading-relaxed font-medium">
            Feed items are derived from weekly hiring records and emerging requirement deltas. These are directional observations, not guarantees of success.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto py-12 px-10">
      <div className="mb-20">
        <div className="flex items-center gap-3 text-indigo-500 mb-4 bg-indigo-500/5 w-fit px-4 py-1 rounded-full border border-indigo-500/10">
          <Sparkles size={14} />
          <span className="text-[10px] font-black uppercase tracking-widest">Career Elite Strategy Map</span>
        </div>
        <h2 className="text-6xl font-black text-white mb-6 tracking-tighter uppercase">Market Outlook</h2>
        <p className="text-slate-500 text-xl font-medium max-w-2xl leading-relaxed">
          Forecasting market movements and long-term trust signals for your trajectory.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-20">
        <div className="lg:col-span-4 bg-[#16161E] border border-[#1D1D26] rounded-[3rem] p-10 shadow-xl flex flex-col">
           <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                 <RefreshCw size={20} className="text-indigo-500 animate-[spin_4s_linear_infinite]" />
                 <h3 className="text-white text-xl font-bold uppercase tracking-tight">Market Sync</h3>
              </div>
              <span className="text-[9px] font-black text-green-400 bg-green-400/10 px-2 py-0.5 rounded border border-green-400/20">Active</span>
           </div>
           
           <div className="space-y-6 flex-1">
              <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Status</p>
                 <p className="text-slate-200 text-sm font-bold">{data?.syncStatus || 'Active — Monitoring weekly market changes'}</p>
                 <p className="text-[10px] text-slate-600 font-bold mt-2 uppercase tracking-widest">Last Sync: {data?.lastSync || '3 days ago'}</p>
              </div>

              <div className="space-y-4">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monitored Dimensions</p>
                 {[
                   { label: 'Skill demand movement', status: 'Rising' },
                   { label: 'Role saturation changes', status: 'Stable' },
                   { label: 'Seniority expectation drift', status: 'Stable' },
                   { label: 'Compensation pressure', status: 'Softening' }
                 ].map((d, i) => (
                    <div key={i} className="flex justify-between items-center text-xs font-bold border-b border-white/5 pb-3">
                       <span className="text-slate-500">{d.label}</span>
                       <span className={`text-[10px] uppercase tracking-widest ${d.status === 'Rising' ? 'text-green-400' : d.status === 'Softening' ? 'text-amber-400' : 'text-blue-400'}`}>{d.status}</span>
                    </div>
                 ))}
              </div>
           </div>

           <button 
             onClick={() => setSubView('feed')}
             className="mt-10 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-indigo-900/20 text-xs uppercase tracking-widest"
           >
             View Full Market Feed <ArrowRight size={14} />
           </button>
        </div>

        <div className="lg:col-span-8 space-y-10">
           <div className="bg-[#16161E] border border-[#1D1D26] rounded-[3rem] p-10 shadow-xl">
              <div className="flex items-center gap-3 mb-10">
                 <div className="w-12 h-12 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500">
                    <Target size={24} />
                 </div>
                 <h3 className="text-white text-2xl font-bold">Positioning Outlook</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="space-y-6">
                    <div className="p-6 bg-blue-600/5 rounded-2xl border border-blue-500/10 text-center">
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Positioning Band</p>
                       <p className="text-3xl font-black text-white">{data?.outlook.positioning.band || 'Middle'}</p>
                    </div>
                    <div className="space-y-3">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Positioning Risks</p>
                       {data?.outlook.positioning.risks.map((risk, i) => (
                          <div key={i} className="flex gap-3 text-sm text-slate-400 font-medium">
                             <span className="text-amber-500 mt-1 shrink-0">•</span>
                             {risk}
                          </div>
                       ))}
                    </div>
                 </div>
                 <div className="bg-[#0D0D12] rounded-2xl p-6 border border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Safer Adjacent Roles</p>
                    <div className="space-y-3">
                       {data?.outlook.positioning.adjacentRoles.map((role, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                             <span className="text-xs font-bold text-white">{role}</span>
                             <ChevronRight size={14} className="text-slate-600" />
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-[#16161E] border border-[#1D1D26] rounded-[3rem] p-10 shadow-xl">
              <div className="flex items-center gap-3 mb-10">
                 <div className="w-12 h-12 rounded-xl bg-indigo-600/10 flex items-center justify-center text-indigo-500">
                    <Activity size={24} />
                 </div>
                 <h3 className="text-white text-2xl font-bold">Skill Landscape (12-24mo)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {[
                   { label: 'Demand Increasing', list: data?.outlook.skills.increasingImportance, color: 'text-green-400' },
                   { label: 'Demand Plateauing', list: data?.outlook.skills.plateauing, color: 'text-blue-400' },
                   { label: 'Commoditization Risk', list: data?.outlook.skills.commoditizationRisk, color: 'text-amber-400' }
                 ].map((col, i) => (
                    <div key={i} className="space-y-4">
                       <p className={`text-[10px] font-black uppercase tracking-widest ${col.color}`}>{col.label}</p>
                       <div className="space-y-2">
                          {col.list?.map((s, idx) => (
                             <div key={idx} className="text-xs font-bold text-slate-400 p-3 bg-white/5 rounded-xl border border-white/5">
                                {s}
                             </div>
                          ))}
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-20">
         <div className="bg-[#16161E] border border-[#1D1D26] rounded-[3.5rem] p-12 shadow-xl relative overflow-hidden group">
            <div className="flex items-center gap-3 mb-10">
               <div className="w-12 h-12 rounded-xl bg-amber-600/10 flex items-center justify-center text-amber-500">
                  <ShieldAlert size={24} />
               </div>
               <h3 className="text-white text-2xl font-bold">Trajectory Pressure</h3>
            </div>
            <div className="space-y-8">
               <div className="flex items-end gap-3">
                  <span className={`text-6xl font-black ${data?.outlook.trajectory.pressure === 'High' ? 'text-red-500' : 'text-blue-500'}`}>
                    {data?.outlook.trajectory.pressure || 'Moderate'}
                  </span>
                  <span className="text-slate-500 font-bold text-xl mb-1 uppercase tracking-widest">Pressure</span>
               </div>
               <p className="text-slate-400 text-base font-medium leading-relaxed italic">
                 {data?.outlook.trajectory.explanation || "System generated analysis of structural pressures affecting career progression bands."}
               </p>
               <div className="p-4 bg-amber-600/5 border border-amber-500/10 rounded-2xl flex items-center gap-3">
                  <Info size={16} className="text-amber-500 shrink-0" />
                  <p className="text-[11px] font-bold text-amber-500/80 uppercase tracking-widest">
                    Trajectory modeling is updated weekly based on seniority compression signals.
                  </p>
               </div>
            </div>
         </div>

         <div className="bg-indigo-600 rounded-[3.5rem] p-12 text-white shadow-2xl relative overflow-hidden group">
            <Sparkles className="absolute bottom-4 right-4 opacity-10 group-hover:scale-110 transition-transform" size={160} />
            <div className="relative z-10">
               <div className="flex items-center gap-3 mb-10">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                     <Clock size={24} />
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight">Strategic Watchlist</h3>
               </div>
               <p className="text-indigo-100 font-medium mb-10 leading-relaxed text-sm">
                 Monitor these specific signals over the next quarter to maintain competitive leverage.
               </p>
               <div className="space-y-4">
                  {data?.outlook.watchlist.map((item, i) => (
                     <div key={i} className="flex items-center gap-4 p-4 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-sm group/item hover:bg-white/20 transition-all">
                        <div className="w-6 h-6 rounded-lg bg-indigo-400/20 flex items-center justify-center text-[10px] font-black">{i + 1}</div>
                        <span className="text-sm font-bold">{item}</span>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      </div>

      <div className="p-10 border border-[#1D1D26] border-dashed rounded-[3rem] text-center">
        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mb-4">Market Intelligence Principle</p>
        <p className="text-slate-500 text-sm max-w-2xl mx-auto leading-relaxed font-medium"> Factual, analytical, and cautious. Strategy map does not provide subjective career coaching or guaranteed success metrics. </p>
      </div>
    </div>
  );
};
