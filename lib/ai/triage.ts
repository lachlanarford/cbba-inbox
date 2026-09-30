import { choice, noul, score } from '@typesafe-ai/sdk'

export const triageQuestions = {
  department: choice(
    'Which single department should handle the enquiry in `enquiry.subject` and `enquiry.content`?',
    {
      Reps: 'Representative basketball, MJL, grading, trials, or rep team enquiries.',
      Comps: 'Domestic competitions, draws, results, registrations, or courts.',
      LTP: 'Learn to Play, Aussie Hoops, junior development, or beginner programs.',
      Referees: 'Referee enquiries, referee registration, referee payments, availability, appointments, or officiating.',
      Other: 'The enquiry does not fit Reps, Comps, LTP, or Referees.',
    },
  ),
  priority: choice(
    'Which single priority fits the enquiry in `enquiry.subject` and `enquiry.content`?',
    {
      urgent: 'Time-sensitive, a complaint, a legal issue, a safety issue, or an event inside 48 hours.',
      high: 'Needs a response within 24 hours, a registration deadline, or a payment issue.',
      medium: 'A general enquiry with a standard turnaround.',
      low: 'Feedback or a non-urgent information request.',
    },
  ),
  safety: noul(
    'Does `enquiry.content` report an injury, a child-safety concern, a threat, or a dangerous facility?',
    {
      true: 'The message describes harm, danger, or a safety incident staff should see immediately.',
      false: 'The message does not describe a safety incident.',
    },
  ),
  complaint: noul(
    'Is the sender complaining about a decision, a person, or how they were treated?',
    {
      true: 'The sender is dissatisfied and wants that treatment or decision addressed.',
      false: 'The sender is asking a question or sharing information without a complaint.',
    },
  ),
  payment: noul(
    'Is the sender reporting a failed payment, a missing payment, or asking for a refund?',
    {
      true: 'Money was charged, missed, or they want it returned.',
      false: 'The message is not about a payment problem or a refund.',
    },
  ),
  soon: noul(
    'Does the enquiry depend on a game, trial, registration, or other event inside the next 48 hours?',
    {
      true: 'A dated commitment in the next two days is the reason they wrote.',
      false: 'Nothing in the message is tied to the next 48 hours.',
    },
  ),
  refund: noul(
    'Is the sender asking for a refund or to cancel an enrolment, registration, or membership?',
    {
      true: 'They want money back or they want to withdraw.',
      false: 'They are not asking for a refund or a cancellation.',
    },
  ),
  missingDetails: noul(
    'Is `enquiry.content` missing a detail staff need before they can act, such as a player name, age group, team, or competition?',
    {
      true: 'A required detail is absent and staff would have to ask for it.',
      false: 'The message already includes what staff need, or no extra detail is required.',
    },
  ),
  frustration: score(
    'How frustrated is the sender in `enquiry.content`?',
    [
      'The sender is calm and is asking a straightforward question.',
      'The sender is impatient or disappointed, but not hostile.',
      'The sender is angry, distressed, or demanding immediate action.',
    ],
  ),
}
