from django.db import models


class Supplier(models.Model):
    name = models.CharField(max_length=200)
    contact_name = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=300, blank=True)

    def __str__(self):
        return self.name


class Material(models.Model):
    UNIT_CHOICES = [
        ('PCS', 'Pieces'), ('M', 'Meters'), ('M2', 'Square Meters'),
        ('M3', 'Cubic Meters'), ('KG', 'Kilograms'), ('L', 'Liters'),
    ]
    sku = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=100, blank=True)
    unit = models.CharField(max_length=10, choices=UNIT_CHOICES, default='PCS')
    quantity_on_hand = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reorder_level = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='materials')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.sku} - {self.name}'


class StockMovement(models.Model):
    MOVEMENT_CHOICES = [('IN', 'In'), ('OUT', 'Out'), ('ADJUST', 'Adjustment')]
    material = models.ForeignKey(Material, on_delete=models.CASCADE, related_name='movements')
    movement_type = models.CharField(max_length=10, choices=MOVEMENT_CHOICES)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=200, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.material.sku} {self.movement_type} {self.quantity}'


class StockAlert(models.Model):
    material = models.ForeignKey(Material, on_delete=models.CASCADE, related_name='alerts')
    message = models.CharField(max_length=300)
    resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.message


class MaterialTexture(models.Model):
    """Visual render-facing material swatch (front/door laminate or worktop surface),
    separate from the inventory Material model which tracks stock/cost.
    Used by the Kitchen Planner 3D view to texture-map cabinet fronts and countertops."""
    TYPE_CHOICES = [('front', 'Front/Door'), ('worktop', 'Worktop/Countertop')]
    code = models.CharField(max_length=50, blank=True)
    name = models.CharField(max_length=200)
    material_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='textures')
    texture_image = models.ImageField(upload_to='material_textures/')
    fallback_hex = models.CharField(max_length=7, default='#FFFFFF', help_text='Used if texture fails to load')
    roughness = models.FloatField(default=0.4)
    metalness = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.name} ({self.get_material_type_display()})'
