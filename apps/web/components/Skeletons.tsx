import React from 'react';

const SHIMMER = "animate-pulse bg-white/5 rounded";

const Block = ({ w = 'w-full', h = 'h-4', className = '' }: { w?: string; h?: string; className?: string }) => (
  <div className={`${SHIMMER} ${w} ${h} ${className}`} />
);

export const FullReviewSkeleton: React.FC = () => (
  <div className="max-w-[1400px] mx-auto py-12 px-10 animate-in fade-in duration-300">
    <div className="flex justify-between items-center mb-12">
      <div className="flex gap-4">
        <Block w="w-40" h="h-10" className="rounded-2xl" />
        <Block w="w-40" h="h-10" className="rounded-2xl" />
      </div>
      <Block w="w-24" h="h-6" />
    </div>
    <div className="bg-[#111118] border border-[#2D313D] rounded-[4rem] p-12 mb-20">
      <div className="grid grid-cols-12 gap-12 items-center">
        <div className="col-span-3 space-y-4">
          {[1,2,3,4].map(i => <Block key={i} h="h-12" className="rounded-xl" />)}
        </div>
        <div className="col-span-6 flex justify-center">
          <div className={`w-[340px] h-[340px] rounded-full ${SHIMMER}`} />
        </div>
        <div className="col-span-3 space-y-4">
          {[1,2,3].map(i => <Block key={i} h="h-14" className="rounded-xl" />)}
        </div>
      </div>
    </div>
    <div className="grid grid-cols-12 gap-12">
      <div className="col-span-8 space-y-4">
        {[1,2,3,4,5].map(i => <Block key={i} h="h-20" className="rounded-[2rem]" />)}
      </div>
      <div className="col-span-4 space-y-6">
        <Block h="h-64" className="rounded-[3rem]" />
        <Block h="h-48" className="rounded-[3.5rem]" />
      </div>
    </div>
  </div>
);

export const ResumeHistorySkeleton: React.FC = () => (
  <div className="max-w-7xl mx-auto py-12 px-10 animate-in fade-in duration-300">
    <div className="flex justify-between items-end mb-16">
      <div className="space-y-3">
        <Block w="w-64" h="h-12" />
        <Block w="w-48" h="h-5" />
      </div>
      <Block w="w-36" h="h-12" className="rounded-2xl" />
    </div>
    <div className="space-y-6">
      {[1,2,3].map(i => <Block key={i} h="h-24" className="rounded-[3.5rem]" />)}
    </div>
  </div>
);

const StepProgress: React.FC<{ steps: string[] }> = ({ steps }) => {
  const [current, setCurrent] = React.useState(0);
  React.useEffect(() => {
    const iv = setInterval(() => setCurrent(c => (c + 1) % steps.length), 2200);
    return () => clearInterval(iv);
  }, [steps.length]);
  return (
    <div className="flex flex-col items-center gap-2 min-h-[80px]">
      {steps.map((s, i) => (
        <p key={i} className={`text-[11px] font-bold uppercase tracking-widest transition-all duration-500 ${i === current ? 'text-blue-400 opacity-100' : i < current ? 'text-green-500 opacity-60' : 'text-slate-700 opacity-30'}`}>
          {i < current ? '✓ ' : i === current ? '▸ ' : ''}{s}
        </p>
      ))}
    </div>
  );
};

export const RebuildProcessingSkeleton: React.FC<{ role: string; track: string }> = ({ role, track }) => (
  <div className="flex flex-col items-center justify-center min-h-[70vh] gap-10 animate-in fade-in duration-500">
    <div className="relative">
      <div className="w-24 h-24 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-b-indigo-500 animate-spin" style={{animationDirection:'reverse',animationDuration:'1.5s'}} />
      </div>
    </div>
    <div className="text-center space-y-3">
      <h3 className="text-3xl font-black text-white uppercase tracking-tight">Re-Architecting Profile</h3>
      <p className="text-slate-400 text-sm font-bold">Targeting <span className="text-blue-400">{role}</span> signal maps</p>
      <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.4em]">{track.replace(/_/g,' ')} judgment track</p>
    </div>
    <StepProgress steps={['Parsing resume structure','Extracting JD signals','Rebuilding bullet density','Injecting ATS keywords','Calibrating seniority signals']} />
    <p className="text-slate-700 text-[10px] font-black uppercase tracking-widest">Running in background — you can navigate away safely</p>
  </div>
);

export const DashboardSkeleton: React.FC = () => (
  <div className="max-w-7xl mx-auto py-12 px-10 animate-in fade-in duration-300">
    <Block w="w-72" h="h-12" className="mb-10" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
      {[1,2,3].map(i => <Block key={i} h="h-36" className="rounded-[2.5rem]" />)}
    </div>
    <div className="grid grid-cols-12 gap-8">
      <div className="col-span-8 space-y-4">
        {[1,2,3,4].map(i => <Block key={i} h="h-24" className="rounded-[2.5rem]" />)}
      </div>
      <div className="col-span-4 space-y-4">
        <Block h="h-48" className="rounded-[2.5rem]" />
        <Block h="h-48" className="rounded-[2.5rem]" />
      </div>
    </div>
  </div>
);

export const MarketIntelSkeleton: React.FC = () => (
  <div className="max-w-[1400px] mx-auto py-12 px-10 animate-in fade-in duration-300">
    <div className="mb-20 space-y-4">
      <Block w="w-48" h="h-6" />
      <Block w="w-96" h="h-16" />
      <Block w="w-72" h="h-5" />
    </div>
    <div className="grid grid-cols-12 gap-16">
      <div className="col-span-8 space-y-12">
        <Block h="h-48" className="rounded-[3.5rem]" />
        <Block h="h-64" className="rounded-[3.5rem]" />
      </div>
      <div className="col-span-4 space-y-8">
        <Block h="h-80" className="rounded-[3.5rem]" />
        <Block h="h-48" className="rounded-[3.5rem]" />
      </div>
    </div>
  </div>
);

export const AnalysisSkeleton: React.FC = () => (
  <div className="max-w-[1400px] mx-auto py-12 px-10 animate-in fade-in duration-300 space-y-8">
    <div className="bg-[#111118] border border-white/5 rounded-[4rem] p-12">
      <div className="space-y-6">
        <Block w="w-2/3" h="h-8" />
        <Block w="w-1/2" h="h-6" />
        <div className="space-y-3 pt-6">
          <Block h="h-4" />
          <Block h="h-4" />
          <Block h="h-4" />
          <Block w="w-5/6" h="h-4" />
        </div>
      </div>
    </div>
  </div>
);
