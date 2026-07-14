import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { v2 as cloudinary } from 'cloudinary';
import { prisma } from '@/lib/prisma';

cloudinary.config({
  cloud_name: 'dyn40clci',
  api_key: '328476136325637',
  api_secret: 'a7MiQt_aMZfhuCe2891nUdgJDVs',
});

const BANNED_KEYWORDS = ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'google', 'placeholder', 'spinner', 'avatar'];

async function uploadToCloudinary(buffer: Buffer, publicId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        folder: 'logos',
        overwrite: true,
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("Upload failed"));
        
        const optimizedUrl = result.secure_url.replace(
          '/upload/', 
          '/upload/e_make_transparent:15,co_white/e_trim/f_avif,q_auto/'
        );
        resolve(optimizedUrl);
      }
    );
    uploadStream.end(buffer);
  });
}

// ---------------------------------------------------------
// THE NEW, ULTRA-AGGRESSIVE LOGO EXTRACTOR
// ---------------------------------------------------------
async function extractLogoUrlFromWebsite(websiteUrl: string, domain: string): Promise<string | null> {
  try {
    const secureUrl = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
    const baseUrlNoSlash = secureUrl.replace(/\/$/, '');

    const response = await fetch(secureUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) return null;
    let html = await response.text();
    
    // CRITICAL HACK: Convert <noscript> tags into readable divs so Cheerio can scrape lazy-loaded images inside them (Fixes WordPress/Elementor lazy loading)
    html = html.replace(/<noscript/gi, '<div class="noscript-hack"').replace(/<\/noscript>/gi, '</div>');
    
    const $ = cheerio.load(html);
    let bestCandidate: string | null = null;

    // Helper: Dig out the true image URL from src, data-src, or srcset
    const getBestSrc = (el: any): string | null => {
      let src = $(el).attr('data-src') || $(el).attr('src');
      // If still no src, try pulling the first URL from a srcset
      if (!src && $(el).attr('srcset')) src = $(el).attr('srcset')?.split(' ')[0];
      if (!src && $(el).attr('data-srcset')) src = $(el).attr('data-srcset')?.split(' ')[0];
      
      if (src && src.startsWith('data:image')) return null; // Reject base64 placeholders
      return src || null;
    };

    const isBanned = (url: string) => BANNED_KEYWORDS.some(kw => url.toLowerCase().includes(kw));

    // STRATEGY 1: JSON-LD Schema (100% Accuracy if it exists)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '{}');
        if (json.logo) bestCandidate = typeof json.logo === 'string' ? json.logo : json.logo.url;
      } catch (e) {}
    });

    // STRATEGY 2: Home Page Anchor Tags (Fixes aspotforspot.com & cuttingedgepetservices.com)
    if (!bestCandidate) {
      $('a').each((_, a) => {
        const href = $(a).attr('href');
        if (!href) return;
        const cleanHref = href.split('?')[0].replace(/\/$/, '');
        const isHome = cleanHref === '' || cleanHref === '/' || cleanHref === baseUrlNoSlash || cleanHref.includes(domain);

        if (isHome) {
          const img = $(a).find('img').first();
          if (img.length) {
            const src = getBestSrc(img);
            if (src && !isBanned(src)) bestCandidate = src;
          }
        }
      });
    }

    // STRATEGY 3: Alt text contains "logo" (Fixes Square sites like als-country-mutts & bubblesfurrbella)
    if (!bestCandidate) {
      $('img').each((_, img) => {
        const alt = $(img).attr('alt') || '';
        if (alt.toLowerCase().includes('logo')) {
          const src = getBestSrc(img);
          if (src && !isBanned(src)) bestCandidate = src;
        }
      });
    }

    // STRATEGY 4: The URL itself contains the word "logo" or "brand"
    if (!bestCandidate) {
      $('img').each((_, img) => {
        const src = getBestSrc(img);
        if (src && (src.toLowerCase().includes('logo') || src.toLowerCase().includes('brand')) && !isBanned(src)) {
          bestCandidate = src;
        }
      });
    }

    // STRATEGY 5: Common classes/ids
    if (!bestCandidate) {
      const selectors = ['.site-logo img', 'a.navbar-brand img', 'header img'];
      for (const selector of selectors) {
        const img = $(selector).first();
        if (img.length) {
          const src = getBestSrc(img);
          if (src && !isBanned(src)) bestCandidate = src;
        }
      }
    }

    if (!bestCandidate) return null;

    // Resolve relative paths (e.g. "/uploads/logo.jpg" -> "https://domain.com/uploads/logo.jpg")
    if (bestCandidate.startsWith('//')) return `https:${bestCandidate}`;
    if (!bestCandidate.startsWith('http')) return new URL(bestCandidate, secureUrl).href;

    return bestCandidate;

  } catch (err) {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    // Process 10 at a time to go faster, but safely within limits
    const websites = await prisma.websiteData.findMany({
      where: { logoStatus: "pending" },
      orderBy: { row_number: 'asc' },
      take: 10 
    });

    if (websites.length === 0) {
      return NextResponse.json({ success: true, done: true, message: "All websites processed!" });
    }

    for (const site of websites) {
      try {
        const safeUrl = site.Website.startsWith('http') ? site.Website : `https://${site.Website}`;
        const urlObj = new URL(safeUrl);
        const domain = urlObj.hostname.replace('www.', '');
        const cleanDomainForId = domain.replace(/\./g, '_');

        let finalDownloadUrl = await extractLogoUrlFromWebsite(safeUrl, domain);

        if (!finalDownloadUrl) {
          finalDownloadUrl = `https://logo.clearbit.com/${domain}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        let imageResponse = await fetch(finalDownloadUrl, { 
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: controller.signal
        }).catch(() => null);
        
        clearTimeout(timeoutId);

        if (!imageResponse || !imageResponse.ok) {
          finalDownloadUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(domain)}&background=random&color=fff&size=512&format=png`;
          imageResponse = await fetch(finalDownloadUrl);
        }

        const arrayBuffer = await (imageResponse as Response).arrayBuffer();
        const finalBuffer = Buffer.from(arrayBuffer);

        const cloudinaryUrl = await uploadToCloudinary(finalBuffer, cleanDomainForId);

        await prisma.websiteData.update({
          where: { id: site.id },
          data: { logoUrl: cloudinaryUrl, logoStatus: "success", logoChecked: true }
        });

      } catch (error) {
        await prisma.websiteData.update({
          where: { id: site.id },
          data: { logoStatus: "failed", logoChecked: true }
        });
      }
    }

    const remaining = await prisma.websiteData.count({ where: { logoStatus: "pending" }});
    return NextResponse.json({ success: true, done: false, remaining, message: `Batch complete.` });

  } catch (error: any) {
    return NextResponse.json({ success: false, done: false, message: error.message }, { status: 500 });
  }
}