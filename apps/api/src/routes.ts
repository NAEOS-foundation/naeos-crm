import { Router } from 'express'

import {
  ActivityFacade,
  CompanyFacade,
  ContactFacade,
  InMemoryCompanyReadPort,
  InMemoryContactReadPort,
  LeadFacade,
  TaskFacade,
} from './service-layer'

const companyFacade = new CompanyFacade(new InMemoryCompanyReadPort())
const contactFacade = new ContactFacade(new InMemoryContactReadPort())
const leadFacade = new LeadFacade()
const activityFacade = new ActivityFacade()
const taskFacade = new TaskFacade()

const buildMeta = () => ({
  request_id: 'placeholder-request-id',
  timestamp: new Date().toISOString(),
})

export const router = Router()

router.get('/api/v1/companies', async (_req, res) => {
  const data = await companyFacade.listCompanies()

  res.json({
    data,
    meta: buildMeta(),
  })
})

router.get('/api/v1/companies/:id', async (req, res) => {
  const company = await companyFacade.getCompany(req.params.id)

  if (!company) {
    res.status(404).json({
      error: {
        code: 'COMPANY_NOT_FOUND',
        message: `Company ${req.params.id} was not found`,
      },
    })
    return
  }

  res.json({
    data: company,
    meta: buildMeta(),
  })
})

router.get('/api/v1/contacts', async (req, res) => {
  const { companyId } = req.query

  const data = companyId
    ? await contactFacade.listByCompany(String(companyId))
    : await contactFacade.listContacts()

  res.json({
    data,
    meta: buildMeta(),
  })
})

router.get('/api/v1/leads', async (req, res) => {
  const { companyId } = req.query

  const data = await leadFacade.listLeads(companyId ? String(companyId) : undefined)

  res.json({
    data,
    meta: buildMeta(),
  })
})

router.get('/api/v1/activities', async (req, res) => {
  const { companyId } = req.query

  const data = await activityFacade.listActivities(companyId ? String(companyId) : undefined)

  res.json({
    data,
    meta: buildMeta(),
  })
})

router.get('/api/v1/tasks', async (req, res) => {
  const { companyId } = req.query

  const data = await taskFacade.listTasks(companyId ? String(companyId) : undefined)

  res.json({
    data,
    meta: buildMeta(),
  })
})
