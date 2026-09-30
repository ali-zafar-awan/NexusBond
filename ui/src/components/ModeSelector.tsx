import React, { useState } from 'react';
import { X, Zap, Server, ShieldCheck, CheckCircle2, Globe, Cpu, ArrowRight } from 'lucide-react';

interface ModeSelectorProps {
  currentMode: 'mode_a' | 'mode_b';
  onClose: () => void;
  onSaveMode: (mode: 'mode_a' | 'mode_b', relayConfig?: any) => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  currentMode,
  onClose,
  onSaveMode
}) => {
  const [selectedMode, setSelectedMode] = useState<'mode_a' | 'mode_b'>(currentMode);
  const [relayHost, setRelayHost] = useState('relay.nexusbond.net');
  const [relayPort, setRelayPort] = useState(51820);
  const [authKey, setAuthKey] = useState('nexusbond_secret');

  const handleSave = () => {
    onSaveMode(selectedMode, {
      enabled: selectedMode === 'mode_b',
      server_address: relayHost,
      server_port: relayPort,
      auth_key: authKey,
      protocol: 'udp_stripe',
      encryption: true
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="glass-panel w-full max-w-2xl rounded-3xl p-6 relative border border-white/10 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2">
            <Zap className="w-3.5 h-3.5" /> Operational Modes
          </div>
          <h2 className="text-xl font-bold text-white">Select Bonding Architecture</h2>
          <p className="text-xs text-slate-400 mt-1">
            Choose how NexusBond balances and aggregates your internet connections.
          </p>
        </div>

        {/* Mode Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Mode A */}
          <div
            onClick={() => setSelectedMode('mode_a')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              selectedMode === 'mode_a'
                ? 'bg-cyan-500/10 border-cyan-500/50 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500'
                : 'bg-slate-900/40 border-white/5 hover:border-white/10'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400">
                <Globe className="w-5 h-5" />
              </span>
              {selectedMode === 'mode_a' && (
                <CheckCircle2 className="w-5 h-5 text-cyan-400" />
              )}
            </div>
            <h3 className="text-base font-bold text-white mb-1">Mode A: Smart Dispatch</h3>
            <p className="text-xs text-cyan-300 font-semibold mb-2">100% Local • Zero Cloud Cost</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Distributes web streams, downloads, video streaming, game updates, and browser tabs across all connections simultaneously.
            </p>
            <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-slate-300">
              ✓ Multi-Stream Speed: <strong className="text-white">Full Sum</strong><br />
              ✓ No VPS / Relay needed
            </div>
          </div>

          {/* Mode B */}
          <div
            onClick={() => setSelectedMode('mode_b')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              selectedMode === 'mode_b'
                ? 'bg-purple-500/10 border-purple-500/50 shadow-lg shadow-purple-500/10 ring-1 ring-purple-500'
                : 'bg-slate-900/40 border-white/5 hover:border-white/10'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400">
                <Server className="w-5 h-5" />
              </span>
              {selectedMode === 'mode_b' && (
                <CheckCircle2 className="w-5 h-5 text-purple-400" />
              )}
            </div>
            <h3 className="text-base font-bold text-white mb-1">Mode B: Bonding Tunnel</h3>
            <p className="text-xs text-purple-300 font-semibold mb-2">Single-Stream Aggregation</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Combines links into a unified packet-striped tunnel terminating at a free self-hosted VPS or relay node.
            </p>
            <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-slate-300">
              ✓ Single-Connection Speed: <strong className="text-white">Full Sum</strong><br />
              ✓ WireGuard / ChaCha20 encryption
            </div>
          </div>
        </div>

        {/* Mode B Options if selected */}
        {selectedMode === 'mode_b' && (
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-purple-500/20 mb-6 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">
              Self-Hosted Relay Node Config
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">VPS Host / IP</label>
                <input
                  type="text"
                  value={relayHost}
                  onChange={(e) => setRelayHost(e.target.value)}
                  className="w-full bg-slate-950 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Port</label>
                <input
                  type="number"
                  value={relayPort}
                  onChange={(e) => setRelayPort(parseInt(e.target.value) || 51820)}
                  className="w-full bg-slate-950 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
          >
            <span>Apply Architecture</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
