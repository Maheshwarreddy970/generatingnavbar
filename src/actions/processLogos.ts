'use server';

import * as cheerio from 'cheerio';
import { v2 as cloudinary } from 'cloudinary';
import { prisma } from '@/lib/prisma';

cloudinary.config({
  cloud_name: 'dyn40clci',
  api_key: '328476136325637',
  api_secret: 'a7MiQt_aMZfhuCe2891nUdgJDVs',
});

// Helper to extract a clean name for Text Logos (e.g., "islanddogspa.com" -> "islanddogspa")
function getCleanName(websiteUrl: string): string {
  try {
    const hostname = new URL(websiteUrl).hostname;
    return hostname.replace('www.', '').split('.')[0];
  } catch {
    return "Logo";
  }
}

async function uploadToCloudinary(buffer: Buffer, publicId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        folder: 'logos',
        overwrite: true,
        resource_type: 'image',
        format: 'png', // FORCES SVGs to become standard images
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result || !result.secure_url) return reject(new Error("Upload failed"));

        // e_background_removal removes white space/backgrounds automatically
        const secureUrl: string = result.secure_url;
        const optimizedUrl = secureUrl.replace(
          '/upload/',
          '/upload/e_background_removal/f_png,q_auto/'
        );
        resolve(optimizedUrl);
      }
    );
    uploadStream.end(buffer);
  });
}

async function extractLogoUrlFromWebsite(websiteUrl: string): Promise<string | null> {
  try {
    const secureUrl = websiteUrl.replace('http://', 'https://');
    const controller = new AbortController();
    // 60 second timeout as requested
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(secureUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      next: { revalidate: 0 },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);
    let foundSrc = '';

    // Expanded selectors to catch islanddogspa.com and others
    const selectors = [
      'img.logo_image', 'img[class*="logo" i]', 'img[id*="logo" i]', 
      '.logo img', '#logo img', 'a[class*="logo" i] img',
      'header img', '.navbar-brand img', '[data-testid*="logo" i]', 
      'img[src*="logo" i]', 'img[alt*="logo" i]'
    ];

    for (const selector of selectors) {
      const img = $(selector).first();
      if (img.length > 0) {
        let src = img.attr('src') || img.attr('data-src');
        if (src?.startsWith('/_next/image')) {
          const urlParam = new URL(src, 'http://dummy.com').searchParams.get('url');
          if (urlParam) src = urlParam;
        }
        if (src && !src.startsWith('data:')) {
          foundSrc = src;
          break; 
        }
      }
    }

    if (!foundSrc) {
      foundSrc = $('meta[property="og:image"]').attr('content') || 
                 $('link[rel="apple-touch-icon"]').attr('href') || 
                 $('link[rel*="icon"]').attr('href') || '';
    }

    if (!foundSrc) return null;
    if (foundSrc.startsWith('//')) return `https:${foundSrc}`;
    if (!foundSrc.startsWith('http')) return new URL(foundSrc, secureUrl).href;

    return foundSrc;
  } catch (err) {
    return null; // Fails gracefully if site is dead or times out
  }
}

export async function processLogoBatch() {
  try {
    // 1. Process in small batches (3 at a time) to prevent 502 Bad Gateway Timeouts
    const batchSize = 3;
    const websites = await prisma.websiteData.findMany({
      where: { logoStatus: "pending" },
      orderBy: { row_number: 'asc' },
      take: batchSize
    });

    if (websites.length === 0) {
      return { success: true, done: true, message: "All logos extracted." };
    }

    for (const site of websites) {
      console.log(`Scraping: ${site.Website}`);

      try {
        const urlObj = new URL(site.Website);
        const domain = urlObj.hostname.replace('www.', '').replace(/\./g, '_');
        const cleanName = getCleanName(site.Website);

        // Try 1: Scrape directly
        let finalDownloadUrl = await extractLogoUrlFromWebsite(site.Website);

        // Try 2: Clearbit API Fallback
        if (!finalDownloadUrl) {
          finalDownloadUrl = `https://logo.clearbit.com/${urlObj.hostname}`;
        }

        let imageResponse = await fetch(finalDownloadUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });

        // Try 3: Text Logo Generation (If site is dead, Wix JS blocked, or Clearbit fails)
        if (!imageResponse.ok) {
          finalDownloadUrl = `https://ui-avatars.com/api/?name=${cleanName}&background=random&color=fff&size=256&font-size=0.4&format=png`;
          imageResponse = await fetch(finalDownloadUrl);
        }
        
        if (!imageResponse.ok) throw new Error('All image extraction methods failed');
        
        const arrayBuffer = await imageResponse.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);

        const cloudinaryUrl = await uploadToCloudinary(imageBuffer, domain);

        await prisma.websiteData.update({
          where: { id: site.id },
          data: {
            logoUrl: cloudinaryUrl,
            logoStatus: "success",
            logoChecked: true
          }
        });

      } catch (error) {
        console.error(`  -> [Failed] ${site.Website}`);
        
        await prisma.websiteData.update({
          where: { id: site.id },
          data: {
            logoStatus: "failed",
            logoChecked: true
          }
        });
      }
    }

    const remainingCount = await prisma.websiteData.count({
      where: { logoStatus: "pending" }
    });

    return { success: true, done: false, remaining: remainingCount };

  } catch (error: any) {
    console.error("Global Action Error:", error);
    return { success: false, message: error.message };
  }
}