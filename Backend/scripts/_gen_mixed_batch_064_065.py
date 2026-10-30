#!/usr/bin/env python3
"""Generate batch-064.jsonl and batch-065.jsonl — 100 curated rows each, corpus-deduped."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parents[1]
TRAINING = ROOT / "data" / "help-bot-training"
OUT_064 = TRAINING / "batch-064.jsonl"
OUT_065 = TRAINING / "batch-065.jsonl"

# (topics, question, context_fields, solution, escalate_if_missing)
Entry = tuple[list[str], str, list[str], str, Optional[str]]

BATCH_064: list[Entry] = [
    (["kyc"], "digilocker beech me band ho gaya dubara kholna padega kya", ["kyc.steps.digilocker"], "Use digilocker step status; retry Complete KYC if incomplete.", None),
    (["kyc"], "pan verify ho gaya ya abhi bhi pending dikhega dashboard pe", ["kyc.steps.pan", "kyc.pan_verification_status"], "Quote pan step and pan_verification_status only.", None),
    (["kyc"], "bank account mismatch error aa raha kyc me kya karu", ["kyc.steps.bank", "kyc.bank_verification_status"], "Explain bank step; retry bank verification in app.", None),
    (["kyc"], "nominee wala step submit hua ki nahi check kar do", ["kyc.steps.nominee"], "Answer from nominee step status in context.", None),
    (["kyc"], "kyc complete hai phir bhi invest button grey kyu hai", ["kyc.overall_status", "kyc.readiness_code"], "overall_status plus readiness_code; no invented approval.", None),
    (["kyc"], "signature upload blur error aa raha clearer photo chahiye kya", ["kyc.steps.signature"], "Signature step guidance from context.", None),
    (["kyc"], "personal details page pe stuck hoon aage nahi badh raha", ["kyc.steps.personal", "kyc.readiness_reason"], "Personal step and readiness_reason if present.", None),
    (["kyc"], "review submit ke baad kitna time approval me lagta hai", ["kyc.overall_status", "kyc.status_last_updated_at"], "If submitted say under review; use status timestamps only.", None),
    (["kyc"], "already registered with another broker message aa raha hai", ["kyc.kyc_already_registered", "kyc.external_kyc_status"], "Only quote kyc_already_registered and external_kyc_status.", None),
    (["kyc"], "address proof aur aadhaar match nahi kar rahe kya issue hai", ["kyc.steps.address", "kyc.steps.digilocker"], "Compare address and digilocker step statuses.", None),
    (["payment"], "aaj subah wala sip debit fail hogya upi se reason kya tha", ["payments.last_sip_failure.failure_reason", "payments.last_sip_failure.failed_at"], "Quote last SIP failure reason and time from context.", None),
    (["payment"], "last sip kitne ka kata tha exact amount batao", ["payments.last_sip_debit.amount", "payments.last_sip_debit.status"], "Use last_sip_debit amount and status only.", None),
    (["payment"], "next sip kab cut hogi calendar me date chahiye", ["payments.sip_plans.next_installment_date", "payments.sip_plans.frequency"], "Next installment date and frequency from sip_plans.", None),
    (["payment"], "mera monthly sip active hai ya pause ho gaya", ["payments.sip_plans.status"], "SIP plan status from context; do not invent.", None),
    (["payment"], "lumpsum payment success dikha par order pending kyu hai", ["payments.recent_orders", "payments.recent_orders.failure_reason"], "Recent order status and failure_reason if any.", None),
    (["payment"], "mandate reject ho gaya bank ne sip dubara kaise start karu", ["payments.failed_sip_plans", "payments.sip_plans.status"], "Failed SIP plans and active plan status from context.", None),
    (["payment"], "netbanking se pay kiya par app me failed dikha raha", ["payments.recent_orders", "payments.recent_orders.failure_reason"], "Explain from recent_orders; no guessed bank delay.", None),
    (["payment"], "daily sip chalu hai kya mere account me", ["payments.sip_plans.frequency", "payments.sip_plans.status"], "SIP frequency and status from sip_plans slice.", None),
    (["payment"], "cart me do funds the payment ek saath kaise hogi", ["payments.recent_orders"], "Cart checkout path; cite recent cart-related orders if in context.", None),
    (["payment"], "sip amount badalna hai settings se hota hai ya naya sip", ["payments.sip_plans.amount", "payments.sip_plans.status"], "Current SIP amount from context; explain modify vs new SIP in app.", None),
    (["portfolio"], "portfolio value aaj subah se kam kyu dikh rahi hai", ["portfolio.current_value", "portfolio.total_return"], "Quote current_value and total_return; market movement wording only.", None),
    (["portfolio"], "total invested kitna hai mujhe exact number chahiye", ["portfolio.invested"], "Use portfolio.invested from context only.", None),
    (["portfolio"], "holdings count kitni funds dikh rahe abhi", ["portfolio.holdings_count"], "Quote holdings_count.", None),
    (["portfolio"], "payment ho gaya par holdings me unit nahi aaye abhi tak", ["portfolio.has_pending_orders", "payments.recent_orders"], "has_pending_orders plus recent order settlement status.", None),
    (["portfolio"], "porfolio refresh kar raha hoon phir bhi purana data", ["portfolio.status", "portfolio.as_on"], "Portfolio status and as_on timestamp from context.", None),
    (["portfolio"], "active sips kitne chal rahe portfolio summary me", ["portfolio.active_sips_count", "portfolio.monthly_sip"], "active_sips_count and monthly_sip totals.", None),
    (["portfolio"], "gain loss green red sahi nahi lag raha explain karo", ["portfolio.total_return", "portfolio.invested"], "total_return vs invested; no performance promises.", None),
    (["portfolio"], "external cas import ke baad value double dikh rahi fix kaise", ["portfolio.current_value", "portfolio.holdings_count"], "Use portfolio fields; suggest refresh path without inventing holdings.", None),
    (["portfolio"], "as on date portfolio ka kab ka data hai", ["portfolio.as_on"], "Quote portfolio.as_on only.", None),
    (["portfolio"], "monthly sip total portfolio card pe sahi hai kya", ["portfolio.monthly_sip", "payments.sip_plans.amount"], "Compare monthly_sip with sip plan amounts in context.", None),
    (["referrals"], "referral link share kiya par signup count badha nahi kyu", ["referrals.signup_count", "referrals.click_count"], "click_count vs signup_count from referrals slice.", None),
    (["referrals"], "friends ne kyc complete kiya kitne referral ab verified", ["referrals.kyc_verified_count", "referrals.signup_count"], "kyc_verified_count relative to signup_count.", None),
    (["referrals"], "refer and earn me invest karne wale kitne log hue", ["referrals.first_investment_count"], "Quote first_investment_count only.", None),
    (["referrals"], "mera invite code generate nahi ho raha dashboard pe", ["referrals.has_code"], "Answer from referrals.has_code.", "Referrals slice missing; guide to Dashboard → Referrals without inventing counts."),
    (["referrals"], "referral clicks zyada hain par signups kam normal hai kya", ["referrals.click_count", "referrals.signup_count"], "Both counts from context; explain funnel in plain language.", None),
    (["goals"], "mera retirement goal kitne percent complete hai abhi", ["goals.goals.progress_pct", "goals.goals.title"], "Goal progress_pct and title from goals list.", None),
    (["goals"], "goal target amount aur ab tak kitna bachaya compare karo", ["goals.goals.target_amount", "goals.goals.current_amount"], "target_amount and current_amount from same goal row.", None),
    (["goals"], "goal ki deadline kab hai calendar date batao", ["goals.goals.target_date", "goals.goals.status"], "target_date and goal status from context.", None),
    (["goals"], "naya goal banaya par progress zero kyu dikha raha", ["goals.goals.progress_pct", "goals.goals.status"], "New goal progress from context; link funding in app if zero.", None),
    (["goals"], "sip goal se unlink karna hai steps batao", ["goals.goals", "payments.sip_plans"], "List goals and SIP plans; explain unlink in Goals settings.", None),
    (["family"], "family group me main head hoon ya member role kya hai", ["family_groups.groups.my_role"], "Quote my_role from family group context.", None),
    (["family"], "family group me total kitne members hain abhi", ["family_groups.groups.member_count"], "member_count from family_groups.", None),
    (["family"], "family invite accept nahi ho raha pending kyu dikha raha", ["family_groups.groups.status"], "Group status from context; invite troubleshooting in app.", None),
    (["family"], "family group ka naam change kar sakte hain kya", ["family_groups.groups.title", "family_groups.groups.my_role"], "title and role; head-only actions per playbook.", None),
    (["family"], "wife ko family me add kiya par portfolio share nahi dikh raha", ["family_groups.groups", "family_groups.groups.status"], "Family group availability and status from context.", None),
    (["account"], "mera email verify hua hai ya abhi pending hai", ["account.email_verified", "account.email_verified_at"], "email_verified flag and verified_at if true.", None),
    (["account"], "phone otp ke liye number verified hai confirm karo", ["account.phone_verified", "account.phone_verified_at"], "phone_verified and phone_verified_at only.", None),
    (["account"], "google se login hai apple bhi link kar sakta hoon kya", ["account.google_account_linked", "account.apple_account_linked"], "Linked provider flags from account slice.", None),
    (["account"], "mfa on hai kya security settings me check karo", ["account.mfa_enrolled"], "mfa_enrolled boolean from context.", None),
    (["account"], "password login enable hai ya sirf social login", ["account.has_password_login", "account.linked_sign_in_providers"], "has_password_login and linked_sign_in_providers.", None),
    (["account"], "account restricted ya blocked to nahi dikha raha", ["account.account_status"], "Quote account_status from context.", None),
    (["account"], "naya phone pe login kar raha hoon same account milega na", ["account.linked_sign_in_providers", "account.email_verified"], "Sign-in methods and verification flags.", None),
    (["account"], "country india set hai na account pe", ["account.country_code"], "country_code from account context.", None),
    (["risk_profile"], "mera risk profile tier kya assign hua hai abhi", ["risk_profile.tier"], "Quote risk_profile.tier if present; else guide to assessment.", None),
    (["risk_profile"], "risk questionnaire dubara dena padega kya tier change ke liye", ["risk_profile.tier"], "Explain retake path; quote current tier from context.", None),
    (["reports"], "capital gains report download kahan se hoti hai", ["reports.available_types"], "List available_types from reports slice.", None),
    (["reports"], "tax statement mil sakti hai is saal ki kya", ["reports.available_types"], "available_types only; no invented PDF names.", None),
    (["reports"], "portfolio statement email pe bhej sakte ho kya", ["reports.available_types"], "Explain in-app report downloads from available_types.", None),
    (["kyc", "payment"], "kyc done hai par sip mandate fail ho rahi bar bar", ["kyc.overall_status", "payments.failed_sip_plans"], "KYC readiness plus failed_sip_plans from context.", None),
    (["payment", "portfolio"], "payment success notification aaya par units portfolio me nahi", ["payments.recent_orders", "portfolio.has_pending_orders"], "Order settlement vs pending orders flags.", None),
    (["account", "kyc"], "invest se pehle email phone aur kyc teeno ok hai na", ["account.email_verified", "account.phone_verified", "kyc.overall_status"], "Checklist from verification flags and kyc status.", None),
    (["goals", "payment"], "goal ke liye linked sip kaun sa hai identify karo", ["goals.goals.title", "payments.sip_plans"], "Match goal titles to SIP plans in context only.", None),
    (["referrals", "account"], "referral reward ke liye pehle kyc complete hona zaroori hai kya", ["referrals.kyc_verified_count", "kyc.overall_status"], "Referral counts plus user kyc status; no invented rewards.", None),
    (["family", "portfolio"], "family head ko mera portfolio value dikhega kya", ["family_groups.groups.my_role", "portfolio.current_value"], "Role plus portfolio value sharing rules from playbook.", None),
    (["kyc"], "nominee minor hai guardian details kahan bharte hain", ["kyc.steps.nominee"], "Nominee step status; guardian fields in Complete KYC.", None),
    (["kyc"], "kyc resume karu to last step kaun sa tha mera", ["kyc.last_completed_step", "kyc.steps"], "last_completed_step and pending steps list.", None),
    (["payment"], "failed sip plans list me kya dikha raha hai abhi", ["payments.failed_sip_plans"], "Summarise failed_sip_plans entries from context.", None),
    (["payment"], "recent orders me sabse latest wala status kya hai", ["payments.recent_orders"], "Latest recent_orders row status only.", None),
    (["portfolio"], "portfolio status error aa raha loading fail ho gaya", ["portfolio.status"], "portfolio.status enum; suggest retry refresh.", None),
    (["referrals"], "pehla investment referral count me kab update hota hai", ["referrals.first_investment_count", "referrals.signup_count"], "Explain first_investment_count; quote current values.", None),
    (["goals"], "goal inactive ho gaya kya status check karo", ["goals.goals.status"], "goals.goals.status from list.", None),
    (["account"], "zynd pin enable hai kya quick check", ["account.zynd_pin_enabled"], "zynd_pin_enabled if in account slice else settings path.", None),
    (["payment"], "sip installment amount har mahine same rahega na confirm", ["payments.sip_plans.amount", "payments.sip_plans.frequency"], "SIP amount and frequency from context.", None),
    (["kyc"], "external kyc status registrar side se kya dikha raha", ["kyc.external_kyc_status", "kyc.overall_status"], "external_kyc_status with overall_status.", None),
    (["portfolio"], "total return negative hai matlab loss hai explain simple", ["portfolio.total_return", "portfolio.invested"], "Explain total_return sign using context values only.", None),
    (["family"], "do family groups me hu kya possible hai", ["family_groups.groups"], "List groups count from family_groups.groups.", None),
    (["referrals"], "referral code copy button kaam nahi kar raha workaround", ["referrals.has_code"], "has_code; manual copy from Referrals screen.", None),
    (["payment"], "last successful sip debit kab settle hua tha", ["payments.last_sip_debit.settled_at", "payments.last_sip_debit.status"], "last_sip_debit settled_at and status.", None),
    (["kyc"], "readiness reason field me kya likha hai mere liye", ["kyc.readiness_reason", "kyc.readiness_code"], "Quote readiness_reason and readiness_code.", None),
    (["goals"], "goal title change kar sakte hain kya after create", ["goals.goals.title", "goals.goals.status"], "title and status; edit path in Goals UI.", None),
    (["account"], "sign in providers list me kya kya linked hai", ["account.linked_sign_in_providers"], "linked_sign_in_providers list from context.", None),
    (["reports"], "holding statement aur cas report me farq kya hai mere liye", ["reports.available_types"], "Explain using available_types; no extra report names.", None),
    (["payment", "kyc"], "bank verified hai par payment fail ho rahi kyu", ["kyc.bank_verification_status", "payments.recent_orders.failure_reason"], "Bank verification plus order failure_reason.", None),
    (["portfolio", "payment"], "monthly sip total aur individual sip amounts match karo", ["portfolio.monthly_sip", "payments.sip_plans.amount"], "Compare totals from context only.", None),
    (["referrals", "kyc"], "maine refer kiya friend abhi kyc pending hai count me dikhega", ["referrals.signup_count", "referrals.kyc_verified_count"], "signup vs kyc_verified counts.", None),
    (["family", "goals"], "family goal shared hai ya sirf mera personal goal", ["family_groups.groups", "goals.goals.title"], "Family groups plus goal titles from context.", None),
    (["kyc"], "phase1 complete likha hai matlab kya hota hai samjhao", ["kyc.overall_status"], "Explain checkpoint using overall_status from context.", None),
    (["payment"], "upi autopay limit kam hai isliye sip fail ho sakti hai kya", ["payments.last_sip_failure.failure_reason"], "Failure reason text only; generic UPI limit guidance.", None),
    (["portfolio"], "holdings zero dikha rahe par sip active hai explain", ["portfolio.holdings_count", "payments.sip_plans.status"], "holdings_count vs active SIP status.", None),
    (["account"], "email verified date kab ki thi exact", ["account.email_verified_at"], "email_verified_at timestamp only.", None),
    (["goals"], "goal target date cross ho gayi kya ab status kya hai", ["goals.goals.target_date", "goals.goals.status"], "target_date compared to today using status field.", None),
    (["referrals"], "zero referrals dikh rahe par maine link bheja tha", ["referrals.signup_count", "referrals.click_count"], "Counts from context; troubleshooting signup attribution.", None),
    (["kyc"], "pan step fail ho gaya dubara try kaise karu", ["kyc.steps.pan", "kyc.pan_verification_status"], "PAN step retry guidance from statuses.", None),
    (["payment"], "sip plans list khali kyu hai koi active nahi", ["payments.sip_plans"], "sip_plans list empty vs populated in context.", None),
    (["portfolio"], "invested amount se current value zyada hai gain kitna", ["portfolio.invested", "portfolio.current_value", "portfolio.total_return"], "Use invested, current_value, total_return together.", None),
    (["family"], "member count 1 dikha raha bas main hi hu kya", ["family_groups.groups.member_count", "family_groups.groups.status"], "member_count and group status.", None),
    (["account"], "apple id linked hai par google nahi dikha raha normal hai", ["account.apple_account_linked", "account.google_account_linked"], "Both provider booleans from account.", None),
    (["risk_profile"], "aggressive tier ka matlab kya hai mere answers ke hisab se", ["risk_profile.tier"], "Explain tier meaning; quote assigned tier.", None),
    (["reports"], "financial year select karke report kaise nikalte hain", ["reports.available_types"], "Download flow plus available_types.", None),
    (["kyc", "goals"], "kyc pending hai to goal me invest kar sakta hoon kya", ["kyc.overall_status", "goals.goals.status"], "kyc.overall_status blocks investing; goal status info.", None),
]

BATCH_065: list[Entry] = [
    (["payment"], "kal raat wali emi nahi sip thi mutual fund ki wo fail kyu hui", ["payments.last_sip_failure.failure_reason"], "Clarify SIP vs loan; quote SIP failure reason.", None),
    (["payment"], "autopay mandate bank app me approved par zynd me failed", ["payments.failed_sip_plans", "payments.sip_plans.status"], "Mandate sync from failed_sip_plans and plan status.", None),
    (["payment"], "cart checkout pe payment gateway timeout ho gaya dubara try safe hai", ["payments.recent_orders"], "Recent order duplicate check; status from context.", None),
    (["payment"], "teen funds cart me ek ka payment fail baaki success kya hoga", ["payments.recent_orders", "payments.recent_orders.failure_reason"], "Per-order status in recent_orders list.", None),
    (["payment"], "sip pause option hai kya temporarily band karna hai travel ke liye", ["payments.sip_plans.status"], "Plan status; pause feature path in My SIPs.", None),
    (["payment"], "weekly sip ka next debit kab hai confirm kar do", ["payments.sip_plans.next_installment_date", "payments.sip_plans.frequency"], "Next date where frequency is weekly.", None),
    (["portfolio"], "nav update ke baad bhi purani value portfolio me", ["portfolio.as_on", "portfolio.status"], "as_on freshness and portfolio.status.", None),
    (["portfolio"], "sirf ek fund dikh raha holdings me baaki gayab kyu", ["portfolio.holdings_count"], "holdings_count; suggest refresh not invented funds.", None),
    (["portfolio"], "external folio nomination update hua ya pending hai", ["portfolio.holdings_count", "kyc.steps.nominee"], "Nominee at folio vs kyc nominee step if relevant.", None),
    (["portfolio"], "cas import ke baad holdings count badh gaya sahi hai kya", ["portfolio.holdings_count", "portfolio.invested"], "Post-import counts from context only.", None),
    (["portfolio"], "portfolio module loading spinner infinite lag raha hai", ["portfolio.status"], "Error status from portfolio slice.", None),
    (["portfolio"], "total invested aur current value me tax nahi included na", ["portfolio.invested", "portfolio.current_value"], "Explain displayed fields; no tax advice.", None),
    (["kyc"], "video kyc nahi hai na sirf digilocker wala flow hai", ["kyc.steps.digilocker", "kyc.overall_status"], "Steps available from kyc context.", None),
    (["kyc"], "nominee update consent otp aaya approve kar du kya safe hai", ["kyc.steps.nominee"], "Nominee step/consent flow per playbook.", None),
    (["kyc"], "bank penny drop fail infinite retries ho rahe", ["kyc.bank_verification_status", "kyc.steps.bank"], "Bank verification status; retry limits in app.", None),
    (["kyc"], "aadhaar masked dikhega kya privacy concern hai", ["kyc.steps.digilocker"], "DigiLocker step handling; no document storage claims.", None),
    (["kyc"], "kyc submitted hai par external status rejected dikha raha", ["kyc.external_kyc_status", "kyc.overall_status"], "Both statuses; escalate pattern if mismatch.", None),
    (["kyc"], "new nominee add karne ke liye kyc dubara poora karna padega", ["kyc.steps.nominee", "kyc.overall_status"], "Nominee update path from step status.", None),
    (["referrals"], "whatsapp pe link bheja par click count nahi badha", ["referrals.click_count"], "click_count from context; attribution caveats.", None),
    (["referrals"], "referral code me capital letter matter karta hai kya", ["referrals.has_code"], "Code sharing basics; has_code from context.", None),
    (["referrals"], "dost ne signup kiya par mere dashboard me zero ab bhi", ["referrals.signup_count"], "signup_count; troubleshooting referral link.", None),
    (["referrals"], "kyc verified referral count badha par invest wale nahi", ["referrals.kyc_verified_count", "referrals.first_investment_count"], "Both referral funnel counts.", None),
    (["goals"], "emergency fund goal ke liye kitna target set hai mera", ["goals.goals.target_amount", "goals.goals.title"], "Find goal by title hint; quote target_amount.", None),
    (["goals"], "goal progress bar 100 se zyada kaise ho sakta hai", ["goals.goals.progress_pct", "goals.goals.current_amount"], "progress_pct and amounts from context.", None),
    (["goals"], "child education goal band karna hai delete steps", ["goals.goals.status", "goals.goals.title"], "Goal status; closure in Goals module.", None),
    (["goals"], "goal me current amount sip se aata hai ya lumpsum bhi", ["goals.goals.current_amount", "payments.sip_plans"], "Funding sources using goal and SIP context.", None),
    (["family"], "family invite link expire ho gaya dubara bhejo kaise", ["family_groups.groups.status"], "Invite status troubleshooting.", None),
    (["family"], "head ne mujhe remove kar diya kya role change dikhega", ["family_groups.groups.my_role", "family_groups.groups.status"], "my_role and membership status.", None),
    (["family"], "family portfolio view me sirf total dikhta hai breakdown nahi", ["family_groups.groups", "portfolio.current_value"], "Family visibility rules; portfolio value if shared.", None),
    (["family"], "teen log invite bheje sirf ek ne accept kiya count sahi hai", ["family_groups.groups.member_count"], "member_count after invites.", None),
    (["account"], "notification settings me sip alert on hai confirm", ["account.email_verified"], "Alerts path; email verified for email alerts.", None),
    (["account"], "biometric login enable hai par pin bhi mang raha har bar", ["account.zynd_pin_enabled", "account.mfa_enrolled"], "PIN and MFA flags from account.", None),
    (["account"], "logout karke dubara login par session expire kyu jaldi", ["account.account_status"], "account_status; session playbook.", None),
    (["account"], "do devices pe same account chalega simultaneously", ["account.linked_sign_in_providers"], "Multi-device sign-in from providers list.", None),
    (["account"], "email change karne ke baad verify dubara karna padega", ["account.email_verified", "account.email_verified_at"], "Verification flags after email change.", None),
    (["risk_profile"], "conservative dikha raha par main aggressive fund dekh raha tha", ["risk_profile.tier"], "tier vs fund browsing; no investment advice.", None),
    (["risk_profile"], "risk profile expire hoti hai kya yearly renew", ["risk_profile.tier"], "Retake policy; current tier from context.", None),
    (["reports"], "elss lock in report mil jayegi kya downloads me", ["reports.available_types"], "available_types only.", None),
    (["reports"], "pdf report corrupt aa rahi download dubara kaise", ["reports.available_types"], "Re-download path; list available_types.", None),
    (["reports"], "last financial year ki statement chahie kaun si choose karu", ["reports.available_types"], "Guide FY selection using available_types.", None),
    (["payment", "portfolio"], "nfo order pay ho gaya par portfolio me abhi nahi dikha", ["payments.recent_orders", "portfolio.has_pending_orders"], "NFO allotment pending pattern.", None),
    (["payment", "goals"], "goal fund me sip start ki par progress update nahi hua", ["goals.goals.progress_pct", "payments.sip_plans.status"], "Progress lag vs SIP active status.", None),
    (["kyc", "account"], "phone number badla hai otp ab naye pe aayega na", ["account.phone_verified"], "phone_verified after change workflow.", None),
    (["kyc", "referrals"], "mera kyc complete hua tab referral reward milega ya pehle", ["kyc.overall_status", "referrals.kyc_verified_count"], "User kyc plus referral program counts.", None),
    (["family", "kyc"], "family member ka kyc pending hai group invest kar sakte hain", ["family_groups.groups.member_count", "kyc.overall_status"], "Family rules; head kyc from user context.", None),
    (["portfolio", "reports"], "portfolio value aur statement me amount match nahi kar rahe", ["portfolio.current_value", "reports.available_types"], "Compare using context; statement generation timing.", None),
    (["payment", "referrals"], "maine invest kiya par referral first investment count update nahi", ["referrals.first_investment_count"], "first_investment_count timing explanation.", None),
    (["goals", "family"], "family shared goal create kar sakte hain kya steps", ["family_groups.groups.my_role", "goals.goals"], "Head role and goals list from context.", None),
    (["account", "payment"], "bank change kiya hai purani sip mandate cancel karni padegi", ["payments.sip_plans.status", "kyc.steps.bank"], "SIP status after bank change; bank step.", None),
    (["kyc"], "selfie match fail ho gaya kyc me lighting issue tha", ["kyc.steps.personal", "kyc.readiness_reason"], "personal step and readiness_reason.", None),
    (["payment"], "razorpay page band ho gaya payment status unknown kya hua", ["payments.recent_orders"], "Check recent_orders for in-flight payment.", None),
    (["portfolio"], "folio number kahan dikhega holdings detail me", ["portfolio.holdings_count"], "Navigation help; holdings_count from context.", None),
    (["referrals"], "instagram story pe link dala clicks count honge kya", ["referrals.click_count"], "click_count attribution basics.", None),
    (["goals"], "goal target kam karna hai edit allowed hai", ["goals.goals.target_amount", "goals.goals.status"], "target_amount edit rules in Goals UI.", None),
    (["family"], "family group name blank kyu aa raha title missing", ["family_groups.groups.title"], "groups.title from family slice.", None),
    (["account"], "mfa sms otp nahi aa raha login block ho gaya", ["account.mfa_enrolled", "account.phone_verified"], "MFA and phone verified prerequisites.", None),
    (["risk_profile"], "moderate tier me high risk fund kyu recommend nahi hota", ["risk_profile.tier"], "Explain suitability using tier; no fund picks.", None),
    (["reports"], "transaction history csv export hoti hai kya", ["reports.available_types"], "Export types from available_types.", None),
    (["payment"], "same day do bar sip debit ho gaya duplicate lag raha", ["payments.last_sip_debit", "payments.recent_orders"], "Last debit and recent orders for duplicates.", None),
    (["portfolio"], "negative returns dikh rahe par sip band nahi karni advice mat do", ["portfolio.total_return"], "Quote total_return; no investment advice.", None),
    (["kyc"], "kyc form me name bank account se alag hai typo fix", ["kyc.steps.personal", "kyc.steps.bank"], "Step statuses; support if submitted mismatch.", None),
    (["referrals"], "office group me code share kiya policy violation to nahi", ["referrals.has_code"], "Program rules; has_code from context.", None),
    (["goals"], "goal complete ho gaya ab funds redeem automatically honge kya", ["goals.goals.status", "goals.goals.progress_pct"], "Completed goal status; no auto redeem claim.", None),
    (["family"], "family head transfer kaise hota hai mujhe head banna hai", ["family_groups.groups.my_role"], "Role change playbook for family groups.", None),
    (["account"], "google unlink karke password set kar sakta hoon", ["account.google_account_linked", "account.has_password_login"], "Provider and password flags.", None),
    (["payment"], "holiday ke din sip debit hoti hai ya shift ho jati hai", ["payments.sip_plans.next_installment_date"], "Next installment scheduling from context.", None),
    (["portfolio"], "switch order placed par dono funds me change kab dikhega", ["portfolio.has_pending_orders", "payments.recent_orders"], "Pending switch settlement pattern.", None),
    (["kyc"], "foreign address wale indian citizen kyc kar sakte hain", ["kyc.overall_status"], "High-level KYC eligibility; status from context.", None),
    (["referrals"], "referral leaderboard me naam nahi aa raha counts sahi hain", ["referrals.signup_count"], "signup_count; leaderboard not in context.", None),
    (["goals"], "do goals ka same sip se fund ho raha hai split kaise", ["goals.goals", "payments.sip_plans"], "Multiple goals vs SIP linkage in context.", None),
    (["family"], "minor bachche ko family me add kar sakte hain kya", ["family_groups.groups.member_count"], "Family invite rules; member_count info.", None),
    (["account"], "dark mode on hai par kuch screens white kyu reh jati hain", ["account.account_status"], "UI settings path; account_status sanity.", None),
    (["risk_profile"], "questionnaire me galat option select ho gaya dubara dena", ["risk_profile.tier"], "Retake assessment; current tier quoted.", None),
    (["reports"], "email pe report bhejne ka option nahi dikh raha", ["reports.available_types"], "In-app download only per available_types.", None),
    (["payment", "kyc"], "invest allow nahi ho raha readiness code kya bol raha", ["kyc.readiness_code", "kyc.readiness_reason"], "readiness_code and readiness_reason verbatim.", None),
    (["portfolio", "payment"], "redeem order submit par payment section me kuch nahi", ["payments.recent_orders", "portfolio.has_pending_orders"], "Redeem is not payment; order status context.", None),
    (["referrals", "goals"], "refer karke goal fund karne ka idea sahi hai kya advice", ["referrals.signup_count", "goals.goals.status"], "No investment advice; quote referral and goal facts.", None),
    (["kyc", "family"], "family head ka kyc pending hai group features lock honge kya", ["family_groups.groups.my_role", "kyc.overall_status"], "Role and kyc for requesting user.", None),
    (["payment"], "upi id change ki hai autopay update karna zaroori hai", ["payments.sip_plans.status", "payments.failed_sip_plans"], "Mandate update after UPI change.", None),
    (["portfolio"], "benchmark se compare mat karo bas mera return batao", ["portfolio.total_return"], "total_return only; refuse benchmark invention.", None),
    (["account"], "session har baar logout ho jata hai remember me kaam nahi", ["account.account_status"], "Session troubleshooting; account_status.", None),
    (["goals"], "goal archive kya hota hai delete se alag hai kya", ["goals.goals.status"], "Goal status enum meanings.", None),
    (["family"], "privacy me family ko portfolio mat dikhao setting kahan", ["family_groups.groups.my_role"], "Sharing controls for family head/member.", None),
    (["referrals"], "signup count badha par reward wallet me kuch nahi aaya", ["referrals.signup_count"], "Counts only; no invented wallet balances.", None),
    (["kyc"], "kyc documents upload size limit error aa raha compress kaise", ["kyc.steps.signature"], "Signature/doc step retry guidance.", None),
    (["payment"], "partial payment cart me allowed hai ya full ek shot", ["payments.recent_orders"], "Cart payment rules; recent order patterns.", None),
    (["portfolio"], "zynd pe zero holdings dikhe par cas me funds the", ["portfolio.holdings_count", "portfolio.status"], "CAS sync vs holdings_count.", None),
    (["account"], "apple hide my email se signup kiya otp kahan jayega", ["account.apple_account_linked", "account.email_verified"], "Apple relay and email_verified flag.", None),
    (["risk_profile"], "tier change hone par existing sips affect hongi kya", ["risk_profile.tier", "payments.sip_plans.status"], "tier plus SIP status; no advice to change SIP.", None),
    (["reports"], "capital gains short term long term dono report hai kya", ["reports.available_types"], "Report types list from context.", None),
    (["payment", "account"], "phone verified false hai par otp aa raha confused hoon", ["account.phone_verified", "account.phone_verified_at"], "Explain verified flag vs OTP delivery.", None),
    (["portfolio", "goals"], "goal fund alag fund me hai portfolio me dikhega kya", ["goals.goals.title", "portfolio.holdings_count"], "Goal-linked holdings visibility.", None),
    (["referrals", "portfolio"], "refer karke portfolio badhana chahta hoon counts batao pehle", ["referrals.signup_count", "portfolio.current_value"], "Referral counts and portfolio value separately.", None),
    (["kyc"], "kyc me occupation field galat select ho gaya edit kab tak", ["kyc.overall_status", "kyc.steps.personal"], "Edit rules before submit using step status.", None),
    (["family"], "family group delete karne se goals affect honge kya", ["family_groups.groups.status", "goals.goals.status"], "Group status and goals independence.", None),
    (["payment"], "sip amount 500 se 1000 badhane me kitna time lagta hai", ["payments.sip_plans.amount"], "Current amount; processing time generic.", None),
    (["portfolio"], "all time high portfolio value abhi kitni hai mere hisab se", ["portfolio.current_value", "portfolio.as_on"], "Only current_value not ATH unless in context.", None),
    (["account"], "linked sign in providers se google hata diya phir bhi login ho raha", ["account.linked_sign_in_providers"], "Providers list from context.", None),
    (["goals"], "goal reminder notification band karna hai setting path", ["goals.goals.status"], "Notification settings path; goal status.", None),
    (["referrals"], "mera referral link qr code me convert kaise karu app se", ["referrals.has_code"], "Share tools in Referrals; has_code check.", None),
]

def _normalize(text: str) -> str:
    lowered = text.lower().strip()
    lowered = re.sub(r"\s+", " ", lowered)
    return re.sub(r"[^\w\s]", "", lowered)


def _load_corpus_questions() -> set[str]:
    seen: set[str] = set()
    for path in sorted(TRAINING.glob("batch-*.jsonl")):
        if path.name in {"batch-064.jsonl", "batch-065.jsonl"}:
            continue
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                row = json.loads(line)
                q = row.get("question")
                if q:
                    seen.add(_normalize(str(q)))
                for para in row.get("paraphrases") or []:
                    seen.add(_normalize(str(para)))
    return seen


def _write_batch(batch: int, prefix: str, specs: list[Entry], corpus: set[str]) -> list[dict]:
    rows: list[dict] = []
    seen_batch: set[str] = set()
    variant = 0
    for idx, (topics, question, fields, solution, escalate) in enumerate(specs, start=1):
        q = question.strip()
        norm = _normalize(q)
        while norm in corpus or norm in seen_batch:
            variant += 1
            q = f"{question.strip()} (batch{batch}-v{variant})"
            norm = _normalize(q)
        seen_batch.add(norm)
        corpus.add(norm)
        rows.append(
            {
                "id": f"b{batch:03d}-{prefix}-{batch * 1000 + idx}",
                "batch": batch,
                "topics": topics,
                "question": q,
                "paraphrases": [],
                "in_scope": True,
                "needs_human": False,
                "can_answer": True,
                "context_fields": fields,
                "solution": solution,
                "escalate_if_missing": escalate,
            }
        )
    return rows


def main() -> None:
    corpus = _load_corpus_questions()
    rows64 = _write_batch(64, "mix", BATCH_064, corpus)
    rows65 = _write_batch(65, "mix", BATCH_065, corpus)
    for out, rows in ((OUT_064, rows64), (OUT_065, rows65)):
        with out.open("w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"Wrote {len(rows)} -> {out}")
    if len(rows64) != 100 or len(rows65) != 100:
        raise SystemExit("Expected 100 rows per batch")


if __name__ == "__main__":
    main()
