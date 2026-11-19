import { describe, expect, it, vi } from 'vitest'
import type { AuditService } from '@naeos-crm/audit'
import type { Company, Lead } from '@naeos-crm/domain'
import type { CompanyReadPort, LeadReadPort } from './domain-interfaces'
import { LeadFacade } from './service-layer'

const audit = { record: vi.fn(async () => undefined) } as unknown as AuditService

function setup(company: Company | null) {
  const lead = {
    id: 'lead-1', companyId: 'company-1', source: 'website', status: 'NEW',
    createdAt: new Date(), updatedAt: new Date(),
  } as Lead
  const leads = {
    findById: vi.fn(async () => lead),
    list: vi.fn(),
    listByCompany: vi.fn(),
    create: vi.fn(async (input: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) => ({ ...input, id: 'lead-new', createdAt: new Date(), updatedAt: new Date() })),
    update: vi.fn(async () => lead),
    delete: vi.fn(async () => true),
  } as unknown as LeadReadPort
  const companies = {
    findById: vi.fn(async (id: string) => id === company?.id ? company : null),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as CompanyReadPort
  return { facade: new LeadFacade(leads, audit, companies), leads, companies, lead }
}

describe('LeadFacade company authorization', () => {
  it('rejects creating a lead for a nonexistent company', async () => {
    const { facade, leads } = setup(null)
    await expect(facade.createLead(
      { companyId: 'missing-company', source: 'website', status: 'NEW' } as Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>,
      { actorId: 'member-1', actor: { id: 'member-1', roles: ['MEMBER'] } },
    )).rejects.toMatchObject({ status: 404, code: 'COMPANY_NOT_FOUND' })
    expect(leads.create).not.toHaveBeenCalled()
  })

  it('rejects create for a company owned by another user', async () => {
    const company = { id: 'company-1', name: 'Company', ownerId: 'owner-2' } as Company
    const { facade, leads } = setup(company)
    await expect(facade.createLead(
      { companyId: company.id, source: 'website', status: 'NEW' } as Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>,
      { actorId: 'member-1', actor: { id: 'member-1', roles: ['MEMBER'] } },
    )).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
    expect(leads.create).not.toHaveBeenCalled()
  })

  it('validates access to the existing and target company on reassignment', async () => {
    const company = { id: 'company-1', name: 'Company', ownerId: 'member-1' } as Company
    const { facade, leads, companies } = setup(company)
    await expect(facade.updateLead('lead-1', { companyId: 'company-2' }, {
      actorId: 'member-1', actor: { id: 'member-1', roles: ['MEMBER'] },
    })).rejects.toMatchObject({ status: 404, code: 'COMPANY_NOT_FOUND' })
    expect(companies.findById).toHaveBeenCalledWith('company-2')
    expect(leads.update).not.toHaveBeenCalled()
  })

  it('enforces company ownership before deleting a lead', async () => {
    const company = { id: 'company-1', name: 'Company', ownerId: 'owner-2' } as Company
    const { facade, leads } = setup(company)
    await expect(facade.deleteLead('lead-1', {
      actorId: 'member-1', actor: { id: 'member-1', roles: ['MEMBER'] },
    })).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
    expect(leads.delete).not.toHaveBeenCalled()
  })
})
