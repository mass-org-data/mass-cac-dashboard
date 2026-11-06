# Original frontend coverage

All pages below are from the manager-approved original inventory. Repeated role/record instances are normalized into separate field/action definitions in the workbook. Exact current-source links pin61893eb; the approved design reference pins0b57ea1. The replacement workspace is not treated as the specification.

|Page|Captured role contexts|Distinct KPI labels|Numbered charts|Distinct table-column contexts|
|---|---:|---:|---|---:|
|overview|3|6|1, 2, 22, 23, 24, 25|7|
|attendance|3|3|3, 4, 5|7|
|daily|2|0||0|
|children|2|0||10|
|learning|3|4|6, 7, 8, 9, 10|7|
|activities|3|4|11, 12|0|
|visits|3|4|13, 14|6|
|morarji|3|0|15, 16, 18|8|
|donor|3|4|20, 21|0|
|guidance|2|4|19|7|

## Source function index

This index locates original rendering, filter, mutation, calculation, export and management functions individually. References are single-line links because the original functions are mostly minified onto one physical line; a large physical line is not a small function.

- `toast()` — [`src/app.js:12`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L12)
- `persist()` — [`src/app.js:13`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L13)
- `scope()` — [`src/app.js:14`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L14)
- `children()` — [`src/app.js:15`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L15)
- `scoreInfo()` — [`src/app.js:17`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L17)
- `scoreGroup()` — [`src/app.js:18`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L18)
- `recordedBand()` — [`src/app.js:19`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L19)
- `stats()` — [`src/app.js:20`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L20)
- `totals()` — [`src/app.js:21`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L21)
- `navItems()` — [`src/app.js:22`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L22)
- `select()` — [`src/app.js:23`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L23)
- `filters()` — [`src/app.js:24`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L24)
- `head()` — [`src/app.js:25`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L25)
- `button()` — [`src/app.js:26`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L26)
- `metric()` — [`src/app.js:27`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L27)
- `bar()` — [`src/app.js:28`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L28)
- `columns()` — [`src/app.js:29`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L29)
- `shortColumns()` — [`src/app.js:30`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L30)
- `cohortColumns()` — [`src/app.js:31`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L31)
- `section()` — [`src/app.js:33`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L33)
- `chartCentres()` — [`src/app.js:34`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L34)
- `engagementCategory()` — [`src/app.js:37`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L37)
- `engagement()` — [`src/app.js:38`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L38)
- `centreEngagement()` — [`src/app.js:39`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L39)
- `dataEntryGaps()` — [`src/app.js:40`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L40)
- `summary()` — [`src/app.js:41`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L41)
- `overview()` — [`src/app.js:42`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L42)
- `sessionPanel()` — [`src/app.js:43`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L43)
- `attendance()` — [`src/app.js:44`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L44)
- `daily()` — [`src/app.js:45`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L45)
- `learning()` — [`src/app.js:46`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L46)
- `activityEvents()` — [`src/app.js:47`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L47)
- `activities()` — [`src/app.js:48`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L48)
- `dropoutStatus()` — [`src/app.js:49`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L49)
- `dropoutCard()` — [`src/app.js:50`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L50)
- `attendanceRate()` — [`src/app.js:52`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L52)
- `reviewNotes()` — [`src/app.js:53`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L53)
- `topPerformers()` — [`src/app.js:54`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L54)
- `profileTable()` — [`src/app.js:55`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L55)
- `attendanceTable()` — [`src/app.js:56`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L56)
- `learningTable()` — [`src/app.js:57`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L57)
- `comparisonPanel()` — [`src/app.js:58`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L58)
- `editLearningRow()` — [`src/app.js:59`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L59)
- `newMorarji()` — [`src/app.js:60`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L60)
- `newGuidance()` — [`src/app.js:61`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L61)
- `paginateTables()` — [`src/app.js:64`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L64)
- `profileBreakdown()` — [`src/app.js:65`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L65)
- `activitySession()` — [`src/app.js:67`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L67)
- `participationButtons()` — [`src/app.js:68`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L68)
- `activityParticipants()` — [`src/app.js:69`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L69)
- `roster()` — [`src/app.js:72`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L72)
- `visits()` — [`src/app.js:73`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L73)
- `morarjiRows()` — [`src/app.js:74`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L74)
- `morarjiYears()` — [`src/app.js:75`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L75)
- `morarjiScorecard()` — [`src/app.js:76`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L76)
- `morarji()` — [`src/app.js:77`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L77)
- `guidance()` — [`src/app.js:79`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L79)
- `donor()` — [`src/app.js:80`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L80)
- `render()` — [`src/app.js:81`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L81)
- `field()` — [`src/app.js:82`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L82)
- `drop()` — [`src/app.js:83`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L83)
- `modal()` — [`src/app.js:85`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L85)
- `close()` — [`src/app.js:86`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L86)
- `childDetail()` — [`src/app.js:87`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L87)
- `editChild()` — [`src/app.js:88`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L88)
- `followup()` — [`src/app.js:90`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L90)
- `enterMarks()` — [`src/app.js:91`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L91)
- `eventEdit()` — [`src/app.js:92`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L92)
- `sessionEntry()` — [`src/app.js:93`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L93)
- `newActivity()` — [`src/app.js:94`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L94)
- `activityPlanReference()` — [`src/app.js:95`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L95)
- `activityEntry()` — [`src/app.js:96`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L96)
- `newVisit()` — [`src/app.js:97`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L97)
- `editMorarji()` — [`src/app.js:98`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L98)
- `editGuidance()` — [`src/app.js:99`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L99)
- `managedRecords()` — [`src/app.js:101`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L101)
- `manageRecords()` — [`src/app.js:110`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L110)
- `removeRecord()` — [`src/app.js:111`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L111)
- `undoRemoval()` — [`src/app.js:112`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L112)
- `editManagedRecord()` — [`src/app.js:113`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L113)
- `guide()` — [`src/app.js:116`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L116)
- `csvExport()` — [`src/app.js:117`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L117)
- `navigate()` — [`src/app.js:118`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L118)

## Browser persistence and operation boundary

Original `persist`, save handlers, daily attendance marks, score entry, activities, visits, Morarji edits, guidance edits, follow-ups, management removal and undo use the original browser model/localStorage. In live review, persist is overridden to reject persistence and a capture handler redirects many controls to workspace. The following are distinct failures, not one successful backend workflow:

- Redirected controls lose the intended operation/record/centre/date; equivalent save has not been demonstrated.
- Controls with data-morarji/data-guidance/data-event are absent from the capture guard and may mutate memory before persistence throws.
- Original remove/clear/undo act on local snapshots; there is no equivalent approved canonical server recovery contract.
- The activity-session modal throws before it renders.
- Unknown daily marks default visually to draft Present; this is not proof they were automatically written to production.

Individual FORM FIELD AUDIT action rows cover navigation, export/print/download, table pagination/search, modals, per-record edits, management, removal and undo. Write contracts remain open until actual persisted evidence exists. Helpers `dataEntryGaps()` and `topPerformers()` are present but not treated as independently rendered dashboard sections.
