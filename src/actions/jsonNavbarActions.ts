'use server';

import fs from 'fs/promises';
import path from 'path';
import { revalidatePath } from 'next/cache';

export interface WebsiteCheckItem {
  row_number: number;
  Website: string;
  logoUrl: string;
  logoShape: string;
  logoStatus: string;
  logoChecked: boolean;
}

export async function updateJsonLogoStatus(rowNumber: number, newStatus: string) {
  try {
    const jsonPath = path.join(process.cwd(), 'src', 'data', 'websitecheck.json');
    
    // Read the file contents safely
    const fileContents = await fs.readFile(jsonPath, 'utf8');
    const data: WebsiteCheckItem[] = JSON.parse(fileContents);
    
    // Update the record matching the modified item row number
    const updatedData = data.map((item) => {
      if (item.row_number === rowNumber) {
        return { ...item, logoStatus: newStatus };
      }
      return item;
    });

    // Save modifications back to storage format beautifully formatted
    await fs.writeFile(jsonPath, JSON.stringify(updatedData, null, 2), 'utf8');
    
    // Invalidate the cache for the JSON visual dashboard layout layout page
    revalidatePath('/jsonnavcheck');
    
    return { success: true };
  } catch (error) {
    console.error('Error mutating file target schema:', error);
    return { success: false, error: 'Failed to complete write mutation' };
  }
}