// constants/legalDocuments.ts

export interface LegalSection {
  id: string;
  title: string;
  content: string;
  subsections?: LegalSection[];
}

export interface LegalDocument {
  id: string;
  title: string;
  lastUpdated: string;
  effectiveDate: string;
  version: string;
  sections: LegalSection[];
}

// Privacy Policy Document
export const PRIVACY_POLICY: LegalDocument = {
  id: "privacy_policy",
  title: "Privacy Policy",
  lastUpdated: "2025-01-01",
  effectiveDate: "2025-01-01",
  version: "1.0",
  sections: [
    {
      id: "introduction",
      title: "Introduction",
      content: `Welcome to ForkCast's Privacy Policy. Qwerty App ("we," "us," "our") is committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application ForkCast ("App").

By using ForkCast, you consent to the data practices described in this policy. If you do not agree with our policies and practices, please do not use our App.`,
    },
    {
      id: "information_we_collect",
      title: "Information We Collect",
      content:
        "We collect information you provide directly to us and information collected automatically when you use our App:",
      subsections: [
        {
          id: "information_you_provide",
          title: "Information You Provide Directly",
          content: `Account Registration:
• Full name
• Email address
• Phone number
• Password (encrypted)
• Profile photo (optional)
• Date of birth (optional)

Profile Information:
• Dietary restrictions and preferences
• Favorite cuisines
• Allergies
• Preferred party size
• Special occasion dates

Booking Information:
• Reservation details (date, time, party size)
• Special requests
• Dietary notes
• Guest information (for group bookings)
• Table preferences`,
        },
        {
          id: "information_collected_automatically",
          title: "Information Collected Automatically",
          content: `Device Information:
• Device type and model
• Operating system version
• Unique device identifiers
• IP address
• Mobile network information
• App version and usage data
• Crash reports and error logs

Usage Data:
• App interactions and navigation patterns
• Search queries and filters
• Time spent on different screens
• Features used and frequency
• Location data (when permitted)
• Booking history and preferences`,
        },
      ],
    },
    {
      id: "how_we_use_information",
      title: "How We Use Your Information",
      content: "We use the information we collect for various purposes:",
      subsections: [
        {
          id: "service_provision",
          title: "Service Provision",
          content: `• Processing and managing your restaurant reservations
• Facilitating communication between you and restaurants
• Providing customer support and responding to your inquiries
• Sending booking confirmations, reminders, and updates
• Managing your account and profile settings
• Processing payments and managing billing`,
        },
        {
          id: "personalization",
          title: "Personalization and Recommendations",
          content: `• Personalizing your experience and content
• Providing restaurant recommendations based on your preferences
• Customizing search results and availability
• Offering relevant promotions and special offers
• Managing your loyalty program benefits
• Tailoring marketing communications`,
        },
        {
          id: "analytics_improvement",
          title: "Analytics and Service Improvement",
          content: `• Analyzing usage patterns and trends
• Improving app functionality and user experience
• Developing new features and services
• Conducting research and analytics
• Monitoring and ensuring platform security
• Preventing fraud and unauthorized access`,
        },
        {
          id: "legal_compliance",
          title: "Legal and Compliance",
          content: `• Complying with applicable laws and regulations
• Enforcing our Terms of Service
• Protecting our rights and the rights of others
• Responding to legal requests and preventing harm
• Maintaining records for business and legal purposes`,
        },
      ],
    },
    {
      id: "information_sharing",
      title: "How We Share Your Information",
      content: "We may share your information in the following circumstances:",
      subsections: [
        {
          id: "restaurant_partners",
          title: "Restaurant Partners",
          content: `We share necessary booking information with restaurants to facilitate your reservations:
• Your name and contact information
• Reservation details and special requests
• Dietary restrictions and accessibility needs
• Party size and seating preferences
• Arrival and cancellation notifications`,
        },
        {
          id: "service_providers",
          title: "Service Providers",
          content: `We work with carefully selected third-party providers who help us deliver ForkCast, including:

• Cloud hosting & database: Supabase and Amazon Web Services (AWS) for secure storage of your data and backups.

• Authentication: Google and Apple for sign-in to your account.

• Messaging & notifications: Providers such as Twilio (SMS/WhatsApp) and push-notification services (such as Expo / OneSignal) to send booking confirmations, reminders, and service messages.

• Maps & location: Providers such as Google Maps to show restaurant locations and distance.

• Analytics & attribution: Analytics and mobile measurement partners (such as Airbridge) that help us understand how users discover and use ForkCast and measure the performance of our campaigns. These partners may use device identifiers and mobile advertising IDs.

• Advertising partners: Advertising platforms (such as Meta) that help us deliver and measure advertising campaigns, where permitted by law and your device settings.

• Error tracking & performance monitoring: Tools such as Sentry that help us diagnose crashes and performance issues.

• Payment processing: PCI-DSS Level 1–certified payment processors who handle your card details on our behalf.

These providers only process your personal data on our instructions and under appropriate contractual safeguards.`,
        },
        {
          id: "business_transfers",
          title: "Business Transfers",
          content: `In the event of a merger, acquisition, or sale of all or a portion of our assets, your information may be transferred to the acquiring entity. We will provide notice before your personal information is transferred and becomes subject to a different privacy policy.`,
        },
        {
          id: "legal_requirements",
          title: "Legal Requirements",
          content: `We may disclose your information when required by law or in response to:
• Valid legal process (subpoenas, court orders)
• Government investigations or requests
• Threats to public safety or security
• Protection of our rights and property
• Prevention of fraud or illegal activities`,
        },
      ],
    },
    {
      id: "data_security",
      title: "Data Security",
      content: `We implement robust security measures to protect your personal information:

• Encryption of data in transit and at rest
• Secure payment processing through PCI-compliant providers
• Regular security audits and vulnerability assessments
• Access controls and authentication requirements
• Employee training on data protection and security
• Incident response and breach notification procedures

However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security.`,
    },
    {
      id: "data_retention",
      title: "Data Retention",
      content: `We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this Privacy Policy:

• Account data: For as long as your ForkCast account is active and for a reasonable period afterwards to maintain your booking history, respond to your requests, and comply with legal obligations.

• Booking history: For as long as your account is active and for a reasonable period afterwards so that you and our restaurant partners can access past reservations and loyalty activity, after which we may anonymize or aggregate the data.

• Reviews: Indefinitely (we may anonymize reviews after account deletion so that they can no longer be linked back to you).

You may request deletion of your personal information at any time, subject to legal and business requirements.`,
    },
    {
      id: "your_rights",
      title: "Your Rights and Choices",
      content: "You have several rights regarding your personal information:",
      subsections: [
        {
          id: "access_rights",
          title: "Access and Portability",
          content: `• Request access to your personal information
• Obtain a copy of your data in a structured format
• Review how your information is being used
• Verify the accuracy of your data`,
        },
        {
          id: "correction_rights",
          title: "Correction and Updates",
          content: `• Update your profile and account information
• Correct inaccurate or incomplete data
• Modify your communication preferences
• Change your marketing consent settings`,
        },
        {
          id: "deletion_rights",
          title: "Deletion and Restriction",
          content: `• Request deletion of your personal information
• Restrict processing of your data
• Object to certain uses of your information
• Withdraw consent for marketing communications`,
        },
        {
          id: "exercising_rights",
          title: "How to Exercise Your Rights",
          content: `To exercise these rights, contact us at:
• Email: privacy@plate-app.com
• Phone: +961 1 234 567
• In-app: Settings > Privacy > Data Rights
• Mail: Qwerty App, Privacy Officer, Beirut, Lebanon

We will respond to your request within 30 days of receipt.`,
        },
      ],
    },
    {
      id: "international_transfers",
      title: "International Data Transfers",
      content: `Your information may be transferred to and processed in countries other than Lebanon, including countries that may not have the same data protection laws as your jurisdiction. When we transfer your information internationally, we implement appropriate safeguards:

• Standard contractual clauses approved by relevant authorities
• Adequacy decisions by data protection authorities
• Binding corporate rules for intra-group transfers
• Your explicit consent for specific transfers

We ensure that any international transfers comply with applicable data protection laws and that your information receives an adequate level of protection.`,
    },
    {
      id: "childrens_privacy",
      title: "Children's Privacy",
      content: `Our Service is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately.

If we become aware that we have collected personal information from a child under 13 without parental consent, we will take steps to delete that information from our servers.`,
    },
    {
      id: "changes_to_policy",
      title: "Changes to This Privacy Policy",
      content: `We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. When we make changes, we will:

• Update the "Last Updated" date at the top of this policy
• Notify you of material changes through the app or by email
• Provide you with the opportunity to review the updated policy
• Obtain your consent for material changes that affect your rights

Your continued use of our Service after the effective date of any changes constitutes your acceptance of the updated Privacy Policy.`,
    },
    {
      id: "contact_information",
      title: "Contact Information",
      content: `If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:

Qwerty App
Privacy Officer
Address: Beirut, Lebanon
Email: privacy@plate-app.com
Phone: +961 1 234 567

If you have questions about this Privacy Policy or how we handle your personal data, you can contact our Privacy Office at: tech@notqwerty.com

We are committed to addressing your privacy concerns promptly and transparently.`,
    },
  ],
};

// Terms of Service Document
export const TERMS_OF_SERVICE: LegalDocument = {
  id: "terms_of_service",
  title: "Terms and Conditions",
  lastUpdated: "2025-09-01",
  effectiveDate: "2025-09-01",
  version: "2.0",
  sections: [
    {
      id: "acceptance_of_terms",
      title: "1. ACCEPTANCE OF TERMS",
      content: `These Terms and Conditions ("Terms") govern your use of the ForkCast mobile application and related services ("ForkCast", "we", "us", "our"), operated by Qwerty SAL, a company incorporated in Beirut (the "Company").

By downloading, installing, accessing, or using ForkCast, you ("you", "your", or "User") agree to be bound by these Terms. If you do not agree to these Terms, you must not use ForkCast.`,
      subsections: [
        {
          id: "eligibility",
          title: "1.1 Eligibility",
          content: `• You must be at least 18 years old to use ForkCast
• You must have the legal capacity to enter into binding contracts
• You must provide accurate, current, and complete information during registration
• You are responsible for maintaining the confidentiality of your account credentials`,
        },
        {
          id: "account_types",
          title: "1.2 Account Types",
          content: `ForkCast offers the following account types:
• Registered Users: Full access to all features with an authenticated account
• Guest Users: Limited access to browse restaurants without booking capabilities
• OAuth Users: Authenticated via Google or Apple Sign-In`,
        },
        {
          id: "license_to_use",
          title: "1.3 License to Use",
          content: `• Limited License. Subject to these Terms, we grant you a personal, non-exclusive, non-transferable, revocable license to use the App for personal, non-commercial purposes.`,
        },
      ],
    },
    {
      id: "services_provided",
      title: "2. SERVICES PROVIDED",
      content: "ForkCast provides comprehensive restaurant reservation services:",
      subsections: [
        {
          id: "core_services",
          title: "2.1 Core Services",
          content: `ForkCast provides the following services:
• Restaurant discovery and search
• Real-time table reservation booking
• Restaurant information, menus, and reviews
• Location-based restaurant recommendations
• Social features for sharing dining experiences
• Loyalty program with points and tier benefits
• Special offers and promotional deals
• Group booking coordination
• Waitlist management`,
        },
        {
          id: "service_availability",
          title: "2.2 Service Availability",
          content: `• Services are provided "as is" and "as available"
• We do not guarantee uninterrupted or error-free service
• We reserve the right to modify, suspend, or discontinue services at any time
• Scheduled maintenance may temporarily affect service availability`,
        },
      ],
    },
    {
      id: "user_responsibilities",
      title: "3. USER RESPONSIBILITIES",
      content: "Users have specific obligations when using our platform:",
      subsections: [
        {
          id: "account_management",
          title: "3.1 Account Management",
          content: `You agree to:
• Provide accurate and complete registration information
• Update your information to keep it current
• Maintain the security of your account credentials
• Notify us immediately of any unauthorized account access
• Accept responsibility for all activities under your account`,
        },
        {
          id: "reservation_obligations",
          title: "3.2 Reservation Obligations",
          content: `When making reservations, you agree to:
• Provide accurate party size and contact information
• Honor confirmed reservations or cancel within the specified timeframe
• Arrive on time for your reservation
• Comply with restaurant-specific policies and dress codes
• Pay any required deposits or cancellation fees`,
        },
        {
          id: "prohibited_conduct",
          title: "3.3 Prohibited Conduct",
          content: `You shall not:
• Make false or fraudulent reservations
• Create multiple accounts to circumvent restrictions
• Resell or commercially exploit reservations
• Use automated systems or bots to make bookings
• Harass, abuse, or harm other users or restaurant staff
• Post false, misleading, or defamatory reviews
• Violate any applicable laws or regulations
• Attempt to gain unauthorized access to our systems
• Reverse engineer or decompile the App`,
        },
      ],
    },
    {
      id: "booking_policies",
      title: "4. BOOKING POLICIES",
      content:
        "Our reservation system operates under comprehensive booking policies:",
      subsections: [
        {
          id: "reservation_confirmation",
          title: "4.1 Reservation Confirmation",
          content: `• Bookings are subject to restaurant availability
• Confirmation is sent via app notification and/or email
• Each booking receives a unique confirmation code
• Some restaurants may require credit card details to secure bookings`,
        },
        {
          id: "cancellation_policy",
          title: "4.2 Cancellation Policy",
          content: `• Restaurant-Defined Policy. Each Restaurant sets its own cancellation and no-show terms (notice period, grace period, and any fees). The applicable policy is shown during booking, on the Restaurant page, and in your confirmation.
• Notice Period. Users must cancel no later than the Restaurant's stated notice period before the scheduled booking time (Restaurant's local time). Cancellations made after that are Late Cancellations.
• Card Guarantee & Charges. If a card guarantee is required, you authorize a pre-authorization and, where applicable, the Late Cancellation/No-Show fee set by the Restaurant (per cover, fixed amount, or percentage), plus applicable taxes/processing. ForkCast collects such amounts as an agent for the Restaurant.
• Modifications. Changes to date, time, or party size inside the notice period may be treated as a cancellation under the Restaurant's policy.
• No-Show. A No-Show occurs when you fail to arrive or check in within the Restaurant's grace period. Repeated no-shows may limit booking privileges and/or loyalty eligibility.
• How to Cancel. Use "Cancel Reservation" in the app. The effective cancellation time is the timestamp recorded by our system in the Restaurant's local time zone.
• Special Events. Set menus, ticketed events, or holidays may have stricter policies or deposits; those terms will be displayed and will prevail in case of conflict.`,
        },
        {
          id: "modifications",
          title: "4.3 Modifications",
          content: `• Reservation modifications are subject to availability
• Changes must be made within the cancellation window
• Party size changes may affect table availability`,
        },
        {
          id: "group_bookings",
          title: "4.4 Group Bookings",
          content: `• Large group bookings may have special requirements
• Organizers are responsible for coordinating attendees
• Deposits may be required for large parties`,
        },
      ],
    },
    {
      id: "loyalty_program",
      title: "5. LOYALTY PROGRAM (WHERE AVAILABLE)",
      content:
        'ForkCast may offer a loyalty or rewards program ("Loyalty Program") in certain locations or to certain users. Participation is optional and may be subject to additional terms and conditions presented in the App. Where available, the Loyalty Program may work as follows:',
      subsections: [
        {
          id: "points_system",
          title: "5.1 Points System",
          content: `• Users earn loyalty points for completed bookings
• Points calculation based on booking value and frequency
• Points may expire after 12 months of inactivity
• Points have no cash value and cannot be transferred
• We may deduct points credited in error, earned by fraud/abuse, or tied to refunded/invalidated bookings.
• Points have no cash value, cannot be exchanged for money, and may be modified or discontinued at any time.`,
        },
        {
          id: "membership_tiers",
          title: "5.2 Membership Tiers",
          content: `Our loyalty program includes four tiers:
• Bronze: Entry level (0-499 points)
• Silver: Enhanced benefits (500-1,499 points)
• Gold: Premium perks (1,500-2,999 points)
• Platinum: Exclusive privileges (3,000+ points)`,
        },
        {
          id: "tier_benefits",
          title: "5.3 Tier Benefits",
          content: `Benefits may include, but are not limited to:
• Priority reservations
• Exclusive restaurant access
• Special discounts and offers
• Complimentary upgrades
• Birthday rewards
• Cash Rewards`,
        },
      ],
    },
    {
      id: "reviews_and_content",
      title: "6. REVIEWS AND CONTENT",
      content:
        "Comprehensive guidelines for user-generated content and reviews:",
      subsections: [
        {
          id: "user_generated_content",
          title: "6.1 User-Generated Content",
          content: `By posting reviews, photos, or other content, you:
• Grant us a non-exclusive, worldwide, royalty-free license to use your content
• Represent that you own or have rights to the content
• Agree that content must be accurate and not misleading
• Acknowledge that we may moderate or remove content at our discretion`,
        },
        {
          id: "review_guidelines",
          title: "6.2 Review Guidelines",
          content: `Reviews must:
• Be based on actual dining experiences
• Be honest and constructive
• Not contain offensive or inappropriate language
• Do not include personal information of others
• Comply with our community standards`,
        },
        {
          id: "objectionable_content_policy",
          title: "6.3 Objectionable Content and Abuse Policy",
          content: `• ForkCast has zero tolerance for objectionable content or abusive conduct.
• Objectionable content includes, but is not limited to:
  • Hate speech, threats, harassment, or bullying
  • Sexually explicit, obscene, or violent material
  • Content promoting illegal activity, self-harm, or dangerous behavior
  • Spam, scams, or deceptive content
• Users who post, share, or otherwise engage in objectionable content or abusive behavior may have their accounts suspended or terminated without notice.
• We reserve the right to remove any user-generated content that we determine, in our sole discretion, to be objectionable or in violation of these Terms.
• By using ForkCast, you agree to comply with this policy and acknowledge that violations may result in loss of access to the App and referral to appropriate authorities where required by law.`,
        },
        {
          id: "moderation_reporting",
          title: "6.4 Moderation, Reporting, and Blocking",
          content: `• ForkCast implements automated filters and manual review to reduce objectionable content.
• Users can flag or report any content they believe is abusive, offensive, fraudulent, or otherwise in violation of these Terms, using the in-app reporting feature.
• Users may also block or mute other users to prevent further unwanted interaction.
• All reports are reviewed, and appropriate action will be taken within 24 hours, including removal of content and suspension or termination of accounts.
• We reserve the right to cooperate with law enforcement or regulatory authorities where required.`,
        },
      ],
    },
    {
      id: "payment_terms",
      title: "7. PAYMENT TERMS",
      content: "Comprehensive payment policies and procedures:",
      subsections: [
        {
          id: "payment_processing",
          title: "7.1 Payment Processing",
          content: `Some restaurants may require a deposit or prepayment to secure a booking. All such payments are processed by independent third-party payment processors on behalf of the restaurant.

We do not store your full payment card details. Payment information is collected and processed directly by our payment processors, who are certified under applicable security standards (such as PCI-DSS). By making a payment through the App, you authorize the relevant payment processor to charge the amount displayed for the booking, deposit, or cancellation fee, as applicable.`,
        },
        {
          id: "refunds",
          title: "7.2 Refunds",
          content: `• Refund policies vary by restaurant
• Cancellation fees may be non-refundable
• Disputes should first be resolved with the restaurant
• We are not liable for refunds`,
        },
      ],
    },
    {
      id: "privacy_data_protection",
      title: "8. PRIVACY AND DATA PROTECTION",
      content: "Our commitment to protecting your privacy and personal data:",
      subsections: [
        {
          id: "data_collection",
          title: "8.1 Data Collection",
          content: `We collect and process personal data as outlined in our Privacy Policy, including:
• Account information (name, email, phone)
• Location data for restaurant recommendations
• Booking history and preferences
• Device and usage information`,
        },
        {
          id: "data_security",
          title: "8.2 Data Security",
          content: `We implement industry-standard security measures to help protect your data, including encryption in transit and at rest provided by our cloud providers and access controls for our production systems. However, no method of transmission or storage is completely secure, and we cannot guarantee absolute security. You are responsible for maintaining the security of your account and device (for example, by using a strong password and keeping your login details confidential).`,
        },
      ],
    },
    {
      id: "third_party_services",
      title: "9. THIRD-PARTY SERVICES",
      content: "Integration with external services and partnerships:",
      subsections: [
        {
          id: "restaurant_partners",
          title: "9.1 Restaurant Partners",
          content: `• Restaurants are independent businesses
• We are not responsible for restaurant services or food quality
• Disputes should be resolved directly with restaurants
• Restaurant terms and conditions may apply`,
        },
        {
          id: "external_services",
          title: "9.2 External Services",
          content: `ForkCast integrates with various third-party services to operate the App and its features. These may include, for example:

• Mapping and location providers (such as Google Maps);

• Authentication providers (such as Apple and Google for Sign-In);

• Cloud hosting and database services (such as Supabase and Amazon Web Services);

• Messaging and notification services (such as Twilio for SMS/WhatsApp and push-notification providers);

• Analytics and mobile measurement partners (such as Airbridge) and advertising platforms (such as Meta) to help us understand how users discover ForkCast and measure the performance of our campaigns;

• Payment processors that handle deposit or prepayment transactions where required by restaurants.

Your use of third-party services may also be subject to their own terms and privacy policies. For more information on how we share data with such third parties, please see our Privacy Policy.`,
        },
        {
          id: "restaurant_widgets",
          title: "9.3 Restaurant Websites & Widgets",
          content: `Some bookings are made via ForkCast's widget on third-party sites (Restaurant websites, Instagram, etc.). Those sites are not controlled by ForkCast. The Restaurant's policy still applies; ForkCast is not responsible for content or downtime on third-party sites.`,
        },
      ],
    },
    {
      id: "intellectual_property",
      title: "10. INTELLECTUAL PROPERTY",
      content: "Protection of intellectual property rights:",
      subsections: [
        {
          id: "ownership",
          title: "10.1 Ownership",
          content: `• The App and its original content are owned by Qwerty SAL
• Trademarks, logos, and branding are our property
• Restaurant information establishments own restaurant information
• User content remains owned by users with license granted to us`,
        },
        {
          id: "restrictions",
          title: "10.2 Restrictions",
          content: `You may not:
• Copy, modify, or distribute our proprietary content
• Use our trademarks without permission
• Create derivative works based on the App
• Remove copyright or proprietary notices`,
        },
        {
          id: "ip_complaints",
          title: "10.3 IP Complaints",
          content: `To report alleged infringement, email support@notqwerty.com with: your contact details, a description of the work, the allegedly infringing URL, and a statement under penalty of perjury that you are authorized to act.`,
        },
      ],
    },
    {
      id: "disclaimers_limitations",
      title: "11. DISCLAIMERS AND LIMITATIONS",
      content: "Important legal disclaimers and limitations of liability:",
      subsections: [
        {
          id: "service_disclaimer",
          title: "11.1 Service Disclaimer",
          content: `THE APP IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.`,
        },
        {
          id: "limitation_of_liability",
          title: "11.2 Limitation of Liability",
          content: `TO THE MAXIMUM EXTENT PERMITTED BY LAW:
• We are not liable for indirect, incidental, or consequential damages
• Our total liability shall not exceed $100 or fees paid in the last 12 months
• We are not responsible for restaurant service quality or issues
• We do not guarantee reservation availability`,
        },
        {
          id: "indemnification",
          title: "11.3 Indemnification",
          content: `You agree to indemnify and hold harmless Qwerty SAL, its affiliates, and their respective officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from your use of the App or violation of these Terms.`,
        },
        {
          id: "force_majeure",
          title: "11.4 Force Majeure",
          content: `Neither party is liable for delays or failures caused by events beyond reasonable control (e.g., network outages, strikes, regulatory actions, extreme weather, or acts of God).`,
        },
      ],
    },
    {
      id: "dispute_resolution",
      title: "12. DISPUTE RESOLUTION",
      content: "Legal framework for resolving disputes:",
      subsections: [
        {
          id: "governing_law",
          title: "12.1 Governing Law",
          content: `These Terms and any dispute or claim arising out of or in connection with them or the use of ForkCast shall be governed by and construed in accordance with the laws of Lebanon, without regard to conflict of law principles.`,
        },
        {
          id: "jurisdiction",
          title: "12.2 Jurisdiction",
          content: `You agree that the courts of Beirut, Lebanon shall have exclusive jurisdiction over any dispute or claim arising out of or in connection with these Terms or the use of ForkCast, except where mandatory law gives you the right to bring proceedings in your country of residence.`,
        },
        {
          id: "class_action_waiver",
          title: "12.3 Class Action Waiver",
          content: `To the extent permitted by applicable law, you agree not to participate in any class, collective, or representative action against us and to bring any claim only in your individual capacity.`,
        },
      ],
    },
    {
      id: "modifications",
      title: "13. MODIFICATIONS",
      content: "How we handle changes to these terms:",
      subsections: [
        {
          id: "changes_to_terms",
          title: "13.1 Changes to Terms",
          content: `• We may modify these Terms at any time
• Material changes will be notified via the App or email
• Continued use after changes constitutes acceptance
• Previous versions will be archived`,
        },
        {
          id: "feature_updates",
          title: "13.2 Feature Updates",
          content: `• App features may be added, modified, or removed
• We strive to improve services continuously
• Major changes will be communicated to users`,
        },
      ],
    },
    {
      id: "termination",
      title: "14. TERMINATION",
      content: "Account termination policies and procedures:",
      subsections: [
        {
          id: "user_termination",
          title: "14.1 User Termination",
          content: `• You may terminate your account at any time
• Deletion requests will be processed within 30 days
• Some information may be retained for legal compliance`,
        },
        {
          id: "our_termination_rights",
          title: "14.2 Our Termination Rights",
          content: `We may suspend or terminate accounts for:
• Violation of these Terms
• Fraudulent or illegal activity
• Extended inactivity
• Repeated policy violations`,
        },
      ],
    },
    {
      id: "accessibility",
      title: "15. ACCESSIBILITY",
      content: `We are committed to making ForkCast accessible to as many users as reasonably possible, including users with disabilities. We aim to support accessibility features provided by your device and operating system, such as screen readers, voice control, adjustable text sizes, and high-contrast modes where technically feasible.

Because ForkCast is continually evolving, some accessibility features may not be fully available on all devices or in all versions of the App. If you experience any difficulty using ForkCast due to accessibility issues, please contact us so we can try to help and improve.`,
    },
    {
      id: "contact_information",
      title: "16. CONTACT INFORMATION",
      content: `For questions about these Terms or ForkCast, you can contact us at:

Email (general/legal): Social@plate-app.com`,
    },
    {
      id: "miscellaneous",
      title: "17. MISCELLANEOUS",
      content: "Additional legal provisions:",
      subsections: [
        {
          id: "entire_agreement",
          title: "17.1 Entire Agreement",
          content: `These Terms constitute the entire agreement between you and Qwerty SAL regarding ForkCast.`,
        },
        {
          id: "severability",
          title: "17.2 Severability",
          content: `If any provision is found unenforceable, the remaining provisions shall continue in effect.`,
        },
        {
          id: "no_waiver",
          title: "17.3 No Waiver",
          content: `Our failure to enforce any right or provision shall not constitute a waiver.`,
        },
        {
          id: "assignment",
          title: "17.4 Assignment",
          content: `We may assign these Terms; you may not assign them without our consent.`,
        },
      ],
    },
    {
      id: "survival",
      title: "18. Survival",
      content: `Sections concerning IP, payments, cancellations/no-show fees, limitations of liability, dispute resolution, and any accrued obligations survive termination.`,
    },
    {
      id: "acknowledgment",
      title:
        "By using ForkCast, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.",
      content: `Effective Date: September 1, 2025`,
    },
  ],
};

// Cookie Policy Document
export const COOKIE_POLICY: LegalDocument = {
  id: "cookie_policy",
  title: "Cookie and Tracking Policy",
  lastUpdated: "2025-01-01",
  effectiveDate: "2025-01-01",
  version: "1.0",
  sections: [
    {
      id: "introduction",
      title: "Introduction",
      content: `This Cookie and Tracking Policy explains how ForkCast ("we," "us," "our") uses cookies, tracking technologies, and similar tools in our mobile application. As a mobile app, we primarily use app-specific tracking technologies rather than traditional web cookies.`,
    },
    {
      id: "tracking_technologies",
      title: "What Are Tracking Technologies?",
      content: `Mobile App Technologies:
In our mobile app, we use:

• Device Identifiers: Unique IDs assigned to your device
• Advertising IDs: IDFA (iOS) and AAID (Android)
• Analytics SDKs: Software development kits for usage tracking
• Local Storage: App-specific data storage on your device
• Session Tokens: Temporary identifiers for your app session

Purpose of Tracking:
These technologies help us:
• Maintain your session and authentication
• Remember your preferences
• Analyze app usage and performance
• Provide personalized recommendations
• Deliver relevant offers and content
• Improve app functionality`,
    },
    {
      id: "types_of_tracking",
      title: "Types of Tracking We Use",
      content:
        "We use different types of tracking technologies for various purposes:",
      subsections: [
        {
          id: "essential_tracking",
          title: "Essential Tracking",
          content: `Purpose: Required for app functionality
Data Collected:
• Authentication tokens
• Session identifiers
• Security tokens
• User preferences
• Cart/booking state

This tracking is necessary for the app to function and cannot be disabled.`,
        },
        {
          id: "performance_tracking",
          title: "Performance and Analytics Tracking",
          content: `Purpose: Improve app performance and user experience
Data Collected:
• App crash reports and error logs
• Performance metrics and load times
• Feature usage statistics
• User journey and navigation patterns
• Device and OS information

This helps us identify and fix issues, optimize performance, and understand how users interact with our app.`,
        },
        {
          id: "functional_tracking",
          title: "Functional Tracking",
          content: `Purpose: Remember your preferences and enhance usability
Data Collected:
• App settings and preferences
• Search history and filters
• Recently viewed restaurants
• Favorite locations and cuisines
• Accessibility settings

This tracking improves your experience by remembering your choices across app sessions.`,
        },
        {
          id: "marketing_tracking",
          title: "Marketing and Personalization Tracking",
          content: `Purpose: Provide personalized content and relevant advertisements
Data Collected:
• Advertising identifiers (IDFA/AAID)
• Marketing campaign interactions
• App install attribution
• In-app purchase behavior
• Content preferences and engagement

This tracking allows us to show you relevant offers and personalized recommendations.`,
        },
      ],
    },
    {
      id: "third_party_cookies",
      title: "Third-Party Cookies and Services",
      content: `We work with third-party services that may place their own cookies on your device:

ANALYTICS PROVIDERS:
• Google Analytics: App usage and user behavior analysis
• Firebase: Performance monitoring and crash reporting
• Mixpanel: User engagement and retention analytics

PAYMENT PROCESSORS:
• Stripe: Payment processing and fraud prevention
• PayPal: Alternative payment processing

MARKETING PLATFORMS:
• Facebook: Social media integration and advertising
• Google Ads: Search and display advertising
• Apple Search Ads: App Store marketing

CUSTOMER SUPPORT:
• Zendesk: Customer service and support chat
• Intercom: In-app messaging and support

Each third-party service has its own privacy policy governing their use of cookies.`,
    },
    {
      id: "cookie_management",
      title: "Managing Your Cookie Preferences",
      content: "You have control over how we use cookies:",
      subsections: [
        {
          id: "app_settings",
          title: "In-App Cookie Settings",
          content: `You can manage cookie preferences through our app:
• Go to Settings > Privacy > Cookie Preferences
• Toggle different types of cookies on/off
• Essential cookies cannot be disabled
• Changes take effect immediately
• You can change your preferences at any time`,
        },
        {
          id: "device_settings",
          title: "Device-Level Controls",
          content: `iOS DEVICES:
• Settings > Privacy & Security > Tracking
• Settings > Privacy & Security > Apple Advertising
• Limit Ad Tracking option

ANDROID DEVICES:
• Settings > Privacy > Ads
• Opt out of Ads Personalization
• Reset Advertising ID

These settings affect all apps on your device.`,
        },
        {
          id: "browser_settings",
          title: "Web Browser Settings",
          content: `If you access our Service through a web browser:
• Most browsers allow you to control cookies through settings
• You can block all cookies or only third-party cookies
• You can delete existing cookies
• Some features may not work with cookies disabled

Consult your browser's help documentation for specific instructions.`,
        },
      ],
    },
    {
      id: "consequences_of_disabling",
      title: "Consequences of Disabling Cookies",
      content: `Disabling certain cookies may affect your experience:

ESSENTIAL COOKIES (Cannot be disabled):
• You will not be able to use the Service without these

PERFORMANCE COOKIES:
• We cannot improve the Service based on usage data
• Technical issues may be harder to identify and fix
• Performance monitoring will be limited

FUNCTIONAL COOKIES:
• Personalization features will not work
• You may need to re-enter preferences each session
• Recommendations will be less relevant

MARKETING COOKIES:
• Advertisements may be less relevant to your interests
• We cannot measure marketing campaign effectiveness
• Social media features may not function properly`,
    },
    {
      id: "data_retention",
      title: "Cookie Data Retention",
      content: `Different types of cookies are retained for different periods:

SESSION COOKIES:
• Deleted when you close the app
• Used for temporary state management

PERSISTENT COOKIES:
• Essential cookies: Up to 2 years
• Performance cookies: Up to 1 year
• Functional cookies: Up to 1 year  
• Marketing cookies: Up to 90 days

THIRD-PARTY COOKIES:
• Retention periods are controlled by third-party services
• Check their privacy policies for specific timeframes
• You can delete these through your device settings

We regularly review and delete expired cookies to minimize data collection.`,
    },
    {
      id: "updates_to_policy",
      title: "Updates to This Cookie Policy",
      content: `We may update this Cookie Policy to reflect changes in:
• The cookies and technologies we use
• Legal and regulatory requirements
• Our business practices
• Industry standards

When we make significant changes:
• We will update the "Last Updated" date
• We will notify you through the app or email
• Continued use constitutes acceptance of the changes
• You can review your cookie preferences at any time

We encourage you to review this policy periodically to stay informed about our use of cookies.`,
    },
    {
      id: "contact_information",
      title: "Contact Us About Cookies",
      content: `If you have questions or concerns about our use of cookies:

Email: privacy@plate-app.com
Phone: +961 1 234 567
Address: Qwerty App, Beirut, Lebanon

For technical issues with cookie settings:
Email: support@plate-app.com

For third-party cookie concerns, you may also need to contact the relevant third-party service directly.

Data Protection Officer: dpo@plate-app.com`,
    },
  ],
};

// Community Guidelines Document
export const COMMUNITY_GUIDELINES: LegalDocument = {
  id: "community_guidelines",
  title: "Community Guidelines",
  lastUpdated: "2025-01-01",
  effectiveDate: "2025-01-01",
  version: "1.0",
  sections: [
    {
      id: "welcome",
      title: "Welcome to the ForkCast Community!",
      content: `At ForkCast, we're building a vibrant community of food lovers, restaurant enthusiasts, and dining adventurers. These guidelines help ensure everyone has a positive experience discovering and sharing great dining moments.`,
    },
    {
      id: "community_values",
      title: "Our Community Values",
      content: "Our community is built on these core values:",
      subsections: [
        {
          id: "authenticity",
          title: "Authenticity",
          content: `• Share genuine experiences
• Post real photos from your visits
• Write honest, balanced reviews
• Be yourself`,
        },
        {
          id: "respect",
          title: "Respect",
          content: `• Treat everyone with kindness
• Value diverse opinions and tastes
• Respect cultural differences
• Consider how your words affect others`,
        },
        {
          id: "helpfulness",
          title: "Helpfulness",
          content: `• Provide constructive feedback
• Share useful tips and recommendations
• Answer questions when you can
• Support local restaurants`,
        },
        {
          id: "inclusivity",
          title: "Inclusivity",
          content: `• Welcome all community members
• Celebrate diverse cuisines
• Make everyone feel valued
• Stand against discrimination`,
        },
      ],
    },
    {
      id: "creating_great_content",
      title: "Creating Great Content",
      content: "Help others make great dining decisions with quality content:",
      subsections: [
        {
          id: "reviews_that_help",
          title: "Reviews That Help Others",
          content: `Write reviews that provide value:
• Share specific details about your experience
• Mention what you ordered and how it tasted
• Describe the atmosphere and service quality
• Include helpful tips for future diners
• Be honest about both positives and areas for improvement
• Consider the restaurant's style and price point
• Update reviews if your experience changes over time`,
        },
        {
          id: "quality_photos",
          title: "Quality Photos and Media",
          content: `Share photos that showcase the experience:
• Take photos that represent the actual food and atmosphere
• Ensure good lighting and clear images
• Respect other diners' privacy
• Follow restaurant photography policies
• Share a variety of shots (food, interior, presentation)
• Avoid heavily edited or misleading images
• Caption photos with helpful context`,
        },
        {
          id: "helpful_information",
          title: "Helpful Information Sharing",
          content: `Provide useful details for the community:
• Share menu highlights and recommendations
• Mention special dietary accommodations
• Note accessibility features
• Describe parking and transportation options
• Share information about busy times and wait periods
• Mention special events or promotions
• Provide context about pricing and value`,
        },
      ],
    },
    {
      id: "prohibited_content",
      title: "Prohibited Content and Behavior",
      content:
        "The following content and behaviors are not allowed on our platform:",
      subsections: [
        {
          id: "fake_content",
          title: "Fake and Misleading Content",
          content: `• Fake reviews or reviews of restaurants you haven't visited
• Misleading information about restaurants or dining experiences
• Artificially inflated or deflated ratings
• Reviews written by restaurant owners about their own establishments
• Coordinated review campaigns or vote manipulation
• Impersonating other users or restaurant staff`,
        },
        {
          id: "inappropriate_content",
          title: "Inappropriate Content",
          content: `• Offensive, discriminatory, or hate speech
• Content that promotes violence or illegal activities
• Sexually explicit or inappropriate material
• Personal attacks or harassment of users or restaurant staff
• Defamatory or libelous statements
• Content that violates intellectual property rights`,
        },
        {
          id: "commercial_violations",
          title: "Commercial and Promotional Violations",
          content: `• Unauthorized commercial promotions or advertisements
• Soliciting business or customers through the platform
• Offering or requesting compensation for reviews
• Competing restaurant owners posting negative reviews
• Excessive self-promotion or spam
• Attempting to manipulate search results or rankings`,
        },
        {
          id: "platform_abuse",
          title: "Platform Abuse",
          content: `• Creating multiple accounts to circumvent restrictions
• Attempting to hack or compromise platform security
• Using automated tools or bots
• Scraping data from the platform without permission
• Attempting to reverse engineer the application
• Violating rate limits or usage restrictions`,
        },
      ],
    },
    {
      id: "dispute_resolution",
      title: "Handling Disputes and Conflicts",
      content: "When conflicts arise, we encourage constructive resolution:",
      subsections: [
        {
          id: "restaurant_disputes",
          title: "Disputes with Restaurants",
          content: `FIRST STEPS:
• Try to resolve issues directly with the restaurant
• Be polite and give restaurants a chance to address concerns
• Understand that mistakes can happen and staff are human
• Consider the restaurant's perspective and constraints

IF DIRECT RESOLUTION FAILS:
• Contact our support team for assistance
• Provide detailed information about the issue
• Include relevant booking information and documentation
• Be open to mediation and compromise
• Focus on fair and reasonable solutions`,
        },
        {
          id: "user_disputes",
          title: "Disputes with Other Users",
          content: `COMMUNITY CONFLICT RESOLUTION:
• Address disagreements respectfully and constructively
• Focus on the issue, not personal attacks
• Be open to different perspectives and experiences
• Use our reporting tools for serious violations
• Contact our community team for assistance with ongoing conflicts

REPORTING GUIDELINES:
• Report content that violates our guidelines
• Provide specific examples and context
• Use the reporting feature rather than public confrontation
• Be patient while we investigate reported issues`,
        },
      ],
    },
    {
      id: "consequences",
      title: "Consequences for Guideline Violations",
      content:
        "Violations of these guidelines may result in various consequences:",
      subsections: [
        {
          id: "content_actions",
          title: "Content-Related Actions",
          content: `• Content removal or editing requirements
• Temporary restriction of posting privileges
• Review or rating adjustments
• Content flagging or warnings
• Requirement to revise inappropriate content`,
        },
        {
          id: "account_actions",
          title: "Account-Related Actions",
          content: `• Warning notifications and educational resources
• Temporary suspension of account features
• Restriction of certain platform privileges
• Permanent account suspension for serious violations
• Reporting to relevant authorities for illegal activity`,
        },
        {
          id: "appeal_process",
          title: "Appeal Process",
          content: `If you believe action was taken in error:
• Contact our support team with your concern
• Provide detailed explanation of your position
• Include any relevant evidence or context
• Be respectful and patient during the review process
• Accept final decisions gracefully if your appeal is denied`,
        },
      ],
    },
    {
      id: "special_programs",
      title: "Special Programs and Recognition",
      content: "We celebrate and recognize valuable community contributors:",
      subsections: [
        {
          id: "elite_reviewers",
          title: "Elite Reviewer Program",
          content: `RECOGNITION FOR TOP CONTRIBUTORS:
• High-quality, helpful reviews
• Consistent community participation
• Positive community interactions
• Adherence to all guidelines
• Special badges and recognition
• Exclusive events and opportunities`,
        },
        {
          id: "community_champions",
          title: "Community Champions",
          content: `LEADERSHIP OPPORTUNITIES:
• Help new users understand the platform
• Moderate community discussions
• Provide feedback on platform improvements
• Assist with guideline enforcement
• Special recognition and privileges`,
        },
      ],
    },
    {
      id: "guideline_updates",
      title: "Updates to Community Guidelines",
      content: `These guidelines may be updated to reflect:
• Changes in platform features
• Evolution of community needs
• Legal and regulatory requirements
• Feedback from community members
• Industry best practices

NOTIFICATION OF CHANGES:
• In-app notifications for significant updates
• Email notifications to active community members
• Highlighted changes in the guidelines section
• Grace period for adapting to new requirements
• Opportunity to provide feedback on proposed changes`,
    },
    {
      id: "getting_help",
      title: "Getting Help and Support",
      content: `COMMUNITY SUPPORT RESOURCES:
• Help Center with detailed guides and FAQs
• Community forums for peer-to-peer assistance
• Video tutorials for platform features
• Live chat support during business hours
• Email support for complex issues

REPORTING AND FEEDBACK:
• In-app reporting tools for violations
• Community feedback surveys
• Suggestion box for platform improvements
• Direct contact with community managers
• Regular town hall meetings with leadership

CONTACT INFORMATION:
• Community Support: community@plate-app.com
• Content Issues: content@plate-app.com
• General Support: support@plate-app.com
• Phone: +961 1 234 567`,
    },
  ],
};

// Data Processing Agreement Document
export const DATA_PROCESSING_AGREEMENT: LegalDocument = {
  id: "data_processing_agreement",
  title: "Data Processing Agreement",
  lastUpdated: "2025-01-01",
  effectiveDate: "2025-01-01",
  version: "1.0",
  sections: [
    {
      id: "introduction",
      title: "Introduction",
      content: `This Data Processing Agreement ("DPA") forms part of the agreement between Qwerty App ("Data Processor," "ForkCast," "we," "us") and the Restaurant Partner ("Data Controller," "you") for the provision of restaurant reservation services through the ForkCast platform.`,
    },
    {
      id: "definitions",
      title: "Definitions",
      content: "Key terms used in this agreement:",
      subsections: [
        {
          id: "key_terms",
          title: "Key Terms",
          content: `• "Personal Data": Any information relating to an identified or identifiable natural person
• "Processing": Any operation performed on Personal Data
• "Data Subject": The individual to whom Personal Data relates (end users/diners)
• "Controller": Restaurant Partner determines purposes and means of processing
• "Data Breach": Unauthorized access, loss, disclosure, or alteration of Personal Data
• "Sub-processor": Third party services engaged by ForkCast
• "Applicable Laws": GDPR, CCPA, and other relevant data protection regulations`,
        },
      ],
    },
    {
      id: "scope_and_roles",
      title: "Scope and Roles",
      content: "This section defines the data processing relationship:",
      subsections: [
        {
          id: "relationship",
          title: "Relationship",
          content: `• Controller: Restaurant Partner determines purposes and means of processing
• Processor: ForkCast processes data on behalf of Controller
• Joint Processing: Certain activities may involve joint controllership`,
        },
        {
          id: "data_categories",
          title: "Data Categories",
          content: `Personal Data processed includes:
• Customer names and contact information
• Booking details and preferences
• Dietary requirements and restrictions
• Special requests and occasions
• Loyalty program participation
• Review and feedback data`,
        },
      ],
    },
    {
      id: "processor_obligations",
      title: "Processor Obligations",
      content: "ForkCast's commitments as a data processor:",
      subsections: [
        {
          id: "compliance",
          title: "Compliance",
          content: `ForkCast shall:
• Process Personal Data only on documented instructions
• Ensure confidentiality of processing personnel
• Implement appropriate technical and organizational measures
• Assist with data subject rights requests
• Notify Controller of data breaches within 72 hours
• Delete or return Personal Data upon termination
• Maintain records of processing activities`,
        },
        {
          id: "security_measures",
          title: "Security Measures",
          content: `Technical and organizational measures include:
• Encryption of data in transit and at rest
• Access controls and authentication
• Regular security assessments and audits
• Staff training on data protection
• Incident response procedures
• Business continuity and disaster recovery`,
        },
      ],
    },
    {
      id: "controller_obligations",
      title: "Controller Obligations",
      content: "Restaurant Partner responsibilities:",
      subsections: [
        {
          id: "lawful_basis",
          title: "Lawful Basis and Instructions",
          content: `Restaurant Partner shall:
• Ensure lawful basis for all processing activities
• Provide clear and documented processing instructions
• Obtain necessary consents from data subjects
• Maintain privacy notices and disclosures
• Respond to data subject rights requests
• Notify relevant supervisory authorities of breaches`,
        },
        {
          id: "data_accuracy",
          title: "Data Accuracy and Minimization",
          content: `Restaurant Partner must:
• Ensure Personal Data is accurate and up-to-date
• Limit data collection to what is necessary
• Establish appropriate retention periods
• Regularly review and update data processing practices
• Train staff on data protection requirements`,
        },
      ],
    },
    {
      id: "data_transfers",
      title: "International Data Transfers",
      content: `Where Personal Data is transferred internationally:
• Adequate safeguards will be implemented
• Standard Contractual Clauses may be used
• Data subjects' rights will be protected
• Regular monitoring of transfer adequacy
• Documentation of transfer impact assessments`,
    },
    {
      id: "liability_and_indemnity",
      title: "Liability and Indemnification",
      content: `• Each party is liable for damages caused by their own violations
• Controller liable for unlawful processing instructions
• Processor liable for unauthorized processing or non-compliance
• Mutual indemnification for third-party claims
• Limitation of liability as set forth in main agreement`,
    },
    {
      id: "term_and_termination",
      title: "Term and Termination",
      content: `• This DPA remains in effect while Personal Data is processed
• Either party may terminate with reasonable notice
• Upon termination, Processor will delete or return all Personal Data
• Certain provisions survive termination (liability, confidentiality)
• Data retention for legal compliance purposes may continue`,
    },
  ],
};

// Data Protection Policy Document
export const DATA_PROTECTION_POLICY: LegalDocument = {
  id: "data_protection_policy",
  title: "Data Protection Policy",
  lastUpdated: "2025-01-01",
  effectiveDate: "2025-01-01",
  version: "1.0",
  sections: [
    {
      id: "introduction",
      title: "Introduction and Scope",
      content: `This Data Protection Policy outlines Table Reserve Lebanon S.A.L.'s commitment to protecting personal data and complying with applicable data protection laws and regulations.

This policy applies to all personal data processing activities conducted by Table Reserve, including data collected through our mobile application, website, and related services.

We are committed to implementing appropriate technical and organizational measures to ensure a level of security appropriate to the risk of processing personal data.`,
    },
    {
      id: "legal_basis",
      title: "Legal Basis for Processing",
      content: "We process personal data based on the following legal grounds:",
      subsections: [
        {
          id: "consent",
          title: "Consent",
          content: `• Marketing communications and promotional offers
• Location tracking for personalized recommendations
• Sharing data with third-party partners for enhanced services
• Cookies and tracking technologies (where required)
• Participation in surveys and research studies`,
        },
        {
          id: "contract",
          title: "Contract Performance",
          content: `• Processing reservations and bookings
• Managing user accounts and profiles
• Facilitating communication with restaurants
• Processing payments and managing billing
• Providing customer support services`,
        },
        {
          id: "legitimate_interests",
          title: "Legitimate Interests",
          content: `• Improving our services and user experience
• Preventing fraud and ensuring platform security
• Conducting analytics and performance monitoring
• Developing new features and services
• Managing business operations and administration`,
        },
        {
          id: "legal_obligations",
          title: "Legal Obligations",
          content: `• Complying with financial regulations and tax requirements
• Responding to law enforcement requests
• Meeting regulatory reporting requirements
• Implementing court orders and legal judgments
• Maintaining records for audit and compliance purposes`,
        },
      ],
    },
    {
      id: "data_categories",
      title: "Categories of Personal Data",
      content: "We process the following categories of personal data:",
      subsections: [
        {
          id: "identity_data",
          title: "Identity and Contact Data",
          content: `• Full name and preferred name
• Email address and phone number
• Postal address and billing information
• Profile picture and avatar
• Date of birth (for age verification)
• Government-issued ID (when required)`,
        },
        {
          id: "account_data",
          title: "Account and Authentication Data",
          content: `• Username and account credentials
• Account preferences and settings
• Login history and session information
• Two-factor authentication data
• Security questions and answers
• Password reset tokens`,
        },
        {
          id: "transaction_data",
          title: "Transaction and Financial Data",
          content: `• Reservation and booking details
• Payment information and billing history
• Loyalty program data and rewards
• Promotional codes and discounts used
• Refund and cancellation records
• Credit card and payment method information`,
        },
        {
          id: "behavioral_data",
          title: "Behavioral and Usage Data",
          content: `• App usage patterns and navigation
• Search queries and filters applied
• Restaurants viewed and bookings made
• Reviews and ratings provided
• Communication with restaurants and support
• Feature usage and engagement metrics`,
        },
        {
          id: "technical_data",
          title: "Technical and Device Data",
          content: `• Device identifiers and characteristics
• IP address and network information
• Operating system and app version
• Location data (when permitted)
• Crash reports and error logs
• Performance and analytics data`,
        },
      ],
    },
    {
      id: "data_sources",
      title: "Sources of Personal Data",
      content: "We collect personal data from various sources:",
      subsections: [
        {
          id: "direct_collection",
          title: "Direct Collection from Users",
          content: `• Account registration and profile creation
• Reservation bookings and modifications
• Customer support interactions
• Survey responses and feedback
• Social media account connections
• Newsletter and marketing subscriptions`,
        },
        {
          id: "automatic_collection",
          title: "Automatic Data Collection",
          content: `• App usage and interaction data
• Device and technical information
• Location data (with permission)
• Cookies and tracking technologies
• Error reports and crash data
• Performance and analytics metrics`,
        },
        {
          id: "third_party_sources",
          title: "Third-Party Sources",
          content: `• Restaurant partners (booking confirmations, visit data)
• Payment processors (transaction data)
• Social media platforms (profile information)
• Marketing partners (with user consent)
• Data brokers and aggregators (for verification)
• Public databases and directories`,
        },
      ],
    },
    {
      id: "data_sharing",
      title: "Data Sharing and Recipients",
      content:
        "We share personal data with the following categories of recipients:",
      subsections: [
        {
          id: "restaurant_partners",
          title: "Restaurant Partners",
          content: `DATA SHARED:
• Name and contact information for reservations
• Party size and dining preferences
• Special requests and dietary restrictions
• Booking history for loyalty programs
• Review and rating information (anonymized)

PURPOSE:
• Facilitating restaurant bookings and service
• Enabling personalized dining experiences
• Managing loyalty and rewards programs
• Improving restaurant services and offerings`,
        },
        {
          id: "service_providers",
          title: "Service Providers and Vendors",
          content: `CATEGORIES OF PROVIDERS:
• Cloud hosting and infrastructure providers
• Payment processing companies
• Customer support platforms
• Analytics and marketing tools
• Security and fraud prevention services
• Legal and professional service providers

DATA PROTECTION MEASURES:
• Contractual data protection obligations
• Regular security assessments and audits
• Limitation of data access to necessary purposes
• Requirement for equivalent data protection standards`,
        },
        {
          id: "legal_authorities",
          title: "Legal and Regulatory Authorities",
          content: `CIRCUMSTANCES FOR DISCLOSURE:
• Valid legal process (subpoenas, court orders)
• Law enforcement investigations
• Regulatory compliance requirements
• National security matters
• Prevention of fraud or illegal activities
• Protection of rights and safety

SAFEGUARDS:
• Legal review of all requests
• Challenge of overly broad requests
• Notification to users when legally permitted
• Minimal data disclosure principle`,
        },
      ],
    },
    {
      id: "data_security",
      title: "Data Security Measures",
      content:
        "We implement comprehensive security measures to protect personal data:",
      subsections: [
        {
          id: "technical_safeguards",
          title: "Technical Safeguards",
          content: `ENCRYPTION:
• Data encrypted in transit using TLS 1.3
• Data encrypted at rest using AES-256
• End-to-end encryption for sensitive communications
• Encrypted database storage and backups

ACCESS CONTROLS:
• Multi-factor authentication for all systems
• Role-based access control (RBAC)
• Principle of least privilege access
• Regular access reviews and updates
• Automated access logging and monitoring`,
        },
        {
          id: "organizational_measures",
          title: "Organizational Measures",
          content: `PERSONNEL SECURITY:
• Background checks for employees with data access
• Regular data protection training and awareness
• Confidentiality agreements and obligations
• Clear data handling procedures and policies
• Incident response and breach notification procedures

VENDOR MANAGEMENT:
• Due diligence assessments of third-party providers
• Contractual data protection requirements
• Regular security audits and assessments
• Monitoring of vendor compliance and performance`,
        },
        {
          id: "incident_response",
          title: "Incident Response and Breach Management",
          content: `INCIDENT DETECTION:
• Automated security monitoring and alerting
• Regular vulnerability assessments and penetration testing
• Continuous threat intelligence and analysis
• Employee reporting mechanisms for suspected incidents

BREACH RESPONSE:
• Immediate containment and damage assessment
• Notification to relevant authorities within 72 hours
• User notification for high-risk breaches
• Forensic analysis and root cause investigation
• Remediation measures and security improvements`,
        },
      ],
    },
    {
      id: "data_retention",
      title: "Data Retention and Deletion",
      content:
        "We retain personal data only as long as necessary for legitimate purposes:",
      subsections: [
        {
          id: "retention_periods",
          title: "Standard Retention Periods",
          content: `ACCOUNT DATA:
• Active accounts: Retained while account is active
• Inactive accounts: Deleted after 3 years of inactivity
• Closed accounts: Deleted within 30 days of closure

TRANSACTION DATA:
• Booking records: 7 years (legal requirement)
• Payment data: 7 years (financial regulations)
• Marketing data: Until consent is withdrawn

COMMUNICATIONS:
• Customer support: 3 years from last interaction
• Marketing communications: Until unsubscribe
• Legal notices: As required by applicable law`,
        },
        {
          id: "deletion_procedures",
          title: "Data Deletion Procedures",
          content: `AUTOMATED DELETION:
• Scheduled deletion based on retention policies
• Regular cleanup of expired data
• Automated purging of temporary files and logs

MANUAL DELETION:
• User-requested account deletion
• Right to erasure requests
• Court orders and legal requirements
• Security incident response

VERIFICATION:
• Confirmation of successful data deletion
• Audit trails for deletion activities
• Third-party notification of deletions where required`,
        },
      ],
    },
    {
      id: "user_rights",
      title: "Individual Rights and Requests",
      content:
        "We respect and facilitate the exercise of individual data protection rights:",
      subsections: [
        {
          id: "access_rights",
          title: "Right of Access",
          content: `WHAT YOU CAN REQUEST:
• Confirmation of data processing activities
• Categories of personal data being processed
• Purposes and legal basis for processing
• Recipients or categories of recipients
• Retention periods for your data
• Source of data if not collected directly

HOW TO REQUEST:
• In-app data export feature
• Email request to privacy@plate.com
• Written request with identity verification
• Response within 30 days of valid request`,
        },
        {
          id: "correction_rights",
          title: "Right to Rectification",
          content: `SCOPE OF CORRECTIONS:
• Updating inaccurate personal data
• Completing incomplete information
• Correcting outdated contact details
• Updating preferences and settings

PROCESS:
• Self-service corrections through app settings
• Customer support assistance for complex changes
• Notification to third parties when required
• Verification of identity for sensitive changes`,
        },
        {
          id: "deletion_rights",
          title: "Right to Erasure",
          content: `GROUNDS FOR DELETION:
• Personal data no longer necessary for original purpose
• Withdrawal of consent where consent was the legal basis
• Objection to processing for legitimate interests
• Unlawful processing of personal data
• Compliance with legal obligations

LIMITATIONS:
• Freedom of expression and information
• Compliance with legal obligations
• Public interest or scientific research
• Establishment, exercise, or defense of legal claims`,
        },
        {
          id: "portability_rights",
          title: "Right to Data Portability",
          content: `PORTABLE DATA INCLUDES:
• Account and profile information
• Booking history and preferences
• Reviews and ratings provided
• Communication history
• Settings and configurations

DELIVERY METHODS:
• Structured data export (JSON, CSV formats)
• Secure download links
• Direct transmission to another service (where feasible)
• Physical media for large datasets (upon request)`,
        },
      ],
    },
    {
      id: "international_transfers",
      title: "International Data Transfers",
      content:
        "When we transfer data internationally, we ensure adequate protection:",
      subsections: [
        {
          id: "transfer_mechanisms",
          title: "Transfer Mechanisms",
          content: `ADEQUACY DECISIONS:
• Transfers to countries with adequate protection levels
• Regular monitoring of adequacy status
• Additional safeguards when adequacy is withdrawn

STANDARD CONTRACTUAL CLAUSES:
• EU Standard Contractual Clauses (SCCs)
• UK International Data Transfer Agreement (IDTA)
• Additional technical and organizational measures
• Regular compliance monitoring and audits

BINDING CORPORATE RULES:
• Internal data protection policies for group companies
• Consistent global data protection standards
• Regular compliance assessments and updates`,
        },
        {
          id: "transfer_safeguards",
          title: "Additional Safeguards",
          content: `TECHNICAL MEASURES:
• Enhanced encryption for international transfers
• Secure transmission protocols and channels
• Access controls and authentication requirements
• Data minimization for cross-border transfers

LEGAL PROTECTIONS:
• Contractual data protection obligations
• Rights of redress for data subjects
• Cooperation with supervisory authorities
• Notification requirements for breaches

ONGOING MONITORING:
• Regular assessment of transfer adequacy
• Updates to safeguards based on legal developments
• Documentation of transfer impact assessments`,
        },
      ],
    },
    {
      id: "contact_information",
      title: "Contact Information and Complaints",
      content: `DATA PROTECTION CONTACTS:

Data Protection Officer:
Email: dpo@plate-app.com
Phone: +961 1 234 568
Address: Qwerty App, DPO Office, Beirut, Lebanon

Privacy Team:
Email: privacy@plate-app.com
Phone: +961 1 234 567

MAKING COMPLAINTS:
If you believe your data protection rights have been violated:
1. Contact our Data Protection Officer first
2. File a complaint with the relevant supervisory authority
3. Seek legal advice if necessary

SUPERVISORY AUTHORITY:
[Relevant Lebanese Data Protection Authority]
[Contact details and complaint procedures]

We are committed to resolving data protection concerns promptly and transparently.`,
    },
  ],
};

// Export all legal documents
export const LEGAL_DOCUMENTS = {
  PRIVACY_POLICY,
  TERMS_OF_SERVICE,
  COOKIE_POLICY,
  COMMUNITY_GUIDELINES,
  DATA_PROCESSING_AGREEMENT,
  DATA_PROTECTION_POLICY,
} as const;

export type LegalDocumentType = keyof typeof LEGAL_DOCUMENTS;

// Helper functions for accessing legal documents
export const getLegalDocument = (type: LegalDocumentType): LegalDocument => {
  return LEGAL_DOCUMENTS[type];
};

export const getAllLegalDocuments = (): LegalDocument[] => {
  return Object.values(LEGAL_DOCUMENTS);
};

export const getLegalDocumentMetadata = () => {
  return Object.entries(LEGAL_DOCUMENTS).map(([key, doc]) => ({
    id: key,
    title: doc.title,
    lastUpdated: doc.lastUpdated,
    version: doc.version,
  }));
};
