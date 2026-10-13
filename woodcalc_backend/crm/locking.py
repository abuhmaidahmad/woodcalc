from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Room

LOCKED_MESSAGE = "Locked: this room is confirmed (Rev {rev}) and can't be changed. Request a change to create a new revision."


def ensure_room_unlocked(room):
    if room is not None and room.is_locked:
        raise PermissionDenied(LOCKED_MESSAGE.format(rev=room.revision_number))


def room_for_ref(room_id, company):
    if not room_id or company is None:
        return None
    return Room.objects.filter(id=room_id, project__client__tenant=company).first()


class RoomNotLocked(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if getattr(view, 'action', None) in getattr(view, 'lock_exempt_actions', ()):
            return True
        room = view.get_lock_room(obj) if hasattr(view, 'get_lock_room') else obj
        ensure_room_unlocked(room)
        return True
