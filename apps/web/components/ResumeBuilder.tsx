
import * as React from 'react';
import { useState, useEffect } from 'react';

import {
  Plus, Trash2, Briefcase, GraduationCap, Wrench, Save,
  PlusCircle, Mail, Phone, MapPin, Linkedin, Pencil,
  X, Target, Award, Users, FlaskConical, BookOpen, FolderOpen,
  Layout,
  ArrowLeft,
  Download,
  CheckCircle
} from 'lucide-react';
import { ResumeData, ResumeSection, ResumeItem, SectionType, UserPlan, ResumeGroup, StructuredResume } from '../types';
import { generateUUID } from '../lib/utils';

interface ResumeBuilderProps {
  plan: UserPlan;
  groupId: string | null;
  versionId: string | null;
  history: ResumeGroup[];
  onBack: () => void;
  onSaveManual?: (data: StructuredResume) => void;
  preloadedData?: StructuredResume | null;
}

const SECTION_TYPES: { type: SectionType; label: string; icon: any; description: string }[] = [
  { type: 'objective', label: 'Professional Summary', icon: <Target size={18} />, description: 'A bold opening statement about your career.' },
  { type: 'experience', label: 'Work Experience', icon: <Briefcase size={18} />, description: 'Your history of professional employment.' },
  { type: 'leadership', label: 'Leadership', icon: <Users size={18} />, description: 'Management roles and cross-functional leadership.' },
  { type: 'projects', label: 'Key Projects', icon: <FolderOpen size={18} />, description: 'Significant projects and their technical outcomes.' },
  { type: 'research', label: 'Research', icon: <FlaskConical size={18} />, description: 'Academic investigations or industrial research.' },
  { type: 'certifications', label: 'Certifications', icon: <Award size={18} />, description: 'Formal certifications and professional credentials.' },
  { type: 'awards', label: 'Awards & Honors', icon: <Award size={18} />, description: 'Formal recognition of excellence and achievement.' },
  { type: 'publications', label: 'Publications', icon: <BookOpen size={18} />, description: 'Scientific papers, articles, or published books.' },
  { type: 'skills', label: 'Technical Skills', icon: <Wrench size={18} />, description: 'Tools, languages, and core proficiencies.' },
  { type: 'education', label: 'Education', icon: <GraduationCap size={18} />, description: 'Degrees and institutional learning.' },
];

export const ResumeBuilder: React.FC<ResumeBuilderProps> = ({ plan, groupId, versionId, history, onBack, onSaveManual, preloadedData }) => {
  const [data, setData] = useState<ResumeData>({
    contact: { fullName: '', email: '', phone: '', location: '', linkedIn: '' },
    summary: '',
    sections: []
  });

  useEffect(() => {
    if (groupId && versionId) {
      const group = history.find(g => g.id === groupId);
      const version = group?.versions.find(v => v.versionId === versionId);
      if (version) {
        const mappedData: ResumeData = {
          contact: {
            fullName: version.data.contact.full_name,
            email: version.data.contact.email,
            phone: version.data.contact.phone,
            location: version.data.contact.location || '',
            linkedIn: version.data.contact.links[0] || ''
          },
          summary: version.data.summary,
          // Explicitly casting to ResumeSection[] to fix type incompatibility for the 'type' field which expects SectionType
          sections: [
            {
              id: 'exp-sec',
              type: 'experience' as SectionType,
              title: 'Work Experience',
              items: version.data.experience.map((e: any, idx: number) => ({
                id: `e-${idx}`,
                title: e.title,
                subtitle: e.organization,
                startDate: e.dates.split('—')[0]?.trim() || '',
                endDate: e.dates.split('—')[1]?.trim() || '',
                description: e.bullets.join('\n')
              }))
            },
            {
              id: 'edu-sec',
              type: 'education' as SectionType,
              title: 'Education',
              items: version.data.education.map((e: any, idx: number) => ({
                id: `ed-${idx}`,
                title: e.degree,
                subtitle: e.institution,
                startDate: e.dates,
                description: e.details
              }))
            },
            {
              id: 'proj-sec',
              type: 'projects' as SectionType,
              title: 'Key Projects',
              items: version.data.projects.map((p: any, idx: number) => ({
                id: `p-${idx}`,
                title: p.name,
                subtitle: p.description,
                description: p.impact
              }))
            }
          ].filter(s => s.items.length > 0) as ResumeSection[]
        };
        setData(mappedData);
      }
    } else if (preloadedData) {
      const mappedData: ResumeData = {
        contact: {
          fullName: preloadedData.contact.full_name,
          email: preloadedData.contact.email,
          phone: preloadedData.contact.phone,
          location: preloadedData.contact.location || '',
          linkedIn: preloadedData.contact.links[0] || ''
        },
        summary: preloadedData.summary,
        // Explicitly casting to ResumeSection[] to fix type incompatibility for the 'type' field which expects SectionType
        sections: [
          {
            id: 'exp-sec',
            type: 'experience' as SectionType,
            title: 'Work Experience',
            items: preloadedData.experience.map((e: any, idx: number) => ({
              id: `e-${idx}`,
              title: e.title,
              subtitle: e.organization,
              startDate: e.dates.split('—')[0]?.trim() || '',
              endDate: e.dates.split('—')[1]?.trim() || '',
              description: e.bullets.join('\n')
            }))
          },
          {
            id: 'edu-sec',
            type: 'education' as SectionType,
            title: 'Education',
            items: preloadedData.education.map((e: any, idx: number) => ({
              id: `ed-${idx}`,
              title: e.degree,
              subtitle: e.institution,
              startDate: e.dates,
              description: e.details
            }))
          },
          {
            id: 'proj-sec',
            type: 'projects' as SectionType,
            title: 'Key Projects',
            items: preloadedData.projects.map((p: any, idx: number) => ({
              id: `p-${idx}`,
              title: p.name,
              subtitle: p.description,
              description: p.impact
            }))
          }
        ].filter(s => s.items.length > 0) as ResumeSection[]
      };
      setData(mappedData);
    } else if (!groupId) {
      // New from scratch - default ATS-safe template empty
      setData({
        contact: { fullName: '', email: '', phone: '', location: '', linkedIn: '' },
        summary: '',
        sections: [
          { id: 'exp-sec', type: 'experience', title: 'Work Experience', items: [] },
          { id: 'edu-sec', type: 'education', title: 'Education', items: [] }
        ]
      });
    }
  }, [groupId, versionId, history, preloadedData]);

  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingItem, setEditingItem] = useState<{ sectionId: string; item?: ResumeItem; type: SectionType } | null>(null);

  const updateContact = (field: keyof typeof data.contact, value: string) => {
    setData({ ...data, contact: { ...data.contact, [field]: value } });
  };

  const addSection = (type: SectionType) => {
    const config = SECTION_TYPES.find(s => s.type === type);
    const newSection: ResumeSection = { id: generateUUID(), type, title: config?.label || 'New Section', items: [] };
    setData(prev => ({ ...prev, sections: [...prev.sections, newSection] }));
    setShowSectionModal(false);
  };

  const removeSection = (id: string) => setData(prev => ({ ...prev, sections: prev.sections.filter(s => s.id !== id) }));

  const saveItem = (sectionId: string, item: ResumeItem) => {
    setData(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === sectionId ? {
        ...s,
        items: s.items.find(i => i.id === item.id)
          ? s.items.map(i => i.id === item.id ? item : i)
          : [...s.items, item]
      } : s)
    }));
    setEditingItem(null);
  };

  const handleDownload = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const content = document.getElementById('resume-architect-preview')?.outerHTML;
      const candidateName = data.contact.fullName || 'Resume';
      // Strip original title to prevent branding in headers
      const styles = document.head.innerHTML.replace(/<title>.*?<\/title>/g, '');

      printWindow.document.write(`
        <html>
          <head>
            <title>${candidateName}</title>
            ${styles}
            <style>
              body { background: white !important; margin: 0 !important; padding: 0 !important; }
              @media print {
                @page { margin: 0; }
                body { margin: 1.6cm; }
                .no-print { display: none; }
                /* Ensure shadow and other UI elements are removed for clean print */
                #resume-architect-preview { box-shadow: none !important; margin: 0 !important; width: 100% !important; }
              }
            </style>
          </head>
          <body>
            <div>${content}</div>
            <script>
              window.onload = () => {
                window.print();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleCommitToHistory = () => {
    if (!onSaveManual) return;

    // Map current editor state to the history structured schema
    const structured: StructuredResume = {
      contact: {
        full_name: data.contact.fullName,
        email: data.contact.email,
        phone: data.contact.phone,
        location: data.contact.location,
        links: data.contact.linkedIn ? [data.contact.linkedIn] : []
      },
      summary: data.summary,
      education: data.sections.filter(s => s.type === 'education').flatMap(s => s.items.map(i => ({
        institution: i.subtitle || '',
        degree: i.title || '',
        dates: i.startDate || '',
        details: i.description || ''
      }))),
      experience: data.sections.filter(s => s.type === 'experience').flatMap(s => s.items.map(i => ({
        title: i.title || '',
        organization: i.subtitle || '',
        dates: `${i.startDate} — ${i.endDate || 'Present'}`,
        bullets: (i.description || '').split('\n').filter(b => b.trim() !== '')
      }))),
      projects: data.sections.filter(s => s.type === 'projects').flatMap(s => s.items.map(i => ({
        name: i.title || '',
        description: i.subtitle || '',
        impact: i.description || ''
      }))),
      skills: {
        languages: [], frameworks: [], tools: [], specializations: []
      },
      leadership: []
    };

    onSaveManual(structured);
  };

  return (
    <div className="flex h-[calc(100vh-80px)] bg-[#0F1117]">
      <div className="w-[480px] border-r border-[#2D313D] bg-[#0D0D14] overflow-y-auto p-8 space-y-8 custom-scrollbar">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-slate-500 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-2xl font-bold text-white tracking-tight">Editor</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="p-2 text-slate-400 hover:text-white transition-colors border border-[#2D313D] rounded-lg"
              title="Download PDF"
            >
              <Download size={16} />
            </button>
            {!groupId && (
              <button
                onClick={handleCommitToHistory}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2"
              >
                <CheckCircle size={14} /> Save to History
              </button>
            )}
            {groupId && (
              <button className="bg-slate-800 text-slate-400 px-4 py-2 rounded-xl font-bold text-xs cursor-default">
                Draft Saved
              </button>
            )}
          </div>
        </div>

        <div className="space-y-5 bg-[#1A1D26] p-6 rounded-2xl border border-[#2D313D] shadow-lg">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-slate-700/30 pb-3">Contact Details</h3>
          <div className="space-y-4">
            <div>
              <label className="input-label">Full Name</label>
              <input value={data.contact.fullName} onChange={e => updateContact('fullName', e.target.value)} className="w-full bg-[#0F1117] border border-[#2D313D] rounded-xl p-3 text-white focus:border-blue-500 outline-none transition-all" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Email</label>
                <input value={data.contact.email} onChange={e => updateContact('email', e.target.value)} className="w-full bg-[#0F1117] border border-[#2D313D] rounded-xl p-3 text-white focus:border-blue-500 outline-none transition-all" />
              </div>
              <div>
                <label className="input-label">Phone</label>
                <input value={data.contact.phone} onChange={e => updateContact('phone', e.target.value)} className="w-full bg-[#0F1117] border border-[#2D313D] rounded-xl p-3 text-white focus:border-blue-500 outline-none transition-all" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Location</label>
                <input value={data.contact.location} onChange={e => updateContact('location', e.target.value)} className="w-full bg-[#0F1117] border border-[#2D313D] rounded-xl p-3 text-white focus:border-blue-500 outline-none transition-all" placeholder="e.g. San Francisco, CA" />
              </div>
              <div>
                <label className="input-label">LinkedIn</label>
                <input value={data.contact.linkedIn} onChange={e => updateContact('linkedIn', e.target.value)} className="w-full bg-[#0F1117] border border-[#2D313D] rounded-xl p-3 text-white focus:border-blue-500 outline-none transition-all" placeholder="linkedin.com/in/user" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 bg-[#1A1D26] p-6 rounded-2xl border border-[#2D313D] shadow-lg">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-slate-700/30 pb-3">About You</h3>
          <div>
            <label className="input-label">Summary Statement</label>
            <textarea value={data.summary} onChange={e => setData({ ...data, summary: e.target.value })} className="w-full bg-[#0F1117] border border-[#2D313D] rounded-xl p-3 text-white h-28 resize-none focus:border-blue-500 outline-none transition-all" />
          </div>
        </div>

        {data.sections.map(section => (
          <div key={section.id} className="space-y-4 bg-[#1A1D26] p-6 rounded-2xl border border-[#2D313D] shadow-lg">
            <div className="flex justify-between items-center border-b border-slate-700/30 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-blue-500">{SECTION_TYPES.find(t => t.type === section.type)?.icon}</span>
                <h3 className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">{section.title}</h3>
              </div>
              <button onClick={() => removeSection(section.id)} className="text-slate-500 hover:text-red-400 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="space-y-3">
              {section.items.map(item => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-[#0F1117] rounded-xl border border-[#2D313D] group hover:border-blue-500/50 transition-all cursor-default">
                  <div className="flex-1 truncate">
                    <p className="text-white font-bold text-sm truncate">{item.title}</p>
                    <p className="text-slate-500 text-[11px] font-medium">{item.subtitle}</p>
                  </div>
                  <button onClick={() => setEditingItem({ sectionId: section.id, type: section.type, item })} className="p-2 text-slate-500 hover:text-white transition-colors">
                    <Pencil size={14} />
                  </button>
                </div>
              ))}
              <button onClick={() => setEditingItem({ sectionId: section.id, type: section.type })} className="w-full py-3 flex items-center justify-center gap-2 text-blue-500/80 text-xs font-bold border border-dashed border-blue-500/20 rounded-xl hover:bg-blue-500/5 transition-all">
                <PlusCircle size={16} /> Add Entry
              </button>
            </div>
          </div>
        ))}

        <div className="pt-4">
          <button
            onClick={() => setShowSectionModal(true)}
            className="w-full py-5 border-2 border-dashed border-blue-500/20 rounded-2xl text-blue-400 hover:text-white hover:border-blue-500 transition-all font-bold text-sm bg-blue-500/5 flex flex-col items-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all">
              <Plus size={20} />
            </div>
            <span>Append New Resume Section</span>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Select from predefined industry layers</p>
          </button>
        </div>
      </div>

      <div className="flex-1 bg-[#12141C] p-12 overflow-y-auto flex justify-center custom-scrollbar">
        <div className="w-[816px] bg-white text-black p-16 shadow-2xl min-h-[1056px] h-fit flex flex-col font-serif" id="resume-architect-preview">
          <header className="mb-10 border-b-2 border-slate-900 pb-8">
            <h1 className="text-4xl font-extrabold uppercase tracking-tight text-slate-950 mb-4">{data.contact.fullName || 'YOUR NAME'}</h1>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-bold text-slate-700">
              {data.contact.email && <div className="flex items-center gap-2"><Mail size={14} /> {data.contact.email}</div>}
              {data.contact.phone && <div className="flex items-center gap-2"><Phone size={14} /> {data.contact.phone}</div>}
              {data.contact.location && <div className="flex items-center gap-2"><MapPin size={14} /> {data.contact.location}</div>}
              {data.contact.linkedIn && <div className="flex items-center gap-2"><Linkedin size={14} /> {data.contact.linkedIn}</div>}
            </div>
          </header>

          <div className="flex-1 space-y-10">
            {data.summary && (
              <section>
                <h2 className="text-[12px] font-extrabold uppercase border-b border-slate-200 pb-1.5 mb-4 text-slate-950 tracking-widest">Professional Summary</h2>
                <p className="text-[14px] leading-relaxed text-slate-800 text-justify">{data.summary}</p>
              </section>
            )}

            {data.sections.map(section => (
              <section key={section.id}>
                <h2 className="text-[12px] font-extrabold uppercase border-b border-slate-200 pb-1.5 mb-5 text-slate-950 tracking-widest">{section.title}</h2>
                <div className="space-y-8">
                  {section.items.map(item => (
                    <div key={item.id}>
                      <div className="flex justify-between items-baseline mb-1">
                        <h3 className="text-[16px] font-bold text-slate-950">{item.title}</h3>
                        <span className="text-[11px] font-bold text-slate-600">{item.startDate} — {item.endDate || 'Present'}</span>
                      </div>
                      <p className="text-[13px] font-bold text-slate-700 italic mb-3">{item.subtitle}</p>
                      {item.description && <p className="text-[13px] text-slate-800 leading-snug whitespace-pre-wrap pl-3 border-l-2 border-slate-100">{item.description}</p>}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      {showSectionModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
          <div className="bg-[#1A1D26] w-full max-w-2xl rounded-3xl border border-[#2D313D] p-10 relative shadow-2xl">
            <button onClick={() => setShowSectionModal(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors">
              <X size={24} />
            </button>
            <div className="flex items-center gap-3 mb-8">
              <Layout className="text-blue-500" size={24} />
              <h2 className="text-2xl font-bold text-white tracking-tight uppercase">Append Section Layer</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {SECTION_TYPES.map(cfg => (
                <button
                  key={cfg.type}
                  onClick={() => addSection(cfg.type)}
                  className="flex items-start gap-4 p-5 bg-[#0F1117] rounded-2xl border border-[#2D313D] hover:border-blue-500 hover:bg-blue-500/5 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#1A1D26] flex items-center justify-center text-slate-500 group-hover:text-blue-500 transition-colors">
                    {cfg.icon}
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">{cfg.label}</p>
                    <p className="text-slate-500 text-[10px] leading-relaxed uppercase tracking-widest mt-1">{cfg.type}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
          <div className="bg-[#1A1D26] w-full max-w-xl rounded-2xl border border-[#2D313D] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[#2D313D] flex justify-between items-center bg-[#1A1D26]">
              <h3 className="text-white font-bold uppercase text-xs tracking-[0.2em]">{editingItem.type} Details</h3>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
              <div className="space-y-2">
                <label className="input-label">Title / Role / Degree</label>
                <input value={editingItem.item?.title || ''} onChange={e => setEditingItem({ ...editingItem, item: { ...(editingItem.item || { id: '', title: '' }), title: e.target.value } })} className="w-full bg-[#0F1117] border border-[#2D313D] rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition-all" />
              </div>
              <div className="space-y-2">
                <label className="input-label">Company / School / Organization</label>
                <input value={editingItem.item?.subtitle || ''} onChange={e => setEditingItem({ ...editingItem, item: { ...(editingItem.item || { id: '', title: '' }), subtitle: e.target.value } })} className="w-full bg-[#0F1117] border border-[#2D313D] rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="input-label">Start Date</label>
                  <input value={editingItem.item?.startDate || ''} onChange={e => setEditingItem({ ...editingItem, item: { ...(editingItem.item || { id: '', title: '' }), startDate: e.target.value } })} className="w-full bg-[#0F1117] border border-[#2D313D] rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition-all" placeholder="e.g. Jan 2020" />
                </div>
                <div className="space-y-2">
                  <label className="input-label">End Date</label>
                  <input value={editingItem.item?.endDate || ''} onChange={e => setEditingItem({ ...editingItem, item: { ...(editingItem.item || { id: '', title: '' }), endDate: e.target.value } })} className="w-full bg-[#0F1117] border border-[#2D313D] rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition-all" placeholder="Present" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="input-label">Achievements & Context</label>
                <textarea value={editingItem.item?.description || ''} onChange={e => setEditingItem({ ...editingItem, item: { ...(editingItem.item || { id: '', title: '' }), description: e.target.value } })} className="w-full bg-[#0F1117] border border-[#2D313D] rounded-xl p-4 text-white h-44 resize-none outline-none focus:border-blue-500 transition-all" placeholder="What did you accomplish?" />
              </div>
            </div>
            <div className="p-6 bg-[#1A1D26] border-t border-[#2D313D] flex justify-end gap-4">
              <button onClick={() => setEditingItem(null)} className="px-6 py-2 text-slate-500 font-bold hover:text-white transition-colors">Discard</button>
              <button
                onClick={() => {
                  const sectionId = editingItem.sectionId;
                  const newItem = editingItem.item || { id: generateUUID(), title: '' };
                  saveItem(sectionId, { ...newItem, id: newItem.id || generateUUID() });
                }}
                className="px-10 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all"
              >
                Apply Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
