from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from .models import Material, Supplier, StockMovement, StockAlert, MaterialTexture, DrawerSystem
from .serializers import MaterialSerializer, SupplierSerializer, StockMovementSerializer, StockAlertSerializer, MaterialTextureSerializer, DrawerSystemSerializer


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
    serializer_class = MaterialTextureSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = MaterialTexture.objects.all().order_by('material_type', 'name')
        material_type = self.request.query_params.get('material_type')
        if material_type:
            qs = qs.filter(material_type=material_type)
        return qs


from rest_framework.permissions import IsAuthenticatedOrReadOnly

class DrawerSystemViewSet(ModelViewSet):
    serializer_class = DrawerSystemSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return DrawerSystem.objects.filter(is_active=True)
