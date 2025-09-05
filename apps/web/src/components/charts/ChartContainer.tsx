import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';
import { CHART_CONFIG } from '../../config/charts';

interface ChartContainerProps {
  children: ReactNode;
  className?: string;
}

export function ChartContainer({ children, className = '' }: ChartContainerProps) {
  const [dimensions, setDimensions] = useState(() => {
    const width = window.innerWidth;
    if (width < 768) return CHART_CONFIG.responsive.mobile;
    if (width < 1024) return CHART_CONFIG.responsive.tablet;
    return CHART_CONFIG.responsive.desktop;
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setDimensions(CHART_CONFIG.responsive.mobile);
      } else if (width < 1024) {
        setDimensions(CHART_CONFIG.responsive.tablet);
      } else {
        setDimensions(CHART_CONFIG.responsive.desktop);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={`chart-container ${className}`} style={{ height: dimensions.height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}