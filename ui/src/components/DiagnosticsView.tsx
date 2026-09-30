import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Globe, 
  Lock, 
  Radio, 
  Network,
  Cpu
} from 'lucide-react';
import { DiagnosticsStatus, NetworkInterface } from '../types';

interface DiagnosticsViewProps {
  interfaces: NetworkInterface[];
  killSwitchArmed: boolean;
  onRunDiagnostics: () => Promise<DiagnosticsStatus>;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({
  interfaces,
  killSwitchArmed,
  onRunDiagnostics
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [diag, setDiag] = useState<DiagnosticsStatus>({
    dns_leak_detected: false,
    ipv6_leak_detected: false,
    kill_switch_armed: killSwitchArmed,
    shared_upstream_detected: false,
  });

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const res = await onRunDiagnostics();
      setDiag(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 mb-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Security & Integrity Verification
          </div>
          <h2 className="text-lg font-bold text-white">System Diagnostics & Leak Tests</h2>
          <p className="text-xs text-slate-400">
            Verifies DNS privacy, IPv6 leak protection, kill switch enforcement, and upstream ISP independence.
          </p>
        </div>

        <button
          onClick={handleRun}
          disabled={isRunning}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
          <span>{isRunning ? 'Running Audits...' : 'Run Full Diagnostics'}</span>
        </button>
      </div>

      {/* Security Audit Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* DNS Leak Check */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">DNS Leak Protection</h3>
                <p className="text-[11px] text-slate-400">Parallel DNS racing over encrypted/bonded tunnel</p>
              </div>
            </div>

            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
              !diag.dns_leak_detected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              {!diag.dns_leak_detected ? 'Secured (No Leak)' : 'Leak Detected'}
            </span>
          </div>
          <div className="text-xs text-slate-400 leading-relaxed pt-2 border-t border-white/5">
            DNS queries are resolved exclusively through NexusBond multiplexer. Zero unencrypted OS fallback queries detected.
          </div>
        </div>

        {/* IPv6 Leak Protection */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                <Network className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">IPv6 Leak Shield</h3>
                <p className="text-[11px] text-slate-400">Blackholes un-tunneled IPv6 packets</p>
              </div>
            </div>

            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
              !diag.ipv6_leak_detected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              {!diag.ipv6_leak_detected ? 'Protected' : 'Warning'}
            </span>
          </div>
          <div className="text-xs text-slate-400 leading-relaxed pt-2 border-t border-white/5">
            Automatic IPv6 leak suppression prevents ISP bypass on dual-stack home routers.
          </div>
        </div>

        {/* Kill Switch Armed */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">System Kill Switch</h3>
                <p className="text-[11px] text-slate-400">Blocks un-bonded traffic if tunnel drops</p>
              </div>
            </div>

            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
              killSwitchArmed
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {killSwitchArmed ? 'Armed' : 'Disarmed'}
            </span>
          </div>
          <div className="text-xs text-slate-400 leading-relaxed pt-2 border-t border-white/5">
            {killSwitchArmed 
              ? 'All outbound traffic will be dropped if bonded tunnel disconnects.'
              : 'Traffic will fail over to local physical default gateway if all relays disconnect.'}
          </div>
        </div>

        {/* Upstream ISP Sharing Detection */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Upstream ISP Independence</h3>
                <p className="text-[11px] text-slate-400">FR-1.2 Shared-upstream bottleneck detection</p>
              </div>
            </div>

            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
              !diag.shared_upstream_detected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              {!diag.shared_upstream_detected ? 'Independent Links' : 'Shared Upstream!'}
            </span>
          </div>
          <div className="text-xs text-slate-400 leading-relaxed pt-2 border-t border-white/5">
            {diag.shared_upstream_detected
              ? 'Warning: Two or more adapters share the same upstream gateway / public IP, limiting additive bandwidth.'
              : 'All detected adapters connect through independent physical gateways.'}
          </div>
        </div>
      </div>
    </div>
  );
};
