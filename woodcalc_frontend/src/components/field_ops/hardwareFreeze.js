import { getInstallation, updateInstallation } from '../../api/fieldOps'
import { hardwareList } from './jobDesign'

export async function freezeJobHardware(installationId, api = { getInstallation, updateInstallation }) {
  try {
    const res = await api.getInstallation(installationId)
    const cabinets = res?.ok ? res.data?.design?.cabinets : null
    if (!Array.isArray(cabinets)) return false
    const update = await api.updateInstallation(installationId, { hardware_summary: hardwareList(cabinets) })
    return !!update?.ok
  } catch {
    return false
  }
}
