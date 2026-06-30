from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from .models import Material, Supplier, StockMovement, StockAlert, MaterialTexture
from .serializers import MaterialSerializer, SupplierSerializer, StockMovementSerializer, StockAlertSerializer, MaterialTextureSerializer


class MaterialViewSet(ModelViewSet):
    queryset = Material.objects.all().order_by('sku')
    serializer_class = MaterialSerializer
    permission_classes = [IsAuthenticated]


class SupplierViewSet(ModelViewSet):
    queryset = Supplier.objects.all().order_by('name')
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]


class StockMovementViewSet(ModelViewSet):
    queryset = StockMovement.objects.all().order_by('-created_at')
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated]


class StockAlertViewSet(ModelViewSet):
    queryset = StockAlert.objects.all().order_by('-created_at')
    serializer_class = StockAlertSerializer
    permission_classes = [IsAuthenticated]


class MaterialTextureViewSet(ModelViewSet):
    # Read access (GET) is public so the Kitchen Planner can load material swatches
    # without requiring a logged-in session. Create/update/delete still require auth.
    queryset = MaterialTexture.objects.all().order_by('material_type', 'name')
    serializer_class = MaterialTextureSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
