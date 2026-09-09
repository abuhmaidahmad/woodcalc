from rest_framework.routers import DefaultRouter
from .views import AdminCompanyViewSet, AdminFeedbackViewSet

router = DefaultRouter()
router.register(r'companies', AdminCompanyViewSet, basename='admin-company')
router.register(r'feedback', AdminFeedbackViewSet, basename='admin-feedback')

urlpatterns = router.urls
