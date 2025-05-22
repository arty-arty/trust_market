import React from 'react';
import { Button } from '@radix-ui/themes';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface BackButtonProps {
  fallbackPath?: string;
}

export function BackButton({ fallbackPath = '/marketplace' }: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Handle back navigation
  const handleBack = () => {
    // If there's history to go back to, use the browser's back functionality
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      // Otherwise, navigate to the fallback path
      navigate(fallbackPath);
    }
  };
  
  // Don't show back button on main marketplace landing page
  if (location.pathname === '/marketplace') {
    return null;
  }
  
  return (
    <Button 
      variant="ghost" 
      onClick={handleBack}
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '4px',
        padding: '8px 12px',
      }}
    >
      <ArrowLeft size={16} />
      Back
    </Button>
  );
}
