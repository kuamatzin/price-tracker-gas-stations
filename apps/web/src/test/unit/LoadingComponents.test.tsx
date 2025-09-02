import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { 
  Spinner, 
  ProgressIndicator, 
  LoadingOverlay,
  CardSkeleton,
  DashboardSkeleton,
  ShimmerCard
} from '@/components/common';

describe('Loading Components', () => {
  describe('Spinner', () => {
    it('renders with default size', () => {
      render(<Spinner />);
      const spinner = document.querySelector('.h-6.w-6');
      expect(spinner).toBeInTheDocument();
    });

    it('renders with custom size', () => {
      render(<Spinner size="lg" />);
      const spinner = document.querySelector('.h-8.w-8');
      expect(spinner).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<Spinner className="custom-class" />);
      const spinner = document.querySelector('.custom-class');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('ProgressIndicator', () => {
    it('renders with correct percentage', () => {
      render(<ProgressIndicator value={75} showPercentage={true} />);
      
      const progressBar = document.querySelector('[style*="width: 75%"]');
      expect(progressBar).toBeInTheDocument();
      
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('handles values over max', () => {
      render(<ProgressIndicator value={150} max={100} showPercentage={true} />);
      
      const progressBar = document.querySelector('[style*="width: 100%"]');
      expect(progressBar).toBeInTheDocument();
      
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('works with custom max value', () => {
      render(<ProgressIndicator value={30} max={60} showPercentage={true} />);
      
      const progressBar = document.querySelector('[style*="width: 50%"]');
      expect(progressBar).toBeInTheDocument();
      
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });

  describe('LoadingOverlay', () => {
    it('renders when visible', () => {
      render(<LoadingOverlay isVisible={true} message="Loading data..." />);
      expect(screen.getByText('Loading data...')).toBeInTheDocument();
    });

    it('does not render when not visible', () => {
      render(<LoadingOverlay isVisible={false} message="Loading data..." />);
      expect(screen.queryByText('Loading data...')).not.toBeInTheDocument();
    });

    it('shows default message when none provided', () => {
      render(<LoadingOverlay isVisible={true} />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Skeleton Components', () => {
    it('renders CardSkeleton', () => {
      render(<CardSkeleton />);
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders DashboardSkeleton with multiple sections', () => {
      render(<DashboardSkeleton />);
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(3);
    });
  });

  describe('ShimmerCard', () => {
    it('renders with shimmer animation', () => {
      render(<ShimmerCard />);
      const shimmerElement = document.querySelector('.animate-\\[shimmer_2s_infinite\\]');
      expect(shimmerElement).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<ShimmerCard className="custom-shimmer" />);
      const shimmerCard = document.querySelector('.custom-shimmer');
      expect(shimmerCard).toBeInTheDocument();
    });
  });
});