import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import debounce from 'lodash.debounce';

export function useGhostText(text, enabled = true) {
  const [ghostText, setGhostText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const lastTextRef = useRef('');
  const abortControllerRef = useRef(null);

  const fetchGhostText = useCallback(
    debounce(async (currentText) => {
      // Don't fetch if text hasn't meaningfully changed
      if (currentText.length < 30 || currentText === lastTextRef.current) {
        return;
      }
      
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      lastTextRef.current = currentText;
      setIsLoading(true);
      
      try {
        const response = await api.post('/ai/ghost-text', {
          text: currentText,
          cursorContext: currentText.slice(-100)
        }, {
          signal: abortControllerRef.current.signal
        });
        
        if (response.data.suggestion) {
          setGhostText(response.data.suggestion);
        } else {
          setGhostText('');
        }
      } catch (error) {
        if (error.name !== 'CanceledError') {
          console.error('Ghost text error:', error);
        }
        setGhostText('');
      } finally {
        setIsLoading(false);
      }
    }, 1500), // Wait 1.5s after user stops typing
    []
  );

  useEffect(() => {
    if (!enabled) {
      setGhostText('');
      return;
    }
    
    fetchGhostText(text);
    
    return () => {
      fetchGhostText.cancel();
    };
  }, [text, enabled, fetchGhostText]);

  const acceptGhostText = useCallback(() => {
    const accepted = ghostText;
    setGhostText('');
    return accepted;
  }, [ghostText]);

  const clearGhostText = useCallback(() => {
    setGhostText('');
  }, []);

  return {
    ghostText,
    isLoading,
    acceptGhostText,
    clearGhostText
  };
}

// Visual component to show ghost text overlay
export function GhostTextOverlay({ ghostText, onAccept, position }) {
  if (!ghostText) return null;

  return (
    <div 
      className="absolute pointer-events-none text-gray-400 italic"
      style={{
        left: position?.left || 0,
        top: position?.top || 0
      }}
    >
      <span className="opacity-50">{ghostText}</span>
      <span className="text-xs ml-2 bg-gray-200 text-gray-600 px-1 rounded pointer-events-auto cursor-pointer hover:bg-gray-300"
        onClick={onAccept}
      >
        Tab ↹
      </span>
    </div>
  );
}

export default useGhostText;
