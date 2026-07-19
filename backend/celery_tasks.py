"""Celery task skeleton — drop-in replacement for APScheduler when Redis is provisioned.

Activation (once REDIS_URL is set in .env):
    1. `celery -A celery_tasks worker --loglevel=info` (in one process)
    2. `celery -A celery_tasks beat --loglevel=info` (in another process)
    3. Remove/skip scheduler.start() in server.py startup handler

The job function is imported from server.py so behavior stays identical.
"""
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")

try:
    from celery import Celery
    from celery.schedules import crontab
except ImportError:  # optional dep
    Celery = None

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

if Celery:
    celery_app = Celery("intelligenceos", broker=REDIS_URL, backend=REDIS_URL)
    celery_app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        enable_utc=True,
        beat_schedule={
            "thesis-auto-recheck-every-6h": {
                "task": "celery_tasks.thesis_auto_recheck_task",
                "schedule": crontab(minute=0, hour="*/6"),
            },
        },
    )

    @celery_app.task(name="celery_tasks.thesis_auto_recheck_task")
    def thesis_auto_recheck_task():
        """Sync wrapper that runs the async job (Celery workers are sync-by-default)."""
        import asyncio
        from server import thesis_auto_recheck_job
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(thesis_auto_recheck_job())
        finally:
            loop.close()
else:
    celery_app = None
