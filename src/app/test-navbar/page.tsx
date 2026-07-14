import NavbarReviewCard from '@/components/NavbarReviewCard';
import { prisma } from '@/lib/prisma';

export default async function TestNavbarPage() {
  // Fetch pending items directly from PostgreSQL using Prisma
  const pendingItems = await prisma.websiteData.findMany({
    where: {
      logoStatus: {
        notIn: ['approved', 'not_approved', 'approved_as_black'],
      },
    },
    orderBy: {
      row_number: 'asc',
    },
  });

  return (
    <main className="min-h-screen pb-20 bg-gray-50">
      <div className="w-full text-center py-8">
        <h1 className="text-3xl font-bold">Navbar Logo Review Tool</h1>
        <p className="text-gray-500 mt-2">
          Review logos below. Making a decision will remove them from this list.
        </p>
        <p className="text-sm text-blue-600 mt-1 font-medium">
          Pending items left: {pendingItems.length}
        </p>
      </div>

      <div className="flex flex-col w-full gap-6">
        {pendingItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500 font-medium">
            🎉 All items have been reviewed!
          </div>
        ) : (
          pendingItems.map((item) => (
            <NavbarReviewCard key={item.id} item={item} />
          ))
        )}
      </div>
    </main>
  );
}