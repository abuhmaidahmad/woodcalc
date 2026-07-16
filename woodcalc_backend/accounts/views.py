from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from .serializers import (
    CustomerRegisterSerializer,
    ArchitectRegisterSerializer,
    ManufacturerRegisterSerializer,
    SupplierRegisterSerializer,
    UserMeSerializer,
)
from .models import ManufacturerProfile, SupplierProfile

User = get_user_model()


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


@api_view(['POST'])
@permission_classes([AllowAny])
def register_customer(request):
    serializer = CustomerRegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        tokens = get_tokens_for_user(user)
        return Response({
            'user': UserMeSerializer(user).data,
            'tokens': tokens,
            'message': 'Account created successfully.'
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def register_architect(request):
    serializer = ArchitectRegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        tokens = get_tokens_for_user(user)
        return Response({
            'user': UserMeSerializer(user).data,
            'tokens': tokens,
            'message': 'Account created successfully.'
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def register_manufacturer(request):
    serializer = ManufacturerRegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        doc = request.FILES.get('trade_license_document')
        if doc:
            user.manufacturer_profile.trade_license_document = doc
            user.manufacturer_profile.save()
        tokens = get_tokens_for_user(user)
        return Response({
            'user': UserMeSerializer(user).data,
            'tokens': tokens,
            'message': 'Account created. Access limited until document verification is complete.',
            'verification_status': 'pending'
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def register_supplier(request):
    data = request.data.copy()
    if 'materials_supplied' in data and isinstance(data['materials_supplied'], str):
        data.setlist('materials_supplied', data['materials_supplied'].split(','))

    serializer = SupplierRegisterSerializer(data=data)
    if serializer.is_valid():
        user = serializer.save()
        doc = request.FILES.get('trade_license_document')
        if doc:
            user.supplier_profile.trade_license_document = doc
            user.supplier_profile.save()
        tokens = get_tokens_for_user(user)
        return Response({
            'user': UserMeSerializer(user).data,
            'tokens': tokens,
            'message': 'Account created. Access limited until document verification is complete.',
            'verification_status': 'pending'
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(UserMeSerializer(request.user).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_verification_document(request):
    user = request.user
    doc = request.FILES.get('trade_license_document')
    if not doc:
        return Response({'error': 'No document provided.'}, status=400)

    if user.user_type == 'manufacturer':
        profile = user.manufacturer_profile
        profile.trade_license_document = doc
        profile.verification_status = 'pending'
        profile.save()
    elif user.user_type == 'supplier':
        profile = user.supplier_profile
        profile.trade_license_document = doc
        profile.verification_status = 'pending'
        profile.save()
    else:
        return Response({'error': 'Not applicable for this user type.'}, status=400)

    return Response({'message': 'Document submitted. Under review.'})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def email_account(request):
    """GET returns the current user's connected email account status (never the password).
    POST connects or updates the user's email account (email + app password)."""
    from .models import EmailAccount
    from .serializers import EmailAccountSerializer

    existing = EmailAccount.objects.filter(user=request.user).first()

    if request.method == 'GET':
        if not existing:
            return Response({'connected': False})
        data = EmailAccountSerializer(existing).data
        data['connected'] = True
        return Response(data)

    serializer = EmailAccountSerializer(
        instance=existing, data=request.data, context={'request': request}
    )
    if serializer.is_valid():
        serializer.save()
        return Response({'message': 'Email account connected successfully.'}, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
