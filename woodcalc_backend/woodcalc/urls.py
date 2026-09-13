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
    path('api/cadcam/', include('cadcam.urls')),
    path('api/hr/', include('hr.urls')),
    path('api/crm/', include('crm.urls')),
    path('api/srm/', include('srm.urls')),
    path('api/billing/', include('billing.urls')),
    path('api/tenants/', include('tenants.urls')),
    path('api/feedback/', include('feedback.urls')),
    path('api/platform-admin/', include('platform_admin.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
