import React, { useEffect, useState, useRef } from 'react';
import { Activity, TrendingUp } from 'lucide-react';
import { NetworkInterface } from '../types';

interface TrafficGraphProps {
  interfaces: NetworkInterface[];
  totalRxMbps: number;
  totalTxMbps: number;
}

interface DataPoint {
  time: string;
  totalRx: number;
  totalTx: number;
  adapterRx: Record<string, number>;
}

export const TrafficGraph: React.FC<TrafficGraphProps> = ({
  interfaces,
  totalRxMbps,
  totalTxMbps
}) => {
  const [history, setHistory] = useState<DataPoint[]>([]);
  const maxPoints = 30;

  useEffect(() => {
    const now = new Date();
    const timeStr = `${now.getMinutes()}:${now.getSeconds() < 10 ? '0' : ''}${now.getSeconds()}`;
    
    const adapterRxMap: Record<string, number> = {};
    interfaces.forEach(i => {
      adapterRxMap[i.id] = i.rx_mbps;
    });

    setHistory(prev => {
      const next = [...prev, {
        time: timeStr,
        totalRx: totalRxMbps,
        totalTx: totalTxMbps,
        adapterRx: adapterRxMap
      }];
      if (next.length > maxPoints) {
        return next.slice(next.length - maxPoints);
      }
      return next;
    });
  }, [totalRxMbps, totalTxMbps, interfaces]);

  // Compute SVG viewBox and coordinates
  const height = 180;
  const width = 600;
  const maxVal = Math.max(
    10,
    Math.max(...history.map(d => Math.max(d.totalRx, d.totalTx)), 1) * 1.2
  );

  const getPoints = (valFn: (d: DataPoint) => number) => {
    if (history.length < 2) return '';
    return history
      .map((d, i) => {
        const x = (i / (maxPoints - 1)) * width;
        const y = height - (valFn(d) / maxVal) * (height - 20) - 10;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const totalRxPoints = getPoints(d => d.totalRx);
  const totalTxPoints = getPoints(d => d.totalTx);

  return (
    <div className="glass-panel rounded-2xl p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Live Aggregation Timeline</h2>
            <p className="text-xs text-slate-400">Real-time multi-WAN throughput telemetry (Last 30 seconds)</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-cyan-400 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
            Total RX ({totalRxMbps.toFixed(2)} Mbps)
          </span>
          <span className="flex items-center gap-1.5 text-indigo-400 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
            Total TX ({totalTxMbps.toFixed(2)} Mbps)
          </span>
        </div>
      </div>

      {/* SVG Canvas Line Graph */}
      <div className="w-full overflow-hidden relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
          {/* Background Grid Lines */}
          <line x1="0" y1="20" x2={width} y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <line x1="0" y1={height - 20} x2={width} y2={height - 20} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />

          {/* Gradients */}
          <defs>
            <linearGradient id="rx-area-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="tx-area-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* RX Filled Area */}
          {totalRxPoints && (
            <polygon
              points={`0,${height} ${totalRxPoints} ${((history.length - 1) / (maxPoints - 1)) * width},${height}`}
              fill="url(#rx-area-gradient)"
            />
          )}

          {/* TX Line */}
          {totalTxPoints && (
            <polyline
              fill="none"
              stroke="#6366f1"
              strokeWidth="2"
              points={totalTxPoints}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* RX Line */}
          {totalRxPoints && (
            <polyline
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2.5"
              points={totalRxPoints}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>

        {/* Max Scale Readout */}
        <div className="absolute top-2 right-2 text-[10px] font-mono text-slate-500">
          Scale: {maxVal.toFixed(1)} Mbps
        </div>
      </div>
    </div>
  );
};
