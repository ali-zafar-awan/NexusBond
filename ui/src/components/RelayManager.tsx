import React, { useState } from 'react';
import { Server, Plus, CheckCircle2, Shield, Activity, RefreshCw, Trash2, Key, Globe } from 'lucide-react';
import { RelayNodeInfo } from '../types';

interface RelayManagerProps {
  relays: RelayNodeInfo[];
  activeRelayId?: string;
  onSelectRelay: (id: string) => void;
  onAddRelay: (name: string, host: string, port: number, pubKey: string) => void;
  onRemoveRelay: (id: string) => void;
  onTestRelay: (id: string) => Promise<void>;
}

export const RelayManager: React.FC<RelayManagerProps> = ({
  relays,
  activeRelayId,
  onSelectRelay,
  onAddRelay,
  onRemoveRelay,
  onTestRelay
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(51820);
  const [pubKey, setPubKey] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !host) return;
    onAddRelay(name, host, port, pubKey);
    setName('');
    setHost('');
    setPubKey('');
    setShowAddModal(false);
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      await onTestRelay(id);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20 mb-1">
            <Server className="w-3.5 h-3.5" /> Mode B Multipath Relays
          </div>
          <h2 className="text-lg font-bold text-white">Bonding Relay Nodes</h2>
          <p className="text-xs text-slate-400">
            Self-hosted VPS relay endpoints for true single-stream packet striping and aggregation.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Custom Relay</span>
        </button>
      </div>

      {/* Relays Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {relays.map((r) => {
          const isActive = r.id === activeRelayId || r.is_active;
          return (
            <div
              key={r.id}
              className={`glass-card rounded-2xl p-5 relative transition-all duration-300 flex flex-col justify-between ${
                isActive
                  ? 'border-purple-500/50 shadow-lg shadow-purple-500/10 bg-purple-950/20'
                  : 'hover:border-white/10'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-800/80 border border-white/5 text-purple-400">
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-tight">{r.name}</h3>
                      <span className="text-[11px] font-mono text-slate-400">
                        {r.host}:{r.port}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                      r.status === 'Online'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                  <div className="p-2.5 rounded-xl bg-slate-900/40 border border-white/5">
                    <span className="text-[10px] text-slate-400 block">Ping Latency</span>
                    <span className="text-sm font-bold font-mono text-white">
                      {r.latency_ms > 0 ? `${r.latency_ms.toFixed(0)} ms` : 'Unchecked'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/40 border border-white/5">
                    <span className="text-[10px] text-slate-400 block">Handshake</span>
                    <span className="text-sm font-bold text-purple-300">Noise_IK OK</span>
                  </div>
                </div>

                {r.public_key && (
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-white/5 mb-4 text-[10px] font-mono text-slate-400 truncate flex items-center gap-1.5">
                    <Key className="w-3 h-3 text-slate-500 shrink-0" />
                    <span className="truncate">{r.public_key}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleTest(r.id)}
                  disabled={testingId === r.id}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingId === r.id ? 'animate-spin' : ''}`} />
                  <span>Test Ping</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onRemoveRelay(r.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Remove Relay"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onSelectRelay(r.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-slate-800 hover:bg-purple-600/40 text-slate-200'
                    }`}
                  >
                    {isActive ? 'Connected' : 'Select'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 relative border border-white/10 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Add New Self-Hosted Relay</h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter the IP/domain and port of your self-hosted NexusBond VPS relay node.
            </p>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Relay Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Frankfurt VPS 1"
                  required
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-slate-300 block mb-1">Host / Public IP</label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="e.g. 198.51.100.25"
                    required
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Port</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(parseInt(e.target.value) || 51820)}
                    required
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Noise Static Public Key (Base64)</label>
                <input
                  type="text"
                  value={pubKey}
                  onChange={(e) => setPubKey(e.target.value)}
                  placeholder="e.g. yK8b8kX4d6Q7..."
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                >
                  Save Relay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
