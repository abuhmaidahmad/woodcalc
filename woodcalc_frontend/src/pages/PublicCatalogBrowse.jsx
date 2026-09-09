import React from 'react'
import { useParams } from 'react-router-dom'
import KitchenPlannerModule from '../features/kitchen_planner/KitchenPlannerModule'

export default function PublicCatalogBrowse() {
  const { companySlug } = useParams()
  return <KitchenPlannerModule publicCompanySlug={companySlug} />
}
