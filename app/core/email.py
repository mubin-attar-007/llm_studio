"""Transactional email with graceful degradation.

Sends via SMTP (a Gmail App Password in prod). If SMTP isn't configured (SMTP_USER blank), the
message + link is logged instead — so password-reset never dead-ends and delivery errors never
surface to the requester (which would leak whether an account exists).
"""
import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

log = logging.getLogger("llm_studio.email")


def send_email(to: str, subject: str, body: str) -> None:
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        log.info("email not configured; would send to %s: %s | %s", to, subject, body)
        return
    msg = EmailMessage()
    msg["From"] = settings.EMAIL_FROM or settings.SMTP_USER
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            smtp.starttls()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
        log.info("password reset email sent to %s", to)
    except Exception as exc:  # never surface delivery errors to the requester
        log.warning("email send failed: %s", exc)
