# Daily Briefing Prompt

Use this prompt every morning to get an actionable summary of your sales pipeline.

---

## Instructions for Claude

Generate my daily sales briefing. Run these steps:

### 1. Check the pipeline
Use `daily_briefing` to pull today's overdue follow-ups, due actions, and pipeline summary.

### 2. Prioritize actions
Rank today's tasks by:
1. **Overdue follow-ups** — these are already late, do them first
2. **Responses received** — anyone who replied needs attention within hours
3. **Deals in active stages** (meeting_booked, sample_sent, quoting, negotiating) — these are closest to revenue
4. **Scheduled outreach** — new emails and follow-ups due today
5. **Research tasks** — new prospect research for pipeline building

### 3. Draft action items
For each due action, prepare:
- The specific email draft or call talking points
- Any research needed before the touchpoint
- The recommended next step after this action

### 4. Pipeline health check
Flag any issues:
- Deals stuck in a stage too long (>14 days in contacted, >7 days in responded)
- Prospects with no activity in 30+ days
- Stages with too few deals (pipeline might dry up)

### 5. Prospecting recommendations
If the pipeline is thin (fewer than 10 active deals), suggest:
- New HS codes to search on ImportYeti
- Industries to prospect on Apollo
- Seasonal opportunities coming up that need lead time

### Output format:

```
## 🌅 Good morning! Here's your sales day — {{date}}

### 🔴 Do Now (overdue/urgent)
1. ...

### 🟡 Do Today
1. ...

### 🟢 Pipeline Snapshot
- New: X | Contacted: X | Responded: X | Meeting: X | Quoting: X

### 💡 Recommendations
- ...

### 📝 Pre-drafted
[Include draft emails or call notes for today's tasks]
```
