from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .permissions import HasActiveCompany
from .utils import get_company_settings


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasActiveCompany])
def company_settings(request):
    return Response(get_company_settings(request.company))
