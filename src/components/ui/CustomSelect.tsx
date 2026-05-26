import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const CustomSelect = ({
  options,
  value,
  onChange,
  className
}: {
  options: { label: string; value: string | number }[];
  value: string | number;
  onChange: (val: any) => void;
  className?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState({});

  const selectedOption = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
        zIndex: 99999
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    
    // Update position on scroll
    const handleScroll = () => {
      if (isOpen && containerRef.current) {
         const rect = containerRef.current.getBoundingClientRect();
         setDropdownStyle(prev => ({ ...prev, top: rect.bottom + 8, left: rect.left }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isOpen]);

  return (
    <div className={cn("relative min-w-0 w-full transition-all duration-200", className)} ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
           "w-full bg-[#121212] hover:bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between text-sm text-white font-medium transition-all duration-200 shadow-[0_4px_12px_rgba(0,0,0,0.3)] cursor-pointer hover:border-white/20 active:scale-[0.98]",
           isOpen && "border-white/30 bg-[#1a1a1a]"
        )}
      >
        <span className="truncate mr-2 text-white font-medium">{selectedOption?.label}</span>
        <ChevronsUpDown size={14} className="text-gray-400 opacity-80" />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          ref={dropdownRef}
          style={dropdownStyle} 
          className="bg-[#121212]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.8)] p-1.5 overflow-hidden text-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="flex flex-col max-h-[250px] overflow-y-auto custom-scrollbar gap-0.5"
          >
            {options.map((option, i) => {
              const isSelected = value === option.value;
              return (
                <button
                  key={i}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3.5 py-2.5 flex items-center justify-between transition-all duration-150 cursor-pointer text-sm rounded-xl",
                    isSelected 
                      ? "bg-white/10 text-white font-bold" 
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <Check size={14} className="text-white shrink-0 ml-2" />}
                </button>
              );
            })}
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
};
