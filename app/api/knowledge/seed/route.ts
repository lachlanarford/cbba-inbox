import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'

const SEED_ENTRIES = [
  {
    title: 'About CBBA',
    category: 'General',
    content: `The City of Blacktown Basketball Association (CBBA) is a not-for-profit incorporated association based in Western Sydney, Australia.
- ABN: 84 635 663 125
- Incorporation Registration Number: INC1901010

Mission: To continuously make basketball accessible and inclusive for all participants, fostering a supportive environment where people of all ages, abilities, and backgrounds can develop their skills.

Vision: To be a leading basketball association in the Sydney Metro area.

Values: Inclusivity, Fairness, Safety, Progression.

Office Hours:
- General: Monday to Friday, 9:00am to 5:00pm
- KBS on-site office (Kevin Betts Stadium, Ralph Pl, Mount Druitt NSW 2770): Tuesday to Thursday, 10:00am to 4:30pm`,
  },
  {
    title: 'Membership - Overview and Fees',
    category: 'Membership',
    content: `All participants in CBBA programs and competitions must hold a valid CBBA Basketball NSW Membership. Membership provides insurance coverage through BNSW.

Registration link: https://registration.basketballconnect.com/userRegistration?organisationId=2db3a0f9-c9eb-4aaf-a5fe-f37b0280d242&competitionId=4242407a-7e66-4523-acfd-01fb04fd423b

PRIMARY 12-MONTH MEMBERSHIP (365 days):
- Junior Under 8: $115
- Junior 8-11 years: $135.50
- Junior 12-17 years: $145.50
- Senior 18+: $145.50
- Other (Coaches, Referees, etc.): $40

PRIMARY 6-MONTH MEMBERSHIP (182 days):
- Junior Under 8: $75
- Junior 8-11 years: $90.50
- Junior 12-17 years: $96.50
- Senior 18+: $96.50
- Other: $26

SECONDARY 12-MONTH MEMBERSHIP:
For players who hold a primary membership with another BNSW-affiliated association (Hills, Penrith, Hawkesbury, Macarthur, etc.). Valid for the equivalent dates of the individual's Primary Membership.
- Juniors Under 12: $65
- Juniors Under 18: $80
- Seniors 18+: $80

SECONDARY 6-MONTH MEMBERSHIP:
- Juniors Under 12: $43
- Juniors Under 18: $52
- Seniors 18+: $52

Note: A Secondary Membership is not valid if the Primary Membership has expired.`,
  },
  {
    title: 'Membership - FAQs',
    category: 'Membership',
    content: `Q: What is a CBBA registration?
Membership acknowledges a participant as a CBBA and BNSW participant and ensures insurance coverage. No person may participate in CBBA/BNSW sanctioned programs or competitions without a valid membership.

Q: How do I check my membership expiry?
Log into Basketball Connect: https://registration.basketballconnect.com/login

Q: Do coaches, referees, and managers need a membership?
Yes. All coaches, assistant coaches, managers, referees, supervisors, and staff must hold a valid registration. Select the 'BNSW - Other' product when registering.

Q: Can I get a refund on my membership?
Refunds are granted only if the participant has NOT participated in any program or competition. All refunds are minus the Basketball Connect processing fee.
BNSW Refund Policy: https://www.bnsw.com.au/about/bnsw-return-and-refunds-policy/

Q: What if I registered with the wrong association?
No refunds are given. Members receive four reminder emails before expiry to renew with the correct association.

Q: What is the Basketball Connect technology fee?
A surcharge reflecting the exact cost of the payment service provider. It includes GST, bank merchant fees, and platform costs.

Q: Can I pause my membership?
From January 2026, members can request a temporary pause via the Basketball Connect app. Primary members: up to 4 weeks. Secondary members: up to 2 weeks. One pause per membership period.
More info: https://www.bnsw.com.au/faq-participant-membership-fees/`,
  },
  {
    title: 'Aussie Hoops - Program Overview',
    category: 'Aussie Hoops',
    content: `Ford Aussie Hoops is a Basketball Australia introductory program for children aged 5-10. CBBA delivers it at two venues each school term.

VENUES AND TIMETABLE (Term 2 2026):

Kevin Betts Stadium, Mt Druitt (1 Ralph Place, Mount Druitt NSW 2770):
- Beginners: Mondays from 5:30pm
- Intermediate: Mondays from 5:30pm
- Train & Play: Fridays from 5:00pm (Training 5:00-6:00pm | 3x3 Game 6:00-6:30pm)

Blacktown Leisure Centre, Stanhope (Sentry Drive, Stanhope Gardens NSW 2768):
- Beginners: Fridays from 5:30pm
- Intermediate: Fridays from 6:30pm
- Train & Play: Fridays from 5:30pm (Training 5:30-6:30pm | 3x3 Game 6:30-7:00pm)

PROGRAM LEVELS:
- Beginner: Ages 5-8. Foundational skills through fun games and drills. No experience needed.
- Intermediate: Ages 7-9 who have completed Beginners. Rules and competition skills.
- Train & Play: Ages 7-9 who have completed Intermediate. Skill building in U8s/U10s competition. Maximum 10 participants per term.

All new participants should start in Beginners. Coaches will assess and move up if appropriate.

FEES (2026):
Beginner and Intermediate:
- New Participant: $175 per term (includes Starter Pack valued at $50)
- Returning Participant: $125 per term

Train & Play:
- New Participant: $312 per term (Training/Pack $207 + Game Fee $105)
- Returning Participant: $262 per term (Training $157 + Game Fee $105)

NSW Active Kids Vouchers accepted.
Programs run 8 weeks per term, 1 hour per session (+30 mins for Train & Play). Register term by term.`,
  },
  {
    title: 'Aussie Hoops - FAQs',
    category: 'Aussie Hoops',
    content: `Q: What experience does my child need?
None for Beginners. Ages 7+ with some experience can register for Intermediate. When in doubt, start in Beginners.

Q: When do programs run each year?
- Term 1: February to April (registrations open January)
- Term 2: May to July (registrations open April)
- Term 3: August to September (registrations open July)
- Term 4: October to December (registrations open September)

Q: What does my child need for their first session?
Ford Aussie Hoops singlet, enclosed running shoes, their Aussie Hoops basketball, and a water bottle. New participants order their singlet and ball at registration.

Q: What if I haven't received the participant pack?
CBBA will lend a basketball for the session. Bring a water bottle, enclosed shoes, and comfortable clothes.

Q: Do returning participants need to buy the pack again?
No. The singlet and basketball from the first registration can be reused each term.

Q: How do I claim my participant pack?
After registering, check for an automated email from Mber+. Check junk/spam if not received. If still missing, visit the link and click 'First time login - Create Password'. Further issues: email learntoplay@blacktownbasketball.com

Q: Who coaches the program?
Accredited CBBA coaches with a NSW Working with Children Check. Programs supervised by experienced Aussie Hoops team leaders.

Q: Does CBBA accept NSW Active Kids Vouchers?
Yes.`,
  },
  {
    title: 'Domestic Competition - 2026 Winter League Overview',
    category: 'Domestic Competition',
    content: `Season: April to September 2026
Start date: Monday 20 April 2026
Finals begin: Week commencing 31 August 2026

No games on:
- 27 April - ANZAC Day Public Holiday
- 8 June - King's Birthday Public Holiday
- 6 July to 17 July - School Holiday Break

Venues:
- Kevin Betts Stadium, Mount Druitt
- Blacktown Leisure Centre, Stanhope

Glory League video technology is being introduced for Winter 2026.

Fixtures and Results: https://registration.basketballconnect.com/livescoreSeasonFixture?organisationKey=2db3a0f9-c9eb-4aaf-a5fe-f37b0280d242&competitionUniqueKey=a9b5f7e2-5daf-4758-998d-0ab2371de940&yearId=8&locked=1

FEES:
Junior Players:
- Team Nomination Fee: $90 per team per competition
- Competition Fee: $222 per person per competition (U8/U10: $111 per term)
- CBBA Membership: separate, required for new or expired members

Senior Players:
- Team Nomination Fee: $120 per team per competition
- Competition Fee: $262 per person per competition
- CBBA Membership: separate, required for new or expired members

A player must have paid competition fees and hold an active CBBA membership before taking the court.

Full rules (uniforms, rosters, rep players, fill-ins): https://www.canva.com/design/DAHBFKiYLp8/q6Wji-9pm48-ykEnrHiiUg/view`,
  },
  {
    title: 'Domestic Competition - 2026 Winter League Schedule by Venue',
    category: 'Domestic Competition',
    content: `KEVIN BETTS STADIUM, MT DRUITT:
- Monday 6:30pm - U18 Boys (born 2009 or later)
- Monday 8:00pm - Open Men's (min. age 16)
- Monday 8:00pm - Masters 35+ (min. age 35)
- Thursday 5:45pm - U16 Boys (born 2011 or later)
- Friday 5:20pm - U12 Girls (born 2015 or later)
- Friday 5:20pm - U12 Boys (born 2015 or later)
- Friday 6:05pm - U10 Mixed (born 2017 or later)
- Friday 6:50pm - U14 Boys (born 2013 or later)

Girls and Women competitions are held at Stanhope.

BLACKTOWN LEISURE CENTRE, STANHOPE:
- Tuesday 6:05pm - U16 Boys (born 2011 or later)
- Tuesday 6:50pm - U18 Boys (born 2009 or later)
- Tuesday 8:25pm - Open Men's (min. age 16)
- Wednesday 6:05pm - U12 Girls (born 2015 or later)
- Wednesday 6:50pm - U14 Girls (born 2013 or later)
- Wednesday 7:35pm - U16 Girls (born 2011 or later)
- Wednesday 8:20pm - U18 Girls (born 2009 or later)
- Wednesday 9:10pm - Open Women's (min. age 16)
- Thursday 6:00pm - U12 Boys (born 2015 or later)
- Thursday 7:30pm - U14 Boys (born 2013 or later)
- Friday 6:30pm - U8 Mixed (born 2019 or later)
- Friday 6:30pm - U10 Mixed (born 2017 or later)`,
  },
  {
    title: 'Domestic Competition - Joining as an Individual Player',
    category: 'Domestic Competition',
    content: `Individual players without a team can submit an Expression of Interest to be matched with clubs or teams.

Individual Player Interest Form: https://form.jotform.com/260078106787867

Submitting populates a table that current team managers can browse. Does not guarantee a spot.

CBBA Clubs: Pitbulls Basketball, Rivals Basketball, Savannah Pride, Sydney Dragons, Sydney Huskies, Embers Basketball, Infinity Warriors, Jaguar Hoops Australia, Joflow Basketball, Phenoms Basketball Academy, Royals Basketball, Tip-Off Basketball, Wollemi Basketball.

Full clubs list: https://www.blacktownbasketball.com/our-clubs`,
  },
  {
    title: 'Policies, Resources and Forms',
    category: 'Policies & Procedures',
    content: `FORMS:
- External Incident Report (non-injury incidents): https://form.jotform.com/252178877834877
- Injury Report Form (injuries only): https://www.bnsw.com.au/about/insurance/
- Exemption Request Form (domestic competition exemptions): https://form.fillout.com/t/nBsbL5WPz6us
- Transfer Request Form (changing clubs or teams): https://form.jotform.com/242681663769875

CBBA POLICIES:
- CBBA Constitution (Jan 2022)
- CBBA Summer League By-Laws (Aug 2025)
- CBBA Winter League By-Laws (Feb 2026)
- CBBA Culture Commitment (Nov 2024)
- CBBA Social Media Policy (Nov 2024)
- CBBA Photography and Videography Policy
- CBBA Return and Refund Policy (May 2024)
- CBBA Branding Guidelines (Nov 2024)

REPRESENTATIVE POLICIES:
- CBBA Representative By-Laws (Nov 2024)
- CBBA Roster Amendment Policy (Mar 2025)

BNSW x CBBA POLICIES:
Zero Tolerance, Players/Spectators/Coaches-Officials Codes of Conduct, Tribunal By-Laws, Member Protection By-Laws, WWCC Policy, Stadium Conditions of Entry, Heat Policy, Concussion Policy, Tribunal Offences and Penalties, Transgender Inclusion Guidelines, BA Privacy Policy.

For all direct document links, visit: https://www.blacktownbasketball.com/policies-resources-forms`,
  },
  {
    title: 'Contact and General Information',
    category: 'General',
    content: `General Office: Monday to Friday, 9:00am to 5:00pm

KBS On-Site Office:
Kevin Betts Stadium (KBS), 1 Ralph Place, Mount Druitt NSW 2770
Tuesday to Thursday, 10:00am to 4:30pm

Contact page: https://www.blacktownbasketball.com/contact-us
Website: https://www.blacktownbasketball.com
Aussie Hoops email: learntoplay@blacktownbasketball.com

Social Media:
- Instagram: http://instagram.com/blacktownstormbasketball
- Facebook: http://facebook.com/blacktownbasketballassociation
- YouTube: https://www.youtube.com/@blacktownstormbasketball
- TikTok: https://www.tiktok.com/@blacktownstormbasketball
- LinkedIn: https://au.linkedin.com/company/blacktownbasketball`,
  },
]

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!appUser || !isAdmin(appUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()
  const results: { title: string; status: 'inserted' | 'skipped' | 'error'; error?: string }[] = []

  for (const entry of SEED_ENTRIES) {
    // Check if an entry with this title already exists (idempotent)
    const { data: existing } = await service
      .from('knowledge_base')
      .select('id')
      .eq('title', entry.title)
      .eq('source_type', 'manual')
      .maybeSingle()

    if (existing) {
      results.push({ title: entry.title, status: 'skipped' })
      continue
    }

    const { data: inserted, error: insertErr } = await service
      .from('knowledge_base')
      .insert({ title: entry.title, content: entry.content, source_type: 'manual' })
      .select('id')
      .single()

    if (insertErr || !inserted) {
      results.push({ title: entry.title, status: 'error', error: insertErr?.message })
      continue
    }

    // @ts-expect-error category/created_by not yet in generated types
    await service.from('knowledge_base').update({ created_by: user.id, category: entry.category }).eq('id', (inserted as { id: string }).id)
    results.push({ title: entry.title, status: 'inserted' })
  }

  const inserted = results.filter((r) => r.status === 'inserted').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  const errors = results.filter((r) => r.status === 'error').length

  return NextResponse.json({ inserted, skipped, errors, results })
}
