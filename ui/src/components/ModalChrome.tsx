import React from 'react';
import { motion, AnimatePresence, useReducedMotion, type Transition } from 'motion/react';
import { backdropClass, modalCardClass } from '../styles';

/** Card spring: quick settle, small overshoot — "alive" without wobbling. */
const CARD_SPRING: Transition = { type: 'spring', stiffness: 420, damping: 30 };
const FADE: Transition = { duration: 0.15 };

interface ModalChromeProps {
  /** Controls presence; keep AnimatePresence mounted for exit animation. */
  open: boolean;
  /**
   * Backdrop-click dismiss. Omit (or pass undefined) for mandatory prompts —
   * clicking outside does nothing.
   */
  onClose?: () => void;
  /** Dialog label for a11y. */
  'aria-label': string;
  /** Extra classes on the card (width etc.). */
  className?: string;
  children: React.ReactNode;
}

/**
 * Animated modal chrome: a fading backdrop plus a card that springs open and
 * out. Renders through AnimatePresence so the exit spring plays when `open`
 * flips — callers must render this component unconditionally and drive it
 * with `open` rather than `{cond && <ModalChrome/>}` inside themselves.
 * Reduced-motion preference swaps the springs for a fast fade.
 */
const ModalChrome: React.FC<ModalChromeProps> = ({ open, onClose, 'aria-label': ariaLabel, className = '', children }) => {
  const reduce = useReducedMotion();
  const cardTransition = reduce ? { duration: 0.12 } : CARD_SPRING;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={backdropClass}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={FADE}
          onMouseDown={(e) => {
            // Click outside the card dismisses (when the prompt is dismissible).
            if (onClose && e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            className={`${modalCardClass} ${className}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8 }}
            transition={cardTransition}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ModalChrome;
