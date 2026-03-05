---
name: ado-test-case-create
description: Create and update ADO Test Case work items with properly formatted test steps using the REST API script. Use this when asked to create, update, or manage ADO test cases.
---

# Creating ADO Test Case Work Items

Use `utils/update-ado-test-steps.js` to create and manage ADO Test Case work items with properly formatted test steps.

## Why This Script Exists

The `az boards` CLI **strips XML attribute quotes** when setting the `Microsoft.VSTS.TCM.Steps` field (e.g., `id="0"` becomes `id=0`). This makes test steps **invisible** in the ADO UI. The script calls the ADO REST API directly and preserves proper XML formatting.

---

## Step-by-Step: Create a New Test Case

### 1. Choose Your Team

| Team | Area Path | Iteration Command |
|---|---|---|
| Azure Monitor UX | `One\Azure Monitor\UX` | `az boards iteration team list --team "Azure Monitor.UX" --org https://msazure.visualstudio.com --project One -o table` |
| Azure Managed Grafana | `One\AEP\Obs\Azure Managed Grafana` | `az boards iteration team list --team "Azure Observability Experiences and Canvases - Grafana" --org https://msazure.visualstudio.com --project One -o table` |

Run the iteration command for your team and pick the row whose date range includes today.

### 2. Create the Work Item Shell

```powershell
az boards work-item create --title "My Feature Behavior" --type "Test Case" --area "<AREA_PATH>" --iteration "<ITERATION_PATH>" --org https://msazure.visualstudio.com --project One
```

This returns a work item ID (e.g., `37004461`). Note it for the next step.

**Do NOT set steps via `--fields` in this command** — the CLI will strip XML quotes.

### 3. Write the Test Steps XML File

Create a file (e.g., `my-steps.xml`) with your test steps:

```xml
<steps id="0" last="4">
  <step id="1" type="ActionStep">
    <parameterizedString isformatted="true">Navigate to the create page</parameterizedString>
    <parameterizedString isformatted="true"></parameterizedString>
  </step>
  <step id="2" type="ValidateStep">
    <parameterizedString isformatted="true">Click the &lt;B&gt;Submit&lt;/B&gt; button</parameterizedString>
    <parameterizedString isformatted="true">Form is submitted successfully</parameterizedString>
  </step>
  <step id="3" type="ActionStep">
    <parameterizedString isformatted="true">Select &lt;B&gt;Option A&lt;/B&gt; from dropdown</parameterizedString>
    <parameterizedString isformatted="true"></parameterizedString>
  </step>
  <step id="4" type="ValidateStep">
    <parameterizedString isformatted="true">Verify the result</parameterizedString>
    <parameterizedString isformatted="true">Expected output is displayed</parameterizedString>
  </step>
</steps>
```

### 4. Set the Steps via REST API

```powershell
node utils/update-ado-test-steps.js <WORK_ITEM_ID> my-steps.xml
```

Example output:

```
Updating work item #37004461...
Reading steps from: C:\Repos\azure-portal-ui-cli-tools\my-steps.xml
Authenticated with Azure CLI
Updated successfully
   Steps: 4
   XML quotes preserved: true
   Link: https://msazure.visualstudio.com/One/_workitems/edit/37004461
```

### 5. Verify in ADO

Open the link and confirm steps are visible in the Test Case UI.

---

## Updating Steps on an Existing Test Case

Same command — the script replaces the steps field:

```powershell
# Edit your XML file, then:
node utils/update-ado-test-steps.js <WORK_ITEM_ID> updated-steps.xml
```

---

## Steps XML Reference

### Structure

```xml
<steps id="0" last="N">
  <!-- N must equal the highest step id -->
  <step id="1" type="ActionStep">...</step>
  <step id="2" type="ValidateStep">...</step>
  ...
</steps>
```

### Step Types

| Type | Purpose | Second parameterizedString |
|---|---|---|
| `ActionStep` | Action only (no expected result) | Leave empty: `<parameterizedString isformatted="true"></parameterizedString>` |
| `ValidateStep` | Action + expected result | Contains the expected result text |

### Text Formatting in Steps

Use HTML entity encoding inside `<parameterizedString>` tags:

| Want | Write |
|---|---|
| **Bold** | `&lt;B&gt;text&lt;/B&gt;` |
| *Italic* | `&lt;I&gt;text&lt;/I&gt;` |
| "Quotes" | `&quot;text&quot;` |
| Ampersand (&) | `&amp;amp;` (double-encoded: XML inside JSON) |
| Line break | `&lt;BR/&gt;` |
| Paragraph | `&lt;P&gt;text&lt;/P&gt;` |

### Example: Full Test Case

```xml
<steps id="0" last="8">
  <step id="1" type="ActionStep">
    <parameterizedString isformatted="true">On Basics page, verify telemetry type defaults to Windows or Linux</parameterizedString>
    <parameterizedString isformatted="true"></parameterizedString>
  </step>
  <step id="2" type="ValidateStep">
    <parameterizedString isformatted="true">Select the &lt;B&gt;Collect and deliver&lt;/B&gt; tab, click &lt;B&gt;+Add data source&lt;/B&gt; button</parameterizedString>
    <parameterizedString isformatted="true">DataSourcePicker context pane opens. Data source type shows &quot;Select a data type&quot;, and Add data source button is disabled</parameterizedString>
  </step>
  <step id="3" type="ValidateStep">
    <parameterizedString isformatted="true">Click &lt;B&gt;Firewall logs&lt;/B&gt; from Data source type dropdown</parameterizedString>
    <parameterizedString isformatted="true">Three checkboxes appear: &quot;Domain&quot;, &quot;Private&quot;, and &quot;Public&quot;. Add data source button becomes enabled</parameterizedString>
  </step>
  <step id="4" type="ActionStep">
    <parameterizedString isformatted="true">Select some checkboxes at random</parameterizedString>
    <parameterizedString isformatted="true"></parameterizedString>
  </step>
  <step id="5" type="ValidateStep">
    <parameterizedString isformatted="true">Switch to &lt;B&gt;Destinations&lt;/B&gt; tab</parameterizedString>
    <parameterizedString isformatted="true">Default destination is Log Analytics Workspaces</parameterizedString>
  </step>
  <step id="6" type="ValidateStep">
    <parameterizedString isformatted="true">Click &lt;B&gt;Add destination&lt;/B&gt;, select subscription and workspace, click &lt;B&gt;Apply&lt;/B&gt;</parameterizedString>
    <parameterizedString isformatted="true">Destination is added. Save button is enabled</parameterizedString>
  </step>
  <step id="7" type="ValidateStep">
    <parameterizedString isformatted="true">Switch to &lt;B&gt;Data source&lt;/B&gt; tab, click &lt;B&gt;Save&lt;/B&gt;</parameterizedString>
    <parameterizedString isformatted="true">Data source is added to the table</parameterizedString>
  </step>
  <step id="8" type="ValidateStep">
    <parameterizedString isformatted="true">Click the data source in the table</parameterizedString>
    <parameterizedString isformatted="true">Pane reopens with Save enabled and previous selections preserved</parameterizedString>
  </step>
</steps>
```

---

## Prerequisites

- **Azure CLI** installed and logged in (`az login`)
- **Node.js** installed
- Access to ADO organization `msazure.visualstudio.com`

The script uses `az account get-access-token` to authenticate — no PAT required.

---

## Troubleshooting

| Error | Fix |
|---|---|
| `Failed to get access token` | Run `az login` first |
| `File not found` | Check the XML file path |
| `File does not contain valid <steps> XML` | Ensure file starts with `<steps` |
| `HTTP 401` | Token expired, run `az login` again |
| `HTTP 404` | Wrong work item ID |
| Steps still not visible in ADO | Check that `last` attribute matches highest step `id` |
