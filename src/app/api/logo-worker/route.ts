import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { v2 as cloudinary } from 'cloudinary';
import { prisma } from '@/lib/prisma';

cloudinary.config({
  cloud_name:'dyn40clci',
  api_key:'328476136325637',
  api_secret:'a7MiQt_aMZfhuCe2891nUdgJDVs',
});

const BANNED_KEYWORDS = ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'google', 'placeholder', 'spinner'];

// AI Background removal and AVIF compression
async function uploadToCloudinary(buffer: Buffer, publicId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        folder: 'logos',
        overwrite: true,
        invalidate: true,
        resource_type: 'image',
        type: 'upload', // public asset, accessible by anyone with the URL
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error('Upload failed'));

        const optimizedUrl = cloudinary.url(result.public_id, {
          secure: true,
          resource_type: 'image',
          type: 'upload',
          format: 'avif',
          transformation: [
            { effect: 'background_removal' },
            { effect: 'trim' },
            { width: 400, height: 400, crop: 'pad', background: 'transparent' },
            { quality: 'auto:best' },
          ],
        });

        resolve(optimizedUrl);
      }
    );

    uploadStream.end(buffer);
  });
}
// ---------------------------------------------------------
// THE NEW, HIGHLY INTELLIGENT LOGO EXTRACTOR
// ---------------------------------------------------------
async function extractLogoUrlFromWebsite(websiteUrl: string, domain: string): Promise<string | null> {
  try {
    const secureUrl = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
    const baseUrlNoSlash = secureUrl.replace(/\/$/, '');

    const response = await fetch(secureUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(8000) // 8-second timeout
    });

    if (!response.ok) throw new Error('Failed to fetch HTML');
    
    const html = await response.text();
    const $ = cheerio.load(html);
    let logoUrl: string | null = null;

    // Helper: Safely extract the real image URL, prioritizing data-src to beat lazy loaders
    // imgEl can be a Cheerio element or raw any from cheerio; using any avoids TS export type issues
    const getBestImageSrc = (imgEl: any): string | null => {
      const dataSrc = $(imgEl).attr('data-src');
      const src = $(imgEl).attr('src');
      
      let candidate = dataSrc || src;
      
      // If candidate is a base64 string (lazy loading placeholder), try falling back to src if data-src was the base64
      if (candidate && candidate.startsWith('data:image')) {
         if (src && !src.startsWith('data:image')) candidate = src;
         else return null; // It's just a placeholder, ignore it
      }
      return candidate || null;
    };

    // Helper: Check if the URL is valid and not a social icon
    const isValidLogo = (url: string | null | undefined): boolean => {
      if (!url) return false;
      
      const lower = url.toLowerCase();
      if (lower.startsWith('data:image')) return false; // Reject purely base64
      return !BANNED_KEYWORDS.some(kw => lower.includes(kw));
    };

    // --- STRATEGY 1: The "Home Link" Pattern (Catches Wix, Weebly, Square) ---
    // Look for <a> tags that link to "/" or "https://website.com/" and contain an image.
    $('a').each((_, a) => {
      const href = $(a).attr('href');
      if (!href) return;
      
      const cleanHref = href.split('?')[0].replace(/\/$/, '');
      const isHomeLink = cleanHref === '' || 
                         cleanHref === '/' || 
                         cleanHref === baseUrlNoSlash || 
                         cleanHref === `http://${domain}` || 
                         cleanHref === `https://${domain}` ||
                         cleanHref === `http://www.${domain}` ||
                         cleanHref === `https://www.${domain}`;

      if (isHomeLink) {
        const img = $(a).find('img').first();
        if (img.length > 0) {
          const src = getBestImageSrc(img[0]);
          if (isValidLogo(src)) {
            logoUrl = src;
            return false; // Break loop
          }
        }
      }
    });

    if (logoUrl) return resolveUrl(logoUrl, secureUrl);

    // --- STRATEGY 2: Strict Attributes & Class Names (Catches WordPress, Custom HTML) ---
    // Look for alt="logo", class="logo", id="logo", or specific header containers
    const targetedSelectors = [
      'img[alt*="logo" i]',          // Image alt contains "logo" (case insensitive)
      'img[class*="logo" i]',        // Image class contains "logo"
      'img[id*="logo" i]',           // Image id contains "logo"
      '.site-logo img',              // Standard WP logo class
      '.navbar-brand img',           // Bootstrap brand image
      'header img',                  // Any image directly in the header
      '[class*="header"] img',       // Any image inside a container with "header" in the class
    ];

    for (const selector of targetedSelectors) {
      $(selector).each((_, img) => {
        const src = getBestImageSrc(img);
        if (isValidLogo(src)) {
          logoUrl = src;
          return false; // Break loop
        }
      });
      if (logoUrl) break;
    }

    if (logoUrl) return resolveUrl(logoUrl, secureUrl);

    // --- STRATEGY 3: URL Contains "logo" (Catches specific filenames like AH-Fancy-Logo.png) ---
    $('img').each((_, img) => {
      const src = getBestImageSrc(img);
      if (src && isValidLogo(src) && src.toLowerCase().includes('logo')) {
        logoUrl = src;
        return false; // Break loop
      }
    });

    if (logoUrl) return resolveUrl(logoUrl, secureUrl);

    // --- STRATEGY 4: Open Graph Metadata ---
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (isValidLogo(ogImage)) return resolveUrl(ogImage!, secureUrl);

    // If scraping completely fails, fallback to Clearbit API
    const clearbitUrl = `https://logo.clearbit.com/${domain}?size=400`;
    const cbCheck = await fetch(clearbitUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
    if (cbCheck.ok && cbCheck.headers.get('content-type')?.includes('image')) {
      return clearbitUrl;
    }

    // Last Resort Fallback: Google High-Res Favicon
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;

  } catch (err) {
    // If the site times out or crashes, use Clearbit/Google fallbacks
    const clearbitUrl = `https://logo.clearbit.com/${domain}?size=400`;
    const cbCheck = await fetch(clearbitUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) }).catch(() => null);
    if (cbCheck?.ok) return clearbitUrl;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
  }
}

// Helper function to resolve relative URLs like "/wp-content/uploads/logo.png" to absolute URLs
function resolveUrl(rawUrl: string, baseUrl: string): string {
  if (rawUrl.startsWith('//')) return `https:${rawUrl}`;
  if (rawUrl.startsWith('http')) return rawUrl;
  try {
    return new URL(rawUrl, baseUrl).href;
  } catch {
    return rawUrl;
  }
}

// ---------------------------------------------------------
// MAIN WORKER LOGIC
// ---------------------------------------------------------
export async function POST(req: Request) {
  try {
    const websites = await prisma.websiteData.findMany({
      where: { logoStatus: "pending" },
      orderBy: { row_number: 'asc' },
      take: 5 
    });

    if (websites.length === 0) {
      return NextResponse.json({ message: "All done!" });
    }

    console.log(`Processing batch of ${websites.length}...`);

    for (const site of websites) {
      try {
        const urlObj = new URL(site.Website.startsWith('http') ? site.Website : `https://${site.Website}`);
        const domain = urlObj.hostname.replace('www.', '');
        const cleanDomainForId = domain.replace(/\./g, '_');

        const finalDownloadUrl = await extractLogoUrlFromWebsite(site.Website, domain);
        
        let imageResponse = await fetch(finalDownloadUrl!, { 
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(10000)
        });

        if (!imageResponse.ok) {
          const textLogoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(domain)}&background=random&color=fff&size=400&format=png`;
          imageResponse = await fetch(textLogoUrl);
        }

        const arrayBuffer = await imageResponse.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);
        
        // Upload to Cloudinary (Handles background removal automatically)
        const cloudinaryUrl = await uploadToCloudinary(imageBuffer, cleanDomainForId);

        await prisma.websiteData.update({
          where: { id: site.id },
          data: { logoUrl: cloudinaryUrl, logoStatus: "success", logoChecked: true }
        });

      } catch (error) {
        console.error(`Failed ${site.Website}`);
        await prisma.websiteData.update({
          where: { id: site.id },
          data: { logoStatus: "failed", logoChecked: true }
        });
      }
    }

    // Trigger the next batch continuously
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host');
    const selfUrl = `${protocol}://${host}/api/logo-worker`;
    
    fetch(selfUrl, { method: 'POST' }).catch(console.error);
    
    await new Promise(resolve => setTimeout(resolve, 200));

    return NextResponse.json({ 
      success: true, 
      message: "Batch processed, triggering next batch in background." 
    });

  } catch (error: any) {
    console.error("Worker Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}