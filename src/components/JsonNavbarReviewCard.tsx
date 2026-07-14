'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import JsonReviewButtons from '@/components/JsonReviewButtons';
import { WebsiteCheckItem } from '@/actions/jsonNavbarActions';

interface JsonNavbarReviewCardProps {
  item: WebsiteCheckItem;
}

export default function JsonNavbarReviewCard({ item }: JsonNavbarReviewCardProps) {
  const [isBlack, setIsBlack] = useState(false);

  // Structural Constraint Requirement: If extracted resource value is null/empty, discard layout completely
  if (!item.logoUrl) return null;

  return (
    <div className="w-full relative flex flex-col min-h-[200px]">
      {/* Target Asset Background Base layer layout */}
      <img
        src="/homeimage.avif"
        className="w-full h-full object-cover absolute top-0 left-0 z-0 inset-0"
        alt="Home Background Mock"
      />

      {/* Presentation Layer Grid Elements Container */}
      <div className="relative z-10 w-full flex flex-col justify-between h-full bg-black/10 backdrop-blur-sm">
        <div className={isBlack ? 'brightness-0' : ''}>
          <Navbar logoUrl={item.logoUrl} url={item.Website} />
        </div>
        
        <JsonReviewButtons
          rowNumber={item.row_number}
          currentStatus={item.logoStatus}
          onToggleBlack={(blackState) => setIsBlack(blackState)}
        />
      </div>
    </div>
  );
}