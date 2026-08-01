"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  ADD_INVESTOR_SIGNATURE_INK_COLOR,
  fillSignatureCanvasPaper,
  isSignatureCanvasBlank,
} from "@/lib/add-investor/add-investor-signature";
import { cn } from "@/lib/utils";

type AddInvestorSignaturePadProps = {
  value: string;
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
};

type Point = { x: number; y: number };

function getCanvasPoint(canvas: HTMLCanvasElement, event: PointerEvent): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

export function AddInvestorSignaturePad({
  value,
  onChange,
  disabled,
}: AddInvestorSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    fillSignatureCanvasPaper(canvas);

    if (!value) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const image = new Image();
    image.onload = () => {
      fillSignatureCanvasPaper(canvas);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = value;
  }, [value]);

  const syncCanvasValue = () => {
    const canvas = canvasRef.current;
    if (!canvas || isSignatureCanvasBlank(canvas)) {
      onChange("");
      return;
    }
    onChange(canvas.toDataURL("image/png"));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    canvas.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(canvas, event.nativeEvent);
    context.strokeStyle = ADD_INVESTOR_SIGNATURE_INK_COLOR;
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(point.x, point.y);
    setIsDrawing(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const point = getCanvasPoint(canvas, event.nativeEvent);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const endStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    canvas?.releasePointerCapture(event.pointerId);
    setIsDrawing(false);
    syncCanvasValue();
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    fillSignatureCanvasPaper(canvas);
    onChange("");
  };

  return (
    <div className="add-investor-signature-pad">
      <div
        className={cn(
          "add-investor-signature-pad__surface",
          disabled && "add-investor-signature-pad__surface--disabled",
        )}
      >
        <canvas
          ref={canvasRef}
          width={640}
          height={220}
          className={cn(
            "add-investor-signature-pad__canvas",
            disabled ? "cursor-not-allowed" : "cursor-crosshair",
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
        />
      </div>

      <div className="add-investor-signature-pad__actions">
        <Button type="button" variant="outline" size="sm" onClick={handleClear} disabled={disabled}>
          Clear signature
        </Button>
      </div>
    </div>
  );
}
