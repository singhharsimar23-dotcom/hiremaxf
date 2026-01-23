
import React from 'react';
import { 
  FileText, 
  Clock, 
  Zap, 
  Eye, 
  Pencil, 
  Download, 
  Plus, 
  Search,
  ChevronRight,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  // Fix: Adding missing Target icon import from lucide-react
  Target
} from 'lucide-react';
import { ResumeGroup, ResumeVersion, DiagnosticResult } from '../types';

interface ResumeHistoryViewProps {
  history: ResumeGroup[];
  analysisHistory: Record<string, DiagnosticResult>;
  onEdit: (groupId: string, versionId: string) => void;
  onView: (groupId: string, versionId: string) => void;
  onStartNew: () => void;
}

const VersionRow: React.FC<{ 
  version: ResumeVersion; 
  groupId: string;
  analysis: DiagnosticResult | undefined;
  onEdit: (gid: string, vid: string) => void;
  onView: (gid: string, vid: string) => void;
}> = ({ version, groupId, analysis, onEdit, onView }) => {
  const isOptimized = version.type === 'optimized';

  return (
    <div className="group flex items-center justify-between p-6 bg-[#1A1D26] border border-[#2D313D] rounded-2xl hover:border-blue-500/30 transition-all">
      <div className="flex items-center gap-6">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isOptimized ? 'bg-green-600/10 text-green-500' : 'bg-slate-700/20 text-slate-400'}`}>
          <FileText size={20} />
        </div>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h4 className="text-white font-bold text-sm">
              {isOptimized ? 'Optimized Version' : 'Original Version'}
            </h4>
            <span className="text-[9px] font-black uppercase tracking-widest bg-slate-800 px-2 py-0.5 rounded text-slate-500">
              v{version.versionId.slice(0, 4)}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
             <span className="flex items-center gap-1.5"><Clock size={12} /> {new Date(version.updatedAt).toLocaleDateString()}</span>
             {analysis && (
               <span className="flex items-center gap-1.5 text-blue-400">
                 <Zap size={12} /> Score: {analysis.overallScore}/100
               </span>
             )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => onView(groupId, version.versionId)}
          className="p-2 text-slate-400 hover:text-white transition-colors"
          title="View"
        >
          <Eye size={18} />
        </button>
        <button 
          onClick={() => onEdit(groupId, version.versionId)}
          className="p-2 text-slate-400 hover:text-white transition-colors"
          title="Edit"
        >
          <Pencil size={18} />
        </button>
        <button 
          className="p-2 text-slate-400 hover:text-white transition-colors"
          title="Download"
        >
          <Download size={18} />
        </button>
      </div>
    </div>
  );
};

export const ResumeHistoryView: React.FC<ResumeHistoryViewProps> = ({ history, analysisHistory, onEdit, onView, onStartNew }) => {
  return (
    <div className="max-w-[1200px] mx-auto py-12 px-10">
      <div className="flex justify-between items-end mb-16">
        <div>
          <h2 className="text-5xl font-black text-white tracking-tighter uppercase mb-4">Resume History</h2>
          <p className="text-slate-500 text-lg font-medium">Manage your versions and track your optimization progress.</p>
        </div>
        <button 
          onClick={onStartNew}
          className="bg-blue-600 hover:bg-blue-50 text-white hover:text-blue-900 font-black py-4 px-8 rounded-2xl transition-all shadow-xl shadow-blue-900/20 flex items-center gap-3 uppercase tracking-widest text-xs"
        >
          <Plus size={18} /> New Analysis
        </button>
      </div>

      {history.length === 0 ? (
        <div className="py-32 text-center bg-[#16161E] rounded-[3rem] border border-dashed border-[#2D313D]">
          <Search size={48} className="mx-auto text-slate-700 mb-6" />
          <h3 className="text-white font-bold text-xl mb-2">No history found</h3>
          <p className="text-slate-500 mb-8 max-w-sm mx-auto">Upload and analyze your first resume to start building your professional history.</p>
          <button 
            onClick={onStartNew}
            className="text-blue-500 font-bold uppercase tracking-widest text-xs hover:text-white transition-colors"
          >
            Run Initial Analysis →
          </button>
        </div>
      ) : (
        <div className="space-y-16">
          {history.map(group => (
            <div key={group.id} className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#2D313D] pb-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500">
                    <Target size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{group.name}</h3>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                      {group.versions.length} {group.versions.length === 1 ? 'Version' : 'Versions'} available
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   {group.versions.some(v => v.type === 'optimized') ? (
                     <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-green-400 bg-green-400/10 px-3 py-1 rounded-full border border-green-400/20">
                       <CheckCircle2 size={10} /> Rebuilt Available
                     </span>
                   ) : (
                     <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-800 px-3 py-1 rounded-full">
                       <AlertCircle size={10} /> Needs Rebuild
                     </span>
                   )}
                </div>
              </div>

              <div className="space-y-4">
                {group.versions.map(version => (
                  <VersionRow 
                    key={version.versionId} 
                    version={version} 
                    groupId={group.id}
                    analysis={version.linkedAnalysisId ? analysisHistory[version.linkedAnalysisId] : undefined}
                    onEdit={onEdit}
                    onView={onView}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-24 p-12 border border-[#2D313D] border-dashed rounded-[3rem] text-center">
        <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.4em] mb-4">Integrity Standard</p>
        <p className="text-slate-500 text-sm max-w-xl mx-auto leading-relaxed font-medium">
          HireMax preserves every version of your professional document. Original uploads are never modified. Optimization history is retained for comparison and tracking purposes.
        </p>
      </div>
    </div>
  );
};
