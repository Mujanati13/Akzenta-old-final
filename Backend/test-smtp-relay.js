/**
 * Test script for Microsoft 365 SMTP Relay (IP-based authentication)
 *
 * Configuration:
 * - SMTP Server: akzente-group.mail.protection.outlook.com
 * - Port: 25 (trying 587 as fallback)
 * - Authentication: None (IP-based)
 * - TLS: Enabled (STARTTLS)
 * - From: mail@akzente.group
 */

const nodemailer = require('nodemailer');

// Test recipient - change this to your email
const TEST_RECIPIENT = 'mail@akzente.group';

async function testSmtpRelay() {
  console.log('='.repeat(60));
  console.log('Microsoft 365 SMTP Relay Test');
  console.log('='.repeat(60));
  console.log('');
  console.log('Configuration:');
  console.log('  SMTP Host: akzente-group.mail.protection.outlook.com');
  console.log('  Port: 25 (primary), 587 (fallback)');
  console.log('  Authentication: None (IP-based relay)');
  console.log('  TLS: STARTTLS enabled');
  console.log('  From: mail@akzente.group');
  console.log('');

  // Try port 25 first
  const ports = [25, 587];

  for (const port of ports) {
    console.log(`\n${'─'.repeat(40)}`);
    console.log(`Testing with port ${port}...`);
    console.log('─'.repeat(40));

    try {
      const transporter = nodemailer.createTransport({
        host: 'akzente-group.mail.protection.outlook.com',
        port: port,
        secure: false, // Use STARTTLS, not implicit TLS
        auth: null, // No authentication - IP-based relay
        tls: {
          ciphers: 'SSLv3',
          rejectUnauthorized: false, // For testing; set to true in production
        },
        requireTLS: true, // Require STARTTLS upgrade
        debug: true,
        logger: true,
      });

      console.log('\n1. Verifying SMTP connection...');
      await transporter.verify();
      console.log('✓ SMTP connection verified successfully!');

      console.log('\n2. Sending test email...');
      const info = await transporter.sendMail({
        from: '"Akzente API Test" <mail@akzente.group>',
        to: TEST_RECIPIENT,
        subject: `SMTP Relay Test - Port ${port} - ${new Date().toISOString()}`,
        text: `This is a test email from the Microsoft 365 SMTP Relay.
        
Configuration used:
- Host: akzente-group.mail.protection.outlook.com
- Port: ${port}
- Authentication: IP-based (no credentials)
- TLS: STARTTLS
- Server IP: 91.99.235.86

If you received this email, the SMTP relay is working correctly!

Sent at: ${new Date().toISOString()}`,
        html: `
          <h2>SMTP Relay Test Successful</h2>
          <p>This is a test email from the Microsoft 365 SMTP Relay.</p>
          <h3>Configuration used:</h3>
          <ul>
            <li><strong>Host:</strong> akzente-group.mail.protection.outlook.com</li>
            <li><strong>Port:</strong> ${port}</li>
            <li><strong>Authentication:</strong> IP-based (no credentials)</li>
            <li><strong>TLS:</strong> STARTTLS</li>
            <li><strong>Server IP:</strong> 91.99.235.86</li>
          </ul>
          <p style="color: green; font-weight: bold;">If you received this email, the SMTP relay is working correctly!</p>
          <p><small>Sent at: ${new Date().toISOString()}</small></p>
        `,
      });

      console.log('✓ Email sent successfully!');
      console.log(`  Message ID: ${info.messageId}`);
      console.log(`  Response: ${info.response}`);

      console.log('\n' + '='.repeat(60));
      console.log(`SUCCESS! Port ${port} is working.`);
      console.log('='.repeat(60));

      return; // Exit on first success
    } catch (error) {
      console.error(`\n✗ Failed with port ${port}`);
      console.error(`  Error: ${error.message}`);

      if (error.code) {
        console.error(`  Error Code: ${error.code}`);
      }
      if (error.responseCode) {
        console.error(`  SMTP Response Code: ${error.responseCode}`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('FAILED: Could not connect on any port.');
  console.log('='.repeat(60));
  console.log('\nTroubleshooting tips:');
  console.log(
    '1. Verify the server IP (91.99.235.86) is whitelisted in the Microsoft 365 connector',
  );
  console.log('2. Check SPF record includes the server IP');
  console.log(
    '3. Ensure outbound ports 25 and 587 are not blocked by firewall',
  );
  console.log(
    '4. Verify the connector is configured for the correct domain (akzente.group)',
  );
  console.log(
    '5. Check Microsoft 365 admin center for any blocked senders or security policies',
  );
}

// Run the test
testSmtpRelay().catch(console.error);
