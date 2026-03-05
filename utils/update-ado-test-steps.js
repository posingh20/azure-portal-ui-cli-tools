/**
 * update-ado-test-steps.js
 *
 * Updates the test steps on an ADO Test Case work item via the REST API.
 * The `az boards` CLI strips XML attribute quotes, which breaks step rendering
 * in the ADO UI. This script preserves proper XML formatting.
 *
 * Usage:
 *   node utils/update-ado-test-steps.js <workItemId> <stepsXmlFile>
 *
 * Example:
 *   node utils/update-ado-test-steps.js 37004461 my-steps.xml
 *
 * Prerequisites:
 *   - Azure CLI installed and logged in (`az login`)
 *   - Access to the ADO organization (msazure.visualstudio.com)
 *
 * The steps XML file should contain valid ADO test step XML, e.g.:
 *
 *   <steps id="0" last="3">
 *     <step id="1" type="ActionStep">
 *       <parameterizedString isformatted="true">Do something</parameterizedString>
 *       <parameterizedString isformatted="true"></parameterizedString>
 *     </step>
 *     <step id="2" type="ValidateStep">
 *       <parameterizedString isformatted="true">Check something</parameterizedString>
 *       <parameterizedString isformatted="true">Expected result</parameterizedString>
 *     </step>
 *   </steps>
 */

const { execSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

const ORG = 'msazure.visualstudio.com';
const PROJECT = 'One';
const ADO_RESOURCE_ID = '499b84ac-1321-427f-aa17-267ca6975798';

function getAccessToken() {
  const token = execSync(
    `az account get-access-token --resource ${ADO_RESOURCE_ID} --query accessToken -o tsv`,
    { encoding: 'utf8' }
  ).trim();
  if (!token) {
    throw new Error('Failed to get access token. Run `az login` first.');
  }
  return token;
}

function updateWorkItem(workItemId, stepsXml, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify([
      { op: 'replace', path: '/fields/Microsoft.VSTS.TCM.Steps', value: stepsXml },
    ]);

    const options = {
      hostname: ORG,
      path: `/${PROJECT}/_apis/wit/workitems/${workItemId}?api-version=7.0`,
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json-patch+json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          const result = JSON.parse(data);
          const steps = result.fields['Microsoft.VSTS.TCM.Steps'] || '';
          const hasQuotes = steps.includes('id="');
          const stepCount = (steps.match(/<step /g) || []).length;
          resolve({ success: true, hasQuotes, stepCount, steps });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 500)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: node utils/update-ado-test-steps.js <workItemId> <stepsXmlFile>');
    console.log('');
    console.log('Example:');
    console.log('  node utils/update-ado-test-steps.js 37004461 my-steps.xml');
    process.exit(1);
  }

  const workItemId = parseInt(args[0], 10);
  const xmlFile = args[1];

  if (isNaN(workItemId)) {
    console.error(`Error: "${args[0]}" is not a valid work item ID`);
    process.exit(1);
  }

  if (!fs.existsSync(xmlFile)) {
    console.error(`Error: File not found: ${xmlFile}`);
    process.exit(1);
  }

  const stepsXml = fs.readFileSync(xmlFile, 'utf8').trim();
  if (!stepsXml.includes('<steps')) {
    console.error('Error: File does not contain valid <steps> XML');
    process.exit(1);
  }

  console.log(`Updating work item #${workItemId}...`);
  console.log(`Reading steps from: ${path.resolve(xmlFile)}`);

  const token = getAccessToken();
  console.log('Authenticated with Azure CLI');

  const result = await updateWorkItem(workItemId, stepsXml, token);
  console.log(`✅ Updated successfully`);
  console.log(`   Steps: ${result.stepCount}`);
  console.log(`   XML quotes preserved: ${result.hasQuotes}`);
  console.log(`   Link: https://${ORG}/${PROJECT}/_workitems/edit/${workItemId}`);
}

main().catch((err) => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
