'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import ReviewButtons from '@/components/ReviewButtons';

interface NavbarReviewCardProps {
  item: {
    id: number;
    row_number: number;
    Website: string;
    logoUrl: string;
    logoStatus: string;
    logoChecked: boolean;
  };
}

export default function NavbarReviewCard({ item }: NavbarReviewCardProps) {
  const [isBlack, setIsBlack] = useState(false);

  // Strict Rule: If there is no extracted logo URL, do not render this element at all
  if (!item.logoUrl) return null;

  return (
    <div className="w-full relative flex flex-col min-h-[200px]">
      {/* Background Image */}
      <img
        src="/homeimage.avif"
        className="w-full h-full object-cover absolute top-0 left-0 z-0 inset-0"
        alt="Home Background"
      />

      {/* Navbar Component Content Wrapper */}
      <div className="relative z-10 w-full flex flex-col justify-between h-full bg-black/10 backdrop-blur-sm">
        {/* We apply the brightness-0 class dynamically down to the navbar elements */}
        <div className={isBlack ? 'brightness-0' : ''}>
          <Navbar logoUrl={item.logoUrl} url={item.Website} />
        </div>
        
        <ReviewButtons
          rowNumber={item.row_number}
          currentStatus={item.logoStatus}
          onToggleBlack={(blackState) => setIsBlack(blackState)}
        />
      </div>
    </div>
  );
}