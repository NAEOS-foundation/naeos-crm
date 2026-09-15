import { PrismaClient, UserRole, UserStatus, CompanyStatus, ContactStatus, LeadStatus, ActivityType, TaskStatus, OpportunityStage, CampaignType, CampaignStatus, CampaignStepActionType, CampaignStepStatus, FollowUpStatus, ContributorRole, EcosystemStatus, PartnerType, InvestorType, PolicyEffect, GoGateActionType } from '@prisma/client'

const prisma = new PrismaClient()

const PIPELINE_STAGE_DEFAULTS: Array<{
  stage: OpportunityStage
  name: string
  sequence: number
  probability: number
}> = [
  { stage: OpportunityStage.NEW, name: 'New', sequence: 0, probability: 10 },
  { stage: OpportunityStage.QUALIFIED, name: 'Qualified', sequence: 1, probability: 30 },
  { stage: OpportunityStage.PROPOSAL, name: 'Proposal', sequence: 2, probability: 50 },
  { stage: OpportunityStage.NEGOTIATION, name: 'Negotiation', sequence: 3, probability: 70 },
  { stage: OpportunityStage.WON, name: 'Won', sequence: 4, probability: 100 },
  { stage: OpportunityStage.LOST, name: 'Lost', sequence: 5, probability: 0 },
]

async function seedPipelineStages() {
  const existing = await prisma.pipelineStage.count()
  if (existing > 0) {
    console.log('Pipeline stages already seeded, skipping.')
    return
  }
  await prisma.pipelineStage.createMany({ data: PIPELINE_STAGE_DEFAULTS })
  console.log('Pipeline stages seeded.')
}

async function seedPhase2Data() {
  const [companyTotal, userTotal, activityTotal] = await Promise.all([
    prisma.company.count(),
    prisma.user.count(),
    prisma.activity.count(),
  ])

  const haveCompanies = companyTotal > 0
  const haveUsers = userTotal > 0
  const haveActivities = activityTotal > 0

  if (haveCompanies && haveUsers) {
    const firstCompany = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } })
    const admin = await prisma.user.findFirst({ where: { roles: { has: UserRole.ADMIN } } })
    if (firstCompany && admin) {
      const opportunityTotal = await prisma.opportunity.count()
      if (opportunityTotal === 0) {
        await prisma.opportunity.createMany({
          data: [
            {
              companyId: firstCompany.id,
              name: 'Enterprise platform upgrade',
              stage: OpportunityStage.PROPOSAL,
              amount: 48000,
              closeDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
              ownerId: admin.id,
            },
            {
              companyId: firstCompany.id,
              name: 'Mobile engagement pilot',
              stage: OpportunityStage.NEW,
              amount: 12500,
              closeDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
              ownerId: admin.id,
            },
            {
              companyId: firstCompany.id,
              name: 'Governance advisory',
              stage: OpportunityStage.WON,
              amount: 8600,
              closeDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
              ownerId: admin.id,
            },
          ],
        })
        console.log('Opportunities seeded.')
      }

      const campaignTotal = await prisma.campaign.count()
      if (campaignTotal === 0) {
        const campaign = await prisma.campaign.create({
          data: {
            name: 'APAC Outbound Q1',
            type: CampaignType.OUTBOUND,
            status: CampaignStatus.ACTIVE,
            ownerId: admin.id,
          },
        })
        await prisma.campaignStep.createMany({
          data: [
            { campaignId: campaign.id, sequence: 0, actionType: CampaignStepActionType.EMAIL, subject: 'Intro email', status: CampaignStepStatus.READY },
            { campaignId: campaign.id, sequence: 1, actionType: CampaignStepActionType.WAIT, status: CampaignStepStatus.PENDING },
            { campaignId: campaign.id, sequence: 2, actionType: CampaignStepActionType.CALL, subject: 'Discovery call', status: CampaignStepStatus.PENDING },
          ],
        })
        console.log('Campaign and steps seeded.')
      }
    }
  }

  if (haveActivities) {
    const followUpTotal = await prisma.followUp.count()
    if (followUpTotal === 0) {
      const activity = await prisma.activity.findFirst({ orderBy: { occurredAt: 'desc' } })
      const owner = await prisma.user.findFirst({})
      if (activity) {
        await prisma.followUp.create({
          data: {
            activityId: activity.id,
            dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            status: FollowUpStatus.OPEN,
            ownerId: owner?.id,
            notes: 'Circle back on next steps',
          },
        })
        console.log('Follow-up seeded.')
      }
    }
  }
}

async function seedPhase3Data() {
  const owner = await prisma.user.findFirst({})
  if (!owner) return

  if ((await prisma.community.count()) === 0) {
    const community = await prisma.community.create({
      data: {
        name: 'NAEOS Builders Guild',
        purpose: 'Open-source contributors and maintainers',
        status: EcosystemStatus.ACTIVE,
        ownerId: owner.id,
      },
    })
    await prisma.contributor.createMany({
      data: [
        { name: 'Rina Haryanto', role: ContributorRole.MAINTAINER, status: EcosystemStatus.ACTIVE, communityId: community.id, ownerId: owner.id },
        { name: 'Bagus Pratama', role: ContributorRole.DEVELOPER, status: EcosystemStatus.ACTIVE, communityId: community.id, ownerId: owner.id },
        { name: 'Cici Wijaya', role: ContributorRole.ADVISOR, status: EcosystemStatus.INACTIVE, ownerId: owner.id },
      ],
    })
    console.log('Community and contributors seeded.')
  }

  if ((await prisma.partner.count()) === 0) {
    await prisma.partner.createMany({
      data: [
        { name: 'DigitalOcean', partnerType: PartnerType.TECHNOLOGY, status: EcosystemStatus.ACTIVE, ownerId: owner.id },
        { name: 'GoPay', partnerType: PartnerType.INTEGRATION, status: EcosystemStatus.ACTIVE, ownerId: owner.id },
        { name: 'SGInnovate', partnerType: PartnerType.STRATEGIC, status: EcosystemStatus.ACTIVE, ownerId: owner.id },
      ],
    })
    console.log('Partners seeded.')
  }

  if ((await prisma.investor.count()) === 0) {
    await prisma.investor.createMany({
      data: [
        { name: 'East Ventures', investorType: InvestorType.VENTURE, status: EcosystemStatus.ACTIVE, ownerId: owner.id },
        { name: 'Indico Capital', investorType: InvestorType.SEED, status: EcosystemStatus.ACTIVE, ownerId: owner.id },
      ],
    })
    console.log('Investors seeded.')
  }

  if ((await prisma.useCase.count()) === 0) {
    const opportunity = await prisma.opportunity.findFirst({ orderBy: { createdAt: 'asc' } })
    if (opportunity) {
      await prisma.useCase.create({
        data: {
          opportunityId: opportunity.id,
          title: 'Transparent SDK licensing dashboard',
          summary: 'Give enterprises visibility into SDK usage and compliance.',
          value: 12000,
          ownerId: owner.id,
        },
      })
      console.log('Use case seeded.')
    }
  }
}

async function seedPhase4Data() {
  const POLICY_VERSION = '2026.09.17'

  if ((await prisma.policyRule.count()) === 0) {
    await prisma.policyRule.createMany({
      data: [
        { resource: 'go-gate', action: GoGateActionType.SEND_EMAIL, role: UserRole.MANAGER, effect: PolicyEffect.ALLOW, priority: 0, enabled: true, policyVersion: POLICY_VERSION },
        { resource: 'go-gate', action: GoGateActionType.SEND_EMAIL, role: UserRole.ADMIN, effect: PolicyEffect.ALLOW, priority: 0, enabled: true, policyVersion: POLICY_VERSION },
        { resource: 'go-gate', action: GoGateActionType.CONTACT_PROSPECT, role: UserRole.MANAGER, effect: PolicyEffect.ALLOW, priority: 0, enabled: true, policyVersion: POLICY_VERSION },
        { resource: 'policy', action: 'write', role: UserRole.ADMIN, effect: PolicyEffect.ALLOW, priority: 0, enabled: true, policyVersion: POLICY_VERSION },
      ],
    })
    console.log('Policy rules seeded.')
  }
}

async function main() {
  const existing = await prisma.user.count()
  if (existing > 0) {
    console.log('Database already seeded, skipping base seed.')
    await seedPipelineStages()
    await seedPhase2Data()
    await seedPhase3Data()
    await seedPhase4Data()
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
  await seedPipelineStages()
  await seedPhase2Data()
  await seedPhase3Data()
  await seedPhase4Data()
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })