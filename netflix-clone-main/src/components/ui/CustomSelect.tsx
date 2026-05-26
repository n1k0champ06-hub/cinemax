import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
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

  const selectedOption = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn("relative z-50 min-w-[150px]", className)} ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#151515] hover:bg-[#222] border border-white/10 rounded-xl px-4 py-2 flex items-center justify-between text-sm text-white font-medium transition-colors"
      >
        <span className="truncate mr-2">{selectedOption?.label}</span>
        <ChevronDown size={16} className={cn("text-gray-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 w-full mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl py-2 overflow-hidden z-50 text-sm"
          >
            <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
              {options.map((option, i) => (
                <button
                  key={i}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-white/10 transition-colors",
                    value === option.value ? "text-red-500 font-bold bg-white/5" : "text-gray-300"
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {value === option.value && <Check size={16} />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
