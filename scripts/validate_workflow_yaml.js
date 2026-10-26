/**
 * Simple YAML Parser & Syntax Validator for GitHub Actions Workflows
 *
 * Validates .github/workflows/test.yml without external dependencies.
 */

'use strict';

const fs = require('fs');
const path = require('path');

function parseSimpleYaml(content) {
  const lines = content.split(/\r?\n/);
  const root = {};
  const stack = [{ indent: -1, container: root, type: 'map' }];

  for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
    const rawLine = lines[lineNum - 1];

    // Check for illegal tabs
    if (rawLine.includes('\t')) {
      throw new Error(`Line ${lineNum}: Illegal tab character found in YAML`);
    }

    // Ignore empty lines and comment lines
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) {
      continue;
    }

    const indent = rawLine.search(/\S/);
    const text = rawLine.trim();

    // Check multiline pipe block continuation
    const currentTop = stack[stack.length - 1];
    if (currentTop.inPipeBlock) {
      if (indent > currentTop.pipeIndent) {
        currentTop.pipeLines.push(rawLine.slice(currentTop.pipeIndent + 2));
        continue;
      } else {
        // End of pipe block
        currentTop.target[currentTop.targetKey] = currentTop.pipeLines.join('\n');
        delete currentTop.inPipeBlock;
        delete currentTop.pipeLines;
        delete currentTop.pipeIndent;
        delete currentTop.target;
        delete currentTop.targetKey;
      }
    }

    // Pop stack for shallower or equal indent
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      const popped = stack.pop();
      if (popped.inPipeBlock) {
        popped.target[popped.targetKey] = popped.pipeLines.join('\n');
      }
    }

    const parent = stack[stack.length - 1];

    if (text.startsWith('- ')) {
      // Sequence item
      const itemContent = text.slice(2).trim();
      let seqContainer;
      if (parent.type === 'seq') {
        seqContainer = parent.container;
      } else {
        throw new Error(`Line ${lineNum}: Unexpected list item without parent sequence`);
      }

      if (itemContent === '') {
        const newObj = {};
        seqContainer.push(newObj);
        stack.push({ indent, container: newObj, type: 'map' });
      } else if (itemContent.includes(':')) {
        // List item with key-value (e.g., "- name: Foo")
        const colonIdx = itemContent.indexOf(':');
        const key = itemContent.slice(0, colonIdx).trim();
        const rawVal = itemContent.slice(colonIdx + 1).trim();
        const newObj = {};
        seqContainer.push(newObj);
        stack.push({ indent, container: newObj, type: 'map' });

        if (rawVal === '') {
          const childObj = {};
          newObj[key] = childObj;
          stack.push({ indent: indent + 2, container: childObj, type: 'map' });
        } else if (rawVal === '|' || rawVal === '|-') {
          stack.push({
            indent: indent + 2,
            inPipeBlock: true,
            pipeIndent: indent,
            pipeLines: [],
            target: newObj,
            targetKey: key
          });
        } else {
          newObj[key] = parseScalar(rawVal);
        }
      } else {
        seqContainer.push(parseScalar(itemContent));
      }
    } else if (text.includes(':')) {
      const colonIdx = text.indexOf(':');
      const key = text.slice(0, colonIdx).trim();
      const rawVal = text.slice(colonIdx + 1).trim();

      if (rawVal === '') {
        // Lookahead to check if next line is sequence item or map
        let nextIndent = -1;
        let isNextSeq = false;
        for (let j = lineNum; j < lines.length; j++) {
          const nLine = lines[j];
          if (nLine.trim() && !nLine.trim().startsWith('#')) {
            nextIndent = nLine.search(/\S/);
            isNextSeq = nLine.trim().startsWith('- ');
            break;
          }
        }

        if (isNextSeq) {
          const newSeq = [];
          parent.container[key] = newSeq;
          stack.push({ indent, container: newSeq, type: 'seq' });
        } else {
          const newMap = {};
          parent.container[key] = newMap;
          stack.push({ indent, container: newMap, type: 'map' });
        }
      } else if (rawVal === '|' || rawVal === '|-') {
        stack.push({
          indent,
          inPipeBlock: true,
          pipeIndent: indent,
          pipeLines: [],
          target: parent.container,
          targetKey: key
        });
      } else {
        parent.container[key] = parseScalar(rawVal);
      }
    } else {
      throw new Error(`Line ${lineNum}: Invalid YAML syntax: "${text}"`);
    }
  }

  // Flush any open pipe block
  while (stack.length > 0) {
    const popped = stack.pop();
    if (popped.inPipeBlock) {
      popped.target[popped.targetKey] = popped.pipeLines.join('\n');
    }
  }

  return root;
}

function parseScalar(val) {
  if (val.startsWith('[') && val.endsWith(']')) {
    return val.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
  }
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
    return val.slice(1, -1);
  }
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (/^-?\d+$/.test(val)) return parseInt(val, 10);
  if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val);
  return val;
}

function validateWorkflow(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`Validating YAML syntax for: ${filePath}`);
  const parsed = parseSimpleYaml(content);

  // Assertions on parsed schema
  if (!parsed.name) throw new Error('Missing "name" property');
  if (!parsed.on) throw new Error('Missing "on" trigger property');
  if (!parsed.permissions || parsed.permissions.contents !== 'read') {
    throw new Error('Workflow level permissions must include contents: read');
  }
  if (!parsed.jobs || !parsed.jobs.test) throw new Error('Missing jobs.test');

  const testJob = parsed.jobs.test;
  if (testJob['timeout-minutes'] !== 30) {
    throw new Error(`Expected timeout-minutes: 30, got ${testJob['timeout-minutes']}`);
  }
  if (!testJob.permissions || testJob.permissions.contents !== 'read') {
    throw new Error('jobs.test permissions must include contents: read');
  }

  const steps = testJob.steps;
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error('jobs.test.steps must be a non-empty array');
  }

  const setupNode = steps.find(s => s.uses && s.uses.startsWith('actions/setup-node'));
  if (!setupNode || setupNode.with['node-version'] !== '24') {
    throw new Error(`Expected node-version: '24', got ${setupNode ? JSON.stringify(setupNode.with) : 'none'}`);
  }

  const installBrowsers = steps.find(s => s.run && s.run.includes('playwright install'));
  if (!installBrowsers || !installBrowsers.run.includes('chromium') || !installBrowsers.run.includes('webkit')) {
    throw new Error('Playwright install step must include both chromium and webkit');
  }

  const browserStep = steps.find(s => s.run && s.run.includes('test:browser'));
  if (!browserStep || !browserStep.env || browserStep.env.CI !== true) {
    throw new Error('Browser test step must explicitly set CI: true');
  }

  console.log('YAML Syntax: VALID');
  console.log('Workflow Structure: VALID');
  console.log('Parsed Summary:');
  console.log(`- Workflow: "${parsed.name}"`);
  console.log(`- Triggers: ${Object.keys(parsed.on).join(', ')}`);
  console.log(`- Job: test (runs-on: ${testJob['runs-on']}, timeout-minutes: ${testJob['timeout-minutes']})`);
  console.log(`- Permissions: contents: ${testJob.permissions.contents}`);
  console.log(`- Node Version: ${setupNode.with['node-version']}`);
  console.log(`- Playwright Install: ${installBrowsers.run}`);
  console.log(`- Browser Test CI Env: CI=${browserStep.env.CI}`);
  console.log(`- Total Steps: ${steps.length}`);

  return parsed;
}

if (require.main === module) {
  const targetFile = path.resolve(__dirname, '../.github/workflows/test.yml');
  try {
    validateWorkflow(targetFile);
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ YAML Validation Failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { parseSimpleYaml, validateWorkflow };
