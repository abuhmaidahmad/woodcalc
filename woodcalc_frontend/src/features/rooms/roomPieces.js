import { workOrderPieces } from '../kitchen_planner/machining/pieces'
import { wardrobePieces } from '../wardrobe/wardrobePieces'
import { isWardrobeRoom } from '../wardrobe/wardrobeRoom'

export function roomPieces(workOrder, room, options = {}) {
  if (isWardrobeRoom(room)) return wardrobePieces(workOrder, room)
  return workOrderPieces(workOrder, room, options)
}
