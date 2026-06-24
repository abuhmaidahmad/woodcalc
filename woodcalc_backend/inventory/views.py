from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from .models import Material, Supplier, StockMovement, StockAlert
from .serializers import MaterialSerializer, SupplierSerializer, StockMovementSerializer, StockAlertSerializer


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
