import fs from 'fs/promises';
import path from 'path';
import { WebsiteCheckItem } from '@/actions/jsonNavbarActions';
import JsonNavbarReviewCard from '@/components/JsonNavbarReviewCard';

export default async function JsonNavbarPage() {
  const jsonPath = path.join(process.cwd(), 'src', 'data', 'websitecheck.json');
  let pendingItems: WebsiteCheckItem[] = [];

  try {
    const fileContents = await fs.readFile(jsonPath, 'utf8');
    const rawData: WebsiteCheckItem[] = JSON.parse(fileContents);
    
    // Filter items exactly like your Prisma configuration did
    pendingItems = rawData.filter(
      (item) => !['approved', 'not_approved', 'approved_as_black'].includes(item.logoStatus)
    );
  } catch (err) {
    console.error('Unable to fetch websitecheck.json configuration dataset:', err);
  }

  return (
    <main className="min-h-screen pb-20 bg-gray-50">
      <div className="w-full text-center py-8">
        <h1 className="text-3xl font-bold">JSON Navbar Review Dashboard</h1>
        <p className="text-gray-500 mt-2">
          Reviewing directly from local configuration file storage. Decisions remove records instantly.
        </p>
        <p className="text-sm text-blue-600 mt-1 font-medium">
          Pending items remaining: {pendingItems.length}
        </p>
      </div>

      <div className="flex flex-col w-full gap-6">
        {pendingItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500 font-medium">
            🎉 All JSON items have been successfully verified!
          </div>
        ) : (
          pendingItems.map((item) => (
            <JsonNavbarReviewCard key={item.row_number} item={item} />
          ))
        )}
      </div>
    </main>
  );
}