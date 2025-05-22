import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ScaledPortalProps {
  children: React.ReactNode;
  className?: string;
}

// Create a portal container that inherits the scale transform
export function ScaledPortal({ children, className = '' }: ScaledPortalProps) {
  const portalContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create a portal container that's positioned relative to the scaled root
    const container = document.createElement('div');
    container.className = `scaled-portal-container ${className}`;
    
    // Apply styles to make it work with the scaled coordinate system
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 9999;
      pointer-events: none;
      transform-origin: top left;
      transform: scale(0.9); /* Increased from 0.75 for better visibility */
      width: 111.11%; /* Adjusted for new scale factor: 100% / 0.9 */
      height: 111.11%; /* Adjusted for new scale factor: 100% / 0.9 */
    `;
    
    // Append to the root element (which has the scale transform)
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.appendChild(container);
      portalContainerRef.current = container;
    }

    return () => {
      if (portalContainerRef.current && rootElement) {
        rootElement.removeChild(portalContainerRef.current);
      }
    };
  }, [className]);

  if (!portalContainerRef.current) {
    return null;
  }

  return createPortal(
    <div style={{ 
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'auto'
    }}>
      {children}
    </div>,
    portalContainerRef.current
  );
}

// Wrapper for modal overlays that need to be scaled
export function ScaledModalOverlay({ 
  children, 
  onClose,
  className = ''
}: {
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}) {
  // Prevent background scrolling when modal is open
  useEffect(() => {
    // Save the original overflow style
    const originalOverflow = document.body.style.overflow;
    
    // Prevent scrolling on the body
    document.body.style.overflow = 'hidden';
    
    // Restore original overflow style when component unmounts
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);
  
  return (
    <ScaledPortal className={className}>
        <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(var(--gray-1-rgb), 0.8)', /* Using CSS variables for consistency */
          backdropFilter: 'blur(8px)', /* Increased blur for better visual effect */
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}
        onClick={onClose}
        className="design-modal-overlay" /* Added for animation consistency */
      >
        <div onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </ScaledPortal>
  );
}
