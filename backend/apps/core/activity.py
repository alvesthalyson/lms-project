import json

from django.core.serializers.json import DjangoJSONEncoder

from .models import ActivityLog


def log_activity(action, *, actor=None, member=None, book=None, **metadata) -> ActivityLog:
    """
    Append one row to the dashboard's activity feed. Services call this
    explicitly inside their transaction, so a rolled-back operation leaves
    no trace. Extra keyword arguments become `metadata`; dates and Decimals
    are converted to JSON-safe values.
    """
    return ActivityLog.objects.create(
        action=action,
        actor=actor,
        member=member,
        book=book,
        metadata=json.loads(json.dumps(metadata, cls=DjangoJSONEncoder)),
    )
