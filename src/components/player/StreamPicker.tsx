/**
 * StreamPicker.tsx — Premium Meta-Streaming Aggregator UI
 *
 * Displays a luxury minimalist stream catalog grouped by quality and language.
 * Uses smooth responsive grids, glassmorphism, and subtle glowing effects.
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2,
  Wifi,
  Globe,
  Subtitles,
  AlertCircle,
  Zap,
  RefreshCw,
  Check,
  Database,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { StreamItem, ProviderState } from '../../api/streamProviders/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StreamPickerProps {
  streams: StreamItem[];
  providers: ProviderState[];
  isLoading: boolean;
  activeStream: StreamItem | null;
  onSelect: (stream: StreamItem) => void;
  onRetry?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLatencyColor(label?: string) {
  if (!label) return 'text-white/30';
  const l = label.toLowerCase();
  if (l.includes('ultra-fast')) return 'text-emerald-400';
  if (l.includes('fast')) return 'text-emerald-500';
  if (l.includes('slow')) return 'text-amber-500';
  if (l.includes('offline')) return 'text-rose-500';
  return 'text-white/30';
}

function formatLatencyLabel(label?: string) {
  if (!label) return 'TESTING...';
  if (label === 'Testing...') return 'TESTING...';
  return label.toUpperCase();
}

function getProviderName(item: StreamItem) {
  if (item.provider === 'cinepro') {
    return item.providerLabel.toUpperCase();
  }
  return item.provider.toUpperCase();
}

const ProviderLoadingDot: React.FC<{ status: ProviderState['status']; label: string }> = ({ status, label }) => {
  const dotColor = {
    loading: 'bg-amber-500 animate-pulse',
    done: 'bg-emerald-500',
    error: 'bg-rose-500',
    idle: 'bg-neutral-600',
    disabled: 'bg-neutral-800',
  }[status];

  return (
    <span
      className={cn('w-1.5 h-1.5 rounded-full shrink-0 transition-colors', dotColor)}
      title={`${label}: ${status.toUpperCase()}`}
    />
  );
};

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

const SectionHeader: React.FC<{ title: string; count: number; icon: React.ReactNode }> = ({ title, count, icon }) => {
  return (
    <div className="flex items-center justify-between px-1 py-1 text-[10px] uppercase tracking-widest font-black text-white/30">
      <div className="flex items-center gap-2">
        {icon}
        <span>{title}</span>
      </div>
      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-white/35">
        {count}
      </span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Row Component
// ---------------------------------------------------------------------------

const StreamRow: React.FC<{
  stream: StreamItem;
  isActive: boolean;
  onSelect: () => void;
}> = ({ stream, isActive, onSelect }) => {
  return (
    <motion.button
      layout
      whileHover={{ y: -1, scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      onClick={onSelect}
      className={cn(
        'relative w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all text-left outline-none cursor-pointer border overflow-hidden',
        isActive
          ? 'bg-emerald-500/[0.02] border-emerald-500/30 text-white shadow-[0_4px_20px_rgba(16,185,129,0.04)] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-emerald-500 before:rounded-l-xl'
          : 'bg-white/[0.01] hover:bg-white/[0.03] border-white/[0.04] hover:border-white/[0.07] text-white/70 hover:text-white'
      )}
    >
      {/* Icon status container */}
      <div
        className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors',
          isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/40'
        )}
      >
        <Database size={16} className={cn(isActive && 'drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]')} />
      </div>

      {/* Title & Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-semibold truncate', isActive ? 'text-white' : 'text-white/95')}>
            {stream.providerLabel}
          </span>
          {stream.episodeName && (
            <span className="text-[10px] text-white/30 font-medium font-mono shrink-0">
              Tập {stream.episodeName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1 text-[10px] tracking-wide font-mono">
          <span className="text-white/40 uppercase">{getProviderName(stream)}</span>
          <span className="text-white/20">•</span>
          <span className={cn('font-bold uppercase', getLatencyColor(stream.latencyLabel))}>
            {formatLatencyLabel(stream.latencyLabel)}
          </span>
        </div>
      </div>

      {/* Badges container */}
      <div className="flex items-center gap-3.5 shrink-0">
        {/* Quality Badge */}
        <span
          className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 border border-white/5 text-white/50 uppercase font-mono'
          )}
        >
          {stream.quality === 'auto' ? 'AUTO' : stream.quality}
        </span>

        {/* Checkmark icon */}
        {isActive && (
          <Check size={16} className="text-emerald-400 stroke-[3px] shrink-0" />
        )}
      </div>
    </motion.button>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const StreamPicker: React.FC<StreamPickerProps> = ({
  streams,
  providers,
  isLoading,
  activeStream,
  onSelect,
  onRetry,
  className,
}) => {
  // Group sources based on category
  const { viStreams, premiumStreams, communityStreams } = useMemo(() => {
    const vi = streams.filter(s => s.category === 'vi' || s.lang === 'vi');
    const premium = streams.filter(s => s.category === 'premium' && s.lang !== 'vi');
    const community = streams.filter(
      s => (s.category === 'standard' || s.category === 'free') && s.lang !== 'vi'
    );
    return { viStreams: vi, premiumStreams: premium, communityStreams: community };
  }, [streams]);

  const anyLoading = providers.some(p => p.status === 'loading');
  const allDone = providers.length > 0 && providers.every(p => p.status !== 'loading');
  const hasNoStreams = allDone && streams.length === 0;

  return (
    <div className={cn('space-y-4 select-none', className)}>
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center">
            <Wifi size={10} className="text-white/60" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
              VIDEO SOURCES
            </span>
            <span className="text-[9px] text-white/20 font-mono mt-0.5">
              Select server
            </span>
          </div>
        </div>

        {/* Status indicator / Scan */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.02] border border-white/[0.04]">
            {providers.map(p => (
              <ProviderLoadingDot key={p.id} status={p.status} label={p.label} />
            ))}
          </div>

          {anyLoading && (
            <span className="flex items-center gap-1.5 text-[9px] text-white/40 font-bold uppercase tracking-wider">
              <Loader2 size={10} className="animate-spin text-emerald-500" />
              Đang Quét...
            </span>
          )}

          {allDone && onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/40 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw size={9} />
              Quét Lại
            </button>
          )}
        </div>
      </div>

      {/* No streams layout */}
      {hasNoStreams && (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center rounded-xl bg-white/[0.01] border border-white/[0.04]">
          <AlertCircle size={24} className="text-white/10" />
          <div>
            <p className="text-white/50 text-xs font-bold">Không tìm thấy luồng phát nào.</p>
            <p className="text-[10px] text-white/25 mt-0.5">Hãy thử quét lại hoặc đổi tập phim.</p>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-[10px] font-bold hover:bg-white/10 transition-all cursor-pointer"
            >
              Thử lại
            </button>
          )}
        </div>
      )}

      {/* Grid of streams */}
      <div className="space-y-5">
        {/* Vietnamese Group */}
        {(viStreams.length > 0 || providers.some(p => p.group === 'vi' && p.status === 'loading')) && (
          <div className="space-y-2">
            <SectionHeader
              title="NGUỒN VIỆT NAM"
              count={viStreams.length}
              icon={<Subtitles size={11} className="text-white/20" />}
            />

            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {viStreams.map(stream => (
                  <StreamRow
                    key={stream.id}
                    stream={stream}
                    isActive={activeStream?.id === stream.id}
                    onSelect={() => onSelect(stream)}
                  />
                ))}
              </AnimatePresence>

              {viStreams.length === 0 && providers.some(p => p.group === 'vi' && p.status === 'loading') && (
                <div className="flex items-center justify-center gap-3 py-6 rounded-xl bg-white/[0.01] border border-white/[0.03]">
                  <Loader2 size={12} className="animate-spin text-white/30" />
                  <span className="text-xs text-white/30 font-medium">Đang tìm luồng phim Vietsub...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Premium Group */}
        {(premiumStreams.length > 0 || providers.some(p => p.id === 'cinepro' && p.status === 'loading')) && (
          <div className="space-y-2">
            <SectionHeader
              title="PREMIUM SOURCES"
              count={premiumStreams.length}
              icon={<Zap size={11} className="text-white/20" />}
            />

            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {premiumStreams.map(stream => (
                  <StreamRow
                    key={stream.id}
                    stream={stream}
                    isActive={activeStream?.id === stream.id}
                    onSelect={() => onSelect(stream)}
                  />
                ))}
              </AnimatePresence>

              {premiumStreams.length === 0 && providers.some(p => p.id === 'cinepro' && p.status === 'loading') && (
                <div className="flex items-center justify-center gap-3 py-6 rounded-xl bg-white/[0.01] border border-white/[0.03]">
                  <Loader2 size={12} className="animate-spin text-white/30" />
                  <span className="text-xs text-white/30 font-medium">Đang quét nguồn Premium HLS...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Community Group */}
        {(communityStreams.length > 0 || providers.some(p => p.id === 'embeds' && p.status === 'loading')) && (
          <div className="space-y-2">
            <SectionHeader
              title="COMMUNITY SOURCES"
              count={communityStreams.length}
              icon={<Globe size={11} className="text-white/20" />}
            />

            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {communityStreams.map(stream => (
                  <StreamRow
                    key={stream.id}
                    stream={stream}
                    isActive={activeStream?.id === stream.id}
                    onSelect={() => onSelect(stream)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Info Legend Footer */}
      {streams.length > 0 && (
        <div className="flex items-center justify-center gap-2 px-1 pt-3 text-[9px] text-white/20 font-bold uppercase tracking-wider">
          <span>SWITCH IF EXPERIENCING BUFFERING</span>
        </div>
      )}
    </div>
  );
};
