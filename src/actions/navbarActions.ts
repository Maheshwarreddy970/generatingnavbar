'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function updateLogoStatus(rowNumber: number, newStatus: string) {
  try {
    // Update the database record where the row_number matches
    await prisma.websiteData.updateMany({
      where: { row_number: rowNumber },
      data: { logoStatus: newStatus }
    });
    
    // Refresh the page data so changes show immediately
    revalidatePath('/test-navbar'); 
    
    return { success: true };
  } catch (error) {
    console.error('Error updating Database:', error);
    return { success: false, error: 'Failed to update status' };
  }
}