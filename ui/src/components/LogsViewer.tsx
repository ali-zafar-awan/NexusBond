import React from 'react';
import { Terminal, ShieldAlert, CheckCircle2, ArrowRight, Clock } from 'lucide-react';
import { FailoverEvent } from '../types';

interface LogsViewerProps {
  events: FailoverEvent[];
}

export const LogsViewer: React.FC<LogsViewerProps> = ({ events }) => {
  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Failover & Audit Event Log</h2>
            <p className="text-xs text-slate-400">Automatic sub-second stream migrations and interface state changes</p>
          </div>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {events.length} Recorded Events
        </span>
      </div>

      {events.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-900/30 border border-white/5 flex flex-col items-center justify-center text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
          <h3 className="text-xs font-semibold text-slate-200">Zero Failover Disruptions</h3>
          <p className="text-[11px] text-slate-500 max-w-xs mt-0.5">
            All connected physical network interfaces are healthy and operating normally.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
          {events.map((ev, idx) => {
            const date = new Date(ev.timestamp * 1000);
            const timeStr = date.toLocaleTimeString();
            return (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-900/60 border border-amber-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                    <ShieldAlert className="w-4 h-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2 font-medium text-white">
                      <span className="text-rose-400">{ev.failed_interface_name}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-emerald-400">{ev.target_interface_name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Reason: {ev.reason}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono">
                  <span className="bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded">
                    {ev.active_streams_rerouted} Streams Rerouted
                  </span>
                  <span className="flex items-center gap-1 text-slate-500">
                    <Clock className="w-3 h-3" /> {timeStr}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
