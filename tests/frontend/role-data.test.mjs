import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizedRoles,defaultAuthorizedRole,roleDataPlan} from '../../src/live/role-data.js';

const context = {
  operational_roles_enabled: true,
  centres: [
    {id:'all',roles:['Leadership'],can_write:false,can_read_profiles:false},
    {id:'cluster',roles:['Leadership','Cluster Officer'],can_write:true,can_read_profiles:false},
    {id:'teacher',roles:['Leadership','Teacher'],can_write:true,can_read_profiles:true},
  ],
};

test('approved multi-role accounts start with their operational Cluster Officer role',()=>{
  assert.deepEqual(authorizedRoles(context),['Leadership','Cluster Officer','Teacher']);
  assert.equal(defaultAuthorizedRole(context),'Cluster Officer');
});

test('each role loads only its own required centre details',()=>{
  const cluster=roleDataPlan(context,'Cluster Officer',{aggregateApi:true});
  assert.deepEqual(cluster.centres.map(centre=>centre.id),['cluster']);
  assert.deepEqual(cluster.detailedCentres.map(centre=>centre.id),['cluster']);
  const teacher=roleDataPlan(context,'Teacher',{aggregateApi:true});
  assert.deepEqual(teacher.centres.map(centre=>centre.id),['teacher']);
  assert.deepEqual(teacher.detailedCentres.map(centre=>centre.id),['teacher']);
  const leadership=roleDataPlan(context,'Leadership',{aggregateApi:true});
  assert.deepEqual(leadership.centres.map(centre=>centre.id),['all','cluster','teacher']);
  assert.deepEqual(leadership.detailedCentres,[]);
});

test('unknown roles are denied and aggregate fallback is explicit',()=>{
  assert.throws(()=>roleDataPlan(context,'Administrator'),/authorized role/);
  assert.deepEqual(roleDataPlan(context,'Leadership',{aggregateApi:false}).detailedCentres.map(centre=>centre.id),['all','cluster','teacher']);
});
