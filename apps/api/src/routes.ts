import { Router } from 'express'

import {
  ActivityFacade,
  CompanyFacade,
  ContactFacade,
  InMemoryActivityReadPort,
  InMemoryCompanyReadPort,
  InMemoryContactReadPort,
  InMemoryLeadReadPort,
  InMemoryTaskReadPort,
  LeadFacade,
  TaskFacade,
} from './service-layer'

const companyFacade = new CompanyFacade(new InMemoryCompanyReadPort())
const contactFacade = new ContactFacade(new InMemoryContactReadPort())
const leadFacade = new LeadFacade(new InMemoryLeadReadPort())
const activityFacade = new ActivityFacade(new InMemoryActivityReadPort())
const taskFacade = new TaskFacade(new InMemoryTaskReadPort())

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

  const data = companyId
    ? await leadFacade.listByCompany(String(companyId))
    : await leadFacade.listLeads()

  res.json({
    data,
    meta: buildMeta(),
  })
})

router.get('/api/v1/activities', async (req, res) => {
  const { companyId } = req.query

  const data = companyId
    ? await activityFacade.listByCompany(String(companyId))
    : await activityFacade.listActivities()

  res.json({
    data,
    meta: buildMeta(),
  })
})

router.get('/api/v1/tasks', async (req, res) => {
  const { companyId } = req.query

  const data = companyId
    ? await taskFacade.listByCompany(String(companyId))
    : await taskFacade.listTasks()

  res.json({
    data,
    meta: buildMeta(),
  })
})
