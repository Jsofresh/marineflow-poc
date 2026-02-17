import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.workOrder.deleteMany()
  await prisma.intakeRequest.deleteMany()

  const intakes = [
    {
      customerName: 'Mike Donnelly',
      email: 'mike@example.com',
      phone: '978-555-0191',
      vesselName: 'Sea Mist',
      serviceRequest: 'Outboard won\'t start after winter storage',
      location: 'Salem',
    },
    {
      customerName: 'Rita Alvarez',
      email: 'rita@example.com',
      phone: '978-555-0114',
      vesselName: 'Blue Harbor',
      serviceRequest: 'Bilge pump runs continuously',
      location: 'Gloucester',
    },
    {
      customerName: 'Dan Mercer',
      email: 'dan@example.com',
      phone: '978-555-0133',
      vesselName: 'North Star',
      serviceRequest: 'Steering feels loose at speed',
      location: 'Marblehead',
    },
  ]

  const created = []
  for (const i of intakes) {
    created.push(await prisma.intakeRequest.create({ data: i }))
  }

  await prisma.workOrder.create({
    data: {
      intakeRequestId: created[0].id,
      status: 'IN_PROGRESS',
      qbSyncStatus: 'PENDING',
      internalNotes: 'Tech assigned, diagnostic in progress',
    },
  })

  await prisma.workOrder.create({
    data: {
      intakeRequestId: created[1].id,
      status: 'COMPLETE',
      qbSyncStatus: 'RETRY_PENDING',
      qbRetryCount: 1,
      qbLastError: 'Mock QuickBooks timeout. Retry queued.',
      internalNotes: 'Repair complete, waiting invoice sync retry',
      completedAt: new Date(),
    },
  })

  console.log('Seed complete: intakes + work orders created')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
