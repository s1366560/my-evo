"use client";

import { useToast } from "./use-toast";
import {
  Toast,
  ToastClose,
  ToastProvider,
  ToastViewport,
  ToastIcon,
  ToastTitle,
  ToastDescription,
  ToastAction,
} from "./toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, variant, action, ...props }) => (
        <Toast key={id} variant={variant} {...props}>
          <div className="flex w-full items-start gap-3">
            {variant && variant !== "default" && <ToastIcon variant={variant} />}
            <div className="flex flex-col gap-1.5 flex-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action && (
              <ToastAction
                altText={action.label}
                onClick={action.onClick}
              >
                {action.label}
              </ToastAction>
            )}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
