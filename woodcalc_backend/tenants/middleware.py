from .models import CompanyMembership


class CompanyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.company = None
        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated:
            membership = (
                CompanyMembership.objects.select_related("company")
                .filter(user=user)
                .first()
            )
            if membership is not None:
                request.company = membership.company
        return self.get_response(request)
