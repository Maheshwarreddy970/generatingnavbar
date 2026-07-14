'use client';

import { useState, useRef } from 'react';

export default function Home() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ remaining: '?', message: 'Ready to start' });
  const isRunningRef = useRef(false); // Prevents double click racing

  const processAll = async () => {
    if (isRunningRef.current) return; // Prevent double clicks
    
    setIsRunning(true);
    isRunningRef.current = true;
    setProgress(prev => ({ ...prev, message: 'Starting engine... PLEASE LEAVE THIS TAB OPEN!' }));

    let isDone = false;
    
    while (!isDone && isRunningRef.current) {
      try {
        const res = await fetch('/api/logo-worker', { method: 'POST' });
        const result = await res.json();
        
        if (result.done) {
          setProgress({ remaining: '0', message: 'All websites processed successfully!' });
          isDone = true;
          setIsRunning(false);
          isRunningRef.current = false;
          break;
        }

        if (!result.success) {
          setProgress(prev => ({ ...prev, message: `Error: ${result.message}. Stopping.` }));
          setIsRunning(false);
          isRunningRef.current = false;
          break;
        }

        setProgress({ 
          remaining: result.remaining?.toString() || '?', 
          message: `Processing batch... ${result.remaining} remaining. (Do not close tab)` 
        });

      } catch (err) {
        setProgress(prev => ({ ...prev, message: 'Network error. Click Start again to resume where you left off.' }));
        setIsRunning(false);
        isRunningRef.current = false;
        break;
      }
    }
  };

  const stopProcess = () => {
    isRunningRef.current = false;
    setIsRunning(false);
    setProgress(prev => ({ ...prev, message: 'Paused. You can resume at any time.' }));
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Logo Extractor</h1>
        <p className="text-gray-500 mb-8 text-sm">
          Because Vercel stops background processes, <b>you must leave this tab open</b> until the remaining count hits 0.
        </p>
        
        <div className="mb-6 p-4 bg-gray-50 rounded-lg text-left">
          <p className="text-sm font-semibold text-gray-700">Status:</p>
          <p className="text-sm text-blue-600 font-medium">{progress.message}</p>
          {progress.remaining !== '?' && (
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {progress.remaining} <span className="text-sm font-normal text-gray-500">Left</span>
            </p>
          )}
        </div>

        <div className="flex gap-4">
          <button
            onClick={processAll}
            disabled={isRunning}
            className={`flex-1 py-3 px-4 rounded-lg font-medium text-white transition-all
              ${isRunning 
                ? 'bg-blue-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
              }`}
          >
            {isRunning ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner /> Running...
              </span>
            ) : (
              'Start Engine'
            )}
          </button>

          {isRunning && (
            <button
              onClick={stopProcess}
              className="py-3 px-4 rounded-lg font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-all border border-red-100"
            >
              Pause
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

const Spinner = () => (
  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);