const { PrismaClient } = require('@prisma/client');

async function clearData() {
  const prisma = new PrismaClient();

  try {
    // Sırasıyla sil (foreign key ilişkilerine göre)
    await prisma.productionLog.deleteMany();
    console.log('ProductionLog silindi');

    await prisma.semiFinishedLog.deleteMany();
    console.log('SemiFinishedLog silindi');

    await prisma.semiFinished.deleteMany();
    console.log('SemiFinished silindi');

    await prisma.shipmentItem.deleteMany();
    console.log('ShipmentItem silindi');

    await prisma.shipment.deleteMany();
    console.log('Shipment silindi');

    await prisma.inventory.deleteMany();
    console.log('Inventory silindi');

    await prisma.product.deleteMany();
    console.log('Product silindi');

    await prisma.order.deleteMany();
    console.log('Order silindi');

    console.log('\nTüm veriler temizlendi!');
  } catch (error) {
    console.error('Hata:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearData();
