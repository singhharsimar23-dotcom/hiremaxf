
import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  Search, 
  Loader2, 
  ShieldCheck, 
  Target, 
  Lock, 
  ArrowRight,
  FileText,
  AlertCircle,
  CheckCircle2,
  Pencil,
  ArrowLeft
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { UserPlan, DiagnosticResult } from '../types';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;

interface AIReviewViewProps {
  plan: UserPlan;
  onResult: (res: DiagnosticResult) => void;
  onUpload: (text: string) => void;
  pendingResumeText: string;
  onUpgrade: () => void;
  onStartScratch: () => void;
}

export const AIReviewView: React.FC<AIReviewViewProps> = ({ plan, onResult, onUpload, pendingResumeText, onUpgrade, onStartScratch }) => {
  const [step, setStep] = useState<'upload' | 'analyze' | 'processing' | 'report'>('upload');
  const [targetRole, setTargetRole] = useState('');
  const [resumeText, setResumeText] = useState(pendingResumeText || '');
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pendingResumeText) {
      setResumeText(pendingResumeText);
      setStep('analyze');
    }
  }, [pendingResumeText]);

  const isStarter = plan === 'Starter';

  const processFile = async (file: File) => {
    setIsParsing(true);
    try {
      let fullText = '';
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
        }
      } else if (file.type.includes('word')) {
        const arrayBuffer = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer });
        fullText = res.value;
      } else {
        fullText = await file.text();
      }
      
      setResumeText(fullText);
      // Immediately notify parent of upload to satisfy the "Resume Received" flow
      onUpload(fullText);
    } catch (err) {
      alert("Parsing failed. Please paste text.");
    } finally {
      setIsParsing(false);
    }
  };

  const startAnalysis = async () => {
    if (!targetRole || !resumeText) return;
    setStep('processing');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze this resume for the role: ${targetRole}. Follow strict HireMax deterministic rules. 
        Focus on structural safety and 8 key hiring signals.
        Input Text: ${resumeText}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              role: { type: Type.STRING },
              overallScore: { type: Type.NUMBER },
              foundation: {
                type: Type.OBJECT,
                properties: {
                  atsShield: { type: Type.STRING },
                  readability: { type: Type.STRING },
                  marketReadiness: { type: Type.STRING },
                  strengthsSnapshot: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              },
              eightPoints: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    name: { type: Type.STRING },
                    score: { type: Type.NUMBER },
                    explanation: { type: Type.STRING },
                    evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
                    implications: { type: Type.STRING }
                  }
                }
              },
              weaknessTeasers: { type: Type.ARRAY, items: { type: Type.STRING } },
              recruiterScan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING, description: 'visible, skipped, concern' },
                    element: { type: Type.STRING },
                    observation: { type: Type.STRING }
                  }
                }
              },
              rejectionReasons: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    probability: { type: Type.STRING, description: 'High, Medium, Low' },
                    reason: { type: Type.STRING },
                    explanation: { type: Type.STRING }
                  }
                }
              },
              roleSaturation: { type: Type.STRING },
              skillRadar: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    skill: { type: Type.STRING },
                    marketNote: { type: Type.STRING },
                    status: { type: Type.STRING, description: 'Growing, Stable, Declining' }
                  }
                }
              },
              longevityEstimate: {
                type: Type.OBJECT,
                properties: {
                  status: { type: Type.STRING },
                  reasoning: { type: Type.STRING }
                }
              }
            }
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      
      const analysisId = crypto.randomUUID();
      const finalResult: DiagnosticResult = {
        ...data,
        analysisId,
        resumeText
      };
      setResult(finalResult);
      onResult(finalResult);
      setStep('report');
    } catch (err) {
      console.error(err);
      setStep('analyze');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  if (step === 'upload') {
    return (
      <div className="max-w-5xl mx-auto py-12 px-6 animate-in fade-in duration-500">
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-white mb-2">Initialize System</h2>
          <p className="text-slate-400">Step 1: Provide your professional document for structural mapping.</p>
        </div>

        <div className="space-y-8">
          <div 
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-[3rem] p-24 flex flex-col items-center justify-center cursor-pointer transition-all group ${
              isDragging ? 'border-blue-500 bg-blue-500/10 scale-[1.01]' : 'border-[#1D1D26] hover:bg-white/5'
            }`}
          >
            {isParsing ? <Loader2 className="animate-spin text-blue-500 mb-4" /> : <UploadCloud size={64} className={`${isDragging ? 'text-blue-500' : 'text-slate-500 group-hover:text-blue-500'} mb-6 transition-colors`} />}
            <p className="text-white font-bold text-2xl">{isDragging ? 'Release to Upload' : 'Drop Resume Here'}</p>
            <p className="text-slate-500 text-sm mt-3 uppercase tracking-widest font-black">PDF, DOCX, or TXT preferred</p>
            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
          </div>

          <div className="flex items-center gap-6 p-8 bg-[#16161E] border border-[#1D1D26] rounded-3xl">
            <div className="flex-1">
              <p className="text-white font-bold mb-1">Manual Entry</p>
              <p className="text-slate-500 text-xs">If you prefer to paste your resume text directly.</p>
            </div>
            <button 
              onClick={() => setStep('analyze')}
              className="px-6 py-3 bg-[#1A1D26] border border-[#2D313D] text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest hover:text-white transition-all"
            >
              Paste Text
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'analyze') {
    return (
      <div className="max-w-4xl mx-auto py-12 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-12 flex items-center gap-4">
          <button onClick={() => setStep('upload')} className="text-slate-500 hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-4xl font-bold text-white mb-2">Market Calibration</h2>
            <p className="text-slate-400">Step 2: Define your target role to calibrate evaluation signals.</p>
          </div>
        </div>

        <div className="space-y-10">
          <div className="bg-[#16161E] border border-[#1D1D26] rounded-[2.5rem] p-10 space-y-8 shadow-2xl">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">
                Target Role
              </label>
              <input 
                type="text" 
                autoFocus
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. Staff Backend Engineer"
                className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-2xl p-5 text-white outline-none focus:border-blue-500 text-lg font-bold transition-all"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">
                Resume Context
              </label>
              <textarea 
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-2xl p-5 text-slate-400 text-sm h-48 resize-none outline-none focus:border-blue-500 transition-all font-medium"
                placeholder="Paste your resume content here..."
              />
            </div>
          </div>

          <button 
            onClick={startAnalysis}
            disabled={!targetRole || !resumeText || isParsing}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-6 rounded-3xl flex items-center justify-center gap-4 transition-all disabled:opacity-50 uppercase tracking-[0.2em] text-xs shadow-2xl shadow-blue-900/30"
          >
            Check My Market Readiness <ArrowRight size={20} />
          </button>
        </div>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-10">
        <Loader2 size={80} className="text-blue-500 animate-spin" strokeWidth={1.5} />
        <div className="text-center space-y-4">
          <h3 className="text-3xl font-black text-white uppercase tracking-tight">System Evaluation in Progress</h3>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Mapping target signals for: {targetRole}</p>
          <div className="flex justify-center gap-8 pt-6">
             {['Parsing Layers', 'Scoring Signals', 'Detecting Roadblocks'].map((l, i) => (
               <div key={i} className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> {l}
               </div>
             ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto py-12 px-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-16">
        <div>
          <h2 className="text-5xl font-black text-white mb-2 tracking-tight uppercase">Assessment Overview</h2>
          <p className="text-slate-500 font-medium">Readiness assessment for {result?.role}</p>
        </div>
        <div className="bg-[#16161E] px-10 py-8 rounded-3xl border border-[#1D1D26] text-right shadow-xl">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Foundation Score</p>
          <p className="text-6xl font-black text-white">{result?.overallScore}<span className="text-2xl text-slate-700">/100</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-[#16161E] rounded-[3rem] p-10 border border-[#1D1D26] shadow-xl">
             <div className="flex items-center gap-3 mb-8">
                <ShieldCheck className="text-blue-500" />
                <h3 className="text-white text-xl font-bold uppercase tracking-tight">Foundation Unlocks</h3>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-[#0D0D12] rounded-2xl border border-white/5">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">ATS Shield</p>
                   <p className="text-white font-bold">{result?.foundation?.atsShield ?? 'N/A'}</p>
                </div>
                <div className="p-6 bg-[#0D0D12] rounded-2xl border-white/5">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Readability</p>
                   <p className="text-white font-bold">{result?.foundation?.readability ?? 'N/A'}</p>
                </div>
                <div className="p-6 bg-[#0D0D12] rounded-2xl border-white/5">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Market Readiness</p>
                   <p className="text-white font-bold">{result?.foundation?.marketReadiness ?? 'N/A'}</p>
                </div>
                <div className="p-6 bg-[#0D0D12] rounded-2xl border-white/5">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Top Strengths</p>
                   <p className="text-white font-bold">{result?.foundation?.strengthsSnapshot?.length ?? 0} Signals Found</p>
                </div>
             </div>
          </div>

          <div className="bg-[#16161E] rounded-[3rem] p-10 border border-[#1D1D26] shadow-xl">
            <div className="flex items-center gap-3 mb-8">
               <Target className="text-amber-500" />
               <h3 className="text-white text-xl font-bold uppercase tracking-tight">8-Point System (Scores Only)</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result?.eightPoints?.map(point => (
                <div key={point.id} className="p-4 bg-[#0D0D12] rounded-xl border border-white/5 flex justify-between items-center group">
                  <span className="text-sm font-bold text-slate-400 uppercase tracking-tight">{point.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-white">{point.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-[#16161E] rounded-3xl p-8 border border-[#1D1D26] relative overflow-hidden shadow-xl">
             <div className="flex items-center gap-3 mb-6">
                <AlertCircle className="text-red-500" />
                <h3 className="text-white font-bold uppercase tracking-tight">Weakness Preview</h3>
             </div>
             <div className="space-y-4">
               {result?.weaknessTeasers?.slice(0, 2).map((t, i) => (
                 <div key={i} className="text-sm text-slate-400 font-medium flex gap-3">
                   <span className="text-red-500 mt-1 shrink-0">•</span>
                   {t}
                 </div>
               ))}
               <div className="pt-4 mt-4 border-t border-white/5">
                  <div className="blur-[3px] select-none opacity-50 space-y-2">
                    <p className="text-xs text-slate-500 uppercase">Detailed rejection analysis lines...</p>
                    <p className="text-xs text-slate-500 uppercase">Detailed rejection analysis lines...</p>
                  </div>
                  <div className="mt-6 p-6 bg-blue-600/10 border border-blue-500/20 rounded-2xl text-center">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">Detailed analysis in Career Pro</p>
                    <button 
                      onClick={onUpgrade}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20"
                    >
                      Unlock Detailed Review
                    </button>
                  </div>
               </div>
             </div>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
            <Lock className="absolute top-4 right-4 opacity-20 group-hover:scale-110 transition-transform" />
            <h4 className="text-lg font-black uppercase mb-2 tracking-tight">Rebuild Resume</h4>
            <p className="text-blue-100 text-xs mb-8 font-medium leading-relaxed opacity-90">
              Deterministic rebuilding based on knockout detection.
            </p>
            <button 
              onClick={onUpgrade}
              className="w-full bg-white text-blue-900 font-black py-4 rounded-2xl text-xs uppercase tracking-widest hover:bg-blue-50 transition-all shadow-xl"
            >
              {isStarter ? 'Unlock Rebuild Utility' : 'Open Rebuild Tool'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
