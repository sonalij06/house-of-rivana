/** Prints a few slugs so smoke checks can hit real URLs. */
import { prisma } from "../src/lib/db";

const [products, collections] = await Promise.all([
  prisma.product.findMany({ select: { slug: true, status: true }, take: 5 }),
  prisma.collection.findMany({ select: { slug: true }, take: 5 }),
]);

console.log(JSON.stringify({ products, collections }, null, 2));
await prisma.$disconnect();
