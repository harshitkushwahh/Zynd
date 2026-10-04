-- Multiplus Risk Profiler Question Bank V4
-- MySQL script for database: multiplus_db
--
-- Tables: risk_profile_manual_question_category, risk_profile_manual_questions,
--         risk_profile_manual_question_options, risk_profile_manual_assessment_templates,
--         risk_profile_manual_template_ratios
--
-- Run the WHOLE file (MySQL Workbench: Execute SQL Script), not one statement.
-- Safe to run again. It replaces questions for these 10 category codes.
-- Other categories are set inactive so they do not pull the score toward neutral.
-- The V4 template is the default. Auto-select on older templates is turned off.
-- Weights are the sheet Original-row weightages. They sum to 1.0000.
-- Each category has 4 wordings. The template asks 1, and the app shuffles which wording is shown.
-- Option scores stay 0, 33, 67, 100 with score_scale 100.
-- One assessment then lands on Secure, Conservative, Moderate, Growth, or Aggressive.

USE multiplus_db;

SET @admin_id := (
  SELECT id FROM rbac_users WHERE is_active = 1 ORDER BY id ASC LIMIT 1
);

START TRANSACTION;

-- Re-run cleanup for these 10 codes only.
DELETE sa FROM risk_profile_manual_session_answers sa
INNER JOIN risk_profile_manual_questions q ON q.id = sa.question_id
INNER JOIN risk_profile_manual_question_category c ON c.id = q.category_id
WHERE c.code IN ('INVESTMENT_GOAL', 'TARGET_REACH', 'GOAL_PRIORITY', 'TIME_HORIZON', 'EMERGENCY_RESERVE', 'LOAN_BURDEN', 'DEPENDENTS', 'MARKET_REACTION', 'PAST_BEHAVIOUR', 'LOSS_LIMIT');

DELETE sq FROM risk_profile_manual_session_questions sq
INNER JOIN risk_profile_manual_questions q ON q.id = sq.question_id
INNER JOIN risk_profile_manual_question_category c ON c.id = q.category_id
WHERE c.code IN ('INVESTMENT_GOAL', 'TARGET_REACH', 'GOAL_PRIORITY', 'TIME_HORIZON', 'EMERGENCY_RESERVE', 'LOAN_BURDEN', 'DEPENDENTS', 'MARKET_REACTION', 'PAST_BEHAVIOUR', 'LOSS_LIMIT');

DELETE o FROM risk_profile_manual_question_options o
INNER JOIN risk_profile_manual_questions q ON q.id = o.question_id
INNER JOIN risk_profile_manual_question_category c ON c.id = q.category_id
WHERE c.code IN ('INVESTMENT_GOAL', 'TARGET_REACH', 'GOAL_PRIORITY', 'TIME_HORIZON', 'EMERGENCY_RESERVE', 'LOAN_BURDEN', 'DEPENDENTS', 'MARKET_REACTION', 'PAST_BEHAVIOUR', 'LOSS_LIMIT');

DELETE q FROM risk_profile_manual_questions q
INNER JOIN risk_profile_manual_question_category c ON c.id = q.category_id
WHERE c.code IN ('INVESTMENT_GOAL', 'TARGET_REACH', 'GOAL_PRIORITY', 'TIME_HORIZON', 'EMERGENCY_RESERVE', 'LOAN_BURDEN', 'DEPENDENTS', 'MARKET_REACTION', 'PAST_BEHAVIOUR', 'LOSS_LIMIT');

INSERT INTO risk_profile_manual_question_category
  (code, name, description, composite_weight, is_active)
VALUES
  ('INVESTMENT_GOAL', 'Investment goal', 'What the investor wants this money to do: protect it, earn income, balance growth, or maximise growth.', 0.1166, 1),
  ('TARGET_REACH', 'Target reach', 'Whether low-risk returns such as bank deposits are enough to hit the target amount and date.', 0.1333, 1),
  ('GOAL_PRIORITY', 'Goal priority', 'How essential the goal is, and how much the amount or date can move.', 0.0834, 1),
  ('TIME_HORIZON', 'Time horizon', 'When the investor needs to start using this money.', 0.1000, 1),
  ('EMERGENCY_RESERVE', 'Emergency reserve', 'How long usual expenses can be covered from money that can be accessed immediately.', 0.0833, 1),
  ('LOAN_BURDEN', 'Loan burden', 'Share of monthly income already committed to loan EMIs.', 0.0833, 1),
  ('DEPENDENTS', 'Dependents', 'How many people rely on this income.', 0.0667, 1),
  ('MARKET_REACTION', 'Market reaction', 'What the investor would do if the portfolio fell sharply.', 0.1167, 1),
  ('PAST_BEHAVIOUR', 'Past behaviour', 'Whether they have previously sold or stopped a SIP because markets were falling.', 0.1167, 1),
  ('LOSS_LIMIT', 'Loss limit', 'How large a fall they will accept before moving the money to safety.', 0.1000, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  composite_weight = VALUES(composite_weight),
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP;

UPDATE risk_profile_manual_question_category
SET is_active = 0
WHERE code NOT IN ('INVESTMENT_GOAL', 'TARGET_REACH', 'GOAL_PRIORITY', 'TIME_HORIZON', 'EMERGENCY_RESERVE', 'LOAN_BURDEN', 'DEPENDENTS', 'MARKET_REACTION', 'PAST_BEHAVIOUR', 'LOSS_LIMIT');

-- A1 Investment goal
INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'What is your primary investment goal?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'INVESTMENT_GOAL';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Capital preservation', 0, 1),
  (@question_id, 'Steady income with low risk', 33, 1),
  (@question_id, 'Balanced growth and income', 67, 1),
  (@question_id, 'Maximum long-term wealth growth', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'Which of these investment outcomes would you be happiest with?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'INVESTMENT_GOAL';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'My money is safe and has not fallen in value', 0, 1),
  (@question_id, 'My money has earned a steady and predictable return', 33, 1),
  (@question_id, 'My money has grown reasonably well, with some ups and downs', 67, 1),
  (@question_id, 'My money has grown as much as possible, even if the ride was bumpy', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'Which word best describes your expectation from your investments?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'INVESTMENT_GOAL';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Safety - protect what I have', 0, 1),
  (@question_id, 'Income - a steady payout', 33, 1),
  (@question_id, 'Balance - some growth, some stability', 67, 1),
  (@question_id, 'Growth - build the largest amount possible', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'Which of the  following statements best describes what you want from your investments?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'INVESTMENT_GOAL';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'I would rather earn less than see my money fall in value', 0, 1),
  (@question_id, 'I want regular income more than growth', 33, 1),
  (@question_id, 'I want a mix of growth and stability', 67, 1),
  (@question_id, 'I want the highest possible growth and I accept the ups and downs', 100, 1);

-- A2 Target reach
INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'If you kept your saving in a bank deposit or similar low-risk product, would you reach the amount you are targeting?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'TARGET_REACH';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Comfortably & will exceed my target', 0, 1),
  (@question_id, 'Just reach my target', 33, 1),
  (@question_id, 'I would get close to my target but not reach it.', 67, 1),
  (@question_id, 'I would fall well short of my target', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'If you saved only in safe products like bank deposits, when would you reach your target amount?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'TARGET_REACH';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Before the date I need it', 0, 1),
  (@question_id, 'Right around the date I need it', 33, 1),
  (@question_id, 'A few years later than I need it', 67, 1),
  (@question_id, 'I would not reach it at all', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'How much do you need your investments to grow in order to reach your target?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'TARGET_REACH';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Bank FD rates are enough to reach  my target savings', 0, 1),
  (@question_id, 'Little more than Bank FD rates will be required to reach my target', 33, 1),
  (@question_id, 'A fair amount above Bank FD rates required to achieve my target', 67, 1),
  (@question_id, 'A great deal above Bank FD rates required - safe returns will not get me to my target', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'When you think about your target savings amount, which is true?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'TARGET_REACH';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Investing my savings in Bank fixed deposits will get me to my target comfortably', 0, 1),
  (@question_id, 'Investing in Bank fixed deposits will help me just about reach my target', 33, 1),
  (@question_id, 'Investing in Bank fixed deposits will only help me reach close to my target but not achieve it. There will be a gap I need to close.', 67, 1),
  (@question_id, 'Investing in Bank fixed deposits will not only help me reach my target. There will be a large gap and my money needs to work much harder.', 100, 1);

-- A3 Goal priority
INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'How would you describe your savings goal?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'GOAL_PRIORITY';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Essential - it must be met in full and on time', 0, 1),
  (@question_id, 'Important - a shortfall would hurt but could be managed', 33, 1),
  (@question_id, 'Desirable - I could delay it or scale it back', 67, 1),
  (@question_id, 'Aspirational - no fixed target or date', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'What would happen if you did not reach your savings goal on time?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'GOAL_PRIORITY';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'It would be a serious problem I could not manage', 0, 1),
  (@question_id, 'It would hurt, but I would find a way around it', 33, 1),
  (@question_id, 'It would be disappointing but manageable', 67, 1),
  (@question_id, 'It would not really matter - there is no fixed deadline', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'How much flexibility do you have on this goal amount and date of achieving it?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'GOAL_PRIORITY';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'None - both the amount and the date are fixed', 0, 1),
  (@question_id, 'Very little flexibility', 33, 1),
  (@question_id, 'Some flexibility - I could delay it or reduce the amount', 67, 1),
  (@question_id, 'Complete flexibility - nothing is fixed', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'If you were short on money supply, where would this goal sit in your priorities?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'GOAL_PRIORITY';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'I would fund it before anything else', 0, 1),
  (@question_id, 'It would be a high priority', 33, 1),
  (@question_id, 'I would fund it after my more important goals', 67, 1),
  (@question_id, 'I would pause funding this goal,  without much concern', 100, 1);

-- A4 Time horizon
INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'When will you need to start using this money?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'TIME_HORIZON';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Within 1 year', 0, 1),
  (@question_id, '1 to 3 years', 33, 1),
  (@question_id, '3 to 7 years', 67, 1),
  (@question_id, 'More than 7 years', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'How long can you leave this money invested without touching it?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'TIME_HORIZON';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Less than a year', 0, 1),
  (@question_id, '1 to 3 years', 33, 1),
  (@question_id, '3 to 7 years', 67, 1),
  (@question_id, 'More than 7 years', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'When do you expect to make your first withdrawal from this investment?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'TIME_HORIZON';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Within the next 12 months', 0, 1),
  (@question_id, 'In 1 to 3 years', 33, 1),
  (@question_id, 'In 3 to 7 years', 67, 1),
  (@question_id, 'Not for at least 7 years', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'By when should this money be fully available to you for usage?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'TIME_HORIZON';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Within a year', 0, 1),
  (@question_id, 'In 1 to 3 years', 33, 1),
  (@question_id, 'In 3 to 7 years', 67, 1),
  (@question_id, 'No fixed date - more than 7 years away', 100, 1);

-- A5 Emergency reserve
INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'How many months of expenses do you have saved as an emergency fund?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'EMERGENCY_RESERVE';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Less than 3 months', 0, 1),
  (@question_id, '3 to 6 months', 33, 1),
  (@question_id, '7 to 12 months', 67, 1),
  (@question_id, 'More than 12 months', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'If your income stopped today, how long could you cover your usual expenses from savings that you can access immediately?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'EMERGENCY_RESERVE';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Less than 3 months', 0, 1),
  (@question_id, '3 to 6 months', 33, 1),
  (@question_id, '7 to 12 months', 67, 1),
  (@question_id, 'More than 12 months', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'How much do you keep aside in cash or in a savings account for emergencies?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'EMERGENCY_RESERVE';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Little or nothing set aside', 0, 1),
  (@question_id, 'About 3 to 6 months of expenses', 33, 1),
  (@question_id, 'About 7 to 12 months of expenses', 67, 1),
  (@question_id, 'More than a year''s expenses', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'If an unexpected large expense came up, how would you meet it?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'EMERGENCY_RESERVE';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'I would have to borrow or sell investments', 0, 1),
  (@question_id, 'I have some set aside, but it would be tight', 33, 1),
  (@question_id, 'I have a comfortable reserve for exactly this', 67, 1),
  (@question_id, 'I keep a very large cash reserve, well beyond what I expect to need', 100, 1);

-- A6 Loan burden
INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'What share of your monthly income goes towards loan EMIs?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'LOAN_BURDEN';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'More than 40%', 0, 1),
  (@question_id, '20% to 40%', 33, 1),
  (@question_id, 'Under 20%', 67, 1),
  (@question_id, 'None', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'Out of every Rs 100 you earn each month, how much goes to loan repayments?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'LOAN_BURDEN';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'More than Rs 40', 0, 1),
  (@question_id, 'Rs 20 to Rs 40', 33, 1),
  (@question_id, 'Less than Rs 20', 67, 1),
  (@question_id, 'Nothing - I have no loans', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'How would you describe your current loan repayments?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'LOAN_BURDEN';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'EMI payments take up more than 40% of my monthly income', 0, 1),
  (@question_id, 'EMI payments take up 20 to 40% of my monthly income', 33, 1),
  (@question_id, 'EMI payments take up less than 20% of my monthly income', 67, 1),
  (@question_id, 'I have no loans', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'What portion of your monthly income you cannot spend since you have to fulfil your EMI commitments?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'LOAN_BURDEN';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Over 40% of my monthly income I need to set aside for EMI payments', 0, 1),
  (@question_id, 'I set aside 20% to 40% of my monthly income for EMI payments', 33, 1),
  (@question_id, 'I set aside less than 20% of my monthly income for EMI payments', 67, 1),
  (@question_id, 'I have no EMIs to pay', 100, 1);

-- A7 Dependents
INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'How many people depend on your income financially?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'DEPENDENTS';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Four or more', 0, 1),
  (@question_id, 'Two or three', 33, 1),
  (@question_id, 'One', 67, 1),
  (@question_id, 'None', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'In your household, who is responsible for meeting the monthly expenses?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'DEPENDENTS';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'I am the only earner and several people depend on me', 0, 1),
  (@question_id, 'I am the main earner, with some support from another member', 33, 1),
  (@question_id, 'There is another earner and we share the expenses roughly equally', 67, 1),
  (@question_id, 'I am responsible only for myself', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'If your income stopped, how many people, besides you, would be affected financially?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'DEPENDENTS';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Four or more', 0, 1),
  (@question_id, 'Two or three', 33, 1),
  (@question_id, 'One', 67, 1),
  (@question_id, 'No one', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'Which of these best describes your family responsibilities?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'DEPENDENTS';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'I need to take care of my children, spouse and my dependent parents (four or more people)', 0, 1),
  (@question_id, 'I need to take care of my spouse and my children (two or three people)', 33, 1),
  (@question_id, 'I need to take are of one other person, such as a spouse or a parent', 67, 1),
  (@question_id, 'No one - I support only myself', 100, 1);

-- A8 Market reaction
INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'How would you react if your investment portfolio dropped by 20% in a single month?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'MARKET_REACTION';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'I will panic and would prefer to sell and accept the loss rather than risk further losses', 0, 1),
  (@question_id, 'I will take the risk on some investments and wait to see what happens, while moving some money to safer investments', 33, 1),
  (@question_id, 'I will feel uncomfortable, but I will stay invested and continue with my existing SIPs', 67, 1),
  (@question_id, 'I will stay invested and invest more by buying more units while prices are low', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'Your investment falls sharply soon after you invest. What course of action would you take?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'MARKET_REACTION';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Sell everything and move to safety before it falls further', 0, 1),
  (@question_id, 'Sell part of it and shift that money somewhere safer', 33, 1),
  (@question_id, 'Stay invested and keep my SIPs going, even though it is unsettling', 67, 1),
  (@question_id, 'Stay invested and add more while prices are down', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'Markets have fallen for three months in a row and your investment is now worth about a fifth less than you put in. What would you do?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'MARKET_REACTION';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Sell everything and stop the losses', 0, 1),
  (@question_id, 'Sell a part and move it to safer options', 33, 1),
  (@question_id, 'Stay invested and wait for it to recover', 67, 1),
  (@question_id, 'Stay invested and put in more at these lower prices', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'If you have a portfolio of Rs 10,00,000 & it fell by Rs 2,00,000  in one month, how would you respond?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'MARKET_REACTION';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Sell and take the loss rather than risk more', 0, 1),
  (@question_id, 'Move part of the money to safer options', 33, 1),
  (@question_id, 'Hold on and continue investing as planned', 67, 1),
  (@question_id, 'Invest more at the lower prices', 100, 1);

-- A9 Past behaviour
INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'Have you ever exited an investment early due to fear of losses?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'PAST_BEHAVIOUR';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Yes, frequently', 0, 1),
  (@question_id, 'Yes, once or twice', 33, 1),
  (@question_id, 'Rarely', 67, 1),
  (@question_id, 'Never', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'Looking back, how often have you sold an investment because you were worried about losing money?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'PAST_BEHAVIOUR';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Many times', 0, 1),
  (@question_id, 'Once or twice', 33, 1),
  (@question_id, 'Almost never', 67, 1),
  (@question_id, 'Never', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'When markets have fallen in the past, what have you usually done with your investments?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'PAST_BEHAVIOUR';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Sold out most times', 0, 1),
  (@question_id, 'Sold on one or two occasions', 33, 1),
  (@question_id, 'Held on nearly every time', 67, 1),
  (@question_id, 'Always held on, and sometimes added more', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'Have you ever stopped or withdrawn a SIP because markets were falling?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'PAST_BEHAVIOUR';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'Yes, more than once', 0, 1),
  (@question_id, 'Yes, once', 33, 1),
  (@question_id, 'No, though I have thought about it', 67, 1),
  (@question_id, 'No, never', 100, 1);

-- A10 Loss limit
INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'Suppose you had invested Rs 10,00,000 and, within a few months, its value had fallen. At what point would you stop and move the remainder to safety?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'LOSS_LIMIT';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'At Rs 9,50,000 (a fall of 5%)', 0, 1),
  (@question_id, 'At Rs 8,50,000 (a fall of 15%)', 33, 1),
  (@question_id, 'At Rs 7,50,000 (a fall of 25%)', 67, 1),
  (@question_id, 'I would not sell on the fall alone', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'You have invested Rs 1,00,000 over the past year through SIPs. How far could its value fall before you stopped the SIP?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'LOSS_LIMIT';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'To Rs 95,000 (a fall of 5%)', 0, 1),
  (@question_id, 'To Rs 85,000 (a fall of 15%)', 33, 1),
  (@question_id, 'To Rs 75,000 (a fall of 25%)', 67, 1),
  (@question_id, 'I would not stop the SIP because of a fall', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'How large a fall in your investment''s value could you live with before deciding to sell?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'LOSS_LIMIT';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'A fall of about 5%', 0, 1),
  (@question_id, 'A fall of about 15%', 33, 1),
  (@question_id, 'A fall of about 25%', 67, 1),
  (@question_id, 'A fall alone would not make me sell', 100, 1);

INSERT INTO risk_profile_manual_questions
  (category_id, admin_id, question_text, score_scale, is_active, version)
SELECT c.id, @admin_id, 'On an investment of Rs 20,00,000, how much of a unrealized loss could you tolerate before acting on it?', 100, 1, 1
FROM risk_profile_manual_question_category c
WHERE c.code = 'LOSS_LIMIT';
SET @question_id := LAST_INSERT_ID();
INSERT INTO risk_profile_manual_question_options (question_id, option_text, score, is_active)
VALUES
  (@question_id, 'About Rs 1,00,000 (5%)', 0, 1),
  (@question_id, 'About Rs 3,00,000 (15%)', 33, 1),
  (@question_id, 'About Rs 5,00,000 (25%)', 67, 1),
  (@question_id, 'I would not act on a paper loss alone', 100, 1);

INSERT INTO risk_profile_manual_assessment_templates (name, is_active, is_default, auto_select)
SELECT 'V4 Standard assessment', 1, 0, 0 FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM risk_profile_manual_assessment_templates WHERE name = 'V4 Standard assessment'
);

SET @tpl_id := (
  SELECT id FROM risk_profile_manual_assessment_templates
  WHERE name = 'V4 Standard assessment'
  ORDER BY id
  LIMIT 1
);

UPDATE risk_profile_manual_assessment_templates
SET is_active = 1, is_default = 0, auto_select = 0
WHERE id > 0;

UPDATE risk_profile_manual_assessment_templates
SET is_default = 1
WHERE id = @tpl_id;

DELETE FROM risk_profile_manual_template_ratios
WHERE id > 0 AND template_id = @tpl_id;

INSERT INTO risk_profile_manual_template_ratios (template_id, category_id, question_count)
SELECT @tpl_id, c.id, 1
FROM risk_profile_manual_question_category c
WHERE c.code IN ('INVESTMENT_GOAL', 'TARGET_REACH', 'GOAL_PRIORITY', 'TIME_HORIZON', 'EMERGENCY_RESERVE', 'LOAN_BURDEN', 'DEPENDENTS', 'MARKET_REACTION', 'PAST_BEHAVIOUR', 'LOSS_LIMIT');

COMMIT;

-- After commit you should see 10 categories, weight sum 1.0000, 40 questions, 160 options, template count 10.
-- SELECT code, name, composite_weight, is_active FROM risk_profile_manual_question_category ORDER BY is_active DESC, code;
-- SELECT ROUND(SUM(composite_weight), 4) FROM risk_profile_manual_question_category WHERE is_active = 1;
-- SELECT COUNT(*) FROM risk_profile_manual_questions q JOIN risk_profile_manual_question_category c ON c.id = q.category_id WHERE c.code IN ('INVESTMENT_GOAL', 'TARGET_REACH', 'GOAL_PRIORITY', 'TIME_HORIZON', 'EMERGENCY_RESERVE', 'LOAN_BURDEN', 'DEPENDENTS', 'MARKET_REACTION', 'PAST_BEHAVIOUR', 'LOSS_LIMIT');
