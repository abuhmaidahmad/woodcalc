from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from billing.models import Invoice, PaymentMethod
from billing.paytabs_client import PayTabsError, charge_token
from tenants.models import Company


class Command(BaseCommand):
    help = "Charges the annual renewal for every active company whose subscription is due. Run daily via Railway Cron."

    def handle(self, *args, **options):
        due_companies = Company.objects.filter(
            status=Company.Status.ACTIVE,
            subscription_ends_at__lte=timezone.now(),
        )
        for company in due_companies:
            payment_method = PaymentMethod.objects.filter(company=company, is_active=True).first()
            if payment_method is None:
                self.stdout.write(self.style.WARNING(f"{company}: no active payment method, marking past_due"))
                company.status = Company.Status.PAST_DUE
                company.save(update_fields=["status"])
                continue

            try:
                data = charge_token(payment_method, company.plan)
            except (PayTabsError, ValueError) as e:
                self.stdout.write(self.style.ERROR(f"{company}: renewal charge failed — {e}"))
                Invoice.objects.create(
                    company=company, plan=company.plan, amount=0, status=Invoice.Status.FAILED,
                )
                company.status = Company.Status.PAST_DUE
                company.save(update_fields=["status"])
                continue

            if data.get("payment_result", {}).get("response_status") != "A":
                self.stdout.write(self.style.ERROR(f"{company}: renewal declined"))
                Invoice.objects.create(
                    company=company, plan=company.plan, amount=0,
                    status=Invoice.Status.FAILED, paytabs_tran_ref=data.get("tran_ref", ""),
                )
                company.status = Company.Status.PAST_DUE
                company.save(update_fields=["status"])
                continue

            now = timezone.now()
            Invoice.objects.create(
                company=company, plan=company.plan, amount=data.get("cart_amount", 0),
                status=Invoice.Status.PAID, paytabs_tran_ref=data.get("tran_ref", ""),
                paid_at=now, billing_period_start=now, billing_period_end=now + timedelta(days=365),
            )
            company.subscription_ends_at = now + timedelta(days=365)
            company.save(update_fields=["subscription_ends_at"])
            self.stdout.write(self.style.SUCCESS(f"{company}: renewed through {company.subscription_ends_at.date()}"))
