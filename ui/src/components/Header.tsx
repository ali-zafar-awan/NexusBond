import React from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Activity, 
  Layers, 
  Zap, 
  Sliders, 
  Gauge, 
  Terminal, 
  Server, 
  Radio, 
  Sparkles,
  Lock,
  LockOpen
} from 'lucide-react';
import { EngineStatus } from '../types';

interface HeaderProps {
  status: EngineStatus | null;
  onOpenModeSelector: () => void;
  onOpenSpeedTest: () => void;
  onOpenSettings: () => void;
  onOpenWizard: () => void;
  onToggleKillSwitch: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  onOpenModeSelector,
  onOpenSpeedTest,
  onOpenSettings,
  onOpenWizard,
  onToggleKillSwitch,
  activeTab,
  setActiveTab
}) => {
  const isOnline = status?.active ?? false;
  const mode = status?.mode || 'auto';
  const killSwitch = status?.kill_switch ?? false;

  const getModeLabel = () => {
    switch (mode) {
      case 'tunnel_only':
      case 'mode_b':
        return 'Tunnel Only (Mode B)';
      case 'local_only':
      case 'mode_a':
        return 'Local Dispatch (Mode A)';
      default:
        return 'Auto Mode (Dynamic)';
    }
  };

  return (
    <header className="sticky top-0 z-30 glass-panel border-b border-white/10 px-6 py-3.5 mb-6">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Logo & v2 Brand */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-cyan-500 to-emerald-400 p-[1px] shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-[#0b0f19] rounded-[11px] flex items-center justify-center">
                <Layers className="w-5 h-5 text-cyan-400" />
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
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider rounded-full bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-cyan-300 border border-cyan-500/30">
                v2.0 (Rust Core)
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Next-Gen Multi-WAN Bonding Engine</p>
          </div>
        </div>

        {/* Navigation Tabs (v2) */}
        <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-white/10 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('adapters')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'adapters'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Adapters ({status?.healthy_interfaces || 0}/{status?.total_interfaces || 0})
          </button>
          <button
            onClick={() => setActiveTab('relays')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'relays'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-purple-400" />
            Relays
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'diagnostics'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Diagnostics
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'logs'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-slate-400" />
            Audit Logs
          </button>
        </div>

        {/* Action Controls & Badges */}
        <div className="flex items-center gap-2">
          {/* First Run Wizard Button */}
          <button
            onClick={onOpenWizard}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-xs font-medium text-amber-300 hover:text-amber-200 flex items-center gap-1.5 transition-all"
            title="Launch Setup Wizard"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Wizard</span>
          </button>

          {/* Kill Switch Toggle */}
          <button
            onClick={onToggleKillSwitch}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
              killSwitch
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 shadow-sm shadow-rose-500/20'
                : 'bg-slate-800/60 border-white/10 text-slate-400 hover:text-slate-200'
            }`}
            title={killSwitch ? 'Kill Switch Armed (Blocks Unbonded Traffic)' : 'Enable Kill Switch'}
          >
            {killSwitch ? <Lock className="w-3.5 h-3.5 text-rose-400" /> : <LockOpen className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Kill Switch</span>
          </button>

          {/* Mode Selector Button */}
          <button
            onClick={onOpenModeSelector}
            className="px-3 py-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 text-xs font-medium flex items-center gap-1.5 transition-all"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>{getModeLabel()}</span>
          </button>

          {/* Bonding Test Button */}
          <button
            onClick={onOpenSpeedTest}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-slate-300 hover:text-white transition-all shadow-sm"
            title="Bonding Test (Zero Simulated Numbers)"
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
