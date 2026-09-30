import React from 'react';
import { ShieldCheck, ShieldAlert, Activity, Cpu, Layers, Zap, Sliders, Gauge, Terminal } from 'lucide-react';
import { EngineStatus } from '../types';

interface HeaderProps {
  status: EngineStatus | null;
  onOpenModeSelector: () => void;
  onOpenSpeedTest: () => void;
  onOpenSettings: () => void;
  onOpenLogs: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  onOpenModeSelector,
  onOpenSpeedTest,
  onOpenSettings,
  onOpenLogs,
  activeTab,
  setActiveTab
}) => {
  const isOnline = status?.active ?? false;
  const isModeB = status?.mode === 'mode_b';

  return (
    <header className="sticky top-0 z-30 glass-panel border-b border-white/10 px-6 py-4 mb-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-surface rounded-[11px] flex items-center justify-center">
                <Layers className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            {isOnline && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                NexusBond
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-mono tracking-wider font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                v1.0.0
              </span>
            </div>
            <p className="text-xs text-slate-400">Intelligent Multi-WAN Bonding Engine</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center bg-slate-900/60 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('adapters')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'adapters'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Adapters ({status?.healthy_interfaces || 0}/{status?.total_interfaces || 0})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'logs'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Audit Logs
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Mode Badge Button */}
          <button
            onClick={onOpenModeSelector}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all ${
              isModeB
                ? 'bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20'
                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{isModeB ? 'Mode B: Bonding Relay' : 'Mode A: Smart Dispatch'}</span>
          </button>

          {/* Speedtest Button */}
          <button
            onClick={onOpenSpeedTest}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-slate-300 hover:text-white transition-all shadow-sm"
            title="Multi-WAN Speed Test"
          >
            <Gauge className="w-4 h-4 text-cyan-400" />
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-slate-300 hover:text-white transition-all shadow-sm"
            title="System Settings"
          >
            <Sliders className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </div>
    </header>
  );
};
