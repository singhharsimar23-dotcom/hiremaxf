
import React, { useState } from 'react';
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
  Target,
  Mail,
  Phone,
  MapPin,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  Sparkles,
  History,
  ArrowRight,
  UserCheck,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { ResumeGroup, ResumeVersion, DiagnosticResult, JobType } from '../types';

interface ResumeHistoryViewProps {
  history: ResumeGroup[];
  analysisHistory: Record<string, DiagnosticResult>;
  onEdit: (groupId: string, versionId: string) => void;
  onView: (groupId: string, versionId: string) => void;
  onStartNew: () => void;
  onSaveToProfile?: (version: ResumeVersion, name: string) => void;
  dispatchJob: (type: JobType, payload: any) => Promise<string>;
}

export const ResumeHistoryView: React.FC<ResumeHistoryViewProps> = ({ history, analysisHistory, onEdit, onView, onStartNew, onSaveToProfile, dispatchJob }) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDownload = (resume: any) => {
    if (!resume || !resume.contact) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const content = `
        <div style="font-family: serif; color: black; max-width: 800px; margin: 0 auto;">
          <header style="border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px;">
            <h1 style="font-size: 28pt; text-transform: uppercase; margin: 0 0 10px 0;">${resume.contact.full_name}</h1>
            <div style="font-size: 10pt; font-weight: bold; color: #444; display: flex; gap: 20px;">
              <span>${resume.contact.email}</span>
              <span>${resume.contact.phone || ''}</span>
              <span>${resume.contact.location || ''}</span>
            </div>
          </header>
          <section style="margin-bottom: 25px;">
            <h2 style="font-size: 11pt; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px;">Summary</h2>
            <p style="font-size: 11pt; line-height: 1.5;">${resume.summary}</p>
          </section>
          <section style="margin-bottom: 25px;">
            <h2 style="font-size: 11pt; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 15px;">Experience</h2>
            ${(resume.experience || []).map((exp: any) => `
              <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                  <h3 style="font-size: 13pt; font-weight: bold; margin: 0;">${exp.title}</h3>
                  <span style="font-size: 10pt; margin-left: auto;">${exp.dates}</span>
                </div>
                <p style="font-size: 11pt; font-style: italic; margin: 2px 0 8px 0;">${exp.organization}</p>
                <ul style="padding-left: 20px; margin: 0;">
                  ${(exp.bullets || []).map((b: string) => `<li style="font-size: 10.5pt; margin-bottom: 4px;">${b}</li>`).join('')}
                </ul>
              </div>
            `).join('')}
          </section>
          ${resume.skills ? `
          <section style="margin-bottom: 25px;">
            <h2 style="font-size: 11pt; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px;">Technical Skills</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
              ${resume.skills.languages?.length > 0 ? `<div><p style="font-size: 10.5pt;"><strong>Languages:</strong> ${resume.skills.languages?.join(', ')}</p></div>` : ''}
              ${resume.skills.frameworks?.length > 0 ? `<div><p style="font-size: 10.5pt;"><strong>Frameworks:</strong> ${resume.skills.frameworks?.join(', ')}</p></div>` : ''}
              ${resume.skills.tools?.length > 0 ? `<div><p style="font-size: 10.5pt;"><strong>Tools:</strong> ${resume.skills.tools?.join(', ')}</p></div>` : ''}
              ${resume.skills.specializations?.length > 0 ? `<div><p style="font-size: 10.5pt;"><strong>Specializations:</strong> ${resume.skills.specializations?.join(', ')}</p></div>` : ''}
            </div>
          </section>` : ''}
        </div>
      `;
      printWindow.document.write(`<html><head><title>${resume.contact.full_name} Resume</title></head><body style="padding: 40px;">${content}</body></html>`);
      printWindow.document.close();
      printWindow.onload = () => { printWindow.print(); };
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-12 px-10">
      <div className="mb-16 flex justify-between items-end">
        <div>
          <h2 className="text-5xl font-black text-white tracking-tighter uppercase mb-4">Resume History</h2>
          <p className="text-slate-500 text-lg font-medium">Evolution of your professional signal over {history.length} iterations.</p>
        </div>
        <button
          onClick={onStartNew}
          className="bg-blue-600 text-white font-black py-4 px-10 rounded-2xl transition-all shadow-xl shadow-blue-900/20 uppercase tracking-widest text-xs flex items-center gap-3"
        >
          <Sparkles size={18} /> New Analysis
        </button>
      </div>

      <div className="space-y-10">
        {history.length === 0 ? (
          <div className="bg-[#16161E] border border-[#1D1D26] p-20 rounded-[3rem] text-center">
            <History className="text-slate-800 mx-auto mb-8" size={64} />
            <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tight">No history found</h3>
            <p className="text-slate-500 mb-8">Deploy your first analysis to begin tracking version integrity.</p>
            <button
              onClick={onStartNew}
              className="bg-white text-black font-bold py-3 px-8 rounded-xl transition-all hover:bg-slate-200 uppercase tracking-widest text-[10px]"
            >
              Start First Run
            </button>
          </div>
        ) : (
          history.map(group => (
            <div key={group.id} className="bg-[#16161E] border border-[#1D1D26] rounded-[3.5rem] overflow-hidden shadow-2xl transition-all hover:border-blue-500/20">
              <div
                onClick={() => toggleGroup(group.id)}
                className="p-10 flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-8">
                  <div className="w-16 h-16 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                    <FileText size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-1">{group.name}</h3>
                    <div className="flex items-center gap-4">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{group.versions.length} Sequential Versions</p>
                      <div className="w-1 h-1 rounded-full bg-slate-800" />
                      <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">
                        Latest: {group.versions && group.versions.length > 0 ? new Date(group.versions[group.versions.length - 1].createdAt).toLocaleDateString() : 'No versions'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-slate-500">
                    {expandedGroups[group.id] ? <ChevronUp size={28} /> : <ChevronDown size={28} />}
                  </div>
                </div>
              </div>

              {expandedGroups[group.id] && (
                <div className="px-10 pb-10 space-y-4 animate-in slide-in-from-top-4 duration-500">
                  <div className="h-[1px] bg-white/5 mb-8" />
                  <div className="grid grid-cols-1 gap-4">
                    {group.versions.slice().reverse().map((version, i) => {
                      const analysis = version.linkedAnalysisId ? analysisHistory[version.linkedAnalysisId] : null;

                      return (
                        <div key={version.versionId} className="flex items-center justify-between p-6 bg-[#0D0D12]/50 border border-white/5 rounded-3xl hover:border-white/10 transition-all group/version">
                          <div className="flex items-center gap-6">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${version.type === 'optimized' ? 'bg-green-600/10 text-green-500' : 'bg-blue-600/10 text-blue-500'}`}>
                              {version.type === 'optimized' ? <Sparkles size={18} /> : <FileText size={18} />}
                            </div>
                            <div>
                              <div className="flex items-center gap-3">
                                <p className="text-white font-bold text-sm">
                                  {version.type === 'optimized' ? 'Optimized Revision' : 'Original Baseline'}
                                </p>
                                {version.status === 'PENDING' || version.status === 'PROCESSING' ? (
                                  <div className="flex items-center gap-2">
                                    <Loader2 size={10} className="text-blue-500 animate-spin" />
                                    <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">{version.status}...</span>
                                  </div>
                                ) : version.status === 'FAILED' ? (
                                  <div className="flex items-center gap-2">
                                    <AlertCircle size={10} className="text-red-500" />
                                    <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Failed</span>
                                    {version.error_reason && (
                                      <span className="text-[8px] text-slate-600 italic">({version.error_reason})</span>
                                    )}
                                  </div>
                                ) : (
                                  i === 0 && (
                                    <span className="text-[8px] font-black bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded uppercase tracking-widest">Latest</span>
                                  )
                                )}
                              </div>
                              <p className="text-slate-500 text-[10px] font-medium uppercase tracking-widest mt-1">
                                {new Date(version.createdAt).toLocaleString()} • {version.templateId || 'Standard Template'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-8">
                            {analysis && (
                              <div className="text-right">
                                <p className="text-green-400 font-black text-lg">{analysis.overallScore}%</p>
                                <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest">Market Score</p>
                              </div>
                            )}
                            <div className="flex items-center gap-3 opacity-0 group-hover/version:opacity-100 transition-opacity">
                              {version.status === 'FAILED' ? (
                                <button
                                  onClick={() => dispatchJob('REBUILD', {
                                    resume_id: group.id,
                                    targetRole: group.name // Best guess for role
                                  })}
                                  className="px-4 py-2 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                  title="Retry Rebuild"
                                >
                                  <RefreshCw size={14} /> Retry
                                </button>
                              ) : version.status === 'COMPLETED' || !version.status ? (
                                <>
                                  <button
                                    onClick={() => onView(group.id, version.versionId)}
                                    className="p-3 text-slate-500 hover:text-white transition-colors"
                                    title="View Document"
                                  >
                                    <Eye size={18} />
                                  </button>
                                  <button
                                    onClick={() => onEdit(group.id, version.versionId)}
                                    className="p-3 text-slate-500 hover:text-white transition-colors"
                                    title="Edit Version"
                                  >
                                    <ArrowRight size={18} />
                                  </button>
                                  <button
                                    onClick={() => handleDownload(version.data)}
                                    className="p-3 text-slate-500 hover:text-white transition-colors"
                                    title="Download"
                                  >
                                    <Download size={18} />
                                  </button>
                                  {onSaveToProfile && (
                                    <button
                                      onClick={() => onSaveToProfile(version, group.name)}
                                      className="px-4 py-2 bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                      title="Save to Primary Profile"
                                    >
                                      <UserCheck size={14} /> Save to Profile
                                    </button>
                                  )}
                                </>
                              ) : (
                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Processing...</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="mt-24 p-12 border border-[#2D313D] border-dashed rounded-[3rem] text-center">
        <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.4em] mb-4">Integrity Standard</p>
        <p className="text-slate-500 text-sm max-w-xl mx-auto leading-relaxed font-medium">
          HireMax preserves every version of your professional document. Original uploads are never modified. Optimization history is retained for comparison and tracking purposes.
        </p>
      </div>
    </div>
  );
}
