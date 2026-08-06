"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { ZyndErrorFallback } from "@/shared/components/zynd-error-fallback";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type ZyndErrorBoundaryProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  onReset?: () => void;
};

type ZyndErrorBoundaryState = {
  hasError: boolean;
};

export class ZyndErrorBoundary extends Component<
  ZyndErrorBoundaryProps,
  ZyndErrorBoundaryState
> {
  state: ZyndErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ZyndErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ZyndErrorBoundary]", error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        className={cn(
          "rounded-[var(--radius-card)] border border-destructive/20 bg-destructive/[0.03]",
        )}
      >
        <ZyndErrorFallback
          variant="inline"
          title={this.props.title ?? copy.dashboard.error.boundaryTitle}
          description={this.props.description ?? copy.dashboard.error.boundaryDescription}
          onRetry={this.handleReset}
        />
      </div>
    );
  }
}
