from django.db import models
from django.core.files.base import ContentFile
from io import BytesIO
from PIL import Image


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
    FINISH_CHOICES = [
        ('matt', 'Matt'), ('gloss', 'Gloss'), ('wood', 'Wood'), ('metal', 'Metal'), ('other', 'Other'),
    ]
    code = models.CharField(max_length=50, blank=True)
    name = models.CharField(max_length=200)
    material_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    finish = models.CharField(max_length=10, choices=FINISH_CHOICES, default='matt')
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='textures')
    texture_image = models.ImageField(upload_to='material_textures/')
    fallback_hex = models.CharField(max_length=7, default='#FFFFFF', help_text='Used if texture fails to load')
    roughness = models.FloatField(default=0.4)
    metalness = models.FloatField(default=0.0)
    board_width = models.PositiveIntegerField(default=2440, help_text='Board width in mm')
    board_height = models.PositiveIntegerField(default=1220, help_text='Board height in mm')
    thickness = models.PositiveIntegerField(default=18, help_text='Board thickness in mm')
    price_per_board = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.name} ({self.get_material_type_display()})'

    # Max dimension (px) any uploaded texture is resized down to. Large enough for crisp
    # close-up cabinet/countertop rendering, small enough to keep page loads fast.
    MAX_DIMENSION = 2048
    JPEG_QUALITY = 85

    def save(self, *args, **kwargs):
        if self.texture_image and hasattr(self.texture_image, 'file'):
            # Only re-process if this is a new/changed file (has an in-memory file object,
            # not an already-saved FieldFile pointing at existing storage).
            try:
                img = Image.open(self.texture_image)
                img = img.convert('RGB')  # drops alpha/CMYK edge cases, ensures clean JPEG output

                w, h = img.size
                if max(w, h) > self.MAX_DIMENSION:
                    scale = self.MAX_DIMENSION / max(w, h)
                    img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

                buffer = BytesIO()
                img.save(buffer, format='JPEG', quality=self.JPEG_QUALITY, optimize=True)
                buffer.seek(0)

                original_name = self.texture_image.name.rsplit('.', 1)[0]
                self.texture_image = ContentFile(buffer.read(), name=f'{original_name}.jpg')
            except Exception:
                # If optimization fails for any reason, fall back to saving the original
                # rather than blocking the upload entirely.
                pass
        super().save(*args, **kwargs)
