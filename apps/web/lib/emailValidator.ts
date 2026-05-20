/**
 * Secure Email Validation Engine for HireMax
 * Prevents signups and payments from invalid, fake, or throwaway email domains.
 */

// Common disposable, temporary, and test email domains
const DISPOSABLE_DOMAINS = new Set([
  'yopmail.com',
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  '10minutemail.com',
  'sharklasers.com',
  'guerrillamail.com',
  'dispostable.com',
  'getairmail.com',
  'burnermail.io',
  'trashmail.com',
  'fake.com',
  'test.com',
  'example.com',
  'teleworm.us',
  'dayrep.com',
  'fleckens.hu',
  'einrot.com',
  'rhyta.com',
  'armyspy.com'
]);

/**
 * Check if the email domain is syntactically correct and not a known throwaway/disposable.
 */
export function isDisposableOrInvalid(email: string): { valid: boolean; reason?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Email is required' };
  }

  const cleanEmail = email.trim();
  
  // RFC 5322 standard regex check
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(cleanEmail)) {
    return { valid: false, reason: 'Please enter a syntactically valid email address (e.g., name@domain.com).' };
  }

  const domain = cleanEmail.split('@')[1]?.toLowerCase();
  if (!domain) {
    return { valid: false, reason: 'Invalid email domain structure.' };
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: false, reason: 'Temporary or disposable email domains are not allowed. Please use a permanent email address.' };
  }

  return { valid: true };
}

/**
 * Perform a real-time MX record lookup using Cloudflare DNS-over-HTTPS (DoH).
 * Returns true if the domain exists and can receive email (has MX records).
 * Falls back to true if the network request fails to avoid blocking users on restricted connections.
 */
export async function verifyEmailDomainMX(email: string): Promise<{ valid: boolean; reason?: string }> {
  const basicCheck = isDisposableOrInvalid(email);
  if (!basicCheck.valid) {
    return basicCheck;
  }

  const domain = email.trim().split('@')[1]?.toLowerCase();
  
  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`;
    
    // Timeout of 3 seconds to keep validation super fast (<150ms normally)
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(url, {
      headers: { 'Accept': 'application/dns-json' },
      signal: controller.signal
    });
    
    clearTimeout(id);

    if (!response.ok) {
      // Fallback on HTTP errors to not block legitimate signups
      console.warn(`[EMAIL_VAL] DNS check returned HTTP status ${response.status}. Falling back to syntax check.`);
      return { valid: true };
    }

    const data = await response.json();
    
    // Status 3 is NXDOMAIN (domain does not exist)
    if (data.Status === 3) {
      return { valid: false, reason: `The email domain "${domain}" does not exist. Please check for spelling mistakes.` };
    }

    // Check if we have an Answer array containing MX records
    const hasMX = !!(data.Answer && data.Answer.length > 0);
    
    if (!hasMX) {
      return { 
        valid: false, 
        reason: `The domain "${domain}" does not have active mail servers configured and cannot receive emails.` 
      };
    }

    return { valid: true };
  } catch (err: any) {
    // If DNS check fails due to network/firewall, fallback gracefully
    console.warn('[EMAIL_VAL] Cloudflare DoH lookup failed or timed out. Falling back to syntax check.', err);
    return { valid: true };
  }
}
