const axios = require('axios');

const BASE_URL = 'https://api.hubapi.com';

function client() {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
}

// Custom properties namespaced pr_* to avoid HubSpot's built-in enum validation on
// fields like "industry" (a fixed picklist that our free-text values won't match).
const BOOL_OPTIONS = [
  { label: 'True', value: 'true', displayOrder: 1 },
  { label: 'False', value: 'false', displayOrder: 2 },
];

const COMPANY_PROPERTIES = [
  { name: 'pr_tier', label: 'PR Tier', type: 'number', fieldType: 'number' },
  { name: 'pr_score', label: 'PR Score', type: 'number', fieldType: 'number' },
  { name: 'pr_industry', label: 'PR Industry', type: 'string', fieldType: 'text' },
  { name: 'pr_marketing_headcount', label: 'PR Marketing Headcount', type: 'number', fieldType: 'number' },
  { name: 'pr_has_ops_hire', label: 'PR Has Ops Hire', type: 'bool', fieldType: 'booleancheckbox', options: BOOL_OPTIONS },
  { name: 'pr_hiring_signal', label: 'PR Hiring Signal', type: 'bool', fieldType: 'booleancheckbox', options: BOOL_OPTIONS },
  { name: 'pr_hiring_signal_titles', label: 'PR Hiring Signal Titles', type: 'string', fieldType: 'text' },
  { name: 'pr_headcount_growth_pct', label: 'PR Headcount Growth %', type: 'number', fieldType: 'number' },
  { name: 'pr_funding_stage', label: 'PR Funding Stage', type: 'string', fieldType: 'text' },
  { name: 'pr_total_raised', label: 'PR Total Raised', type: 'number', fieldType: 'number' },
  { name: 'pr_tech_stack', label: 'PR Tech Stack', type: 'string', fieldType: 'text' },
  { name: 'pr_source', label: 'PR Source', type: 'string', fieldType: 'text' },
];

// Idempotent -- HubSpot returns 409 if a property already exists, which we treat as success.
async function ensureCompanyProperties() {
  const created = [];
  for (const prop of COMPANY_PROPERTIES) {
    try {
      await client().post('/crm/v3/properties/companies', { groupName: 'companyinformation', ...prop });
      created.push(prop.name);
    } catch (err) {
      if (err.response?.status !== 409) throw err;
    }
  }
  return created;
}

async function findCompanyByDomain(domain) {
  const { data } = await client().post('/crm/v3/objects/companies/search', {
    filterGroups: [{ filters: [{ propertyName: 'domain', operator: 'EQ', value: domain }] }],
    properties: ['name', 'domain'],
  });
  return data.results[0] || null;
}

// Domain isn't a unique property in HubSpot by default, so upsert-by-domain isn't
// available via the batch/upsert endpoint -- search first, then create or update.
async function upsertCompanyByDomain(domain, properties) {
  const existing = domain ? await findCompanyByDomain(domain) : null;
  if (existing) {
    const { data } = await client().patch(`/crm/v3/objects/companies/${existing.id}`, { properties });
    return data;
  }
  const { data } = await client().post('/crm/v3/objects/companies', { properties });
  return data;
}

// email IS a default-unique property for contacts, so batch/upsert works directly.
async function upsertContactByEmail(email, properties) {
  const { data } = await client().post('/crm/v3/objects/contacts/batch/upsert', {
    inputs: [{ idProperty: 'email', id: email, properties }],
  });
  return data.results[0];
}

// The `default` association endpoint auto-selects the correct HubSpot-defined
// association type (279/280 for contact<->company) rather than hardcoding it.
async function associateContactToCompany(contactId, companyId) {
  await client().put(`/crm/v4/objects/contacts/${contactId}/associations/default/companies/${companyId}`);
}

module.exports = {
  ensureCompanyProperties,
  findCompanyByDomain,
  upsertCompanyByDomain,
  upsertContactByEmail,
  associateContactToCompany,
};
