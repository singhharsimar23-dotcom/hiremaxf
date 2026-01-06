
import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Download, 
  Layout, 
  User, 
  Briefcase, 
  GraduationCap, 
  Wrench, 
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle
} from 'lucide-react';
import { ResumeData, ExperienceItem, EducationItem } from '../types';

export const ResumeBuilder: React.FC = () => {
  const [data, setData] = useState<ResumeData>({
    contact: { fullName: '', email: '', phone: '', location: '', linkedIn: '' },
    experience: [],
    education: [],
    skills: [],
    summary: ''
  });

  const [activeSection, setActiveSection] = useState<string>('contact');

  const addExperience = () => {
    const newItem: ExperienceItem = {
      id: crypto.randomUUID(),
      company: '',
      position: '',
      location: '',
      startDate: '',
      endDate: '',
      bullets: ['']
    };
    setData({ ...data, experience: [...data.experience, newItem] });
  };

  const updateExperience = (id: string, field: keyof ExperienceItem, value: any) => {
    setData({
      ...data,
      experience: data.experience.map(item => item.id === id ? { ...item, [field]: value } : item)
    });
  };

  const handleDownload = () => {
    window.print();
  };

  const calculateATSScore = () => {
    let score = 0;
    if (data.contact.fullName && data.contact.email) score += 20;
    if (data.experience.length > 0) score += 40;
    if (data.education.length > 0) score += 20;
    if (data.skills.length > 0) score += 20;
    return score;
  };

  return (
    <div className="flex h-[calc(100vh-100px)] overflow-hidden bg-[#0D0D12]">
      {/* Left Input Panel */}
      <div className="w-1/2 overflow-y-auto p-10 border-r border-[#1D1D26] custom-scrollbar">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tighter">Construction Interface</h2>
            <p className="text-gray-500 text-sm font-medium uppercase tracking-widest mt-1">Status: Active Development</p>
          </div>
          <div className="text-right">
             <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Structural Integrity</p>
             <div className="text-2xl font-black text-blue-500">{calculateATSScore()}%</div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Contact Section */}
          <section className="bg-[#16161E] rounded-3xl border border-[#1D1D26] overflow-hidden">
            <button 
              onClick={() => setActiveSection(activeSection === 'contact' ? '' : 'contact')}
              className="w-full flex items-center justify-between p-6 hover:bg-[#1D1D26] transition-colors"
            >
              <div className="flex items-center gap-4">
                <User size={18} className="text-blue-500" />
                <span className="text-sm font-black text-white uppercase tracking-widest">Contact Information</span>
                <span className="text-[9px] font-black text-blue-500/50 uppercase ml-2">Required</span>
              </div>
              {activeSection === 'contact' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {activeSection === 'contact' && (
              <div className="p-8 border-t border-[#1D1D26] grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Full Name</label>
                  <input 
                    type="text" 
                    value={data.contact.fullName}
                    onChange={e => setData({...data, contact: {...data.contact, fullName: e.target.value}})}
                    className="w-full bg-[#0D0D12] border border-[#1D1D26] rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Email Address</label>
                  <input 
                    type="email" 
                    value={data.contact.email}
                    onChange={e => setData({...data, contact: {...data.contact, email: e.target.value}})}
                    className="w-full bg-[#0D0D12] border border-[#1D1D26] rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Phone</label>
                  <input 
                    type="text" 
                    value={data.contact.phone}
                    onChange={e => setData({...data, contact: {...data.contact, phone: e.target.value}})}
                    className="w-full bg-[#0D0D12] border border-[#1D1D26] rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Location</label>
                  <input 
                    type="text" 
                    value={data.contact.location}
                    onChange={e => setData({...data, contact: {...data.contact, location: e.target.value}})}
                    className="w-full bg-[#0D0D12] border border-[#1D1D26] rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Professional Summary - Optional */}
          <section className="bg-[#16161E] rounded-3xl border border-[#1D1D26] overflow-hidden">
             <button 
              onClick={() => setActiveSection(activeSection === 'summary' ? '' : 'summary')}
              className="w-full flex items-center justify-between p-6 hover:bg-[#1D1D26] transition-colors"
            >
              <div className="flex items-center gap-4">
                <FileText size={18} className="text-gray-500" />
                <span className="text-sm font-black text-white uppercase tracking-widest">Professional Summary</span>
                <span className="text-[9px] font-black text-gray-600 uppercase ml-2">Optional</span>
              </div>
              {activeSection === 'summary' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {activeSection === 'summary' && (
              <div className="p-8 border-t border-[#1D1D26]">
                <textarea 
                  value={data.summary}
                  onChange={e => setData({...data, summary: e.target.value})}
                  className="w-full bg-[#0D0D12] border border-[#1D1D26] rounded-xl p-4 text-sm text-white min-h-[120px] focus:outline-none focus:border-blue-500"
                  placeholder="Focus on high-level achievements and production results..."
                />
              </div>
            )}
          </section>

          {/* Experience Section */}
          <section className="bg-[#16161E] rounded-3xl border border-[#1D1D26] overflow-hidden">
            <button 
              onClick={() => setActiveSection(activeSection === 'experience' ? '' : 'experience')}
              className="w-full flex items-center justify-between p-6 hover:bg-[#1D1D26] transition-colors"
            >
              <div className="flex items-center gap-4">
                <Briefcase size={18} className="text-blue-500" />
                <span className="text-sm font-black text-white uppercase tracking-widest">Professional Experience</span>
                <span className="text-[9px] font-black text-blue-500/50 uppercase ml-2">Required</span>
              </div>
              {activeSection === 'experience' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {activeSection === 'experience' && (
              <div className="p-8 border-t border-[#1D1D26] space-y-10">
                {data.experience.map((exp, idx) => (
                  <div key={exp.id} className="relative p-6 bg-[#0D0D12] rounded-2xl border border-[#1D1D26] space-y-6">
                    <button 
                      onClick={() => setData({ ...data, experience: data.experience.filter(e => e.id !== exp.id) })}
                      className="absolute top-4 right-4 text-red-500/50 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Company</label>
                        <input 
                          type="text" 
                          value={exp.company}
                          onChange={e => updateExperience(exp.id, 'company', e.target.value)}
                          className="w-full bg-[#16161E] border border-[#1D1D26] rounded-lg p-2 text-xs text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Position</label>
                        <input 
                          type="text" 
                          value={exp.position}
                          onChange={e => updateExperience(exp.id, 'position', e.target.value)}
                          className="w-full bg-[#16161E] border border-[#1D1D26] rounded-lg p-2 text-xs text-white"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Bullets (Structural Results)</label>
                      {exp.bullets.map((bullet, bIdx) => (
                        <div key={bIdx} className="flex gap-2">
                          <input 
                            type="text" 
                            value={bullet}
                            onChange={e => {
                              const newBullets = [...exp.bullets];
                              newBullets[bIdx] = e.target.value;
                              updateExperience(exp.id, 'bullets', newBullets);
                            }}
                            className="flex-1 bg-[#16161E] border border-[#1D1D26] rounded-lg p-2 text-xs text-white"
                            placeholder="Action -> Market Result -> Quantitative Marker"
                          />
                        </div>
                      ))}
                      <button 
                        onClick={() => updateExperience(exp.id, 'bullets', [...exp.bullets, ''])}
                        className="text-[9px] font-black text-blue-500 uppercase tracking-widest mt-2"
                      >
                        + Add Bullet
                      </button>
                    </div>
                  </div>
                ))}
                <button 
                  onClick={addExperience}
                  className="w-full py-4 border-2 border-dashed border-[#1D1D26] rounded-2xl text-gray-500 text-[10px] font-black uppercase tracking-widest hover:border-blue-500/50 hover:text-blue-500 transition-all"
                >
                  + Add Role Node
                </button>
              </div>
            )}
          </section>

          {/* Education & Skills are similar structure... */}

          <button 
            className="w-full py-6 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-[10px] hover:bg-blue-500 transition-all shadow-xl"
            onClick={() => alert("Resume Sections Management Modal would open here.")}
          >
            Add Resume Sections
          </button>
        </div>
      </div>

      {/* Right Preview Panel */}
      <div className="w-1/2 bg-[#F9FAFB] p-16 overflow-y-auto print:p-0 print:bg-white custom-scrollbar">
        <div className="flex justify-between items-center mb-8 print:hidden">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ATS Reality Check (Standard Hierarchy)</span>
          <button 
            onClick={handleDownload}
            className="flex items-center gap-2 bg-black text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition-all"
          >
            <Download size={14} /> Export PDF
          </button>
        </div>

        <div id="resume-preview" className="bg-white text-black min-h-[1100px] p-12 shadow-inner border border-gray-100 print:shadow-none print:border-0 print:p-0 font-serif">
          {/* Header */}
          <div className="text-center mb-10 border-b border-black pb-6">
            <h1 className="text-3xl font-bold uppercase tracking-tight mb-2">{data.contact.fullName || 'FULL NAME'}</h1>
            <div className="flex justify-center gap-4 text-xs">
              <span>{data.contact.location}</span>
              {data.contact.email && <span>• {data.contact.email}</span>}
              {data.contact.phone && <span>• {data.contact.phone}</span>}
            </div>
          </div>

          {/* Experience */}
          {data.experience.length > 0 && (
            <div className="mb-10">
              <h2 className="text-sm font-bold uppercase tracking-widest border-b border-black mb-4">Experience</h2>
              <div className="space-y-6">
                {data.experience.map(exp => (
                  <div key={exp.id}>
                    <div className="flex justify-between font-bold text-xs mb-1">
                      <span>{exp.company}</span>
                      <span>{exp.startDate} – {exp.endDate}</span>
                    </div>
                    <div className="flex justify-between italic text-[11px] mb-3">
                      <span>{exp.position}</span>
                      <span>{exp.location}</span>
                    </div>
                    <ul className="list-disc ml-4 text-[11px] space-y-1 leading-relaxed">
                      {exp.bullets.filter(b => b.trim()).map((bullet, i) => (
                        <li key={i}>{bullet}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education & Skills Preview... */}
        </div>
      </div>
    </div>
  );
};
