'use client';

import { useState } from 'react';
import { generateLogosAction } from '@/actions/processLogos';

export default function Home() {
  const [isRunning, setIsRunning] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const handleGenerate = async () => {
    setIsRunning(true);
    setMessage('Starting continuous extraction...');
    let isDone = false;

    try {
      // Continuously call the server in batches of 5 until the database says it's empty
      while (!isDone) {
        const result = await generateLogosAction();
        
        if (result.success) {
          if (result.done) {
            setMessage('All logos extracted successfully!');
            setRemaining(0);
            isDone = true;
          } else {
            // Update the UI with how many are left
            setRemaining(result.remaining ?? null);
            setMessage(`Processing... moving to next batch.`);
          }
        } else {
          setMessage(`Error: ${result.message}`);
          isDone = true; // Stop the loop if the server throws a critical error
        }
      }
    } catch (error) {
      setMessage('Network error occurred. Process stopped.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Logo Extractor</h1>
        <p className="text-gray-500 mb-8 text-sm">
          Continuously extracts logos until the database is fully processed.
        </p>
        
        <button
          onClick={handleGenerate}
          disabled={isRunning}
          className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-all
            ${isRunning 
              ? 'bg-blue-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
            }`}
        >
          {isRunning ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner /> Processing Batch...
            </span>
          ) : (
            'Generate All Logos'
          )}
        </button>

        {/* Status display below the button */}
        <div className="mt-6 min-h-[60px]">
          {message && (
            <p className="text-sm font-medium text-gray-700">{message}</p>
          )}
          {remaining !== null && remaining > 0 && (
            <p className="text-xl font-bold text-blue-600 mt-2">
              {remaining} <span className="text-sm text-gray-500 font-normal">websites remaining</span>
            </p>
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