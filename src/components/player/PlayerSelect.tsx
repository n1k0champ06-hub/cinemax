import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Option {
  value: any;
  label: string;
  icon?: React.ReactNode;
}

interface PlayerSelectProps {
  options: Option[];
  value: any;
  onChange: (value: any) => void;
  activeColor: string;
  className?: string;
}

export const PlayerSelect = ({ options, value, onChange, activeColor, className }: PlayerSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setScrollTick] = useState(0);

  const selectedOption = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    if (!isOpen) return;

    const handleUpdate = () => {
      setScrollTick(prev => prev + 1);
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isOpen]);

  let dropdownStyle: React.CSSProperties = {};
  if (isOpen && containerRef.current) {
    const rect = containerRef.current.getBoundingClientRect();
    
    // Check if we are inside a fullscreen container and need to adjust top offset
    const fsElement = typeof document !== 'undefined'
      ? (document.fullscreenElement || (document as any).webkitFullscreenElement)
      : null;
      
    let offsetTop = rect.bottom + 6;
    let offsetRight = window.innerWidth - rect.right;
    
    if (fsElement) {
      const fsRect = fsElement.getBoundingClientRect();
      offsetTop = rect.bottom - fsRect.top + 6;
      offsetRight = fsRect.right - rect.right;
    }

    dropdownStyle = {
      position: 'fixed',
      top: `${offsetTop}px`,
      right: `${offsetRight}px`,
      minWidth: '160px',
      zIndex: 999999
    };
  }

  // Find dynamic portal target (supporting fullscreen element or document.body)
  const getPortalTarget = () => {
    if (typeof document === 'undefined') return null;
    const fsElement = document.fullscreenElement || (document as any).webkitFullscreenElement;
    if (fsElement) return fsElement;
    return document.body;
  };

  const portalTarget = getPortalTarget();

  return (
    <div className={cn("relative inline-block text-left", className)} ref={containerRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        className={cn(
          "bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-3 py-1.5 text-xs font-bold outline-none cursor-pointer active:scale-[0.98] text-white flex items-center justify-between gap-2 select-none transition-all duration-200 w-[115px]",
          isOpen && "border-white/20 bg-white/10"
        )}
      >
        <span className="truncate pr-1 text-gray-200">{selectedOption?.label}</span>
        <ChevronDown size={12} className="text-gray-400 opacity-80 shrink-0" />
      </button>

      <AnimatePresence>
        {isOpen && portalTarget && createPortal(
          <>
            {/* Transparent backdrop to handle click outside */}
            <div 
              className="fixed inset-0 z-[999998] bg-transparent cursor-default"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
            />
            <div 
              style={dropdownStyle} 
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              className="bg-black/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.85)] p-1.5 overflow-hidden text-sm z-[999999]"
            >
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="flex flex-col gap-0.5"
              >
                {options.map((option, i) => {
                  const isSelected = value === option.value;
                  return (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(option.value);
                        setIsOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 flex items-center justify-between transition-all duration-150 cursor-pointer text-xs rounded-xl hover:bg-white/5 text-gray-300 hover:text-white"
                      style={isSelected ? {
                        backgroundColor: `${activeColor}30`,
                        color: '#ffffff',
                      } : undefined}
                    >
                      <div className="flex items-center gap-2">
                        {option.icon && (
                          <span style={isSelected ? { color: '#ffffff' } : { color: '#9ca3af' }}>
                            {option.icon}
                          </span>
                        )}
                        <span className={cn("font-medium", isSelected ? "font-bold" : "")}>{option.label}</span>
                      </div>
                      {isSelected && <Check size={12} className="text-white shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </motion.div>
            </div>
          </>,
          portalTarget
        )}
      </AnimatePresence>
    </div>
  );
};
