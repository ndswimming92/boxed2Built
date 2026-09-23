import test from 'node:test';
import assert from 'node:assert/strict';

import {
  describeDuration,
  firstName,
  joinList,
  renderCustomerReminder,
  resolveLocation,
  type ReminderBusiness,
  type ReminderJob,
} from '../../supabase/functions/_shared/customerReminderEmail.ts';

const CHICAGO = 'America/Chicago';
/** 5pm Chicago on the 25th — the moment the sweep would mail a job on the 26th. */
const SEND_MOMENT = new Date('2026-09-25T22:00:00Z');

function job(overrides: Partial<ReminderJob> = {}): ReminderJob {
  return {
    id: '3cf26ed0-d8aa-5efe-9ba4-e24ad532ff39',
    client_name: 'Kurt Zollner',
    job_type: 'Furniture Assembly',
    job_description: null,
    date_scheduled: '2026-09-26',
    scheduled_start_time: '11:30',
    scheduled_end_time: '14:00',
    client_address: '2014 Beamon Drive Franklin, TN 37064',
    service_address: null,
    location_city: 'Franklin',
    quoted_price: 285,
    customer_reminder_ics_sequence: 0,
    ...overrides,
  };
}

function business(overrides: Partial<ReminderBusiness> = {}): ReminderBusiness {
  return {
    name: 'Boxed2Built',
    email: 'boxed2builtco@gmail.com',
    phone: '(931) 707-5555',
    phoneHref: '+19317075555',
    timeZone: CHICAGO,
    paymentMethods: ['Cash', 'Card', 'Zelle'],
    ...overrides,
  };
}

function render(j = job(), b = business(), now = SEND_MOMENT) {
  return renderCustomerReminder(j, b, { now, siteUrl: 'https://boxed2built.com' });
}

test('subject names the job type and says tomorrow', () => {
  assert.equal(
    render().subject,
    'Reminder: your Furniture Assembly appointment is tomorrow at 11:30 AM',
  );
});

test('subject falls back to the date when the job is further out', () => {
  const early = new Date('2026-09-20T22:00:00Z');
  assert.equal(
    render(job(), business(), early).subject,
    'Reminder: your Furniture Assembly appointment is Saturday, September 26, 2026 at 11:30 AM',
  );
});

test('a same-day send says today, not tomorrow', () => {
  // 8am Chicago on the 26th, for an 11:30am job the same day.
  const sameDay = new Date('2026-09-26T13:00:00Z');
  assert.match(render(job(), business(), sameDay).subject, /is today at 11:30 AM$/);
  assert.match(render(job(), business(), sameDay).html, /See you today at 11:30 AM/);
});

test('the arrival time is the banner, and it is the exact start time', () => {
  const { html } = render();
  assert.match(html, /I&#39;ll arrive at/);
  assert.match(html, /font-size:30px;font-weight:700;line-height:1.2;">11:30 AM</);
  assert.match(html, /Tomorrow &middot; about 2 hours 30 minutes/);
});

test('the address is shown for confirmation in both bodies', () => {
  const { html, text } = render();
  assert.match(html, /Please confirm the address/);
  assert.match(html, /2014 Beamon Drive Franklin, TN 37064/);
  assert.match(text, /Please double-check that address/);
});

test('the prep checklist is job-type aware and always has the universal items', () => {
  const { html, text } = render();
  assert.match(html, /Move the boxes into the room where the furniture will live/);
  assert.match(text, /- Secure any pets/);

  const tv = render(job({ job_type: 'TV Mounting' }));
  assert.match(tv.html, /Have everything being mounted/);
  assert.match(tv.html, /soundbar/);
  assert.doesNotMatch(tv.html, /Move the boxes/);

  // An unrecognised type still gets access, pets, and a decision-maker.
  const odd = render(job({ job_type: 'Trampoline Setup' }));
  assert.match(odd.html, /someone 18 or older is home/);
  assert.match(odd.html, /Secure any pets/);
});

test('estimate and payment methods appear when both are known', () => {
  const { html, text } = render();
  assert.match(html, /Your estimate is <strong>\$285\.00<\/strong>/);
  assert.match(html, /I accept <strong>Cash, Card, and Zelle<\/strong>/);
  assert.match(text, /Estimate: \$285\.00/);
  assert.match(text, /I accept Cash, Card, and Zelle\./);
  assert.match(html, /no surprise charges/);
});

test('the money block disappears entirely when there is no quote or method', () => {
  const { html, text } = render(job({ quoted_price: null }), business({ paymentMethods: [] }));
  assert.doesNotMatch(html, /Estimate &amp; payment/);
  assert.doesNotMatch(html, /\$/);
  assert.doesNotMatch(text, /Estimate:/);
  assert.doesNotMatch(text, /I accept/);
});

test('a job with no start time promises a time rather than inventing one', () => {
  const { html, subject } = render(job({ scheduled_start_time: null, scheduled_end_time: null }));
  assert.equal(subject, 'Reminder: your Furniture Assembly appointment is tomorrow');
  assert.match(html, /I will confirm a time with you before the day/);
  assert.doesNotMatch(html, /Arriving/);
});

test('the phone is a tel: link when present and gone when not', () => {
  assert.match(render().html, /href="tel:\+19317075555"/);

  const noPhone = render(job(), business({ phone: null, phoneHref: null }));
  assert.match(noPhone.html, /Just reply to this email and it comes straight to me/);
  assert.doesNotMatch(noPhone.html, /tel:/);
  assert.doesNotMatch(noPhone.text, /call/);
});

test('customer content never leaks the internal email vocabulary', () => {
  const { html, text, ics } = render();
  for (const body of [html, text, ics]) {
    assert.doesNotMatch(body, /Leave by/i);
    assert.doesNotMatch(body, /admin/i);
    assert.doesNotMatch(body, /Quoted/);
  }
  // Pricing is for the customer's own email, but never for a calendar entry
  // they might share.
  assert.doesNotMatch(ics, /285/);
});

test('hostile field values cannot break out into markup', () => {
  const nasty = render(
    job({
      client_name: '<script>alert(1)</script> Evil',
      job_description: 'Sofa & "chair" <b>set</b>',
      client_address: "12 O'Brien St <hr>",
    }),
  );
  assert.doesNotMatch(nasty.html, /<script>/);
  assert.doesNotMatch(nasty.html, /<hr>/);
  assert.match(nasty.html, /&lt;script&gt;/);
  assert.match(nasty.html, /Sofa &amp; &quot;chair&quot;/);
});

test('the calendar attachment is the customer copy, timed and de-duplicating', () => {
  const { ics } = render();
  assert.match(ics, /UID:job-3cf26ed0-d8aa-5efe-9ba4-e24ad532ff39-customer@boxed2built\.com/);
  // A resend supersedes rather than duplicates.
  assert.match(ics, /SEQUENCE:1/);
  assert.match(render(job({ customer_reminder_ics_sequence: 4 })).ics, /SEQUENCE:5/);
  assert.match(ics, /SUMMARY:Boxed2Built — Furniture Assembly/);
  // 11:30 AM Chicago is 16:30 UTC, and the writer emits timed stamps in UTC.
  assert.match(ics, /DTSTART:20260926T163000Z/);
  assert.match(ics, /TRIGGER;RELATED=START:-PT2H/);
});

test('an all-day job gets a morning alarm, not one at 10pm the night before', () => {
  const { ics } = render(job({ scheduled_start_time: null, scheduled_end_time: null }));
  assert.match(ics, /TRIGGER;RELATED=START:PT8H/);
  assert.doesNotMatch(ics, /-PT2H/);
});

test('the service address wins over the client address', () => {
  assert.equal(
    resolveLocation(job({ service_address: '99 Jobsite Rd\nFranklin, TN' })),
    '99 Jobsite Rd, Franklin, TN',
  );
  // Falls back to the city when there is no street address at all.
  assert.equal(resolveLocation(job({ client_address: null, service_address: null })), 'Franklin');
});

test('small helpers behave at their edges', () => {
  assert.equal(firstName('Kurt Zollner'), 'Kurt');
  assert.equal(firstName('   '), 'there');
  assert.equal(joinList([]), '');
  assert.equal(joinList(['Cash']), 'Cash');
  assert.equal(joinList(['Cash', 'Card']), 'Cash and Card');
  assert.equal(describeDuration(job({ scheduled_end_time: '12:00' })), 'about 30 minutes');
  assert.equal(describeDuration(job({ scheduled_end_time: '13:30' })), 'about 2 hours');
  // An end that is not after the start is not a duration.
  assert.equal(describeDuration(job({ scheduled_end_time: '11:00' })), null);
  assert.equal(describeDuration(job({ scheduled_end_time: null })), null);
});
