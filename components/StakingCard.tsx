
import React from 'react';
import { ArrowUpRight, FilePlus, Layers, Search } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { ActionCardData } from '../types';

interface ActionCardProps {
  data: ActionCardData;
  onClick?: () => void;
}

const IconMap: Record<string, React.ReactNode> = {
  FilePlus: <FilePlus size={24} />,
  Layers: <Layers size={24} />,
  Search: <Search size={24} />
};

const ActionCard: React.FC<ActionCardProps> = ({ data, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="bg-[#16161E] rounded-[2.5rem] p-10 border border-[#1D1D26] relative flex flex-col h-60 transition-all hover:border-blue-500/30 group cursor-pointer overflow-hidden shadow-2xl"
    >
      <div className="flex justify-between items-start mb-8 relative z-10">
        <div className="flex flex-col gap-6">
          <div className="w-14 h-14 rounded-2xl border border-[#1D1D26] bg-[#0D0D12] flex items-center justify-center text-gray-400 group-hover:scale-110 group-hover:text-blue-500 transition-all duration-500">
            {IconMap[data.icon] || data.icon}
          </div>
          <div>
            <h3 className="text-white font-bold text-xl tracking-tight leading-none mb-3">{data.title}</h3>
            <p className="text-gray-500 text-xs font-medium leading-relaxed opacity-80 max-w-[180px]">{data.description}</p>
          </div>
        </div>
        <div className="w-10 h-10 rounded-full bg-[#0D0D12] border border-[#1D1D26] flex items-center justify-center text-gray-700 group-hover:text-white group-hover:bg-blue-600 group-hover:border-blue-600 transition-all duration-300">
          <ArrowUpRight size={20} />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none opacity-10 group-hover:opacity-30 transition-opacity duration-500">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.chartData}>
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#3b82f6" 
              strokeWidth={3}
              fill="#3b82f6" 
              fillOpacity={1} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ActionCard;
