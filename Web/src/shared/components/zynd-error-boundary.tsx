"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { copy } from "@/shared/config/copy";

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
        role="alert"
        className="rounded-[var(--radius-card)] border border-destructive/25 bg-destructive/5 px-4 py-5"
      >
        <p className="text-compact font-semibold text-foreground">
          {this.props.title ?? copy.dashboard.error.boundaryTitle}
        </p>
        <p className="mt-2 text-caption leading-relaxed text-muted-foreground">
          {this.props.description ?? copy.dashboard.error.boundaryDescription}
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={this.handleReset}>
          {copy.dashboard.error.retry}
        </Button>
      </div>
    );
  }
}
