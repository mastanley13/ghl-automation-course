# M06: If They Have a Phone: Text Otherwise Email

**Phase:** 2 (Branching + Guardrails)

## What this means
You will practice: If They Have a Phone: Text Otherwise Email.

## Why this matters
Simple, clear workflows help your team respond fast and avoid mistakes.

## Where this is in HighLevel
- Workflows -> + Add Trigger -> Contact Created
- Workflows -> + Add Action -> Send SMS, Send Email, If/Else

## Practice steps
1) Add the trigger: Contact Created.
2) Add the actions you need: Send SMS, Send Email.
3) Add logic steps if needed: If/Else.
4) Fill required fields (marked with *).
5) Run a test run.

## Allowed steps (mock builder)
### Triggers
- Contact Created
### Actions
- Send SMS
- Send Email
### Logic
- If/Else

## Requirements checklist
- Trigger is Contact Created
- Has at least 1 If/Else step
- Includes Send SMS
- Includes Send Email
- SMS message includes "Welcome"
- Email message includes "Welcome"

## Test run cases
### Contact has phone
Event: Contact Created
Expected outcomes:
- SMS message includes "Welcome"

### Contact has no phone
Event: Contact Created
Expected outcomes:
- Email message includes "Welcome"

## Teach-back prompt
Explain why this workflow uses If/Else and how it prevents a common automation failure.

## Hints
- Hint 1: Use an If/Else step after the trigger with condition: field exists phone.
- Hint 2: Connect both True and Else outputs and leave each branch with no further steps to end it.
- Hint 3: If TC1 fails, check SMS is on the True branch; if TC2 fails, check Email is on Else.

## Admin notes (do not show learners)
### Acceptable variants (should pass)
- Add a tag like log:welcome_sent_sms or log:welcome_sent_email in each branch.
### Common mistakes (what checks should catch)
- Else path not connected.
- Using fieldEquals on phone instead of fieldExists.
- Placing both SMS and Email on the same branch.
