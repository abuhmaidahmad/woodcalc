from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('api/auth/', include('accounts.urls')),
    path('admin/', admin.site.urls),
    path('api/auth/login/', TokenObtainPairView.as_view()),
    path('api/auth/refresh/', TokenRefreshView.as_view()),
    path('api/inventory/', include('inventory.urls')),
    path('api/manufacturing/', include('manufacturing.urls')),
    path('api/supply_chain/', include('supply_chain.urls')),
    path('api/hr/', include('hr.urls')),
    path('api/crm/', include('crm.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
