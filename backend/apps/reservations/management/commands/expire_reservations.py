from django.core.management.base import BaseCommand

from apps.reservations.services import reservation_service


class Command(BaseCommand):
    help = (
        "Expire READY reservations whose pick-up window has passed and offer "
        "their copies to the next member in the queue. Run every 10-15 minutes "
        "(cron, Celery beat, or a Kubernetes CronJob)."
    )

    def handle(self, *args, **options):
        expired = reservation_service.expire_stale_holds()
        self.stdout.write(self.style.SUCCESS(f"Expired {expired} reservation(s)."))
