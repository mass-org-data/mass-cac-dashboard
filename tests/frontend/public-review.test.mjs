import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {emptyPublicProgramme,PUBLIC_DATA_NOTICE} from '../../src/live/public-review.js';

test('public dashboard has unknown coverage, no people and no fabricated observations',()=>{
 const first=emptyPublicProgramme(),second=emptyPublicProgramme();
 assert.equal(first.visitAvailable,false);assert.equal(first.academicYear,'');assert.equal(first.lastSaved,null);
 for(const key of ['students','events','visits','morarjiHistory','sessions'])assert.deepEqual(first[key],[]);
 for(const key of ['attendance','scores','assessmentDetails','attendanceRecords','visitSummary'])assert.deepEqual(first[key],{});
 first.students.push({synthetic:true});assert.equal(second.students.length,0);
 assert.match(PUBLIC_DATA_NOTICE,/Access approval pending/);
});
test('download allowlist excludes internal audit and source-derived reports',async()=>{
 const archive=JSON.parse(await readFile('source-archive.manifest.json','utf8'));
 assert(archive.files.includes('src/live/public-review.js'));
 assert(!archive.files.some(path=>path.startsWith('docs/')));
});
