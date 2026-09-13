from rest_framework.routers import DefaultRouter
from .views import CadCamImportJobViewSet, RemnantOffcutViewSet

router = DefaultRouter()
router.register(r'import-jobs', CadCamImportJobViewSet, basename='cadcamimportjob')
router.register(r'offcuts', RemnantOffcutViewSet, basename='remnantoffcut')
urlpatterns = router.urls
