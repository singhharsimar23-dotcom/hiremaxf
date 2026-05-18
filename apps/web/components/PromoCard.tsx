
import React from 'react';
import { LayoutDashboard, Wallet, ChevronRight, TrendingUp } from 'lucide-react';

const PromoCard: React.FC = () => {
  return (
    <div className="bg-gradient-to-br from-[#1E1E2D] to-[#2D2D39] rounded-[2.5rem] p-10 border border-[#2D2D39] relative flex flex-col h-full overflow-hidden shadow-2xl">
      {/* Decorative background effects */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-600/10 blur-[100px] rounded-full"></div>
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-600/5 blur-[100px] rounded-full"></div>

      <div className="flex justify-between items-center mb-10 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <TrendingUp className="text-black" size={18} />
          </div>
          <span className="text-white font-bold text-lg">Stakent<sup>®</sup></span>
        </div>
        <span className="bg-[#6366F1] text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">New</span>
      </div>

      <div className="mb-12 relative z-10">
        <h2 className="text-4xl font-bold text-white mb-6 leading-[1.1]">Liquid Staking Portfolio</h2>
        <p className="text-gray-400 text-sm leading-relaxed max-w-[240px]">
          An all-in-one portfolio that helps you make smarter investments into Ethereum Liquid Staking.
        </p>
      </div>

      <div className="mt-auto space-y-4 relative z-10">
        <button className="w-full bg-[#D1D5DB] text-black font-bold py-4 rounded-3xl flex items-center justify-center gap-2 hover:bg-white transition-all shadow-xl shadow-black/20 group">
          Connect with Wallet
          <LayoutDashboard size={18} className="text-black/60 group-hover:text-black" />
        </button>
        <button className="w-full bg-[#16161E]/40 backdrop-blur-sm border border-[#2D2D39] text-white font-bold py-4 rounded-3xl flex items-center justify-center gap-2 hover:bg-[#16161E] transition-all">
          Enter a Wallet Address
          <Wallet size={18} className="text-gray-500" />
        </button>
      </div>

      {/* Background Starscape-like effect */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute bg-white rounded-full"
            style={{
              width: Math.random() * 2 + 'px',
              height: Math.random() * 2 + 'px',
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%'
            }}
          ></div>
        ))}
      </div>
    </div>
  );
};

export default PromoCard;
