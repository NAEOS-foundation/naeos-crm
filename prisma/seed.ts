import { PrismaClient, UserRole, UserStatus, CompanyStatus, ContactStatus, LeadStatus, ActivityType, TaskStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.user.count()
  if (existing > 0) {
    console.log('Database already seeded, skipping.')
    return
  }

  const admin = await prisma.user.create({
    data: {
      email: 'admin@naeos.local',
      name: 'System Admin',
      roles: [UserRole.ADMIN],
      status: UserStatus.ACTIVE,
    },
  })

  const manager = await prisma.user.create({
    data: {
      email: 'manager@naeos.local',
      name: 'Ops Manager',
      roles: [UserRole.MANAGER],
      status: UserStatus.ACTIVE,
    },
  })

  const member = await prisma.user.create({
    data: {
      email: 'member@naeos.local',
      name: 'Sales Member',
      roles: [UserRole.MEMBER],
      status: UserStatus.ACTIVE,
    },
  })

  const northwind = await prisma.company.create({
    data: {
      name: 'Northwind Labs',
      industry: 'SaaS',
      region: 'APAC',
      status: CompanyStatus.ACTIVE,
      ownerId: admin.id,
    },
  })

  const blueHarbor = await prisma.company.create({
    data: {
      name: 'Blue Harbor Ventures',
      industry: 'Finance',
      region: 'EMEA',
      status: CompanyStatus.PENDING,
      ownerId: manager.id,
    },
  })

  await prisma.contact.createMany({
    data: [
      {
        companyId: northwind.id,
        fullName: 'Ari Suryadi',
        email: 'ari@northwindlabs.example',
        role: 'Head of Operations',
        status: ContactStatus.ACTIVE,
      },
      {
        companyId: blueHarbor.id,
        fullName: 'Mira Sulaiman',
        email: 'mira@blueharbor.example',
        role: 'Finance Director',
        status: ContactStatus.PENDING,
      },
    ],
  })

  await prisma.lead.create({
    data: {
      companyId: northwind.id,
      source: 'Outbound',
      status: LeadStatus.QUALIFIED,
      ownerId: admin.id,
      score: 82,
    },
  })

  await prisma.activity.create({
    data: {
      companyId: northwind.id,
      type: ActivityType.EMAIL,
      channel: 'email',
      summary: 'Sent onboarding follow-up',
      occurredAt: new Date(),
      ownerId: admin.id,
    },
  })

  await prisma.task.create({
    data: {
      companyId: northwind.id,
      assigneeId: admin.id,
      subject: 'Review partnership terms',
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: TaskStatus.OPEN,
    },
  })

  console.log('Seed complete.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })