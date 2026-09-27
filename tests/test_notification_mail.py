import importlib.util
import pathlib
import unittest
from unittest.mock import patch, MagicMock

path = pathlib.Path(__file__).parents[1] / 'apps/review-portal/send-notification.py'
spec = importlib.util.spec_from_file_location('notification_mail', path)
mail = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mail)


class NotificationMailTests(unittest.TestCase):
    def setUp(self):
        self.config = {'enabled': True, 'smtp': {'host': 'smtp.gmail.com', 'from': 'synthetic@gmail.com', 'user': 'synthetic@gmail.com', 'password': 'synthetic-password'}}
        self.id = '00000000-0000-4000-8000-000000000001'

    def test_fixed_recipient_and_template(self):
        msg = mail.message(self.config, self.id)
        self.assertEqual(msg['To'], 'synthetic@gmail.com')
        self.assertEqual(msg['Message-ID'], mail.message(self.config, self.id)['Message-ID'])
        self.assertIn('https://dentalopensource.org/review/', msg.get_content())
        self.assertNotIn('synthetic-password', msg.as_string())
        self.assertNotIn(self.id, msg.get_content())

    def test_injection_rejected(self):
        for value in ['x\r\nBcc: recipient@example.org', '../secret', 'not-a-uuid']:
            with self.assertRaises(ValueError):
                mail.message(self.config, value)
        self.config['smtp']['from'] = 'synthetic@gmail.com\r\nBcc: x@example.org'
        with self.assertRaises(ValueError):
            mail.message(self.config, self.id)

    def test_tls_precedes_auth_and_smtp_refusal_is_failure(self):
        client = MagicMock()
        client.send_message.return_value = {}
        with patch.object(mail.smtplib, 'SMTP') as smtp:
            smtp.return_value.__enter__.return_value = client
            mail.send(self.config, self.id)
            smtp.assert_called_once_with('smtp.gmail.com', 587, timeout=15)
            self.assertEqual([c[0] for c in client.method_calls], ['ehlo', 'starttls', 'ehlo', 'login', 'send_message'])
            client.send_message.return_value = {'synthetic@gmail.com': (550, 'refused')}
            with self.assertRaises(ValueError):
                mail.send(self.config, self.id)

    def test_missing_credentials_never_connect(self):
        self.config['smtp'].pop('password')
        with patch.object(mail.smtplib, 'SMTP') as smtp:
            with self.assertRaises(ValueError):
                mail.send(self.config, self.id)
            smtp.assert_not_called()


if __name__ == '__main__':
    unittest.main()
