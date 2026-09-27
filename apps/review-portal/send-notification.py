#!/usr/bin/env python3
"""Fixed-template owner notification; no applicant-controlled mail fields."""
import json
import re
import smtplib
import ssl
import sys
from email.message import EmailMessage
from email.utils import formatdate


def message(config, application):
    smtp = config['smtp']
    address = smtp.get('from', '')
    if not re.fullmatch(r'[a-zA-Z0-9._%+-]+@gmail\.com', address):
        raise ValueError('invalid_mailbox')
    if smtp.get('user') != address or smtp.get('host') != 'smtp.gmail.com':
        raise ValueError('invalid_configuration')
    if not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', application):
        raise ValueError('invalid_application')
    mail = EmailMessage()
    mail['From'] = f'Dental Open Source <{address}>'
    mail['To'] = address
    mail['Subject'] = 'Dental Open Source: new membership application'
    mail['Date'] = formatdate(localtime=False)
    mail['Message-ID'] = f'<membership-{application}@dentalopensource.org>'
    mail.set_content('A new membership application was submitted.\n\n'
                     'Sign in to the private workspace to review it:\n'
                     'https://dentalopensource.org/review/\n\n'
                     'Yeni bir ekip basvurusu alindi. Incelemek icin ozel panele giris yapin.\n'
                     'Application details and attachments are available only in the portal.\n')
    return mail


def send(config, application):
    mail = message(config, application)
    smtp = config['smtp']
    if config.get('enabled') is not True or not smtp.get('password'):
        raise ValueError('mail_not_configured')
    with smtplib.SMTP('smtp.gmail.com', 587, timeout=15) as client:
        client.ehlo()
        client.starttls(context=ssl.create_default_context())
        client.ehlo()
        client.login(smtp['user'], smtp['password'])
        if client.send_message(mail):
            raise ValueError('recipient_refused')


if __name__ == '__main__':
    try:
        with open(sys.argv[1]) as file:
            config = json.load(file)
        send(config, sys.stdin.read(80).strip())
    except Exception:
        print('Notification not accepted; private delivery configuration requires attention.', file=sys.stderr)
        sys.exit(1)
