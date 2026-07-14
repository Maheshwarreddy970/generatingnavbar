'use client';

import { useTransition, useState } from 'react';
import { updateJsonLogoStatus } from '@/actions/jsonNavbarActions';

interface JsonReviewButtonsProps {
  rowNumber: number;
  currentStatus: string;
  onToggleBlack: (isBlack: boolean) => void;
}

export default function JsonReviewButtons({ rowNumber, currentStatus, onToggleBlack }: JsonReviewButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const [isBlack, setIsBlack] = useState(false);

  const handleStatusUpdate = (status: string) => {
    startTransition(async () => {
      await updateJsonLogoStatus(rowNumber, status);
    });
  };

  const toggleBlackMode = () => {
    const nextState = !isBlack;
    setIsBlack(nextState);
    onToggleBlack(nextState);
  };

  return (
    <div className="flex w-full items-center z-10 justify-between bg-white px-6 py-4 shadow-sm mb-12">
      <div className="text-sm font-medium text-gray-600">
        Current Local Status: <span className="font-bold text-black uppercase">{currentStatus}</span>
      </div>
      
      <div className="flex gap-4 items-center">
        {/* Toggle Black State Transformation Modifier */}
        <button
          onClick={toggleBlackMode}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isBlack ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
          }`}
        >
          {isBlack ? 'Revert Color' : 'Use Black'}
        </button>

        {/* Dynamic State Update Handler Selection */}
        {isBlack ? (
          <button
            onClick={() => handleStatusUpdate('approved_as_black')}
            disabled={isPending}
            className="px-5 py-2 rounded-lg bg-gray-900 text-white font-medium hover:bg-black transition-colors disabled:opacity-50"
          >
            {isPending ? 'Updating...' : 'Approve as Black'}
          </button>
        ) : (
          <button
            onClick={() => handleStatusUpdate('approved')}
            disabled={isPending}
            className="px-5 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {isPending ? 'Updating...' : 'Approve'}
          </button>
        )}
        
        <button
          onClick={() => handleStatusUpdate('not_approved')}
          disabled={isPending}
          className="px-5 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Updating...' : 'Not Approve'}
        </button>
      </div>
    </div>
  );
}