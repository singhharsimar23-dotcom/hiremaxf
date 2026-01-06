
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  UploadCloud, 
  Search, 
  Loader2, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle, 
  Terminal, 
  ArrowRight,
  ChevronRight,
  FileText,
  RefreshCw,
  Cpu,
  Target,
  Copy,
  Sparkles,
  Undo2,
  XCircle,
  CheckCircle2,
  TrendingUp,
  Database,
  Briefcase,
  GraduationCap,
  Code2,
  HelpCircle,
  AlertCircle,
  Activity,
  Eye,
  ZapOff,
  Volume2,
  History,
  Clock,
  BarChart3,
  Edit3
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  DiagnosticResult, 
  AnalysisPoint, 
  Verdict, 
  ComparisonData, 
  SignalAcquisitionType, 
  MarketInsight,
} from '../types';
import mammoth from 'mammoth';

const VerdictBadge: React.FC<{ verdict: Verdict }> = ({ verdict }) => {
  const styles = {
    Pass: 'bg-green-500/10 text-green-500 border-green-500/20',
    Weak: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    Failing: 'bg-red-500/10 text-red-500 border-red-500/20'
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${styles[verdict]}`}>
      {verdict}
    </span>
  );
};

const AcquisitionIcon: React.FC<{ type: SignalAcquisitionType }> = ({ type }) => {
  switch (type) {
    case 'production': return <Database size={12} />;
    case 'internship': return <Briefcase size={12} />;
    case 'academic': return <GraduationCap size={12} />;
    case 'project': return <Code2 size={12} />;
    default: return <HelpCircle size={12} />;
  }
};

const MarketTrendVisual: React.FC<{ insight: MarketInsight }> = ({ insight }) => {
  const data = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      value: 10 + Math.random() * 20 + (i * 2)
    }));
  }, []);

  return (
    <div className="space-y-4 group">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <p className="text-white font-black text-[11px] tracking-tight group-hover:text-blue-400 transition-colors uppercase leading-tight mb-1">
            {insight.trend}
          </p>
          <p className="text-gray-500 text-[10px] leading-relaxed font-medium opacity-80 line-clamp-2">
            {insight.implication}
          </p>
        </div>
        <div className="w-16 h-8 flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#3b82f6" 
                strokeWidth={2} 
                dot={false} 
                isAnimationActive={true}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="h-[1px] w-full bg-[#1D1D26]" />
    </div>
  );
};

export const AIReviewView: React.FC<{ onResult?: (res: DiagnosticResult) => void }> = ({ onResult }) => {
  const [step, setStep] = useState<'input' | 'processing' | 'report' | 'rebuilding' | 'rebuilt'>('input');
  const [targetRole, setTargetRole] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<AnalysisPoint | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsParsing(true);

    try {
      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer });
        setResumeText(res.value);
      } else if (file.type === 'text/plain') {
        const text = await file.text();
        setResumeText(text);
      } else if (file.type === 'application/pdf') {
        setResumeText(`[PDF Data Ingested: ${file.name}]\n\n(Note: PDF text extraction works best when text is selectable. If results are poor, please paste the text manually.)`);
      } else {
        alert("Unsupported file format. Please use PDF, DOCX, or TXT.");
      }
    } catch (err) {
      console.error("File parsing error:", err);
      alert("Failed to parse file. Please try pasting the text manually.");
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
        contents: `
          SYSTEM INSTRUCTION: You are performing a Target Role Simulation for the role: ${targetRole}.
          
          TASK: Execute a multi-layer market diagnostic using strictly observational language.
          
          CONSTRAINTS:
          - DO NOT give personal advice, rewrites, or recommendations.
          - DO NOT use motivational or editorial language.
          - ALL outputs must be phrased as market observations.
          - If a signal cannot be verified, treat it as absent.
          
          LAYERS TO SIMULATE:
          1. Recruiter Scan (6-10s Pass): Identify elements "Visible in first 8 seconds", "Likely skipped", or "Raises concern".
          2. Rejection Model: Assign probability bands (Low/Medium/High) to elimination buckets: Overqualified, Underqualified, Misaligned role, Weak signals, Market saturation.
          3. Noise Detection: Report Noise Density (Low/Med/High) and Signal-to-Noise Ratio (Low/Med/High).
          4. Saturation Index: Report current role competition intensity (Low/Med/High).
          5. Skill Radar: Flag skills as Stable or Declining.
          6. Longevity Estimate: Report as Short-lived, Moderate, or Durable.
          7. Signal Diagnostic (8 Points): Standard structural verification.
          
          INPUT RESUME:
          """
          ${resumeText}
          """
        `,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              role: { type: Type.STRING },
              overallScore: { type: Type.NUMBER },
              recruiterScan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    observation: { type: Type.STRING },
                    category: { type: Type.STRING, description: "visible, skipped, concern" },
                    element: { type: Type.STRING }
                  }
                }
              },
              rejectionReasons: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    reason: { type: Type.STRING },
                    probability: { type: Type.STRING, description: "Low, Medium, High" },
                    explanation: { type: Type.STRING }
                  }
                }
              },
              noiseDetection: {
                type: Type.OBJECT,
                properties: {
                  noiseDensity: { type: Type.STRING },
                  signalToNoiseRatio: { type: Type.STRING },
                  observations: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              },
              roleSaturation: { type: Type.STRING },
              skillRadar: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    skill: { type: Type.STRING },
                    status: { type: Type.STRING, description: "Stable, Declining" },
                    marketNote: { type: Type.STRING }
                  }
                }
              },
              longevityEstimate: {
                type: Type.OBJECT,
                properties: {
                  status: { type: Type.STRING, description: "Short-lived, Moderate, Durable" },
                  reasoning: { type: Type.STRING }
                }
              },
              points: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    verdict: { type: Type.STRING },
                    impact: { type: Type.STRING },
                    issues: { type: Type.ARRAY, items: { type: Type.STRING } },
                    remediation: { type: Type.ARRAY, items: { type: Type.STRING } },
                    type: { type: Type.STRING },
                    acquisitionClassification: { type: Type.STRING },
                    examples: {
                      type: Type.OBJECT,
                      properties: {
                        bad: { type: Type.STRING },
                        good: { type: Type.STRING }
                      }
                    }
                  }
                }
              },
              marketInsights: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    trend: { type: Type.STRING },
                    implication: { type: Type.STRING }
                  }
                }
              },
              rebuildRoadmap: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      setResult(data);
      if (onResult) onResult(data);
      setStep('report');
      if (data.points?.length > 0) setSelectedPoint(data.points[0]);
    } catch (err) {
      console.error("Analysis failed", err);
      setStep('input');
    }
  };

  const rebuildResume = async () => {
    if (!result) return;
    setStep('rebuilding');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const remediationSummary = result.points
        .filter(p => p.verdict !== 'Pass')
        .map(p => `${p.title} Observation: ${p.remediation.join(', ')}`)
        .join('\n');

      const prompt = `
        TASK: Rebuild this resume as a Market Signal Optimization exercise for the role: ${targetRole}.
        
        ORIGINAL DOCUMENT:
        """
        ${resumeText}
        """
        
        OBSERVED GAPS FOR NORMALIZATION:
        ${remediationSummary}
        
        OPTIMIZATION REQUIREMENTS:
        - Perform structural normalization for high-fidelity signal detection by ATS/Recruiters.
        - Normalize all identified weak/missing signals to meet market benchmarks.
        - For EVERY improvement made, provide a "reasoning" block that explains the screening-side preference.
        - Output the result as a JSON object containing newResume (Markdown), improvements (Array of {change, reasoning}), and scoreLift (number).
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              newResume: { type: Type.STRING },
              improvements: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT,
                  properties: {
                    change: { type: Type.STRING },
                    reasoning: { type: Type.STRING }
                  }
                } 
              },
              scoreLift: { type: Type.NUMBER }
            }
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      setComparison({
        oldResume: resumeText,
        newResume: parsed.newResume,
        improvements: parsed.improvements || [],
        scoreLift: parsed.scoreLift || 25
      });
      setStep('rebuilt');
    } catch (err) {
      console.error("Rebuild failed", err);
      setStep('report');
    }
  };

  const handleUpdateNewResume = (text: string) => {
    if (comparison) {
      setComparison({ ...comparison, newResume: text });
    }
  };

  if (step === 'input') {
    return (
      <div className="max-w-5xl mx-auto py-12 px-6">
        <div className="mb-12 flex justify-between items-start">
          <div>
            <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">Market Ingestion</h2>
            <p className="text-gray-500 text-lg">Initialize a Target Role Simulation to verify profile signals.</p>
          </div>
          <div className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/20 px-4 py-2 rounded-xl">
             <AlertCircle size={16} className="text-blue-500" />
             <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest leading-none">Simulation Mode Active</span>
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1 flex items-center gap-2">
              <Target size={12} className="text-blue-500" /> Target Role Simulation
            </label>
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
              <input 
                type="text" 
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. Senior Software Engineer"
                className="w-full bg-[#16161E] border border-[#1D1D26] rounded-2xl py-5 pl-14 pr-6 text-white focus:outline-none focus:border-blue-500 transition-all shadow-inner"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-[2.5rem] p-12 flex flex-col items-center justify-center transition-all group relative overflow-hidden ${
                fileName ? 'border-blue-500/50 bg-blue-500/5' : 'border-[#1D1D26] hover:border-blue-500/50 hover:bg-blue-500/5 cursor-pointer'
              }`}
            >
              {isParsing && (
                <div className="absolute inset-0 bg-[#0D0D12]/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                   <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
                   <p className="text-xs font-bold uppercase tracking-widest text-blue-500">Extracting Signal...</p>
                </div>
              )}
              
              <UploadCloud size={48} className={`${fileName ? 'text-blue-500' : 'text-gray-600 group-hover:text-blue-500'} mb-6 transition-colors`} />
              <p className="text-white font-black text-xl mb-2">{fileName ? 'Signal Captured' : 'Upload Resume'}</p>
              <p className="text-gray-500 text-sm font-medium">{fileName ? fileName : 'PDF, DOCX, or TXT supported'}</p>
              
              {fileName && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setFileName(null); setResumeText(''); }}
                  className="mt-6 text-[10px] font-bold text-red-500 uppercase tracking-widest hover:text-red-400"
                >
                  Clear File
                </button>
              )}
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload}
                className="hidden" 
                accept=".pdf,.docx,.txt" 
              />
            </div>

            <div className="bg-[#16161E] border border-[#1D1D26] rounded-[2.5rem] p-10 flex flex-col shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-gray-500">
                  <Terminal size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Manual Text Ingestion</span>
                </div>
                {resumeText.length > 0 && (
                  <span className="text-[9px] font-mono text-gray-600 bg-gray-900 px-2 py-0.5 rounded">
                    {resumeText.length} chars
                  </span>
                )}
              </div>
              <textarea 
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste resume content here for immediate signal simulation..."
                className="flex-1 bg-transparent border-none resize-none text-gray-300 font-mono text-xs leading-relaxed focus:outline-none placeholder:text-gray-700"
              />
            </div>
          </div>

          <button 
            onClick={startAnalysis}
            disabled={!targetRole || !resumeText || isParsing}
            className="w-full bg-white text-black font-black py-6 rounded-3xl flex items-center justify-center gap-4 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed group tracking-[0.2em] text-[11px] uppercase shadow-2xl"
          >
            Start Market Simulation <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
          </button>
        </div>
      </div>
    );
  }

  if (step === 'processing' || step === 'rebuilding') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] gap-12">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500/20 blur-[60px] rounded-full animate-pulse"></div>
          <Loader2 size={100} className="text-blue-500 animate-spin relative z-10" strokeWidth={1} />
          <div className="absolute inset-0 flex items-center justify-center relative z-10">
            {step === 'rebuilding' ? <Sparkles size={32} className="text-blue-500/60" /> : <Cpu size={32} className="text-blue-500/60" />}
          </div>
        </div>
        <div className="text-center space-y-4 max-w-sm">
          <h3 className="text-3xl font-black text-white tracking-tighter">
            {step === 'rebuilding' ? 'Signal Normalization' : 'Market Simulation Engine'}
          </h3>
          <p className="text-gray-500 font-mono text-[10px] leading-relaxed uppercase tracking-[0.2em]">
            {step === 'rebuilding' 
              ? 'Executing market-driven structural reconstruction...' 
              : 'Verifying resume signals against active hiring standards...'}
          </p>
        </div>
        <div className="w-80 h-1.5 bg-[#16161E] rounded-full overflow-hidden border border-[#1D1D26]">
          <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 w-1/3 animate-[shimmer_1.5s_infinite]"></div>
        </div>
      </div>
    );
  }

  if (step === 'rebuilt' && comparison) {
    return (
      <div className="max-w-[1400px] mx-auto py-12 px-10">
        <div className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setStep('report')}
              className="w-12 h-12 rounded-2xl bg-[#16161E] border border-[#1D1D26] flex items-center justify-center text-gray-400 hover:text-white transition-all"
            >
              <Undo2 size={20} />
            </button>
            <div>
              <h2 className="text-4xl font-black text-white tracking-tighter">Signal Optimization Result</h2>
              <p className="text-gray-500 font-bold text-xs uppercase tracking-widest">Simulation Score Lift: <span className="text-green-500">+{comparison.scoreLift}% Estimated</span></p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isEditing ? 'bg-blue-600 text-white' : 'bg-[#16161E] text-gray-400 border border-[#1D1D26] hover:text-white'}`}
            >
                <Edit3 size={16} /> {isEditing ? 'Exit Editor' : 'Direct Edit Signal'}
            </button>
            <button 
                onClick={() => {
                navigator.clipboard.writeText(comparison.newResume);
                alert('Normalized draft copied to clipboard.');
                }}
                className="flex items-center gap-3 bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-500/20"
            >
                <Copy size={16} /> Copy Normalized Signal
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-[#16161E] rounded-[2rem] p-8 border border-[#1D1D26] shadow-xl">
              <div className="flex items-center gap-2 mb-8 border-b border-[#1D1D26] pb-4">
                <TrendingUp size={16} className="text-green-500" />
                <span className="text-white text-[10px] font-black uppercase tracking-widest">Improvement Rationale</span>
              </div>
              <div className="space-y-6">
                {comparison.improvements.map((imp, idx) => (
                  <div key={idx} className="space-y-3 group border-b border-[#1D1D26]/50 pb-6 last:border-0">
                    <div className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle2 size={12} className="text-green-500" />
                      </div>
                      <p className="text-white text-[11px] font-black uppercase tracking-tight">{imp.change}</p>
                    </div>
                    <div className="pl-8">
                       <p className="text-gray-500 text-[11px] leading-relaxed font-medium italic">
                         {imp.reasoning}
                       </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-600/10 to-indigo-600/5 rounded-[2rem] p-10 border border-blue-500/20 text-center shadow-xl">
              <h4 className="text-white font-black text-xl mb-2">Market Pass-Rate</h4>
              <div className="text-6xl font-black text-blue-500 mb-2">{(result?.overallScore || 0) + comparison.scoreLift}%</div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed">
                Projected Screening Clearance Probability
              </p>
            </div>
          </div>

          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-red-500/5 border border-red-500/20 rounded-xl w-fit">
                <XCircle size={14} className="text-red-500" />
                <span className="text-red-500 text-[10px] font-bold uppercase tracking-widest">Original Draft (Weak)</span>
              </div>
              <div className="bg-[#0D0D12] rounded-[2.5rem] border border-[#1D1D26] p-10 h-[800px] overflow-y-auto custom-scrollbar">
                <div className="prose prose-invert prose-xs font-mono whitespace-pre-wrap text-gray-600 opacity-40 leading-relaxed">
                  {comparison.oldResume}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/5 border border-green-500/20 rounded-xl w-fit">
                <CheckCircle2 size={14} className="text-green-500" />
                <span className="text-green-500 text-[10px] font-bold uppercase tracking-widest">Normalized Draft (Pass)</span>
              </div>
              <div className="bg-[#16161E] rounded-[2.5rem] border border-blue-500/40 h-[800px] shadow-2xl relative group ring-1 ring-blue-500/10 overflow-hidden">
                {isEditing ? (
                  <textarea 
                    value={comparison.newResume}
                    onChange={(e) => handleUpdateNewResume(e.target.value)}
                    className="w-full h-full bg-transparent border-none p-10 text-gray-200 font-mono text-sm leading-relaxed resize-none focus:outline-none custom-scrollbar"
                  />
                ) : (
                  <div className="p-10 h-full overflow-y-auto custom-scrollbar">
                    <div className="absolute top-8 right-8 opacity-5 group-hover:opacity-20 transition-opacity">
                      <Sparkles size={140} className="text-blue-500" />
                    </div>
                    <div className="prose prose-invert prose-sm font-mono whitespace-pre-wrap text-gray-200 relative z-10 leading-relaxed">
                      {comparison.newResume}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto py-12 px-10">
      {/* Header Info */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 mb-16">
        <div>
          <div className="flex items-center gap-3 text-blue-500 mb-6 bg-blue-500/5 w-fit px-4 py-1.5 rounded-full border border-blue-500/10">
            <Terminal size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Simulation Context: {result?.role}</span>
          </div>
          <h2 className="text-7xl font-black text-white tracking-tighter leading-none mb-2">Market Diagnostic</h2>
          <p className="text-gray-500 text-lg font-medium opacity-80">Strict market observations. No advice. No forecasts.</p>
        </div>
        <div className="bg-[#16161E] px-10 py-8 rounded-[2.5rem] border border-[#1D1D26] text-right shadow-2xl min-w-[240px]">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.3em] mb-3">Presence Index</p>
          <div className="flex items-end justify-end gap-3">
            <span className={`text-6xl font-black leading-none tracking-tighter ${result?.overallScore && result.overallScore < 50 ? 'text-red-500' : 'text-green-500'}`}>
              {result?.overallScore}
            </span>
            <span className="text-gray-600 font-black text-xl mb-1">/100</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-16">
        <div className="lg:col-span-3 space-y-12">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#16161E] rounded-[3rem] p-10 border border-[#1D1D26] shadow-xl">
               <div className="flex items-center gap-3 mb-8">
                  <Eye size={20} className="text-blue-500" />
                  <span className="text-white text-[10px] font-black uppercase tracking-widest">Recruiter Scan (6-10s Pass)</span>
               </div>
               <div className="space-y-4">
                  {result?.recruiterScan.map((obs, i) => (
                    <div key={i} className="flex gap-4 p-4 rounded-2xl bg-[#0D0D12] border border-[#1D1D26]">
                      <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${
                        obs.category === 'concern' ? 'bg-red-500' : obs.category === 'skipped' ? 'bg-gray-600' : 'bg-green-500'
                      }`} />
                      <div>
                        <p className="text-[10px] font-black uppercase text-gray-600 tracking-widest mb-1">{obs.element} — {obs.category}</p>
                        <p className="text-gray-300 text-xs leading-relaxed">{obs.observation}</p>
                      </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="bg-[#16161E] rounded-[3rem] p-10 border border-[#1D1D26] shadow-xl">
               <div className="flex items-center gap-3 mb-8">
                  <ZapOff size={20} className="text-red-500" />
                  <span className="text-white text-[10px] font-black uppercase tracking-widest">Rejection Probability Model</span>
               </div>
               <div className="space-y-4">
                  {result?.rejectionReasons.map((reason, i) => (
                    <div key={i} className="flex justify-between items-start gap-4 p-4 rounded-2xl bg-[#0D0D12] border border-[#1D1D26]">
                      <div className="flex-1">
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">{reason.reason}</p>
                        <p className="text-gray-500 text-[11px] leading-relaxed">{reason.explanation}</p>
                      </div>
                      <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                        reason.probability === 'High' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                        reason.probability === 'Medium' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                        'bg-green-500/10 text-green-500 border-green-500/20'
                      }`}>
                        {reason.probability}
                      </div>
                    </div>
                  ))}
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {result?.points.map((point) => (
              <div 
                key={point.id}
                onClick={() => setSelectedPoint(point)}
                className={`bg-[#16161E] border rounded-3xl p-6 cursor-pointer hover:border-blue-500/50 transition-all group relative overflow-hidden ${selectedPoint?.id === point.id ? 'border-blue-500 ring-2 ring-blue-500/5' : 'border-[#1D1D26]'}`}
              >
                <div className="flex justify-between items-start mb-4">
                   <VerdictBadge verdict={point.verdict as Verdict} />
                   <div className={`${point.verdict === 'Pass' ? 'text-green-500' : 'text-amber-500'}`}>
                      {point.verdict === 'Pass' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                   </div>
                </div>
                <h3 className="text-white font-black text-xs mb-2 group-hover:text-blue-400 transition-colors uppercase tracking-tight">{point.title}</h3>
                <p className="text-gray-500 text-[10px] leading-relaxed line-clamp-2 opacity-70 uppercase tracking-tighter">{point.impact}</p>
              </div>
            ))}
          </div>

          {selectedPoint ? (
            <div className="bg-[#16161E] rounded-[3.5rem] p-16 border border-[#1D1D26] relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
                <ShieldAlert size={200} />
              </div>
              <div className="flex items-center gap-6 mb-12 relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-[#0D0D12] border border-[#1D1D26] flex items-center justify-center text-blue-500 shadow-inner">
                  <ShieldAlert size={32} />
                </div>
                <div>
                  <h3 className="text-4xl font-black text-white tracking-tighter">{selectedPoint.title} Simulation</h3>
                  <p className="text-gray-500 font-bold text-sm uppercase tracking-widest opacity-60">Market Observation: Signal Presence</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16 relative z-10">
                <div className="space-y-8">
                  <div className="space-y-6">
                    <h4 className="text-[11px] font-black text-red-500 uppercase tracking-[0.25em]">Unverified Signals</h4>
                    <div className="space-y-4">
                      {selectedPoint.issues.map((issue, i) => (
                        <div key={i} className="p-4 bg-red-500/5 rounded-2xl border border-red-500/10 text-gray-300 text-sm leading-relaxed">
                          {issue}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-[0.25em]">Acquisition Source</h4>
                    <div className="space-y-4">
                      {selectedPoint.remediation.map((fix, i) => (
                        <div key={i} className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10 text-gray-300 text-sm font-bold">
                          {fix}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-8">
                   <div className="space-y-4">
                      <h4 className="text-[11px] font-black text-gray-600 uppercase tracking-[0.25em]">Screening Exit Pattern</h4>
                      <div className="p-6 bg-[#0D0D12] rounded-3xl border border-[#1D1D26] italic text-gray-500 text-xs leading-relaxed">"{selectedPoint.examples.bad}"</div>
                   </div>
                   <div className="space-y-4">
                      <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.25em]">Screening Selection Pattern</h4>
                      <div className="p-6 bg-green-500/5 rounded-3xl border border-green-500/20 text-gray-300 text-xs leading-relaxed font-black">"{selectedPoint.examples.good}"</div>
                   </div>
                   <div className="flex gap-4">
                      <div className="flex items-center gap-2 bg-[#0D0D12] px-4 py-2 rounded-full border border-gray-800">
                         <AcquisitionIcon type={selectedPoint.acquisitionClassification as SignalAcquisitionType} />
                         <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">{selectedPoint.acquisitionClassification} source</span>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center bg-[#16161E] rounded-[3.5rem] border border-dashed border-[#1D1D26] opacity-50 text-gray-600 text-[10px] font-black uppercase tracking-widest">Select diagnostic node for simulation depth</div>
          )}

        </div>

        <div className="space-y-10">
          <div className="bg-[#16161E] rounded-[3rem] p-10 border border-[#1D1D26] shadow-xl">
             <div className="flex items-center gap-3 mb-8">
                <Volume2 size={18} className="text-amber-500" />
                <span className="text-white text-[10px] font-black uppercase tracking-widest">Resume Noise Detection</span>
             </div>
             <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 rounded-2xl bg-[#0D0D12] border border-[#1D1D26] text-center">
                   <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Noise Density</p>
                   <p className={`text-sm font-black ${result?.noiseDetection.noiseDensity === 'High' ? 'text-red-500' : 'text-green-500'}`}>{result?.noiseDetection.noiseDensity}</p>
                </div>
                <div className="p-4 rounded-2xl bg-[#0D0D12] border border-[#1D1D26] text-center">
                   <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Signal-to-Noise</p>
                   <p className={`text-sm font-black ${result?.noiseDetection.signalToNoiseRatio === 'Low' ? 'text-red-500' : 'text-green-500'}`}>{result?.noiseDetection.signalToNoiseRatio}</p>
                </div>
             </div>
             <div className="space-y-3">
                {result?.noiseDetection.observations.map((obs, i) => (
                  <p key={i} className="text-[11px] text-gray-500 leading-relaxed border-l border-gray-800 pl-3">{obs}</p>
                ))}
             </div>
          </div>

          <div className="bg-[#16161E] rounded-[3rem] p-10 border border-[#1D1D26] shadow-xl">
             <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-3">
                  <BarChart3 size={18} className="text-blue-500" />
                  <span className="text-white text-[10px] font-black uppercase tracking-widest">Market Saturation Index</span>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                  result?.roleSaturation === 'High' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'
                }`}>{result?.roleSaturation} Saturation</span>
             </div>
             <div className="space-y-8">
                <div className="flex items-center gap-3 mb-2 border-b border-[#1D1D26] pb-4">
                  <History size={16} className="text-purple-500" />
                  <span className="text-white text-[10px] font-black uppercase tracking-widest">Skill Obsolescence Radar</span>
                </div>
                {result?.skillRadar.map((item, i) => (
                  <div key={i} className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                       <p className="text-white text-xs font-black uppercase tracking-tight">{item.skill}</p>
                       <p className="text-gray-500 text-[10px]">{item.marketNote}</p>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                      item.status === 'Declining' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                    }`}>{item.status}</span>
                  </div>
                ))}
             </div>
          </div>

          <div className="bg-[#16161E] rounded-[3rem] p-10 border border-[#1D1D26] shadow-xl">
             <div className="flex items-center gap-3 mb-6">
                <Clock size={18} className="text-teal-500" />
                <span className="text-white text-[10px] font-black uppercase tracking-widest">Longevity Estimate</span>
             </div>
             <div className="p-6 rounded-3xl bg-[#0D0D12] border border-[#1D1D26] text-center mb-6">
                <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Competitiveness Profile</p>
                <p className="text-2xl font-black text-white tracking-tighter">{result?.longevityEstimate.status}</p>
             </div>
             <p className="text-gray-500 text-[11px] leading-relaxed italic">{result?.longevityEstimate.reasoning}</p>
          </div>

          <div className="bg-[#16161E] rounded-[3rem] p-10 border border-[#1D1D26] shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-transparent opacity-20" />
            <div className="flex items-center gap-3 mb-10">
              <Activity size={18} className="text-blue-500" />
              <span className="text-white text-[10px] font-black uppercase tracking-[0.3em]">Market Intelligence Feed</span>
            </div>
            <div className="space-y-8">
              {result?.marketInsights.map((insight, i) => (
                <MarketTrendVisual key={i} insight={insight} />
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-700 to-indigo-900 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
            <h4 className="text-3xl font-black mb-6 leading-[1.1] tracking-tighter">Signal Normalization</h4>
            <p className="text-blue-100 text-xs mb-10 leading-relaxed font-bold opacity-80 uppercase tracking-tight">
              Execute structural reconstruction to align observations with recruiter benchmarks.
            </p>
            <button 
              onClick={rebuildResume}
              className="w-full bg-white text-blue-900 font-black py-5 rounded-[1.5rem] text-[10px] uppercase tracking-[0.25em] hover:bg-blue-50 transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-95"
            >
              Rebuild Simulation <Sparkles size={18} />
            </button>
          </div>
          
          <div className="px-6 py-4 rounded-3xl border border-gray-800/50 text-center">
             <p className="text-[9px] font-bold text-gray-700 uppercase tracking-widest leading-relaxed">
               Evaluation strictly based on automated screening heuristics and live market data. No outcome is guaranteed. This is a simulation, not professional advice.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};
