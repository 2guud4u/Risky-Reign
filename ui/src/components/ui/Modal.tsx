import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import Button from './Button';

interface ModalProps {
  /** Controls visibility; renders nothing when false. */
  open: boolean;
  /** Called when the user dismisses (backdrop click, X button, or Escape). */
  onClose: () => void;
  /** Modal title; renders the header row when present. */
  title?: React.ReactNode;
  /** Accessible label — defaults to title text when it's a string. */
  'aria-label'?: string;
  /** Max-width class (default max-w-md). */
  width?: string;
  /** Footer buttons — rendered in a bottom row. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** Shared modal surface: backdrop, spring open/close, Escape + backdrop
 * dismiss, consistent rounded/shadowed card. All screens render through this —
 * never raw fixed-position divs. */
const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  'aria-label': ariaLabel,
  width = 'max-w-md',
  footer,
  children,
}) => (
  <AnimatePresence>
    {open && (
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? (typeof title === 'string' ? title : undefined)}
        className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          className={`w-full ${width} bg-canvas-raised rounded-xl shadow-pop p-5 flex flex-col gap-3 max-h-[90vh]`}
          initial={{ scale: 0.92, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 8 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        >
          {title && (
            <div className="flex items-center justify-between gap-3 shrink-0">
              <h2 className="m-0 text-lg font-bold text-ink">{title}</h2>
              <Button
                variant="ghost"
                size="sm"
                className="!p-1.5"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={18} />
              </Button>
            </div>
          )}
          <div className="min-h-0 overflow-y-auto flex-1">{children}</div>
          {footer && <div className="shrink-0">{footer}</div>}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default Modal;
