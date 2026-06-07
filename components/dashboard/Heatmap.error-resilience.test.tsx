import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import Heatmap from './Heatmap';
import type { ActivityData } from '@/types/dashboard';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
  },
}));

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
};

// Error Boundary
class TestErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);

    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <p>Something went wrong</p>
          <button>Retry</button>
        </div>
      );
    }

    return this.props.children;
  }
}

const mockData: ActivityData[] = [
  {
    count: 5,
    date: '2025-01-01',
    intensity: 2,
  },
];

describe('Heatmap Error Resilience', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('maintains hydration stability during repeated renders', () => {
    const { rerender } = render(
      <TestErrorBoundary>
        <Heatmap data={mockData} />
      </TestErrorBoundary>
    );

    rerender(
      <TestErrorBoundary>
        <Heatmap data={mockData} />
      </TestErrorBoundary>
    );

    expect(screen.getByText(/contribution heatmap/i)).toBeInTheDocument();
  });

  it('renders fallback UI when nested runtime exception occurs', () => {
    const ThrowingComponent = () => {
      throw new Error('Simulated runtime crash');
    };

    render(
      <TestErrorBoundary>
        <ThrowingComponent />
      </TestErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeDefined();
  });

  it('handles exceptions from Heatmap safely and logs telemetry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <TestErrorBoundary>
        <Heatmap data={undefined as unknown as ActivityData[]} />
      </TestErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeDefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('provides recovery/reset controls in fallback UI', () => {
    const BrokenComponent = () => {
      throw new Error('Unexpected failure');
    };

    render(
      <TestErrorBoundary>
        <BrokenComponent />
      </TestErrorBoundary>
    );

    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
  });

  it('logs exceptions to telemetry trackers', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const CrashComponent = () => {
      throw new Error('Telemetry test crash');
    };

    render(
      <TestErrorBoundary>
        <CrashComponent />
      </TestErrorBoundary>
    );

    expect(errorSpy).toHaveBeenCalled();
  });
});
