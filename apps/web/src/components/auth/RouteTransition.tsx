import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface RouteTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export const RouteTransition = ({ children, className }: RouteTransitionProps) => {
  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    setIsTransitioning(true);
    
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <div 
      className={`
        w-full transition-all duration-300 ease-in-out
        ${isTransitioning 
          ? 'opacity-0 transform translate-y-2' 
          : 'opacity-100 transform translate-y-0'
        }
        ${className || ''}
      `}
    >
      {children}
    </div>
  );
};