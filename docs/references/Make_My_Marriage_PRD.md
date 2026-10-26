# **Make My Marriage** 

Product Requirements Document | Version 1.0 

Purpose: Personal use | Language: English | Platform: Responsive web application 

## **1. Product overview** 

Make My Marriage helps a couple organize their Indian wedding in one place. It brings together ceremony details, tasks, spending, family invitations, attendance responses, livestreams, and photos. 

The couple manages the wedding through one shared account. Guests use personalized family invitation links without creating accounts. 

## **2. Problem statement** 

Indian weddings involve multiple events, families, responsibilities, and expenses. Details spread across conversations and spreadsheets can make it difficult to track what needs doing, who spent money, and which families are attending each event. 

The application will provide one place to manage this information and a simple website for guests to access their invitations and wedding updates. 

## **3. Goals** 

- Help the couple manage their wedding from one dashboard. 

- Organize multiple ceremonies with minimal setup. 

- Track tasks and the people responsible for them. 

- Record expenses and spending by person. 

- Invite families to specific events. 

- Collect attendance counts without guest registration. 

- Share invitations and reminders through WhatsApp. 

- Provide directions, YouTube livestreams, and shared photos. 

## **4. Users and access** 

### **Couple** 

Full access through one shared login: manage wedding details, events, tasks, expenses, families, invitations, livestreams, and photos. 

### **Guest family** 

Access through a unique invitation link: view invited events, respond to invitations, get directions, watch livestreams, and upload or view photos. 

One account manages one wedding. There are no separate partner accounts, family workspaces, or vendor accounts. 

MAKE MY MARRIAGE  |  PRD v1.0 

1 

## **5. Primary user journeys** 

### **Couple journey** 

- 1. Register and log in. 

- 2. Enter the groom's name, bride's name, wedding date, and venue. 

- 3. Review the preset ceremonies and edit or remove them. 

- 4. Add families and select their invited events. 

- 5. Share personalized invitation links through WhatsApp. 

- 6. Manage tasks, record expenses, and monitor RSVPs. 

- 7. Add livestream links and manage the shared gallery. 

### **Guest journey** 

- 1. Open the family invitation link received through WhatsApp. 

- 2. View the invitation and the events the family is invited to. 

- 3. Confirm attendance and member counts for each event. 

- 4. Reopen the link to update the response or view directions and schedules. 

- 5. Watch available livestreams and upload or view photos. 

## **6. Functional requirements** 

### **6.1 Authentication** 

- Support registration, login, logout, and password reset. 

- Provide one shared account for the couple. 

- Keep management pages accessible only after login. 

- Keep the account connected to one wedding. 

### **Acceptance criteria** 

- The couple can log in from different devices using the same credentials. 

- Unauthenticated visitors cannot access management data. 

- Logging out ends access to protected pages. 

### **6.2 Wedding setup** 

Required fields: groom's name, bride's name, wedding date, and main wedding venue. 

Optional fields: couple photo or cover image, and main venue Google Maps link. 

The couple can edit these details later. Updated details must appear on the dashboard and invitation pages. 

### **Acceptance criteria** 

- Setup requires all mandatory fields. 

- Saved details remain available after logout and login. 

- Changes appear on existing invitation links. 

MAKE MY MARRIAGE  |  PRD v1.0 

2 

### **6.3 Dashboard** 

- Couple's names and wedding countdown. 

- Upcoming events in chronological order. 

- Pending, completed, and overdue task counts. 

- Total spending. 

- Total invited families and invited members. 

- Families with pending RSVPs. 

- Confirmed guest counts by event. 

- Quick actions to add a family, task, expense, or event. 

### **Acceptance criteria** 

- Dashboard figures reflect the latest saved records. 

- Attendance is displayed per event; attendance across several events is not presented as a unique guest total. 

- Empty sections provide a clear action to get started. 

### **6.4 Event management** 

Create these editable events during setup: engagement, haldi, mehendi, sangeet, wedding, and reception. 

- Each event supports a name, date and time, venue name or address, optional Google Maps link, invited families, and RSVP summary with confirmed attendance. 

- The couple can add, edit, and remove events. 

- Incomplete preset events remain drafts and do not appear on guest invitations until their required details are complete. 

### **Acceptance criteria** 

- Events appear in chronological order. 

- A family sees only events assigned to it. 

- Removing an event requires confirmation and removes its invitation assignments and RSVP records. 

- Existing expenses remain recorded if their associated event is removed. 

### **6.5 Task planner** 

Each task contains a task name, responsible person's name, optional due date, optional associated event, and status: pending or completed. 

- Create, edit, and delete tasks. 

- Mark complete or reopen. 

- Filter by pending, completed, and overdue. 

Responsible people are text entries and do not require accounts or receive assigned access. 

### **Acceptance criteria** 

- An incomplete task with a past due date appears overdue. 

- Completed tasks do not appear overdue. 

- Task updates are reflected on the dashboard. 

MAKE MY MARRIAGE  |  PRD v1.0 

3 

### **6.6 Expense tracker** 

Each expense contains a description, amount in Indian rupees, date, payer's name, and optional associated event. 

- Create, edit, and delete expenses. 

- View total spending. 

- View spending grouped by payer or event. 

- Filter expense records by payer or event. 

For the first version, each expense has one payer. Shared purchases can be entered as separate records for each person's contribution. 

### **Acceptance criteria** 

- Amounts must be greater than zero. 

- Editing or deleting an expense updates all totals. 

- Expenses without an event remain included in overall and payer totals. 

- The tracker records spending; it does not calculate reimbursements or outstanding balances. 

### **6.7 Family-based guest management** 

Each family record contains a family name, WhatsApp number including country code, invited member count, selected events, unique invitation link, and RSVP status for each invited event. 

- Add, edit, and remove families. 

- Search by family name or phone number. 

- View invited and confirmed member counts by event. 

- Filter families by event or RSVP status. 

### **Acceptance criteria** 

- Individual guest profiles are not required. 

- Invited member count must be a positive whole number. 

- The couple can invite one family to several events. 

- Removing a family invalidates its invitation link. 

- Removing an event assignment removes that family's response for that event after confirmation. 

### **6.8 Digital invitations** 

- Provide one traditional Indian wedding template. 

- Use English text and a traditional color palette, such as maroon, cream, and gold. 

- Display the couple's names and family name. 

- Show only the family's invited events. 

- Include dates, times, venues, directions, and RSVP access. 

- Provide a WhatsApp sharing action. 

### **Acceptance criteria** 

- Each family receives a distinct, difficult-to-guess link. 

MAKE MY MARRIAGE  |  PRD v1.0 

4 

- Invitation links remain the same when wedding details change. 

- Invitations work on mobile without registration. 

- Invalid or removed links display a clear unavailable message without exposing wedding management data. 

### **6.9 RSVP** 

For each invited event, the family representative can select attending or not attending, enter the number of attending members, and submit or later update the response. RSVP statuses are pending, attending, and not attending. 

### **Acceptance criteria** 

- Attendance is recorded separately for each event. 

- Attending counts must be whole numbers between one and the family's invited member count. 

- Selecting not attending records zero attendees. 

- Updating a response replaces the previous response. 

- Unanswered events remain pending. 

- Guests cannot submit responses for events they are not invited to. 

### **6.10 WhatsApp sharing and reminders** 

Provide prepared messages for sending an invitation, requesting a pending RSVP, reminding a family about an upcoming event, and sharing an event update. 

The couple selects a family and opens WhatsApp with a prepared message. The couple reviews and sends it manually. 

### **Acceptance criteria** 

- Messages include the relevant invitation link. 

- Event reminders reference only events assigned to that family. 

- The application does not claim a message was delivered or read. 

- Automatic scheduling and automatic WhatsApp delivery are outside the first version. 

### **6.11 Guest wedding page** 

Provide a personalized invitation, invited event schedule, RSVP, venue directions, available livestreams for invited events, and the shared wedding photo gallery. 

### **Acceptance criteria** 

- Guests cannot access tasks, expenses, management screens, or other families' records. 

- Event restrictions apply to both displayed content and data access. 

- The shared gallery is visible to all valid invitation-link holders, regardless of their invited events. 

### **6.12 YouTube livestreams** 

- Allow the couple to add or update a YouTube livestream URL for each event. 

- Embed the stream on the relevant guest event page. 

- Provide an Open on YouTube link when embedding is unavailable. 

MAKE MY MARRIAGE  |  PRD v1.0 

5 

### **Acceptance criteria** 

- Only supported YouTube URLs are accepted. 

- Events without a livestream link do not show an empty player. 

- Guests see livestreams only for their invited events. 

- Video broadcasting and recording are handled by YouTube. 

### **6.13 Shared photo gallery** 

- Allow the couple and guests with valid invitation links to upload photos. 

- Allow all valid invitation-link holders to view the same gallery. 

- Support optional event labels and an All photos view. 

- Allow photos to open in a larger view. 

- Allow the couple to delete any photo. 

Initial upload rules: JPEG, PNG, and WebP; maximum 10 MB per photo; upload progress, success, and failure feedback; successful uploads publish immediately. 

### **Acceptance criteria** 

- Guests can upload without creating accounts. 

- Unsupported or oversized files are rejected with a clear message. 

- Only the couple can delete photos. 

- Photos remain available across devices and sessions. 

- Event labels organize photos but do not restrict gallery visibility. 

### **6.14 Settings** 

Allow the couple to update wedding details, cover image, account password, and event livestream links. Provide a sign-out action. 

## **7. Navigation** 

### **Couple area** 

Dashboard / Events / Tasks / Expenses / Guests / Invitation / Gallery / Settings 

### **Guest area** 

Invitation / My Events / RSVP / Directions / Livestreams / Photos 

Guest navigation can use sections on one mobile-friendly page. 

## **8. Core data entities** 

Account: Login credentials and linked wedding. 

Wedding: Couple names, wedding date, venue, cover image. 

Event: Wedding, name, date, time, venue, maps link, livestream URL. 

Task: Wedding, name, responsible person, due date, status, optional event. 

Expense: Wedding, description, amount, date, payer, optional event. 

MAKE MY MARRIAGE  |  PRD v1.0 

6 

Family: Wedding, family name, WhatsApp number, invited count, invitation token. 

Event invitation: Family, event, RSVP status, attending count. 

Photo: Wedding, stored image, upload time, optional event label. 

## **9. Design requirements** 

- Traditional Indian wedding styling. 

- Clear typography and readable contrast. 

- Simple forms and prominent primary actions. 

- Mobile-first layouts for invitations, RSVP, and photo uploads. 

- Friendly empty states and clear validation messages. 

- Confirmation before deleting events, families, expenses, or photos. 

- Avoid decorative effects that slow down essential actions. 

## **10. Non-functional requirements** 

### **Security and privacy** 

- Protect account credentials using standard secure authentication practices. 

- Enforce authorization on the server for management and guest data. 

- Use HTTPS for a deployed application. 

- Treat invitation links as access credentials: anyone holding a family's link can view its invitation and update its RSVP. 

- Validate uploaded files and apply upload rate limits. 

- Keep stored photos accessible through authorized application access. 

### **Reliability** 

- Save data persistently across devices and sessions. 

- Show clear feedback when saves or uploads fail. 

- Prevent duplicate records from repeated submission clicks. 

- Keep totals consistent after edits and deletions. 

### **Usability and accessibility** 

- Work in current mobile and desktop browsers. 

- Support keyboard navigation and labeled form fields. 

- Do not rely on color alone to communicate status. 

- Show dates and times clearly in Indian Standard Time. 

- Format money using Indian rupee conventions. 

### **Performance** 

- Optimize invitation images and gallery thumbnails. 

- Load gallery photos progressively. 

MAKE MY MARRIAGE  |  PRD v1.0 

7 

- Keep guest pages usable on typical mobile internet connections. 

## **11. First-release scope** 

The first release includes all features in Section 6: 

- Shared couple authentication. 

- Wedding setup and dashboard. 

- Multiple events. 

- Task planning. 

- Spending by person and event. 

- Family-based guest management. 

- Personalized invitations. 

- Event-wise RSVP. 

- Manual WhatsApp sharing and reminders. 

- Directions and schedules. 

- YouTube embeds. 

- Shared photo uploads and viewing. 

## **12. Out of scope** 

- Multiple weddings per account. 

- Separate logins or permission roles for partners and relatives. 

- Professional wedding-planner organizations. 

- Vendor marketplace or vendor accounts. 

- Payment processing or paid subscriptions. 

- Automated WhatsApp messaging. 

- Accommodation, transport, and room allocation. 

- Individual guest profiles. 

- Budget forecasting, reimbursements, and payment settlement. 

- Native video broadcasting. 

- Face recognition or automatic photo tagging. 

- Multiple languages. 

- Multiple invitation templates. 

- Native Android or iOS apps. 

## **13. Release acceptance checklist** 

The application is ready for personal use when: 

- The couple can register, configure the wedding, and return to saved information. 

- Events can be created, edited, removed, and assigned to families. 

MAKE MY MARRIAGE  |  PRD v1.0 

8 

- Tasks and expenses update dashboard summaries correctly. 

- Each family's link shows only its invited events. 

- Families can RSVP separately for each event without accounts. 

- RSVP updates produce accurate event attendance totals. 

- WhatsApp actions open the correct prepared message and invitation link. 

- Venue links and supported YouTube embeds work. 

- Guests can upload and view photos, and the couple can remove them. 

- Guest access cannot reveal private management information. 

- Core workflows work on both phones and desktop browsers. 

## **14. Dependencies and cost assumptions** 

The application will not charge users. Deployment still requires hosting, persistent data storage, authentication, and photo storage. Whether these remain free depends on provider limits and actual usage. 

WhatsApp is used for manual sharing, Google Maps links provide directions, and YouTube hosts livestreams. Provider selection and the implementation technology stack remain open. 

MAKE MY MARRIAGE  |  PRD v1.0 

9 

