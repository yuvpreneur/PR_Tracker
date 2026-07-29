import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


def send_email(to_email: str, subject: str, html_body: str, text_body: str) -> None:
    """Sends an email via SMTP using credentials from the environment. Raises
    RuntimeError if SMTP isn't configured, so callers can fall back to a dev-friendly
    alternative (e.g. printing a link to the console) instead of failing outright."""
    host = os.environ.get("SMTP_HOST")
    username = os.environ.get("SMTP_USERNAME")
    password = os.environ.get("SMTP_PASSWORD")
    if not host or not username or not password:
        raise RuntimeError("SMTP not configured")

    port = int(os.environ.get("SMTP_PORT", "587"))
    from_email = os.environ.get("SMTP_FROM_EMAIL") or username

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = from_email
    message["To"] = to_email
    message.attach(MIMEText(text_body, "plain"))
    message.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(host, port) as server:
        server.starttls()
        server.login(username, password)
        server.send_message(message)
