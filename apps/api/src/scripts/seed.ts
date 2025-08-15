import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  try {
    // Clear existing data
    await prisma.work.deleteMany();
    console.log('✅ Cleared existing data');

    // Create sample works
    const sampleWorks = [
      {
        doi: '10.1101/2024.01.25.577295',
        version: 1,
        receivedDate: new Date('2024-01-25'),
        acceptedDate: null,
        batch: 'January_2024',
        server: 'biorxiv',
        s3Bucket: 'biorxiv-src-monthly',
        s3Key: 'Current_Content/January_2024/10.1101_2024.01.25.577295v1.meca',
        fileSize: BigInt(1024000),
        title: 'Sample Research Paper 1',
      },
      {
        doi: '10.1101/2024.01.15.123456',
        version: 2,
        receivedDate: new Date('2024-01-15'),
        acceptedDate: new Date('2024-02-01'),
        batch: 'January_2024',
        server: 'biorxiv',
        s3Bucket: 'biorxiv-src-monthly',
        s3Key: 'Current_Content/January_2024/10.1101_2024.01.15.123456v2.meca',
        fileSize: BigInt(2048000),
        title: 'Sample Research Paper 2',
      },
    ];

    for (const work of sampleWorks) {
      await prisma.work.create({
        data: work,
      });
    }

    console.log(`✅ Created ${sampleWorks.length} sample works`);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
