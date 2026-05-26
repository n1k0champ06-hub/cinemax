import { useEffect, useState, useRef } from 'react';

export const useIntersectionObserver = (options: IntersectionObserverInit) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // use stringified options as dependency to avoid infinite loops if an object literal is passed
  const optionsString = JSON.stringify(options || {});

  useEffect(() => {
    const parsedOptions = JSON.parse(optionsString);
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, parsedOptions);

    const el = ref.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
      observer.disconnect();
    };
  }, [optionsString]);

  return { ref, isIntersecting };
};
